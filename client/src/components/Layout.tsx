import { Link, Outlet } from "react-router-dom";
import { useServer } from "../context/ServerContext";

export default function Layout() {
  const { serverStatus } = useServer();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-green-400">
            Uptime Monitor
          </Link>
          <div className="flex gap-6 text-sm">
            <Link to="/" className="text-gray-300 hover:text-white transition">Dashboard</Link>
            <Link to="/monitors/new" className="text-gray-300 hover:text-white transition">+ Add Monitor</Link>
            <Link to="/load-test" className="text-gray-300 hover:text-white transition">Load Test</Link>
            <Link to="/load-test/history" className="text-gray-300 hover:text-white transition">Test History</Link>
            <Link to="/benchmark" className="text-gray-300 hover:text-white transition">Benchmark</Link>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-800">
          <span>🐍</span>
          <span className="text-gray-300">FastAPI</span>
          <span className={`w-2 h-2 rounded-full ${serverStatus.ok ? "bg-green-500" : "bg-red-500"}`} />
          {serverStatus.ok && <span className="text-xs text-gray-500">{serverStatus.ms}ms</span>}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
