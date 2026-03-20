use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize)]
pub struct OllamaStatus {
    pub running: bool,
    pub models: Vec<String>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct OllamaModelsResponse {
    models: Option<Vec<OllamaModel>>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
}

#[tauri::command]
pub async fn check_ollama(state: State<'_, AppState>) -> Result<OllamaStatus, String> {
    let url = format!("{}/api/tags", state.ollama_url);
    match reqwest::get(&url).await {
        Ok(resp) if resp.status().is_success() => {
            let body: OllamaModelsResponse = resp.json().await.unwrap_or(OllamaModelsResponse { models: None });
            let models = body
                .models
                .unwrap_or_default()
                .into_iter()
                .map(|m| m.name)
                .collect();
            Ok(OllamaStatus {
                running: true,
                models,
                error: None,
            })
        }
        Ok(resp) => Ok(OllamaStatus {
            running: false,
            models: vec![],
            error: Some(format!("HTTP {}", resp.status())),
        }),
        Err(_) => Ok(OllamaStatus {
            running: false,
            models: vec![],
            error: Some("Server offline".to_string()),
        }),
    }
}

#[tauri::command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
) -> Result<ChatResponse, String> {
    let url = format!("{}/api/chat", state.ollama_url);
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let result: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let message = ChatMessage {
        role: result["message"]["role"]
            .as_str()
            .unwrap_or("assistant")
            .to_string(),
        content: result["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string(),
    };

    Ok(ChatResponse {
        message,
        done: result["done"].as_bool().unwrap_or(true),
    })
}
