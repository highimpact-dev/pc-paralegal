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
            model: "qwen3:8b".to_string(),
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
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deliverables: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
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

fn write_inventory(base: &Path, inventory: &Inventory) -> Result<(), String> {
    let path = inventory_path(base);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(inventory).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn process_document_manual(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let paralegal_dir = state.paralegal_dir.clone();
    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || {
        process_single_document(&app_clone, &paralegal_dir, &path);
    })
    .await
    .map_err(|e| e.to_string())
}

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
                    message: format!("Failed to create watcher: {}", e),
                    document_type: None,
                    deliverables: None,
                    error: Some(e.to_string()),
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
                message: format!("Failed to watch directory: {}", e),
                document_type: None,
                deliverables: None,
                error: Some(e.to_string()),
            },
        );
        return;
    }

    let _ = app.emit(
        "director:status",
        DirectorEvent {
            event_type: "watching".into(),
            filename: String::new(),
            message: format!("Watching {}", watch_path),
            document_type: None,
            deliverables: None,
            error: None,
        },
    );

    // Initial scan: process existing unprocessed files
    if let Ok(entries) = std::fs::read_dir(&watch_path) {
        let inventory = read_inventory(&paralegal_dir);
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Some(name) = path.file_name() {
                let name = name.to_string_lossy();
                if name.starts_with('.') || name.starts_with('~') {
                    continue;
                }
            }
            let path_str = path.to_string_lossy().to_string();
            if !inventory
                .entries
                .iter()
                .any(|e| e.source_path == path_str && e.status == "complete")
            {
                let app_clone = app.clone();
                let pd_clone = paralegal_dir.clone();
                std::thread::spawn(move || {
                    process_single_document(&app_clone, &pd_clone, &path_str);
                });
            }
        }
    }

    // Track recently seen files for debouncing
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
                        // Skip hidden files and directories
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
                            // Debounce: wait for file to finish writing
                            let app_clone = app.clone();
                            let paralegal_dir_clone = paralegal_dir.clone();
                            let path_clone = path_str.clone();
                            std::thread::spawn(move || {
                                // Wait 3 seconds for file to stabilize
                                std::thread::sleep(Duration::from_secs(3));
                                process_single_document(
                                    &app_clone,
                                    &paralegal_dir_clone,
                                    &path_clone,
                                );
                            });
                        }
                    }
                }
            }
            Ok(Err(_)) => {} // Watcher error, ignore
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // Clear pending set periodically
                pending.clear();
            }
            Err(_) => break, // Channel disconnected
        }
    }
}

fn process_single_document(app: &AppHandle, paralegal_dir: &Path, file_path: &str) {
    let filename = Path::new(file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Check inventory - skip if already processed
    let inventory = read_inventory(paralegal_dir);
    if inventory
        .entries
        .iter()
        .any(|e| e.source_path == file_path && e.status == "complete")
    {
        return;
    }

    // Emit processing event
    let _ = app.emit(
        "director:processing",
        DirectorEvent {
            event_type: "processing".into(),
            filename: filename.clone(),
            message: format!("Processing {}", filename),
            document_type: None,
            deliverables: None,
            error: None,
        },
    );

    // In dev mode, CARGO_MANIFEST_DIR is src-tauri/, parent is project root
    let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(std::path::Path::new("."));

    // Ensure PATH includes common binary locations (homebrew, cargo, etc.)
    let current_path = std::env::var("PATH").unwrap_or_default();
    let extended_path = format!(
        "/opt/homebrew/bin:/usr/local/bin:{}/.cargo/bin:{}",
        std::env::var("HOME").unwrap_or_default(),
        current_path
    );

    // Run the pipeline script
    let output = std::process::Command::new("bun")
        .args([
            "run",
            "agent-scripts/director-pipeline.ts",
            file_path,
        ])
        .current_dir(project_root)
        .env("PATH", &extended_path)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();

            // Parse the last line as JSON (pipeline outputs JSON result)
            let result_line = stdout.lines().last().unwrap_or("");
            match serde_json::from_str::<serde_json::Value>(result_line) {
                Ok(result) => {
                    let doc_type = result["document_type"]
                        .as_str()
                        .unwrap_or("unknown")
                        .to_string();
                    let deliverables: Vec<String> = result["deliverables"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    // Update inventory
                    let mut inventory = read_inventory(paralegal_dir);
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default();
                    inventory.entries.push(InventoryEntry {
                        filename: filename.clone(),
                        source_path: file_path.to_string(),
                        processed_at: format!("{}", now.as_secs()),
                        document_type: doc_type.clone(),
                        deliverables: deliverables.clone(),
                        status: "complete".to_string(),
                    });
                    let _ = write_inventory(paralegal_dir, &inventory);

                    let _ = app.emit(
                        "director:complete",
                        DirectorEvent {
                            event_type: "complete".into(),
                            filename,
                            message: format!("Completed review ({})", doc_type),
                            document_type: Some(doc_type),
                            deliverables: Some(deliverables),
                            error: None,
                        },
                    );
                }
                Err(e) => {
                    let _ = app.emit(
                        "director:error",
                        DirectorEvent {
                            event_type: "error".into(),
                            filename,
                            message: format!("Failed to parse pipeline output: {}", e),
                            document_type: None,
                            deliverables: None,
                            error: Some(format!("Parse error: {}. Output: {}", e, stdout)),
                        },
                    );
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let _ = app.emit(
                "director:error",
                DirectorEvent {
                    event_type: "error".into(),
                    filename,
                    message: format!("Pipeline failed: {}", stderr),
                    document_type: None,
                    deliverables: None,
                    error: Some(stderr),
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                "director:error",
                DirectorEvent {
                    event_type: "error".into(),
                    filename,
                    message: format!("Failed to run pipeline: {}", e),
                    document_type: None,
                    deliverables: None,
                    error: Some(e.to_string()),
                },
            );
        }
    }
}
