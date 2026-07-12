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
pub fn build_command(
    program: &Path,
    args: &[String],
    prefix: &Path,
    wine_bin_dir: &Path,
    extra_env: &HashMap<String, String>,
) -> Command {
    let mut cmd = Command::new(program);
    cmd.args(args);
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

fn pipe_logs(app: &AppHandle, bottle_id: &str, child: &mut tokio::process::Child) {
    if let Some(out) = child.stdout.take() {
        let app = app.clone();
        let id = bottle_id.to_string();
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit_log(&app, &id, &line, "stdout");
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let app = app.clone();
        let id = bottle_id.to_string();
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit_log(&app, &id, &line, "stderr");
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
pub fn run_detached(app: &AppHandle, bottle_id: &str, mut cmd: Command) -> Result<u32, String> {
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
    });
    Ok(pid)
}
