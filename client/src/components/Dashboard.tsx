import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useServer } from "../context/ServerContext";
import type { DashboardData } from "../types";
import UptimeBar from "./UptimeBar";

export default function Dashboard() {
  const { api } = useServer();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setData(await api.get("/api/dashboard"));
    } catch (err) {
      console.error("Failed to fetch dashboard", err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const triggerCheck = async () => {
    await api.post("/api/cron");
    fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (!data) return <div className="text-center py-20 text-red-400">Failed to load dashboard</div>;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card label="Total Monitors" value={data.totalMonitors} />
        <Card label="Active" value={data.activeMonitors} />
        <Card label="Up" value={data.upCount} color="text-green-400" />
        <Card label="Down" value={data.downCount} color="text-red-400" />
        <Card label="Avg Response" value={`${data.avgResponseTime}ms`} />
      </div>

      {data.activeIncidents.length > 0 && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-8">
          <h3 className="text-red-400 font-bold mb-2">Active Incidents ({data.activeIncidents.length})</h3>
          {data.activeIncidents.map((inc) => (
            <div key={inc.id} className="text-sm text-red-300">
              {inc.monitor_name} ({inc.monitor_url}) — down since {inc.started_at}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Monitors</h2>
        <button onClick={triggerCheck} className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded transition">
          Check Now
        </button>
      </div>

      {data.monitors.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No monitors yet.</p>
          <Link to="/monitors/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Add your first monitor
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.monitors.map((m) => {
            const bar = data.uptimeBars.find((b) => b.monitorId === m.id);
            return (
              <Link key={m.id} to={`/monitors/${m.id}`}
                className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${
                      m.current_status === "up" ? "bg-green-500" : m.current_status === "down" ? "bg-red-500" : "bg-gray-600"
                    }`} />
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-500 text-sm">{m.url}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">{m.last_response_time != null ? `${m.last_response_time}ms` : "—"}</span>
                    <span className={m.current_status === "up" ? "text-green-400" : m.current_status === "down" ? "text-red-400" : "text-gray-500"}>
                      {m.current_status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>
                </div>
                {bar && <UptimeBar days={bar.days} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
