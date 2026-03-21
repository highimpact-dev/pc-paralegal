use crate::state::{AppState, WatcherHandle};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Deserialize, Clone)]
pub struct DirectorConfig {
    pub inbox_path: Option<String>,
    pub auto_process: bool,
    pub model: String,
}

impl Default for DirectorConfig {
    fn default() -> Self {
        Self {
            inbox_path: None,
            auto_process: true,
            model: "gemma3:4b".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InventoryEntry {
    pub filename: String,
    pub source_path: String,
    pub processed_at: String,
    pub document_type: String,
    pub deliverables: Vec<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct Inventory {
    pub entries: Vec<InventoryEntry>,
}

#[derive(Serialize, Clone)]
pub struct DirectorEvent {
    pub event_type: String,
    pub filename: String,
    pub path: String,
    pub message: String,
}

fn config_path(base: &Path) -> std::path::PathBuf {
    base.join("config").join("director.json")
}

fn inventory_path(base: &Path) -> std::path::PathBuf {
    base.join("config").join("inventory.json")
}

fn read_config(base: &Path) -> DirectorConfig {
    let path = config_path(base);
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => DirectorConfig::default(),
    }
}

fn write_config(base: &Path, config: &DirectorConfig) -> Result<(), String> {
    let path = config_path(base);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

fn read_inventory(base: &Path) -> Inventory {
    let path = inventory_path(base);
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or(Inventory { entries: vec![] }),
        Err(_) => Inventory { entries: vec![] },
    }
}

#[tauri::command]
pub async fn get_director_config(state: State<'_, AppState>) -> Result<DirectorConfig, String> {
    Ok(read_config(&state.paralegal_dir))
}

#[tauri::command]
pub async fn save_director_config(
    state: State<'_, AppState>,
    config: DirectorConfig,
) -> Result<(), String> {
    write_config(&state.paralegal_dir, &config)
}

#[tauri::command]
pub async fn get_inventory(state: State<'_, AppState>) -> Result<Vec<InventoryEntry>, String> {
    Ok(read_inventory(&state.paralegal_dir).entries)
}

#[tauri::command]
pub async fn save_inventory_entry(
    state: State<'_, AppState>,
    entry: InventoryEntry,
) -> Result<(), String> {
    let base = &state.paralegal_dir;
    let path = inventory_path(base);
    let mut inventory = read_inventory(base);

    // Update existing or add new
    if let Some(existing) = inventory
        .entries
        .iter_mut()
        .find(|e| e.source_path == entry.source_path)
    {
        *existing = entry;
    } else {
        inventory.entries.push(entry);
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&inventory).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_watcher_status(state: State<'_, AppState>) -> Result<bool, String> {
    let watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    Ok(watcher.is_some())
}

#[tauri::command]
pub async fn start_watching(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // Stop existing watcher if any
    {
        let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
        if let Some(mut handle) = watcher.take() {
            handle.stop_flag.store(true, Ordering::Relaxed);
            if let Some(thread) = handle.thread.take() {
                let _ = thread.join();
            }
        }
    }

    let config = read_config(&state.paralegal_dir);
    let inbox_path = config
        .inbox_path
        .ok_or("No inbox path configured. Set one in Settings first.")?;

    if !Path::new(&inbox_path).exists() {
        return Err(format!("Inbox path does not exist: {}", inbox_path));
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_clone = stop_flag.clone();
    let paralegal_dir = state.paralegal_dir.clone();
    let watch_path = inbox_path.clone();

    let thread = std::thread::spawn(move || {
        run_watcher(app, paralegal_dir, watch_path, stop_flag_clone);
    });

    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher = Some(WatcherHandle {
        stop_flag,
        thread: Some(thread),
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_watching(state: State<'_, AppState>) -> Result<(), String> {
    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    if let Some(mut handle) = watcher.take() {
        handle.stop_flag.store(true, Ordering::Relaxed);
        if let Some(thread) = handle.thread.take() {
            let _ = thread.join();
        }
        Ok(())
    } else {
        Err("No watcher is running".to_string())
    }
}

/// Watcher loop — only emits events, no processing.
/// Frontend handles all processing through existing IPC.
pub fn run_watcher(
    app: AppHandle,
    paralegal_dir: std::path::PathBuf,
    watch_path: String,
    stop_flag: Arc<AtomicBool>,
) {
    let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = match notify::recommended_watcher(tx) {
        Ok(w) => w,
        Err(e) => {
            let _ = app.emit(
                "director:error",
                DirectorEvent {
                    event_type: "error".into(),
                    filename: String::new(),
                    path: String::new(),
                    message: format!("Failed to create watcher: {}", e),
                },
            );
            return;
        }
    };

    if let Err(e) = watcher.watch(Path::new(&watch_path), RecursiveMode::NonRecursive) {
        let _ = app.emit(
            "director:error",
            DirectorEvent {
                event_type: "error".into(),
                filename: String::new(),
                path: String::new(),
                message: format!("Failed to watch directory: {}", e),
            },
        );
        return;
    }

    // Emit watching status
    let _ = app.emit(
        "director:status",
        DirectorEvent {
            event_type: "watching".into(),
            filename: String::new(),
            path: watch_path.clone(),
            message: format!("Watching {}", watch_path),
        },
    );

    // Initial scan: emit events for existing unprocessed files
    if let Ok(entries) = std::fs::read_dir(&watch_path) {
        let inventory = read_inventory(&paralegal_dir);
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') || name_str.starts_with('~') {
                    continue;
                }
            }
            let path_str = path.to_string_lossy().to_string();
            let fname = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            if !inventory
                .entries
                .iter()
                .any(|e| e.source_path == path_str && e.status == "complete")
            {
                let _ = app.emit(
                    "director:new-file",
                    DirectorEvent {
                        event_type: "new-file".into(),
                        filename: fname,
                        path: path_str,
                        message: "New file detected".into(),
                    },
                );
            }
        }
    }

    // Watch for new files
    let mut pending: HashSet<String> = HashSet::new();

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        match rx.recv_timeout(Duration::from_secs(1)) {
            Ok(Ok(event)) => {
                if matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(notify::event::ModifyKind::Data(_))
                ) {
                    for path in &event.paths {
                        let path_str = path.to_string_lossy().to_string();
                        if let Some(name) = path.file_name() {
                            let name = name.to_string_lossy();
                            if name.starts_with('.') || name.starts_with('~') {
                                continue;
                            }
                        }
                        if !path.is_file() {
                            continue;
                        }
                        if !pending.contains(&path_str) {
                            pending.insert(path_str.clone());
                            let app_clone = app.clone();
                            let ps = path_str.clone();
                            let fname = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            // Debounce: wait for file to finish writing
                            std::thread::spawn(move || {
                                std::thread::sleep(Duration::from_secs(3));
                                let _ = app_clone.emit(
                                    "director:new-file",
                                    DirectorEvent {
                                        event_type: "new-file".into(),
                                        filename: fname,
                                        path: ps,
                                        message: "New file detected".into(),
                                    },
                                );
                            });
                        }
                    }
                }
            }
            Ok(Err(_)) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                pending.clear();
            }
            Err(_) => break,
        }
    }
}
