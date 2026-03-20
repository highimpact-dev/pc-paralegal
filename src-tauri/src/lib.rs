mod commands;
mod state;

use state::AppState;
use tauri::Manager;

#[tauri::command]
fn set_window_theme(app: tauri::AppHandle, window: tauri::WebviewWindow, dark: bool) -> Result<(), String> {
    use tauri::Theme;
    use tauri::utils::config::Color;
    let theme = if dark { Theme::Dark } else { Theme::Light };
    // Set app-level theme (affects NSApplication.appearance on macOS)
    app.set_theme(Some(theme));
    // Also set window-level theme
    let _ = window.set_theme(Some(if dark { Theme::Dark } else { Theme::Light }));
    // Set background color to match
    let color = if dark {
        Color(15, 15, 23, 255)
    } else {
        Color(255, 255, 255, 255)
    };
    let _ = window.set_background_color(Some(color));
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            set_window_theme,
            // Paperclip lifecycle
            commands::paperclip::check_paperclip,
            commands::paperclip::start_paperclip,
            commands::paperclip::stop_paperclip,
            // Ollama
            commands::llm::check_ollama,
            commands::llm::chat_completion,
            // File system
            commands::files::init_directories,
            commands::files::list_directory,
            commands::files::list_arbitrary_directory,
            commands::files::read_file_text,
            commands::files::write_file_text,
            commands::files::write_file_binary,
            commands::files::delete_file,
            commands::files::copy_to_inbox,
            commands::files::archive_file,
            commands::files::restore_file,
            // Documents
            commands::documents::parse_document,
            commands::documents::check_liteparse,
            // Director
            commands::director::get_director_config,
            commands::director::save_director_config,
            commands::director::get_inventory,
            commands::director::get_watcher_status,
            commands::director::start_watching,
            commands::director::stop_watching,
            commands::director::process_document_manual,
        ])
        .setup(|app| {
            // Init paralegal directories on startup
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let base = std::path::PathBuf::from(&home).join("paralegal");
            let dirs = ["inbox", "processing", "deliverables", "parsed", "templates", "matters", "config", "data", "archive"];
            for dir in &dirs {
                let _ = std::fs::create_dir_all(base.join(dir));
            }

            // Auto-start watcher if a watch dir is configured
            let config_path = base.join("config").join("director.json");
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(inbox_path) = config["inbox_path"].as_str() {
                        if !inbox_path.is_empty() && std::path::Path::new(inbox_path).exists() {
                            let app_handle = app.handle().clone();
                            let base_clone = base.clone();
                            let inbox = inbox_path.to_string();
                            let stop_flag = std::sync::Arc::new(
                                std::sync::atomic::AtomicBool::new(false),
                            );

                            // Store the handle before spawning
                            {
                                let managed: &state::AppState = app.state::<state::AppState>().inner();
                                if let Ok(mut w) = managed.watcher.lock() {
                                    *w = Some(state::WatcherHandle {
                                        stop_flag: stop_flag.clone(),
                                        thread: None, // Thread set after spawn
                                    });
                                }
                            }

                            let stop_clone = stop_flag;
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_secs(2));
                                commands::director::run_watcher(
                                    app_handle, base_clone, inbox, stop_clone,
                                );
                            });
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
