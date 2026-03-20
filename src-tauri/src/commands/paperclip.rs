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
    // Resolve the paperclip server path relative to the app
    // In dev: ./paperclip/src/index.ts (run with bun)
    // In prod: bundled sidecar binary
    let home = std::env::var("HOME").unwrap_or_default();
    let db_path = format!("{}/paralegal/data/paperclip.db", home);

    // Try compiled binary first, fall back to bun dev mode
    let (cmd, args) = {
        let binary_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("paperclip-server")))
            .unwrap_or_default();

        if binary_path.exists() {
            (binary_path.to_string_lossy().to_string(), vec![])
        } else {
            // Dev mode: run with bun from the paperclip/ directory
            let script_path = std::env::var("HOME")
                .map(|h| format!("{}/projects/business/pc-paralegal/paperclip/src/index.ts", h))
                .unwrap_or_default();
            ("bun".to_string(), vec!["run".to_string(), script_path])
        }
    };

    let mut command = tokio::process::Command::new(&cmd);
    for arg in &args {
        command.arg(arg);
    }

    let child = command
        .env("PORT", "3101")
        .env("DATABASE_PATH", &db_path)
        .env("AUTH_MODE", "local_trusted")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Paperclip: {}", e))?;

    {
        let mut proc = state.paperclip_process.lock().await;
        *proc = Some(child);
    }

    // Wait for startup, then health check
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
