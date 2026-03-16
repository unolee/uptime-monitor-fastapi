import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useServer } from "../context/ServerContext";
import type {
  BenchmarkCurrent,
  BenchmarkHistoryItem,
  BenchmarkPhase,
} from "../types";

const PHASES = [25, 50, 100, 200, 400] as const;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMs(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}ms`;
}

export default function Benchmark() {
  const { api } = useServer();
  const [current, setCurrent] = useState<BenchmarkCurrent | null>(null);
  const [history, setHistory] = useState<BenchmarkHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [checkInterval, setCheckInterval] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = current?.status === "running";

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get("/api/benchmark");
      setCurrent(data.current ?? null);
      setHistory(data.history ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch benchmark status");
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Initial fetch and refetch on server change
  useEffect(() => {
    setLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 3 seconds when running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isRunning, fetchStatus]);

  // Live elapsed timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isRunning && current?.progress) {
      setElapsed(current.progress.elapsed_seconds);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, current?.progress?.elapsed_seconds]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await api.post("/api/benchmark", { check_interval_seconds: checkInterval });
      await fetchStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start benchmark");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!confirm("Are you sure you want to stop the benchmark?")) return;
    setStopping(true);
    try {
      await api.post("/api/benchmark/stop");
      await fetchStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to stop benchmark");
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {isRunning ? <RunningView /> : <IdleView />}
    </div>
  );

  function IdleView() {
    return (
      <>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Benchmark Test</h1>
          <p className="text-gray-400 mt-1">
            서버 성능 벤치마크. 25→50→100→200→400개 사이트를 순차적으로
            모니터링하며 각 단계별 10분, 총 50분 테스트합니다.
          </p>
        </div>

        {/* Check interval + Start */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div>
              <label
                htmlFor="check-interval"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Check Interval (seconds)
              </label>
              <input
                id="check-interval"
                type="number"
                min={10}
                max={300}
                value={checkInterval}
                onChange={(e) =>
                  setCheckInterval(
                    Math.max(10, Math.min(300, Number(e.target.value) || 60))
                  )
                }
                className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={handleStart}
              disabled={starting}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-lg transition shadow-lg shadow-green-600/20"
            >
              {starting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Starting...
                </span>
              ) : (
                "Start Full Benchmark"
              )}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            5 phases: 25 → 50 → 100 → 200 → 400 sites, ~50 min total
          </p>
        </div>

        {/* Phase overview cards */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Phase Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {PHASES.map((count, i) => (
              <div
                key={count}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Phase {i + 1}
                </div>
                <div className="text-3xl font-bold text-green-400">{count}</div>
                <div className="text-sm text-gray-400 mt-1">Sites</div>
                <div className="text-xs text-gray-500 mt-2">
                  10 rounds, {count * 10} checks
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completed benchmark banner */}
        {current && current.status !== "running" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">
                    Last Benchmark
                  </h2>
                  <StatusBadge status={current.status} />
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Phase {current.current_phase}/{current.total_phases},{" "}
                  {current.completed_rounds}/{current.total_rounds} rounds
                </p>
              </div>
              <Link
                to={`/benchmark/${current.id}`}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition"
              >
                View Report
              </Link>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">
              Benchmark History
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Phases</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Rounds</th>
                    <th className="text-left px-4 py-3 font-medium">Started</th>
                    <th className="text-left px-4 py-3 font-medium">Ended</th>
                    <th className="text-right px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-3 text-gray-300">#{item.id}</td>
                      <td className="px-4 py-3 text-white font-medium">
                        {item.current_phase}/{item.total_phases}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {item.completed_rounds}/{item.total_rounds}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(item.started_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {item.ended_at
                          ? new Date(item.ended_at).toLocaleString("ko-KR")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/benchmark/${item.id}`}
                          className="text-green-400 hover:text-green-300 transition text-sm"
                        >
                          Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  function RunningView() {
    const bm = current!;
    const progress = bm.progress;
    const percent = progress?.percent ?? 0;

    // Compute phase-level round counts
    const currentPhaseData = bm.phases?.find(
      (p: BenchmarkPhase) => p.phase === bm.current_phase
    );
    const phaseRounds = currentPhaseData?.rounds?.length ?? 0;

    return (
      <>
        {/* Running banner */}
        <div className="bg-gray-900 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
            </span>
            <h1 className="text-2xl font-bold text-white">
              Benchmark Running
            </h1>
          </div>

          {/* Overall progress bar */}
          <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="text-sm text-gray-400 text-right mb-6">
            {percent.toFixed(1)}% complete
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Current Phase"
              value={`Phase ${bm.current_phase}/${bm.total_phases} (${bm.site_count} sites)`}
            />
            <StatCard label="Elapsed" value={formatDuration(elapsed)} />
            <StatCard
              label="Remaining"
              value={
                progress
                  ? formatDuration(
                      Math.max(
                        0,
                        progress.remaining_seconds -
                          (elapsed - progress.elapsed_seconds)
                      )
                    )
                  : "-"
              }
            />
            <StatCard
              label="Overall Rounds"
              value={`${bm.completed_rounds}/${bm.total_rounds}`}
            />
            <StatCard
              label="Phase Rounds"
              value={`${phaseRounds}/10`}
            />
          </div>
        </div>

        {/* Phase progress visualization */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Phase Progress
          </h2>
          <div className="space-y-3">
            {PHASES.map((siteCount, i) => {
              const phaseNum = i + 1;
              const phaseData = bm.phases?.find(
                (p: BenchmarkPhase) => p.phase === phaseNum
              );
              const isCompleted = phaseData?.completed ?? false;
              const isCurrent = phaseNum === bm.current_phase;
              const isFuture = phaseNum > bm.current_phase;
              const roundsDone = phaseData?.rounds?.length ?? 0;

              let barColor = "bg-gray-700";
              let textColor = "text-gray-500";
              let barWidth = 0;

              if (isCompleted) {
                barColor = "bg-green-500";
                textColor = "text-green-400";
                barWidth = 100;
              } else if (isCurrent) {
                barColor = "bg-green-500";
                textColor = "text-yellow-400";
                barWidth = (roundsDone / 10) * 100;
              } else if (isFuture) {
                barColor = "bg-gray-700";
                textColor = "text-gray-500";
                barWidth = 0;
              }

              return (
                <div
                  key={phaseNum}
                  className={`bg-gray-900 border rounded-lg p-4 ${
                    isCurrent
                      ? "border-green-500/50"
                      : "border-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold ${textColor}`}
                      >
                        Phase {phaseNum}
                      </span>
                      <span className="text-sm text-gray-400">
                        {siteCount} sites
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                          In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          Completed
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">
                      {roundsDone}/10 rounds
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`${barColor} h-2 rounded-full transition-all duration-500 ${
                        isCurrent ? "animate-pulse" : ""
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stop button */}
        <div className="flex justify-end">
          <button
            onClick={handleStop}
            disabled={stopping}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {stopping ? "Stopping..." : "Stop Benchmark"}
          </button>
        </div>

        {/* Current phase round results table */}
        {currentPhaseData && currentPhaseData.rounds.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">
              Phase {bm.current_phase} Round Results ({bm.site_count} sites)
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left px-4 py-3 font-medium">
                        Round
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Time
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Checks
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Up
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Down
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Avg
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Min
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Max
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentPhaseData.rounds].reverse().map((r) => (
                      <tr
                        key={r.round}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          #{r.round}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(r.checked_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {formatNum(r.total_checks)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400">
                          {formatNum(r.up_count)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-400">
                          {r.down_count > 0 ? formatNum(r.down_count) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {formatMs(r.avg_response_ms)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {formatMs(r.min_response_ms)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {formatMs(r.max_response_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-green-500/20 text-green-400",
    completed: "bg-blue-500/20 text-blue-400",
    stopped: "bg-yellow-500/20 text-yellow-400",
    interrupted: "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? "bg-gray-700 text-gray-300"
      }`}
    >
      {status}
    </span>
  );
}
