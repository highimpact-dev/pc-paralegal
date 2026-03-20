import { useState, useEffect, useCallback } from "react";
import ChatInterface from "../components/ChatInterface";
import { listDirectory, readFileText } from "../lib/tauri";
import { chatWithDocument } from "../lib/ollama";
import type { ChatMessage, FileEntry } from "../types";

const STORAGE_KEY = "pc-paralegal-chat-history";

interface ChatHistory {
  [docPath: string]: ChatMessage[];
}

function loadHistory(): ChatHistory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: ChatHistory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export default function Chat() {
  const [documents, setDocuments] = useState<FileEntry[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FileEntry | null>(null);
  const [docText, setDocText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatHistory>(loadHistory);

  useEffect(() => {
    const loadDocs = async () => {
      const inbox = await listDirectory("inbox").catch(() => []);
      const delivs = await listDirectory("deliverables").catch(() => []);
      setDocuments([...inbox, ...delivs]);
    };
    loadDocs();
  }, []);

  const persistMessages = useCallback((docPath: string, msgs: ChatMessage[]) => {
    setHistory((prev) => {
      const next = { ...prev, [docPath]: msgs };
      saveHistory(next);
      return next;
    });
  }, []);

  const handleSelectDoc = async (file: FileEntry) => {
    setSelectedDoc(file);
    // Restore chat history for this document
    const restored = history[file.path] || [];
    setMessages(restored);
    try {
      const text = await readFileText(file.path);
      setDocText(text);
    } catch {
      setDocText("Failed to read document");
    }
  };

  const handleSend = async (message: string) => {
    if (!docText || !selectedDoc) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    persistMessages(selectedDoc.path, updated);
    setLoading(true);

    try {
      const response = await chatWithDocument(docText, messages, message);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };
      const withResponse = [...updated, assistantMsg];
      setMessages(withResponse);
      persistMessages(selectedDoc.path, withResponse);
    } catch (e) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${e}. Make sure Ollama is running with a model loaded.`,
        timestamp: new Date().toISOString(),
      };
      const withError = [...updated, errorMsg];
      setMessages(withError);
      persistMessages(selectedDoc.path, withError);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!selectedDoc) return;
    setMessages([]);
    setHistory((prev) => {
      const next = { ...prev };
      delete next[selectedDoc.path];
      saveHistory(next);
      return next;
    });
  };

  return (
    <div className="h-full flex gap-4">
      {/* Document selector */}
      <div className="w-64 border-r dark:border-dark-border pr-4 overflow-auto flex-shrink-0">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400">No documents available</p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => {
              const hasHistory = !!history[doc.path]?.length;
              return (
                <button
                  key={doc.path}
                  onClick={() => handleSelectDoc(doc)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedDoc?.path === doc.path
                      ? "bg-accent text-white"
                      : "hover:bg-gray-100 dark:hover:bg-dark-card text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="block truncate">{doc.name}</span>
                  {hasHistory && selectedDoc?.path !== doc.path && (
                    <span className="text-[10px] text-gray-400">
                      {history[doc.path].filter((m) => m.role !== "system").length} messages
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedDoc ? (
          <>
            <div className="pb-3 border-b dark:border-dark-border mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Chat: {selectedDoc.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {docText.length.toLocaleString()} characters loaded
                </p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ChatInterface
                messages={messages}
                onSend={handleSend}
                loading={loading}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a document to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
