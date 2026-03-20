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
    let output = Command::new("lit")
        .args(["parse", &path, "--format", "json"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();

            // LiteParse prints progress lines before the JSON object.
            // Find the first '{' to locate where JSON starts.
            let json_start = stdout.find('{').unwrap_or(0);
            let json_str = &stdout[json_start..];

            let parsed: serde_json::Value =
                serde_json::from_str(json_str).unwrap_or(serde_json::json!({}));

            let filename = std::path::Path::new(&path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // LiteParse returns { pages: [{ page, text, ... }, ...] }
            // Concatenate all page texts into one document
            let text = if let Some(pages) = parsed["pages"].as_array() {
                pages
                    .iter()
                    .filter_map(|p| p["text"].as_str())
                    .collect::<Vec<&str>>()
                    .join("\n\n")
            } else {
                // Fallback: check for top-level text field
                parsed["text"].as_str().unwrap_or("").to_string()
            };

            let page_count = parsed["pages"].as_array().map(|p| p.len());

            Ok(ParsedDocument {
                filename,
                text,
                metadata: serde_json::json!({
                    "parser": "liteparse",
                    "pages": page_count,
                }),
                pages: page_count,
            })
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
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
