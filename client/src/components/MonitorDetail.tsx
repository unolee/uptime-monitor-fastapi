import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useServer } from "../context/ServerContext";
import type { Monitor, Check, SSLData, ChecksResponse } from "../types";
import ResponseChart from "./ResponseChart";

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useServer();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [uptimePercent, setUptimePercent] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [ssl, setSsl] = useState<SSLData | null>(null);
  const [period, setPeriod] = useState("24h");

  const fetchMonitor = useCallback(async () => {
    setMonitor(await api.get(`/api/monitors/${id}`));
  }, [api, id]);

  const fetchChecks = useCallback(async () => {
    const data: ChecksResponse = await api.get(`/api/checks/${id}?period=${period}`);
    setChecks(data.checks);
    setUptimePercent(data.uptimePercent);
    setAvgResponseTime(data.avgResponseTime);
  }, [api, id, period]);

  const fetchSSL = useCallback(async () => {
    try {
      const data = await api.post(`/api/ssl/${id}`);
      if (data) setSsl(data);
    } catch { /* ignore */ }
  }, [api, id]);

  useEffect(() => { fetchMonitor(); fetchSSL(); }, [fetchMonitor, fetchSSL]);
  useEffect(() => { fetchChecks(); }, [fetchChecks]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this monitor?")) return;
    await api.del(`/api/monitors/${id}`);
    navigate("/");
  };

  const handleCheckNow = async () => {
    await api.post("/api/cron");
    setTimeout(fetchChecks, 1000);
  };

  if (!monitor) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null;
  const isUp = lastCheck?.status === "up";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <span className={`w-4 h-4 rounded-full ${isUp ? "bg-green-500" : lastCheck ? "bg-red-500" : "bg-gray-600"}`} />
          <div>
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            <p className="text-gray-400 text-sm">{monitor.url}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheckNow} className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded transition">Check Now</button>
          <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded transition">Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Status" value={isUp ? "UP" : lastCheck ? "DOWN" : "PENDING"} color={isUp ? "text-green-400" : lastCheck ? "text-red-400" : "text-gray-500"} />
        <Stat label={`Uptime (${period})`} value={`${uptimePercent}%`} color={uptimePercent >= 99.9 ? "text-green-400" : uptimePercent >= 95 ? "text-yellow-400" : "text-red-400"} />
        <Stat label="Avg Response" value={`${avgResponseTime}ms`} />
        <Stat label="Total Checks" value={checks.length} />
      </div>

      <div className="flex gap-2 mb-4">
        {["1h", "24h", "7d", "30d", "90d"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm ${period === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Response Time</h3>
        <ResponseChart checks={checks} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Configuration</h3>
          <div className="space-y-2 text-sm">
            <Row label="Method" value={monitor.method} />
            <Row label="Interval" value={`${monitor.interval_seconds}s`} />
            <Row label="Timeout" value={`${monitor.timeout_seconds}s`} />
            <Row label="Expected Status" value={String(monitor.expected_status)} />
            <Row label="Active" value={monitor.is_active ? "Yes" : "No"} />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">SSL Certificate</h3>
          {ssl ? (
            <div className="space-y-2 text-sm">
              <Row label="Issuer" value={ssl.issuer} />
              <Row label="Subject" value={ssl.subject} />
              <Row label="Valid From" value={ssl.valid_from} />
              <Row label="Valid To" value={ssl.valid_to} />
              <Row label="Days Remaining" value={String(ssl.days_remaining)}
                valueColor={ssl.days_remaining > 30 ? "text-green-400" : ssl.days_remaining > 7 ? "text-yellow-400" : "text-red-400"} />
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No SSL data (HTTP only or not checked yet)</p>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Checks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Code</th>
                <th className="text-left py-2 px-2">Response</th>
                <th className="text-left py-2 px-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {[...checks].reverse().slice(0, 20).map((c, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-2 px-2 text-gray-400">{new Date(c.checked_at).toLocaleString("ko-KR")}</td>
                  <td className={`py-2 px-2 ${c.status === "up" ? "text-green-400" : "text-red-400"}`}>{c.status.toUpperCase()}</td>
                  <td className="py-2 px-2">{c.status_code || "—"}</td>
                  <td className="py-2 px-2">{c.response_time_ms}ms</td>
                  <td className="py-2 px-2 text-red-400 text-xs">{c.error_message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={valueColor || "text-white"}>{value}</span>
    </div>
  );
}
