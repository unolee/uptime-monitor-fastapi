import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useServer } from "../context/ServerContext";
import type {
  BenchmarkReportData,
  BenchmarkPhaseReport,
  BenchmarkPhaseSummary,
} from "../types";

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMs(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}ms`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

const PHASE_COLORS = [
  { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", bar: "bg-emerald-500" },
  { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", bar: "bg-blue-500" },
  { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30", bar: "bg-violet-500" },
  { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", bar: "bg-amber-500" },
  { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/30", bar: "bg-rose-500" },
];

export default function BenchmarkReport() {
  const { id } = useParams<{ id: string }>();
  const { api } = useServer();
  const [report, setReport] = useState<BenchmarkReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const data = await api.get(`/api/benchmark/${id}`);
      setReport(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    setLoading(true);
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link
          to="/benchmark"
          className="text-green-400 hover:text-green-300 transition text-sm"
        >
          &larr; Back to Benchmark
        </Link>
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error || "Report not found"}
        </div>
      </div>
    );
  }

  const { benchmark, phases, overall_summary } = report;

  // Find best/worst phase by avg response
  const bestPhase = phases.length > 0
    ? phases.reduce((best, p) =>
        p.summary.avg_response_ms < best.summary.avg_response_ms ? p : best
      )
    : null;
  const worstPhase = phases.length > 0
    ? phases.reduce((worst, p) =>
        p.summary.avg_response_ms > worst.summary.avg_response_ms ? p : worst
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        to="/benchmark"
        className="text-green-400 hover:text-green-300 transition text-sm inline-block"
      >
        &larr; Back to Benchmark
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Benchmark Report #{benchmark.id}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {benchmark.total_phases} phases, {benchmark.completed_rounds}/
            {benchmark.total_rounds} rounds
            {benchmark.started_at && (
              <>
                {" "}
                &middot;{" "}
                {new Date(benchmark.started_at).toLocaleString("ko-KR")}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={benchmark.status} />
      </div>

      {/* Overall Summary Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Overall Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Total Checks"
            value={formatNum(overall_summary.total_checks)}
          />
          <MetricCard
            label="Success Rate"
            value={formatPercent(overall_summary.success_rate)}
            color={
              overall_summary.success_rate >= 99
                ? "text-green-400"
                : overall_summary.success_rate >= 95
                ? "text-yellow-400"
                : "text-red-400"
            }
          />
          <MetricCard
            label="Avg Response"
            value={formatMs(overall_summary.avg_response_ms)}
          />
          <MetricCard
            label="P95 Response"
            value={formatMs(overall_summary.p95_response_ms)}
          />
          <MetricCard
            label="P99 Response"
            value={formatMs(overall_summary.p99_response_ms)}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MetricCard
            label="Success"
            value={formatNum(overall_summary.success_count)}
            color="text-green-400"
            small
          />
          <MetricCard
            label="Failures"
            value={formatNum(overall_summary.failure_count)}
            color={
              overall_summary.failure_count > 0
                ? "text-red-400"
                : "text-gray-300"
            }
            small
          />
          <MetricCard
            label="Min Response"
            value={formatMs(overall_summary.min_response_ms)}
            small
          />
          <MetricCard
            label="Max Response"
            value={formatMs(overall_summary.max_response_ms)}
            small
          />
        </div>
      </div>

      {/* Phase Comparison */}
      {phases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Phase Comparison
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {phases.map((phase) => {
              const colors =
                PHASE_COLORS[(phase.phase - 1) % PHASE_COLORS.length];
              const isBest = bestPhase?.phase === phase.phase;
              const isWorst =
                worstPhase?.phase === phase.phase &&
                phases.length > 1;

              return (
                <div
                  key={phase.phase}
                  className={`bg-gray-900 border rounded-xl p-5 relative ${colors.border}`}
                >
                  {isBest && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                      Best
                    </span>
                  )}
                  {isWorst && !isBest && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                      Worst
                    </span>
                  )}
                  <div
                    className={`text-xs uppercase tracking-wide mb-1 ${colors.text}`}
                  >
                    Phase {phase.phase}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {phase.site_count} sites
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg</span>
                      <span className="text-white font-medium">
                        {formatMs(phase.summary.avg_response_ms)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success</span>
                      <span
                        className={
                          phase.summary.success_rate >= 99
                            ? "text-green-400"
                            : phase.summary.success_rate >= 95
                            ? "text-yellow-400"
                            : "text-red-400"
                        }
                      >
                        {formatPercent(phase.summary.success_rate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">P95</span>
                      <span className="text-gray-300">
                        {formatMs(phase.summary.p95_response_ms)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Checks</span>
                      <span className="text-gray-300">
                        {formatNum(phase.summary.total_checks)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Phase Detailed Sections (collapsible) */}
      {phases.map((phase) => (
        <PhaseDetailSection
          key={phase.phase}
          phase={phase}
          isExpanded={expandedPhase === phase.phase}
          onToggle={() =>
            setExpandedPhase(
              expandedPhase === phase.phase ? null : phase.phase
            )
          }
        />
      ))}
    </div>
  );
}

function PhaseDetailSection({
  phase,
  isExpanded,
  onToggle,
}: {
  phase: BenchmarkPhaseReport;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = PHASE_COLORS[(phase.phase - 1) % PHASE_COLORS.length];

  return (
    <div className={`bg-gray-900 border ${colors.border} rounded-xl overflow-hidden`}>
      {/* Collapsible header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg font-semibold ${colors.text}`}>
            Phase {phase.phase}: {phase.site_count} Sites
          </span>
          <span className="text-sm text-gray-400">
            {formatPercent(phase.summary.success_rate)} success,{" "}
            {formatMs(phase.summary.avg_response_ms)} avg
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* Phase summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat
              label="Total Checks"
              value={formatNum(phase.summary.total_checks)}
            />
            <MiniStat
              label="Success Rate"
              value={formatPercent(phase.summary.success_rate)}
            />
            <MiniStat
              label="Avg Response"
              value={formatMs(phase.summary.avg_response_ms)}
            />
            <MiniStat
              label="P95 / P99"
              value={`${formatMs(phase.summary.p95_response_ms)} / ${formatMs(
                phase.summary.p99_response_ms
              )}`}
            />
          </div>

          {/* Round-by-round table */}
          {phase.rounds.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Round-by-Round Results
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left px-4 py-2 font-medium">
                        Round
                      </th>
                      <th className="text-left px-4 py-2 font-medium">
                        Time
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Checks
                      </th>
                      <th className="text-right px-4 py-2 font-medium">Up</th>
                      <th className="text-right px-4 py-2 font-medium">
                        Down
                      </th>
                      <th className="text-right px-4 py-2 font-medium">Avg</th>
                      <th className="text-right px-4 py-2 font-medium">Min</th>
                      <th className="text-right px-4 py-2 font-medium">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase.rounds.map((r) => (
                      <tr
                        key={r.round}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-2 text-white font-medium">
                          #{r.round}
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs">
                          {new Date(r.checked_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-300">
                          {formatNum(r.total_checks)}
                        </td>
                        <td className="px-4 py-2 text-right text-green-400">
                          {formatNum(r.up_count)}
                        </td>
                        <td className="px-4 py-2 text-right text-red-400">
                          {r.down_count > 0 ? formatNum(r.down_count) : "-"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-300">
                          {formatMs(r.avg_response_ms)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          {formatMs(r.min_response_ms)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          {formatMs(r.max_response_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 5 Fastest */}
          {phase.top_fastest.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Top 5 Fastest Sites
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">URL</th>
                    <th className="text-right px-4 py-2 font-medium">
                      Avg Response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {phase.top_fastest.map((site, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 text-white font-medium">
                        {site.name}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-xs">
                        {site.url}
                      </td>
                      <td className="px-4 py-2 text-right text-green-400 font-medium">
                        {formatMs(site.avg_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top 5 Slowest */}
          {phase.top_slowest.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Top 5 Slowest Sites
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">URL</th>
                    <th className="text-right px-4 py-2 font-medium">
                      Avg Response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {phase.top_slowest.map((site, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 text-white font-medium">
                        {site.name}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-xs">
                        {site.url}
                      </td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-medium">
                        {formatMs(site.avg_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Failures */}
          {phase.failures.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Failed Sites
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">URL</th>
                    <th className="text-right px-4 py-2 font-medium">
                      Failures
                    </th>
                    <th className="text-left px-4 py-2 font-medium">
                      Last Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {phase.failures.map((site, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-2 text-white font-medium">
                        {site.name}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-xs">
                        {site.url}
                      </td>
                      <td className="px-4 py-2 text-right text-red-400 font-medium">
                        {formatNum(site.fail_count)}
                      </td>
                      <td className="px-4 py-2 text-red-300 text-xs truncate max-w-sm">
                        {site.last_error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color = "text-white",
  small = false,
}: {
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`${small ? "text-lg" : "text-2xl"} font-bold ${color} mt-1`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
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
      className={`px-3 py-1 rounded-full text-sm font-medium ${
        styles[status] ?? "bg-gray-700 text-gray-300"
      }`}
    >
      {status}
    </span>
  );
}
