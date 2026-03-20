import { useState, useCallback } from "react";

interface FileDropZoneProps {
  onFileDrop: (files: File[]) => void;
  accept?: string;
}

export default function FileDropZone({ onFileDrop, accept }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFileDrop(files);
    },
    [onFileDrop]
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if (accept) input.accept = accept;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length > 0) onFileDrop(files);
    };
    input.click();
  }, [onFileDrop, accept]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-300 dark:border-dark-border hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-dark-card"
      }`}
    >
      <svg
        className="w-12 h-12 mx-auto text-gray-400 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
      <p className="text-gray-600 dark:text-gray-300 font-medium">
        Drop files here or click to browse
      </p>
      <p className="text-sm text-gray-400 mt-1">
        PDF, DOCX, TXT, and image files supported
      </p>
    </div>
  );
}
