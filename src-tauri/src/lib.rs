mod commands;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
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
            // Documents
            commands::documents::parse_document,
            commands::documents::check_liteparse,
        ])
        .setup(|_app| {
            // Init paralegal directories on startup
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let base = std::path::PathBuf::from(&home).join("paralegal");
            let dirs = ["inbox", "processing", "deliverables", "templates", "matters", "config", "data"];
            for dir in &dirs {
                let _ = std::fs::create_dir_all(base.join(dir));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
