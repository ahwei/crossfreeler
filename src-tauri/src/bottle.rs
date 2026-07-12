use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, State};

use crate::config::{self, AppConfig, Bottle, DisplaySettings, Shortcut};
use crate::env as wenv;
use crate::runner;
use crate::ConfigState;

/// 建立 bottle 過程的 log 頻道 id（bottle 尚未有正式 id）
const CREATE_CHANNEL: &str = "__create__";

struct BottleCtx {
    prefix: PathBuf,
    wine: PathBuf,
    wine_bin_dir: PathBuf,
    env: HashMap<String, String>,
}

fn ctx(app: &AppHandle, config: &AppConfig, bottle_id: &str) -> Result<BottleCtx, String> {
    let bottle = config
        .bottles
        .iter()
        .find(|b| b.id == bottle_id)
        .ok_or_else(|| "找不到此 Bottle".to_string())?;
    let wine = wenv::resolve_wine(app, config, &bottle.runtime)
        .ok_or_else(|| "找不到 Wine，請先於環境頁安裝或指定路徑".to_string())?;
    let wine_bin_dir = wine
        .parent()
        .ok_or_else(|| "Wine 路徑異常".to_string())?
        .to_path_buf();
    let prefix = config::bottles_dir(app)?.join(&bottle.id);
    Ok(BottleCtx {
        prefix,
        wine,
        wine_bin_dir,
        env: bottle.env_vars.clone(),
    })
}

#[tauri::command]
pub fn load_config(state: State<'_, ConfigState>) -> Result<AppConfig, String> {
    Ok(state.0.lock().unwrap().clone())
}

#[tauri::command]
pub async fn create_bottle(
    app: AppHandle,
    state: State<'_, ConfigState>,
    name: String,
    windows_version: String,
    runtime: String,
    env_vars: HashMap<String, String>,
) -> Result<Bottle, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名稱不可為空".into());
    }
    let (wine, duplicated) = {
        let config = state.0.lock().unwrap();
        (
            wenv::resolve_wine(&app, &config, &runtime),
            config.bottles.iter().any(|b| b.name == name),
        )
    };
    if duplicated {
        return Err(format!("已存在名為「{name}」的 Bottle"));
    }
    let wine = wine.ok_or_else(|| "找不到 Wine，請先於環境頁安裝或指定路徑".to_string())?;
    let wine_bin_dir = wine.parent().unwrap().to_path_buf();

    let id = uuid::Uuid::new_v4().to_string();
    let prefix = config::bottles_dir(&app)?.join(&id);
    std::fs::create_dir_all(&prefix).map_err(|e| format!("建立 Bottle 目錄失敗：{e}"))?;

    runner::emit_log(&app, CREATE_CHANNEL, &format!("初始化 Wine prefix（{name}）…"), "stdout");
    let mut base_env = env_vars.clone();
    base_env.insert("WINEARCH".into(), "win64".into());

    let cmd = runner::build_command(
        &wine,
        &["wineboot".into(), "--init".into()],
        &prefix,
        &wine_bin_dir,
        &base_env,
    );
    if let Err(e) = runner::run_and_wait(&app, CREATE_CHANNEL, cmd).await {
        let _ = std::fs::remove_dir_all(&prefix);
        return Err(format!("初始化 prefix 失敗：{e}"));
    }

    runner::emit_log(&app, CREATE_CHANNEL, &format!("設定 Windows 版本為 {windows_version}…"), "stdout");
    let cmd = runner::build_command(
        &wine,
        &["winecfg".into(), "-v".into(), windows_version.clone()],
        &prefix,
        &wine_bin_dir,
        &base_env,
    );
    if let Err(e) = runner::run_and_wait(&app, CREATE_CHANNEL, cmd).await {
        runner::emit_log(&app, CREATE_CHANNEL, &format!("設定 Windows 版本失敗（不影響使用）：{e}"), "stderr");
    }

    let bottle = Bottle {
        id,
        name,
        created_at: chrono::Utc::now().to_rfc3339(),
        windows_version,
        runtime,
        env_vars,
        shortcuts: Vec::new(),
        display: DisplaySettings::default(),
    };
    {
        let mut config = state.0.lock().unwrap();
        config.bottles.push(bottle.clone());
        config::save(&app, &config)?;
    }
    runner::emit_log(&app, CREATE_CHANNEL, "Bottle 建立完成 ✓", "stdout");
    Ok(bottle)
}

