use std::path::PathBuf;
use tokio::process::Child;
use tokio::sync::Mutex;

pub struct AppState {
    pub paralegal_dir: PathBuf,
    pub paperclip_url: String,
    pub ollama_url: String,
    pub paperclip_process: Mutex<Option<Child>>,
}

impl AppState {
    pub fn new() -> Self {
        let home = dirs_home();
        Self {
            paralegal_dir: home.join("paralegal"),
            paperclip_url: "http://localhost:3100".to_string(),
            ollama_url: "http://localhost:11434".to_string(),
            paperclip_process: Mutex::new(None),
        }
    }
}

fn dirs_home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}
