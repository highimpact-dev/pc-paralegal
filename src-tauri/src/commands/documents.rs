use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize)]
pub struct ParsedDocument {
    pub filename: String,
    pub text: String,
    pub metadata: serde_json::Value,
    pub pages: Option<usize>,
}

#[tauri::command]
pub async fn parse_document(path: String) -> Result<ParsedDocument, String> {
    // Try LiteParse CLI first
    let output = Command::new("lit")
        .args(["parse", &path, "--format", "json"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let parsed: serde_json::Value =
                serde_json::from_str(&stdout).unwrap_or(serde_json::json!({}));

            let filename = std::path::Path::new(&path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            Ok(ParsedDocument {
                filename,
                text: parsed["text"].as_str().unwrap_or("").to_string(),
                metadata: parsed.get("metadata").cloned().unwrap_or(serde_json::json!({})),
                pages: parsed["pages"].as_u64().map(|p| p as usize),
            })
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            // Fallback: try to read as plain text
            match std::fs::read_to_string(&path) {
                Ok(text) => {
                    let filename = std::path::Path::new(&path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    Ok(ParsedDocument {
                        filename,
                        text,
                        metadata: serde_json::json!({"parser": "plaintext", "liteparse_error": stderr}),
                        pages: None,
                    })
                }
                Err(_) => Err(format!("LiteParse failed: {}", stderr)),
            }
        }
        Err(_) => {
            // LiteParse not installed, fallback to plain text
            let text = std::fs::read_to_string(&path)
                .map_err(|e| format!("Cannot read file: {}", e))?;
            let filename = std::path::Path::new(&path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Ok(ParsedDocument {
                filename,
                text,
                metadata: serde_json::json!({"parser": "plaintext", "liteparse_available": false}),
                pages: None,
            })
        }
    }
}

#[tauri::command]
pub async fn check_liteparse() -> Result<bool, String> {
    match Command::new("lit").arg("--version").output() {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}
