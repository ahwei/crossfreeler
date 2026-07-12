use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub bottle_id: String,
    pub line: String,
    pub stream: String,
}

pub fn emit_log(app: &AppHandle, bottle_id: &str, line: &str, stream: &str) {
    let _ = app.emit(
        "bottle-log",
        LogLine {
            bottle_id: bottle_id.to_string(),
            line: line.to_string(),
            stream: stream.to_string(),
        },
    );
}

/// 建立乾淨環境的指令：白名單環境變數 + WINEPREFIX + bottle 自訂值。
/// cwd 一律設在 prefix 內或呼叫端指定的目錄（避免繼承 app 的 cwd，
/// 否則自解壓安裝檔會把內容解到 app 工作目錄）。
pub fn build_command(
    program: &Path,
    args: &[String],
    prefix: &Path,
    wine_bin_dir: &Path,
    extra_env: &HashMap<String, String>,
) -> Command {
    let mut cmd = Command::new(program);
    cmd.args(args);
    cmd.current_dir(if prefix.is_dir() { prefix } else { Path::new("/tmp") });
    cmd.env_clear();
    for key in ["HOME", "USER", "LOGNAME", "TMPDIR", "LANG", "LC_ALL"] {
        if let Ok(v) = std::env::var(key) {
            cmd.env(key, v);
        }
    }
    cmd.env(
        "PATH",
        format!(
            "{}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin",
            wine_bin_dir.display()
        ),
    );
    cmd.env("WINEPREFIX", prefix);
    for (k, v) in extra_env {
        cmd.env(k, v);
    }
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd
}

/// 過濾掉會洗版又無資訊量的行（MoltenVK/Vulkan 能力清單、SEH unwind trace）。
fn is_noise(line: &str) -> bool {
    let l = line.trim_start();
    l.starts_with("[mvk-info]")
        || l.starts_with("VK_")
        || l.starts_with("trace:seh:")
        || l.contains("GPU Family")
        || l.contains("Metal Shading Language")
        || l.contains("Read-Write Texture")
        || l.contains("the following")
        || l.contains("supports the")
        || (l.starts_with("model:") || l.starts_with("type:"))
        || l.contains("vendorID")
        || l.contains("deviceID")
        || l.contains("pipelineCacheUUID")
        || l.contains("GPU memory")
}

fn pipe_logs(app: &AppHandle, bottle_id: &str, child: &mut tokio::process::Child) {
    if let Some(out) = child.stdout.take() {
        let app = app.clone();
        let id = bottle_id.to_string();
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if !is_noise(&line) {
                    emit_log(&app, &id, &line, "stdout");
                }
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let app = app.clone();
        let id = bottle_id.to_string();
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if !is_noise(&line) {
                    emit_log(&app, &id, &line, "stderr");
                }
            }
        });
    }
}

/// 執行並等待結束（建 bottle、winetricks 等長任務）。
pub async fn run_and_wait(app: &AppHandle, bottle_id: &str, mut cmd: Command) -> Result<(), String> {
    let mut child = cmd.spawn().map_err(|e| format!("無法啟動程序：{e}"))?;
    pipe_logs(app, bottle_id, &mut child);
    let status = child.wait().await.map_err(|e| format!("等待程序失敗：{e}"))?;
    emit_log(
        app,
        bottle_id,
        &format!("[程序結束，exit code: {}]", status.code().map_or("?".into(), |c| c.to_string())),
        "stdout",
    );
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "程序以非零狀態結束（exit code: {}）",
            status.code().map_or("?".into(), |c| c.to_string())
        ))
    }
}

/// 執行但不等待（啟動應用程式／遊戲），結束時發 log 事件。回傳 pid。
/// exe_path 是啟動來源（捷徑/程式路徑），會附在 program-exited 事件裡
/// 讓前端解除該程式的「執行中」狀態；winecfg 這類內建工具傳 None。
pub fn run_detached(
    app: &AppHandle,
    bottle_id: &str,
    mut cmd: Command,
    exe_path: Option<String>,
) -> Result<u32, String> {
    let mut child = cmd.spawn().map_err(|e| format!("無法啟動程序：{e}"))?;
    let pid = child.id().unwrap_or(0);
    pipe_logs(app, bottle_id, &mut child);
    let app = app.clone();
    let id = bottle_id.to_string();
    tokio::spawn(async move {
        if let Ok(status) = child.wait().await {
            emit_log(
                &app,
                &id,
                &format!("[程序結束，exit code: {}]", status.code().map_or("?".into(), |c| c.to_string())),
                "stdout",
            );
        }
        // 通知前端（解除執行中狀態、重新整理已安裝清單）
        let _ = app.emit(
            "program-exited",
            serde_json::json!({ "bottleId": id, "exePath": exe_path, "pid": pid }),
        );
    });
    Ok(pid)
}