#[tauri::command]
pub fn rename_bottle(app: AppHandle, state: State<'_, ConfigState>, id: String, name: String) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名稱不可為空".into());
    }
    let mut config = state.0.lock().unwrap();
    if config.bottles.iter().any(|b| b.name == name && b.id != id) {
        return Err(format!("已存在名為「{name}」的 Bottle"));
    }
    let bottle = config.bottles.iter_mut().find(|b| b.id == id).ok_or("找不到此 Bottle")?;
    bottle.name = name;
    config::save(&app, &config)
}

#[tauri::command]
pub async fn kill_bottle(app: AppHandle, state: State<'_, ConfigState>, id: String) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &id)?
    };
    let wineserver = c.wine_bin_dir.join("wineserver");
    if !wineserver.is_file() {
        return Err("找不到 wineserver".into());
    }
    let cmd = runner::build_command(&wineserver, &["-k".into()], &c.prefix, &c.wine_bin_dir, &c.env);
    // wineserver -k 對「沒有執行中程序」會回非零，不視為錯誤
    let _ = runner::run_and_wait(&app, &id, cmd).await;
    Ok(())
}

#[tauri::command]
pub async fn delete_bottle(app: AppHandle, state: State<'_, ConfigState>, id: String) -> Result<(), String> {
    // 先關掉該 prefix 的所有 wine 程序（失敗不阻擋刪除）
    let _ = kill_bottle(app.clone(), state.clone(), id.clone()).await;

    let prefix = config::bottles_dir(&app)?.join(&id);
    if prefix.exists() {
        std::fs::remove_dir_all(&prefix).map_err(|e| format!("刪除 Bottle 目錄失敗：{e}"))?;
    }
    let mut config = state.0.lock().unwrap();
    config.bottles.retain(|b| b.id != id);
    config::save(&app, &config)
}

#[tauri::command]
pub fn open_drive_c(app: AppHandle, state: State<'_, ConfigState>, id: String) -> Result<(), String> {
    let config = state.0.lock().unwrap();
    let c = ctx(&app, &config, &id)?;
    let drive_c = c.prefix.join("drive_c");
    if !drive_c.exists() {
        return Err("此 Bottle 尚未初始化完成（找不到 drive_c）".into());
    }
    std::process::Command::new("/usr/bin/open")
        .arg(drive_c)
        .spawn()
        .map_err(|e| format!("開啟 Finder 失敗：{e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn run_winecfg(app: AppHandle, state: State<'_, ConfigState>, id: String) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &id)?
    };
    let cmd = runner::build_command(&c.wine, &["winecfg".into()], &c.prefix, &c.wine_bin_dir, &c.env);
    runner::run_detached(&app, &id, cmd, None)?;
    Ok(())
}

#[tauri::command]
pub fn update_bottle_env(
    app: AppHandle,
    state: State<'_, ConfigState>,
    id: String,
    env: HashMap<String, String>,
) -> Result<(), String> {
    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == id).ok_or("找不到此 Bottle")?;
    bottle.env_vars = env;
    config::save(&app, &config)
}

#[tauri::command]
pub async fn set_windows_version(
    app: AppHandle,
    state: State<'_, ConfigState>,
    id: String,
    version: String,
) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &id)?
    };
    let cmd = runner::build_command(
        &c.wine,
        &["winecfg".into(), "-v".into(), version.clone()],
        &c.prefix,
        &c.wine_bin_dir,
        &c.env,
    );
    runner::run_and_wait(&app, &id, cmd).await?;
    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == id).ok_or("找不到此 Bottle")?;
    bottle.windows_version = version;
    config::save(&app, &config)
}

