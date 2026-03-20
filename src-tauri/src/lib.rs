mod commands;
mod state;

use state::AppState;

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
        ])
        .setup(|_app| {
            // Init paralegal directories on startup
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let base = std::path::PathBuf::from(&home).join("paralegal");
            let dirs = ["inbox", "processing", "deliverables", "templates", "matters", "config", "data", "archive"];
            for dir in &dirs {
                let _ = std::fs::create_dir_all(base.join(dir));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
