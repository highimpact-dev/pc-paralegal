use crate::state::AppState;
use serde::Serialize;
use std::fs;
use tauri::State;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

#[tauri::command]
pub async fn init_directories(state: State<'_, AppState>) -> Result<(), String> {
    let base = &state.paralegal_dir;
    let dirs = [
        base.join("inbox"),
        base.join("processing"),
        base.join("deliverables"),
        base.join("templates"),
        base.join("matters"),
        base.join("config"),
    ];
    for dir in &dirs {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_directory(
    state: State<'_, AppState>,
    subdir: String,
) -> Result<Vec<FileEntry>, String> {
    let path = state.paralegal_dir.join(&subdir);
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut entries = vec![];
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

#[tauri::command]
pub async fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub async fn write_file_text(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, data).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn copy_to_inbox(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<String, String> {
    let source = std::path::Path::new(&source_path);
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let dest = state.paralegal_dir.join("inbox").join(&filename);
    fs::copy(source, &dest).map_err(|e| format!("Failed to copy: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn archive_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let source = std::path::Path::new(&path);
    if !source.exists() {
        return Err("File not found".to_string());
    }
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let dest = state.paralegal_dir.join("archive").join(&filename);
    fs::rename(source, &dest).map_err(|e| format!("Failed to archive: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn restore_file(
    state: State<'_, AppState>,
    path: String,
    target_dir: String,
) -> Result<String, String> {
    let source = std::path::Path::new(&path);
    if !source.exists() {
        return Err("File not found".to_string());
    }
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let dest = state.paralegal_dir.join(&target_dir).join(&filename);
    fs::rename(source, &dest).map_err(|e| format!("Failed to restore: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}
