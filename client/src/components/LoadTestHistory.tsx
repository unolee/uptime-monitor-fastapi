import { useEffect, useState } from "react";
import { useServer } from "../context/ServerContext";
import { normalizeLoadTest } from "../types";
import type { LoadTestResult } from "../types";

export default function LoadTestHistory() {
  const { api } = useServer();
  const [tests, setTests] = useState<ReturnType<typeof normalizeLoadTest>[]>([]);

  useEffect(() => {
    api.get("/api/load-test").then((raw: LoadTestResult[]) => setTests(raw.map(normalizeLoadTest)));
  }, [api]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Load Test History</h1>
      {tests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No load tests yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-3 px-3">Date</th>
                <th className="text-left py-3 px-3">Target</th>
                <th className="text-right py-3 px-3">Users</th>
                <th className="text-right py-3 px-3">Requests</th>
                <th className="text-right py-3 px-3">Duration</th>
                <th className="text-right py-3 px-3">RPS</th>
                <th className="text-right py-3 px-3">Avg (ms)</th>
                <th className="text-right py-3 px-3">P95 (ms)</th>
                <th className="text-right py-3 px-3">P99 (ms)</th>
                <th className="text-right py-3 px-3">Success</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => {
                const successRate = ((t.successCount / t.totalRequests) * 100).toFixed(1);
                return (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-3 text-gray-400">{t.createdAt ? new Date(t.createdAt).toLocaleString("ko-KR") : "—"}</td>
                    <td className="py-3 px-3 max-w-xs truncate">{t.targetUrl}</td>
                    <td className="py-3 px-3 text-right">{t.concurrentUsers}</td>
                    <td className="py-3 px-3 text-right">{t.totalRequests}</td>
                    <td className="py-3 px-3 text-right">{(t.totalDurationMs / 1000).toFixed(2)}s</td>
                    <td className="py-3 px-3 text-right text-green-400">{t.rps.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right">{Math.round(t.avgResponseMs)}</td>
                    <td className="py-3 px-3 text-right">{t.p95ResponseMs}</td>
                    <td className="py-3 px-3 text-right">{t.p99ResponseMs}</td>
                    <td className={`py-3 px-3 text-right ${Number(successRate) >= 99 ? "text-green-400" : "text-yellow-400"}`}>
                      {successRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
