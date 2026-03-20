import { readFileSync } from "fs";
import { join } from "path";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

function getDefaultModel(): string {
  // Read from director config, fall back to env, then hardcoded default
  if (process.env.OLLAMA_MODEL) return process.env.OLLAMA_MODEL;
  try {
    const home = process.env.HOME || "/tmp";
    const config = JSON.parse(
      readFileSync(join(home, "paralegal", "config", "director.json"), "utf-8")
    );
    if (config.model) return config.model;
  } catch {}
  return "gemma3:4b";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  num_ctx?: number;
  num_predict?: number;
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = getDefaultModel(),
    temperature = 0.3,
    num_ctx = 32768,
    num_predict = 8192,
  } = options;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature, num_ctx, num_predict },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}