#[tauri::command]
pub async fn run_program(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    exe_path: String,
    args: String,
    name: Option<String>,
) -> Result<u32, String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let lower = exe_path.to_lowercase();
    let mut wine_args: Vec<String> = if lower.ends_with(".msi") {
        vec!["msiexec".into(), "/i".into(), exe_path.clone()]
    } else if lower.ends_with(".bat") {
        vec!["cmd".into(), "/c".into(), exe_path.clone()]
    } else {
        vec![exe_path.clone()]
    };
    // 簡易參數切割（v1 限制：不支援含空白的引號參數）
    wine_args.extend(args.split_whitespace().map(String::from));

    // macOS 上顯示的程式名：捷徑名 > exe 檔名
    let app_name = name.filter(|n| !n.trim().is_empty()).unwrap_or_else(|| {
        PathBuf::from(&exe_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "App".into())
    });

    runner::emit_log(&app, &bottle_id, &format!("啟動：{app_name}"), "stdout");
    let mut cmd = runner::build_named_command(&app_name, &c.wine, &wine_args, &c.prefix, &c.wine_bin_dir, &c.env);
    // Windows 程式預期 cwd = 程式所在目錄（自解壓檔也會解到這裡）
    if let Some(parent) = PathBuf::from(&exe_path).parent().filter(|p| p.is_dir()) {
        cmd.current_dir(parent);
    }
    runner::run_detached(&app, &bottle_id, cmd, Some(exe_path))
}

#[tauri::command]
pub async fn run_winetricks(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    verbs: Vec<String>,
) -> Result<(), String> {
    if verbs.is_empty() {
        return Err("請至少選擇一個元件".into());
    }
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let winetricks =
        wenv::find_winetricks().ok_or("找不到 winetricks，請先執行 brew install winetricks")?;
    let mut env = c.env.clone();
    env.insert("WINE".into(), c.wine.display().to_string());

    let mut args: Vec<String> = vec!["-q".into()];
    args.extend(verbs);
    runner::emit_log(&app, &bottle_id, &format!("winetricks 開始安裝：{}", args.join(" ")), "stdout");
    let cmd = runner::build_command(&PathBuf::from(winetricks), &args, &c.prefix, &c.wine_bin_dir, &env);
    runner::run_and_wait(&app, &bottle_id, cmd).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledProgram {
    pub key: String,
    pub name: String,
}

#[tauri::command]
pub async fn list_programs(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
) -> Result<Vec<InstalledProgram>, String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let mut cmd = runner::build_command(
        &c.wine,
        &["uninstaller".into(), "--list".into()],
        &c.prefix,
        &c.wine_bin_dir,
        &c.env,
    );
    let out = cmd.output().await.map_err(|e| format!("執行 uninstaller 失敗：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    // 每行格式：<registry key>|||<顯示名稱>
    let programs = stdout
        .lines()
        .filter_map(|line| line.split_once("|||"))
        .map(|(key, name)| InstalledProgram {
            key: key.trim().to_string(),
            name: name.trim().to_string(),
        })
        .collect();
    Ok(programs)
}

#[tauri::command]
pub async fn uninstall_program(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    key: String,
) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let cmd = runner::build_command(
        &c.wine,
        &["uninstaller".into(), "--remove".into(), key],
        &c.prefix,
        &c.wine_bin_dir,
        &c.env,
    );
    runner::run_detached(&app, &bottle_id, cmd, None)?;
    Ok(())
}

#[tauri::command]
pub async fn open_uninstaller(app: AppHandle, state: State<'_, ConfigState>, bottle_id: String) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let cmd = runner::build_command(&c.wine, &["uninstaller".into()], &c.prefix, &c.wine_bin_dir, &c.env);
    runner::run_detached(&app, &bottle_id, cmd, None)?;
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExeEntry {
    pub name: String,
    pub path: String,
}

const EXE_BLOCKLIST: &[&str] = &[
    "unins", "uninst", "setup", "install", "vcredist", "vc_redist", "dxsetup", "dxwebsetup",
    "crashreport", "crashhandler", "updater", "patcher_hash",
];

fn walk_exes(dir: &std::path::Path, depth: u32, out: &mut Vec<ExeEntry>) {
    if depth == 0 || out.len() >= 500 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_exes(&path, depth - 1, out);
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            let lower = name.to_lowercase();
            if lower.ends_with(".exe") && !EXE_BLOCKLIST.iter().any(|b| lower.contains(b)) {
                out.push(ExeEntry {
                    name: name.to_string(),
                    path: path.display().to_string(),
                });
            }
        }
    }
}

