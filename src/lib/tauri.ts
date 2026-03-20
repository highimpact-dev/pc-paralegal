import { invoke } from "@tauri-apps/api/core";
import type {
  FileEntry,
  ParsedDocument,
  ServiceStatus,
  OllamaStatus,
  ChatMessage,
  ChatResponse,
  ServiceStatuses,
} from "../types";
export type { ServiceStatuses } from "../types";

// Service health checks
export async function checkPaperclip(): Promise<ServiceStatus> {
  try {
    return await invoke<ServiceStatus>("check_paperclip");
  } catch {
    return { running: false, url: "http://localhost:3100", error: "IPC failed" };
  }
}

export async function startPaperclip(): Promise<ServiceStatus> {
  return invoke<ServiceStatus>("start_paperclip");
}

export async function stopPaperclip(): Promise<void> {
  return invoke("stop_paperclip");
}

export async function checkOllama(): Promise<OllamaStatus> {
  try {
    return await invoke<OllamaStatus>("check_ollama");
  } catch {
    return { running: false, models: [], error: "IPC failed" };
  }
}

export async function checkLiteparse(): Promise<boolean> {
  try {
    return await invoke<boolean>("check_liteparse");
  } catch {
    return false;
  }
}

export async function checkServices(): Promise<ServiceStatuses> {
  const [paperclip, ollama, liteparse] = await Promise.all([
    checkPaperclip(),
    checkOllama(),
    checkLiteparse(),
  ]);
  return { paperclip, ollama, liteparse };
}

// File operations
export async function initDirectories(): Promise<void> {
  return invoke("init_directories");
}

export async function listDirectory(subdir: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { subdir });
}

export async function readFileText(path: string): Promise<string> {
  return invoke<string>("read_file_text", { path });
}

export async function writeFileText(path: string, content: string): Promise<void> {
  return invoke("write_file_text", { path, content });
}

export async function writeFileBinary(path: string, data: number[]): Promise<void> {
  return invoke("write_file_binary", { path, data });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function copyToInbox(sourcePath: string): Promise<string> {
  return invoke<string>("copy_to_inbox", { sourcePath });
}

// Document parsing
export async function parseDocument(path: string): Promise<ParsedDocument> {
  return invoke<ParsedDocument>("parse_document", { path });
}

// LLM
export async function chatCompletion(
  model: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  return invoke<ChatResponse>("chat_completion", { model, messages });
}
