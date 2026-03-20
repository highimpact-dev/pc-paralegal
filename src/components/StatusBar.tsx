import type { ServiceStatuses } from "../types";

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        active ? "bg-green-500" : "bg-red-500"
      }`}
    />
  );
}

export default function StatusBar({ services }: { services: ServiceStatuses }) {
  return (
    <footer className="h-8 bg-gray-100 border-t border-gray-200 flex items-center px-4 gap-6 text-xs text-gray-600">
      <div className="flex items-center gap-1.5">
        <Dot active={services.paperclip.running} />
        <span>Paperclip</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Dot active={services.ollama.running} />
        <span>
          Ollama
          {services.ollama.running && services.ollama.models.length > 0
            ? ` (${services.ollama.models.length} models)`
            : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Dot active={services.liteparse} />
        <span>LiteParse</span>
      </div>
    </footer>
  );
}
