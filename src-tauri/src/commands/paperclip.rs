use crate::state::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct ServiceStatus {
    pub running: bool,
    pub url: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_paperclip(state: State<'_, AppState>) -> Result<ServiceStatus, String> {
    let url = format!("{}/api/health", state.paperclip_url);
    match reqwest::get(&url).await {
        Ok(resp) if resp.status().is_success() => Ok(ServiceStatus {
            running: true,
            url: state.paperclip_url.clone(),
            error: None,
        }),
        Ok(resp) => Ok(ServiceStatus {
            running: false,
            url: state.paperclip_url.clone(),
            error: Some(format!("HTTP {}", resp.status())),
        }),
        Err(e) => Ok(ServiceStatus {
            running: false,
            url: state.paperclip_url.clone(),
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn start_paperclip(state: State<'_, AppState>) -> Result<ServiceStatus, String> {
    let server_path = std::env::var("HOME")
        .map(|h| format!("{}/projects/business/paperclip/server/dist/index.js", h))
        .unwrap_or_default();

    let child = tokio::process::Command::new("node")
        .arg(&server_path)
        .env("PORT", "3100")
        .env("NODE_ENV", "development")
        .env("AUTH_MODE", "local_trusted")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Paperclip: {}", e))?;

    {
        let mut proc = state.paperclip_process.lock().await;
        *proc = Some(child);
    } // Lock dropped here before the await

    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    check_paperclip(state).await
}

#[tauri::command]
pub async fn stop_paperclip(state: State<'_, AppState>) -> Result<(), String> {
    let mut proc = state.paperclip_process.lock().await;
    if let Some(ref mut child) = *proc {
        child.kill().await.map_err(|e| e.to_string())?;
    }
    *proc = None;
    Ok(())
}
