use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shortcut {
    pub id: String,
    pub name: String,
    pub exe_path: String,
    #[serde(default)]
    pub args: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bottle {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub windows_version: String,
    #[serde(default = "default_runtime")]
    pub runtime: String,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub shortcuts: Vec<Shortcut>,
    #[serde(default)]
    pub display: DisplaySettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySettings {
    #[serde(default)]
    pub retina: bool,
    #[serde(default = "default_dpi")]
    pub dpi: u32,
    /// 虛擬桌面解析度，如 "1024x768"；None = 關閉（全螢幕直接輸出）
    #[serde(default)]
    pub virtual_desktop: Option<String>,
}

impl Default for DisplaySettings {
    fn default() -> Self {
        Self { retina: false, dpi: 96, virtual_desktop: None }
    }
}

fn default_dpi() -> u32 {
    96
}

fn default_runtime() -> String {
    "stable".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub wine_path: Option<String>,
    pub bottles: Vec<Bottle>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self { version: 1, wine_path: None, bottles: Vec::new() }
    }
}

pub fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| format!("找不到家目錄：{e}"))?;
    Ok(home.join("Library/Application Support/CrossFreeler"))
}

pub fn bottles_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("bottles"))
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("config.json"))
}

pub fn load(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("讀取設定檔失敗：{e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("設定檔格式錯誤：{e}"))
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("建立設定目錄失敗：{e}"))?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw).map_err(|e| format!("寫入設定失敗：{e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("寫入設定失敗：{e}"))?;
    Ok(())
}
