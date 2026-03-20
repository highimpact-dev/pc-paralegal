export default function Admin() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        <a
          href="http://localhost:3100"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent dark:text-blue-400 hover:underline"
        >
          Open in browser
        </a>
      </div>
      <div className="flex-1 border dark:border-dark-border rounded-lg overflow-hidden">
        <iframe
          src="http://localhost:3100"
          className="w-full h-full border-0"
          title="Paperclip Admin"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
