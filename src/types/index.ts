export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
}

export interface ParsedDocument {
  filename: string;
  text: string;
  metadata: Record<string, unknown>;
  pages: number | null;
}

export interface ServiceStatus {
  running: boolean;
  url: string;
  error?: string;
}

export interface OllamaStatus {
  running: boolean;
  models: string[];
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  done: boolean;
}

export interface ServiceStatuses {
  paperclip: ServiceStatus;
  ollama: OllamaStatus;
  liteparse: boolean;
}

export interface Matter {
  id: string;
  name: string;
  client?: string;
  created: number;
}

export interface Deliverable {
  filename: string;
  path: string;
  source_doc?: string;
  type: "review" | "memo" | "summary" | "checklist";
  created: number;
}

export interface DirectorConfig {
  inbox_path: string | null;
  auto_process: boolean;
  model: string;
}

export interface InventoryEntry {
  filename: string;
  source_path: string;
  processed_at: string;
  document_type: string;
  deliverables: string[];
  status: string;
}

export interface DirectorEvent {
  event_type: string;
  filename: string;
  path: string;
  message: string;
}
