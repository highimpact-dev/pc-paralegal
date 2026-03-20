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
