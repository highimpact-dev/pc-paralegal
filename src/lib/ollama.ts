import { chatCompletion } from "./tauri";
import type { ChatMessage } from "../types";

const DEFAULT_MODEL = "qwen3:8b";

export async function reviewDocument(
  documentText: string,
  instructions: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a paralegal reviewing documents. Identify risks, missing clauses, unusual terms, and areas of concern. Be thorough and specific. Structure your output with clear sections: Key Findings, Risks Identified, Missing Clauses, Unusual Terms, and Recommendations.`,
    },
    {
      role: "user",
      content: `Please review the following document. Instructions: ${instructions}\n\n---\n\n${documentText}`,
    },
  ];
  const response = await chatCompletion(model, messages);
  return response.message.content;
}

export async function draftMemo(
  documentText: string,
  instructions: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a paralegal drafting memos and summaries. Produce structured documents with clear sections: Executive Summary, Key Points, Detailed Analysis, and Action Items. Be precise and professional.`,
    },
    {
      role: "user",
      content: `Draft a memo based on the following document. Instructions: ${instructions}\n\n---\n\n${documentText}`,
    },
  ];
  const response = await chatCompletion(model, messages);
  return response.message.content;
}

export async function chatWithDocument(
  documentText: string,
  chatHistory: ChatMessage[],
  userMessage: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a paralegal assistant. You have access to the following document and should answer questions about it accurately and thoroughly. Reference specific sections when relevant.\n\nDocument:\n${documentText}`,
    },
    ...chatHistory,
    { role: "user", content: userMessage },
  ];
  const response = await chatCompletion(model, messages);
  return response.message.content;
}
