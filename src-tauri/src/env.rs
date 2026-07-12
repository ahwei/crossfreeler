use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager, State};

use crate::config::{self, AppConfig};
use crate::ConfigState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WineInfo {
    pub path: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvStatus {
    pub rosetta: bool,
    pub wine: Option<WineInfo>,
    pub staging: Option<WineInfo>,
    /// CrossOver 系引擎（WhiskyWine / CrossOver / GPTK）— 能跑 Themida/WinLicense 保護的遊戲
    pub crossover: Option<WineInfo>,
    pub winetricks: Option<String>,
}

fn is_executable(path: &PathBuf) -> bool {
    path.is_file()
}

/// 尋找 CrossOver 系 wine（WhiskyWine / CrossOver.app / CrossFreeler 自帶）。
/// 這類引擎含商業保護殼（Themida/WinLicense/GameGuard）相容修改。
fn crossover_wine(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(data) = config::data_dir(app) {
        // CrossFreeler 未來自帶的 crossover runtime
        candidates.push(data.join("runtime/crossover/bin/wine64"));
        candidates.push(data.join("runtime/crossover/bin/wine"));
    }
    // 真正的 CrossOver.app（版本最新、相容性最好，優先於 WhiskyWine）
    const CX_WINE: &str = "Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine";
    if let Ok(home) = app.path().home_dir() {
        candidates.push(home.join(CX_WINE));
    }
    candidates.push(PathBuf::from("/").join(CX_WINE));
    if let Ok(home) = app.path().home_dir() {
        // 借用已安裝的 WhiskyWine（CrossOver 22 fork，較舊）
        candidates.push(
            home.join("Library/Application Support/com.isaacmarovitz.Whisky/Libraries/Wine/bin/wine64"),
        );
    }
    candidates.into_iter().find(is_executable)
}

/// 尋找 staging runtime 目錄（runtime/wine-staging-*）
fn staging_wine(app: &AppHandle) -> Option<PathBuf> {
    let runtime = config::data_dir(app).ok()?.join("runtime");
    let entries = std::fs::read_dir(&runtime).ok()?;
    let mut dirs: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("wine-staging-"))
                .unwrap_or(false)
        })
        .collect();
    dirs.sort();
    let wine = dirs.pop()?.join("bin/wine");
    is_executable(&wine).then_some(wine)
}

fn stable_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(dir) = config::data_dir(app) {
        candidates.push(dir.join("runtime/current/bin/wine"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/wine"));
    candidates.push(PathBuf::from("/usr/local/bin/wine"));
    candidates.push(PathBuf::from(
        "/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine",
    ));
    candidates
}

pub fn wine_version(path: &PathBuf) -> Option<String> {
    let out = Command::new(path).arg("--version").output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// 依 bottle 的 runtime channel 解析 wine 路徑。
/// config.winePath 為使用者手動覆寫，優先於一切。
pub fn resolve_wine(app: &AppHandle, config: &AppConfig, runtime: &str) -> Option<PathBuf> {
    if let Some(overridden) = &config.wine_path {
        let p = PathBuf::from(overridden);
        if is_executable(&p) {
            return Some(p);
        }
    }
    if runtime == "crossover" {
        if let Some(p) = crossover_wine(app) {
            return Some(p);
        }
        // 找不到 CrossOver 系引擎時退回 stable
    }
    if runtime == "staging" {
        if let Some(p) = staging_wine(app) {
            return Some(p);
        }
        // staging 不存在時退回 stable
    }
    stable_candidates(app).into_iter().find(is_executable)
}

pub fn find_winetricks() -> Option<String> {
    for p in ["/opt/homebrew/bin/winetricks", "/usr/local/bin/winetricks"] {
        if PathBuf::from(p).is_file() {
            return Some(p.to_string());
        }
    }
    let out = Command::new("/usr/bin/which").arg("winetricks").output().ok()?;
    if out.status.success() {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !s.is_empty() {
            return Some(s);
        }
    }
    None
}

fn rosetta_installed() -> bool {
    Command::new("/usr/bin/pgrep")
        .arg("oahd")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn detect_environment(app: AppHandle, state: State<'_, ConfigState>) -> Result<EnvStatus, String> {
    let config = state.0.lock().unwrap().clone();

    let wine = resolve_wine(&app, &config, "stable").and_then(|p| {
        wine_version(&p).map(|version| WineInfo { path: p.display().to_string(), version })
    });
    let staging = staging_wine(&app).and_then(|p| {
        wine_version(&p).map(|version| WineInfo { path: p.display().to_string(), version })
    });
    let crossover = crossover_wine(&app).and_then(|p| {
        wine_version(&p).map(|version| WineInfo { path: p.display().to_string(), version })
    });

    Ok(EnvStatus {
        rosetta: rosetta_installed(),
        wine,
        staging,
        crossover,
        winetricks: find_winetricks(),
    })
}

#[tauri::command]
pub fn set_wine_path(
    app: AppHandle,
    state: State<'_, ConfigState>,
    path: Option<String>,
) -> Result<(), String> {
    if let Some(p) = &path {
        let pb = PathBuf::from(p);
        if !is_executable(&pb) {
            return Err(format!("找不到可執行的 wine：{p}"));
        }
    }
    let mut config = state.0.lock().unwrap();
    config.wine_path = path;
    config::save(&app, &config)
}
