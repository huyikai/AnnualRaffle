use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 返回应用数据目录，并确保它存在。
///
/// 前端在启动时调用一次，既是初始化的入口，也是一个「原生侧是否打通」的自检点：
/// 命令能返回说明 invoke 通路正常、能拿到 app handle、权限配置正确。
#[tauri::command]
fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    println!("[annual-raffle] app_data_dir = {}", dir.display());
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![app_data_dir])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
