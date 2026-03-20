import type { ParsedDocument } from "../types";

interface DocumentViewerProps {
  document: ParsedDocument | null;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  if (!document) {
    return (
      <div className="text-center text-gray-400 py-12">
        No document selected
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
        <span className="font-medium text-sm">{document.filename}</span>
        {document.pages && (
          <span className="text-xs text-gray-500">{document.pages} pages</span>
        )}
      </div>
      <div className="p-4 max-h-96 overflow-auto">
        <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
          {document.text || "No text content extracted"}
        </pre>
      </div>
    </div>
  );
}
