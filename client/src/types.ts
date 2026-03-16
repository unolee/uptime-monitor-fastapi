

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  interval_seconds: number;
  timeout_seconds: number;
  expected_status: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  current_status?: string | null;
  last_response_time?: number | null;
  last_checked_at?: string | null;
  uptime_24h?: number | null;
}

export interface Check {
  id: number;
  status: string;
  status_code: number;
  response_time_ms: number;
  response_size_bytes: number;
  error_message: string | null;
  checked_at: string;
}

export interface SSLData {
  issuer: string;
  subject: string;
  valid_from: string;
  valid_to: string;
  days_remaining: number;
}

export interface Incident {
  id: number;
  monitor_id: number;
  monitor_name?: string;
  monitor_url?: string;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  cause: string | null;
}

export interface UptimeBarDay {
  date: string;
  uptimePercent: number;
}

export interface UptimeBarData {
  monitorId: number;
  monitorName: string;
  days: UptimeBarDay[];
}

export interface DashboardData {
  totalMonitors: number;
  activeMonitors: number;
  upCount: number;
  downCount: number;
  avgResponseTime: number;
  monitors: Monitor[];
  activeIncidents: Incident[];
  uptimeBars: UptimeBarData[];
}

export interface ChecksResponse {
  checks: Check[];
  uptimePercent: number;
  avgResponseTime: number;
  total: number;
}

export interface LoadTestResult {
  target_url?: string;
  targetUrl?: string;
  concurrent_users?: number;
  concurrentUsers?: number;
  total_requests?: number;
  totalRequests?: number;
  timeout_seconds?: number;
  timeoutSeconds?: number;
  total_duration_ms?: number;
  totalDurationMs?: number;
  avg_response_ms?: number;
  avgResponseMs?: number;
  min_response_ms?: number;
  minResponseMs?: number;
  max_response_ms?: number;
  maxResponseMs?: number;
  p95_response_ms?: number;
  p95ResponseMs?: number;
  p99_response_ms?: number;
  p99ResponseMs?: number;
  success_count?: number;
  successCount?: number;
  failure_count?: number;
  failureCount?: number;
  rps?: number;
  status_code_distribution?: string | Record<string, number>;
  statusCodeDistribution?: Record<string, number>;
  created_at?: string;
  id?: number;
}

export interface BenchmarkPhaseRound {
  round: number;
  checked_at: string;
  total_checks: number;
  up_count: number;
  down_count: number;
  avg_response_ms: number;
  min_response_ms: number;
  max_response_ms: number;
}

export interface BenchmarkPhase {
  phase: number;
  site_count: number;
  completed: boolean;
  rounds: BenchmarkPhaseRound[];
}

export interface BenchmarkCurrent {
  id: number;
  status: string; // 'running' | 'completed' | 'stopped' | 'interrupted'
  current_phase: number;
  total_phases: number;
  site_count: number; // current phase's site count
  completed_rounds: number;
  total_rounds: number;
  check_interval_seconds: number;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  phases: BenchmarkPhase[];
  progress: {
    elapsed_seconds: number;
    remaining_seconds: number;
    percent: number;
  } | null;
}

export interface BenchmarkStatusResponse {
  current: BenchmarkCurrent | null;
  history: BenchmarkHistoryItem[];
}

export interface BenchmarkHistoryItem {
  id: number;
  site_count: number;
  status: string;
  completed_rounds: number;
  total_rounds: number;
  total_phases: number;
  current_phase: number;
  started_at: string;
  ended_at: string | null;
}

export interface BenchmarkPhaseSummary {
  total_checks: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_response_ms: number;
  min_response_ms: number;
  max_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
}

export interface BenchmarkPhaseReport {
  phase: number;
  site_count: number;
  summary: BenchmarkPhaseSummary;
  rounds: BenchmarkPhaseRound[];
  top_fastest: Array<{ name: string; url: string; avg_ms: number }>;
  top_slowest: Array<{ name: string; url: string; avg_ms: number }>;
  failures: Array<{ name: string; url: string; fail_count: number; last_error: string }>;
}

export interface BenchmarkReportData {
  benchmark: Omit<BenchmarkCurrent, 'phases' | 'progress'>;
  phases: BenchmarkPhaseReport[];
  overall_summary: BenchmarkPhaseSummary;
}

// Normalize field names from both servers
export function normalizeLoadTest(r: LoadTestResult) {
  return {
    targetUrl: r.target_url || r.targetUrl || "",
    concurrentUsers: r.concurrent_users ?? r.concurrentUsers ?? 0,
    totalRequests: r.total_requests ?? r.totalRequests ?? 0,
    totalDurationMs: r.total_duration_ms ?? r.totalDurationMs ?? 0,
    avgResponseMs: r.avg_response_ms ?? r.avgResponseMs ?? 0,
    minResponseMs: r.min_response_ms ?? r.minResponseMs ?? 0,
    maxResponseMs: r.max_response_ms ?? r.maxResponseMs ?? 0,
    p95ResponseMs: r.p95_response_ms ?? r.p95ResponseMs ?? 0,
    p99ResponseMs: r.p99_response_ms ?? r.p99ResponseMs ?? 0,
    successCount: r.success_count ?? r.successCount ?? 0,
    failureCount: r.failure_count ?? r.failureCount ?? 0,
    rps: r.rps ?? 0,
    statusCodeDistribution:
      typeof r.status_code_distribution === "string"
        ? JSON.parse(r.status_code_distribution)
        : r.status_code_distribution ?? r.statusCodeDistribution ?? {},
    createdAt: r.created_at || "",
    id: r.id,
  };
}