/// 掃描 bottle 的 Program Files 目錄找可執行檔（供「從已安裝建立捷徑」用）
#[tauri::command]
pub fn list_exes(app: AppHandle, state: State<'_, ConfigState>, bottle_id: String) -> Result<Vec<ExeEntry>, String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let drive_c = c.prefix.join("drive_c");
    let mut out = Vec::new();
    for dir in ["Program Files", "Program Files (x86)"] {
        walk_exes(&drive_c.join(dir), 4, &mut out);
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

/// 回傳 bottle 的 drive_c 絕對路徑（供前端 file dialog 當預設目錄）
#[tauri::command]
pub fn drive_c_path(app: AppHandle, state: State<'_, ConfigState>, bottle_id: String) -> Result<String, String> {
    let config = state.0.lock().unwrap();
    let c = ctx(&app, &config, &bottle_id)?;
    Ok(c.prefix.join("drive_c").display().to_string())
}

/// 在 bottle 內執行 `wine reg add/…`，等待完成。
async fn run_reg(app: &AppHandle, bottle_id: &str, c: &BottleCtx, args: &[&str]) -> Result<(), String> {
    let owned: Vec<String> = std::iter::once("reg".to_string())
        .chain(args.iter().map(|s| s.to_string()))
        .collect();
    let mut cmd = runner::build_command(&c.wine, &owned, &c.prefix, &c.wine_bin_dir, &c.env);
    // reg 不需要圖形；靜音 debug
    cmd.env("WINEDEBUG", "-all");
    runner::run_and_wait(app, bottle_id, cmd).await
}

const MAC_CJK_FONTS: &[&str] = &[
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Supplemental/Microsoft Sans Serif.ttf",
    "/System/Library/Fonts/Supplemental/Tahoma.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
];

// 把常見 Windows 字型名導向含完整 CJK 的字型
const FONT_SUBSTITUTES: &[(&str, &str)] = &[
    ("MS Shell Dlg", "Arial Unicode MS"),
    ("MS Shell Dlg 2", "Arial Unicode MS"),
    ("Tahoma", "Arial Unicode MS"),
    ("Microsoft Sans Serif", "Arial Unicode MS"),
    ("MS Sans Serif", "Arial Unicode MS"),
    ("MS Gothic", "Arial Unicode MS"),
    ("MS UI Gothic", "Arial Unicode MS"),
    ("SimSun", "Arial Unicode MS"),
    ("NSimSun", "Arial Unicode MS"),
    ("PMingLiU", "Arial Unicode MS"),
    ("MingLiU", "Arial Unicode MS"),
    ("Microsoft YaHei", "Arial Unicode MS"),
    ("Microsoft JhengHei", "Arial Unicode MS"),
];

/// 一鍵：注入 macOS 內建字型（含微軟系字型）並設定字型替換，修正亂碼。
#[tauri::command]
pub async fn install_fonts(app: AppHandle, state: State<'_, ConfigState>, bottle_id: String) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };
    let fonts_dir = c.prefix.join("drive_c/windows/Fonts");
    std::fs::create_dir_all(&fonts_dir).map_err(|e| format!("建立字型目錄失敗：{e}"))?;

    let mut copied = 0;
    for src in MAC_CJK_FONTS {
        let p = std::path::Path::new(src);
        if p.is_file() {
            if let Some(name) = p.file_name() {
                if std::fs::copy(p, fonts_dir.join(name)).is_ok() {
                    copied += 1;
                }
            }
        }
    }
    runner::emit_log(&app, &bottle_id, &format!("已複製 {copied} 個字型檔，設定字型替換…"), "stdout");

    let key = r"HKLM\Software\Microsoft\Windows NT\CurrentVersion\FontSubstitutes";
    for (from, to) in FONT_SUBSTITUTES {
        run_reg(&app, &bottle_id, &c, &["add", key, "/v", from, "/d", to, "/f"]).await?;
    }
    runner::emit_log(&app, &bottle_id, "字型安裝完成 ✓（重開遊戲生效）", "stdout");
    Ok(())
}

/// 套用顯示設定（Retina / DPI / 虛擬桌面），並存回 config。
#[tauri::command]
pub async fn set_display(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    display: DisplaySettings,
) -> Result<(), String> {
    let c = {
        let config = state.0.lock().unwrap();
        ctx(&app, &config, &bottle_id)?
    };

    // Retina（HiDPI）
    run_reg(
        &app,
        &bottle_id,
        &c,
        &[
            "add",
            r"HKCU\Software\Wine\Mac Driver",
            "/v",
            "RetinaMode",
            "/d",
            if display.retina { "y" } else { "n" },
            "/f",
        ],
    )
    .await?;

    // DPI
    let dpi = display.dpi.clamp(96, 240).to_string();
    run_reg(
        &app,
        &bottle_id,
        &c,
        &["add", r"HKCU\Control Panel\Desktop", "/v", "LogPixels", "/t", "REG_DWORD", "/d", &dpi, "/f"],
    )
    .await?;

    // 虛擬桌面
    match &display.virtual_desktop {
        Some(size) if !size.is_empty() => {
            run_reg(
                &app,
                &bottle_id,
                &c,
                &["add", r"HKCU\Software\Wine\Explorer\Desktops", "/v", "Default", "/d", size, "/f"],
            )
            .await?;
            run_reg(
                &app,
                &bottle_id,
                &c,
                &["add", r"HKCU\Software\Wine\Explorer", "/v", "Desktop", "/d", "Default", "/f"],
            )
            .await?;
        }
        _ => {
            let _ = run_reg(
                &app,
                &bottle_id,
                &c,
                &["delete", r"HKCU\Software\Wine\Explorer", "/v", "Desktop", "/f"],
            )
            .await;
        }
    }

    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == bottle_id).ok_or("找不到此 Bottle")?;
    bottle.display = display;
    config::save(&app, &config)?;
    runner::emit_log(&app, &bottle_id, "顯示設定已套用 ✓", "stdout");
    Ok(())
}

/// 從 exe 抽出圖示，回傳 PNG 的 data URL；失敗回 None（前端用預設圖示）。
#[tauri::command]
pub fn extract_icon(path: String) -> Option<String> {
    crate::icon::extract_png_data_url(&path)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInput {
    pub name: String,
    pub exe_path: String,
    #[serde(default)]
    pub args: String,
}

#[tauri::command]
pub fn add_shortcut(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    shortcut: ShortcutInput,
) -> Result<Shortcut, String> {
    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == bottle_id).ok_or("找不到此 Bottle")?;
    let s = Shortcut {
        id: uuid::Uuid::new_v4().to_string(),
        name: shortcut.name,
        exe_path: shortcut.exe_path,
        args: shortcut.args,
    };
    bottle.shortcuts.push(s.clone());
    config::save(&app, &config)?;
    Ok(s)
}

#[tauri::command]
pub fn update_shortcut(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    shortcut: Shortcut,
) -> Result<(), String> {
    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == bottle_id).ok_or("找不到此 Bottle")?;
    let existing = bottle
        .shortcuts
        .iter_mut()
        .find(|s| s.id == shortcut.id)
        .ok_or("找不到此捷徑")?;
    *existing = shortcut;
    config::save(&app, &config)
}

#[tauri::command]
pub fn remove_shortcut(
    app: AppHandle,
    state: State<'_, ConfigState>,
    bottle_id: String,
    shortcut_id: String,
) -> Result<(), String> {
    let mut config = state.0.lock().unwrap();
    let bottle = config.bottles.iter_mut().find(|b| b.id == bottle_id).ok_or("找不到此 Bottle")?;
    bottle.shortcuts.retain(|s| s.id != shortcut_id);
    config::save(&app, &config)
}
