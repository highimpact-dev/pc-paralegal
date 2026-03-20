import { Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Deliverables from "./pages/Deliverables";
import Chat from "./pages/Chat";
import Matters from "./pages/Matters";
import Admin from "./pages/Admin";
import { checkServices, type ServiceStatuses } from "./lib/tauri";

export default function App() {
  const [services, setServices] = useState<ServiceStatuses>({
    paperclip: { running: false, url: "" },
    ollama: { running: false, models: [] },
    liteparse: false,
  });

  useEffect(() => {
    const poll = async () => {
      const s = await checkServices();
      setServices(s);
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard services={services} />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/deliverables" element={<Deliverables />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/matters" element={<Matters />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        <StatusBar services={services} />
      </div>
    </div>
  );
}
