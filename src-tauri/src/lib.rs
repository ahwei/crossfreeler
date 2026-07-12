mod bottle;
mod config;
mod env;
mod runner;

use std::sync::Mutex;
use tauri::Manager;

pub struct ConfigState(pub Mutex<config::AppConfig>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let cfg = config::load(&handle).unwrap_or_default();
            app.manage(ConfigState(Mutex::new(cfg)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            env::detect_environment,
            env::set_wine_path,
            bottle::load_config,
            bottle::create_bottle,
            bottle::rename_bottle,
            bottle::delete_bottle,
            bottle::open_drive_c,
            bottle::run_winecfg,
            bottle::kill_bottle,
            bottle::update_bottle_env,
            bottle::set_windows_version,
            bottle::run_program,
            bottle::run_winetricks,
            bottle::list_programs,
            bottle::uninstall_program,
            bottle::open_uninstaller,
            bottle::list_exes,
            bottle::add_shortcut,
            bottle::update_shortcut,
            bottle::remove_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
