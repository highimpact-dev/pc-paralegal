import { useState, useEffect } from "react";
import ChatInterface from "../components/ChatInterface";
import { listDirectory, readFileText } from "../lib/tauri";
import { chatWithDocument } from "../lib/ollama";
import type { ChatMessage, FileEntry } from "../types";

export default function Chat() {
  const [documents, setDocuments] = useState<FileEntry[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FileEntry | null>(null);
  const [docText, setDocText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDocs = async () => {
      const inbox = await listDirectory("inbox").catch(() => []);
      const delivs = await listDirectory("deliverables").catch(() => []);
      setDocuments([...inbox, ...delivs]);
    };
    loadDocs();
  }, []);

  const handleSelectDoc = async (file: FileEntry) => {
    setSelectedDoc(file);
    setMessages([]);
    try {
      const text = await readFileText(file.path);
      setDocText(text);
    } catch {
      setDocText("Failed to read document");
    }
  };

  const handleSend = async (message: string) => {
    if (!docText) return;
    const userMsg: ChatMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await chatWithDocument(docText, messages, message);
      const assistantMsg: ChatMessage = { role: "assistant", content: response };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${e}. Make sure Ollama is running with a model loaded.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Document selector */}
      <div className="w-64 border-r pr-4 overflow-auto flex-shrink-0">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400">No documents available</p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <button
                key={doc.path}
                onClick={() => handleSelectDoc(doc)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedDoc?.path === doc.path
                    ? "bg-accent text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <span className="block truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedDoc ? (
          <>
            <div className="pb-3 border-b mb-2">
              <h2 className="text-lg font-bold text-gray-900">
                Chat: {selectedDoc.name}
              </h2>
              <p className="text-xs text-gray-500">
                {docText.length.toLocaleString()} characters loaded
              </p>
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
