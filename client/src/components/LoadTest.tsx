import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useServer } from "../context/ServerContext";
import { normalizeLoadTest } from "../types";

export default function LoadTest() {
  const { api } = useServer();
  const [form, setForm] = useState({ target_url: "", concurrent_users: 10, total_requests: 100, timeout_seconds: 30 });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof normalizeLoadTest> | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      // FastAPI uses snake_case model, Next.js uses camelCase in body but returns camelCase
      const raw = await api.post("/api/load-test", form);
      setResult(normalizeLoadTest(raw));
    } finally {
      setRunning(false);
    }
  };

  const statusChartData = result
    ? Object.entries(result.statusCodeDistribution).map(([code, count]) => ({ code: `HTTP ${code}`, count }))
    : [];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Load Test</h1>
      <form onSubmit={handleRun} className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Target URL <span className="text-red-400">*</span></label>
            <input type="url" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })}
              placeholder="https://example.com" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Concurrent Users</label>
              <input type="number" value={form.concurrent_users} onChange={(e) => setForm({ ...form, concurrent_users: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" min={1} max={500} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total Requests</label>
              <input type="number" value={form.total_requests} onChange={(e) => setForm({ ...form, total_requests: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" min={10} max={10000} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Timeout (sec)</label>
              <input type="number" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" min={1} max={120} />
            </div>
          </div>
          <button type="submit" disabled={running}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded transition">
            {running ? "Running Load Test..." : "Run Load Test"}
          </button>
        </div>
      </form>

      {result && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <R label="Total Duration" value={`${(result.totalDurationMs / 1000).toFixed(2)}s`} />
            <R label="RPS" value={result.rps.toFixed(1)} color="text-green-400" />
            <R label="Success Rate" value={`${((result.successCount / result.totalRequests) * 100).toFixed(1)}%`}
              color={result.failureCount === 0 ? "text-green-400" : "text-yellow-400"} />
            <R label="Avg Response" value={`${result.avgResponseMs}ms`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <R label="Min" value={`${result.minResponseMs}ms`} />
            <R label="Avg" value={`${result.avgResponseMs}ms`} />
            <R label="P95" value={`${result.p95ResponseMs}ms`} />
            <R label="P99" value={`${result.p99ResponseMs}ms`} />
            <R label="Max" value={`${result.maxResponseMs}ms`} />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Status Code Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="code" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function R({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-lg font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
