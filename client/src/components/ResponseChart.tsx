import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Check } from "../types";

export default function ResponseChart({ checks }: { checks: Check[] }) {
  const data = checks.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    ms: c.response_time_ms,
  }));

  if (data.length === 0) {
    return <div className="text-gray-600 text-sm py-8 text-center">No check data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} />
        <YAxis stroke="#9CA3AF" fontSize={11} unit="ms" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
          labelStyle={{ color: "#9CA3AF" }}
          itemStyle={{ color: "#34D399" }}
        />
        <Line type="monotone" dataKey="ms" stroke="#34D399" strokeWidth={2} dot={false} name="Response Time" />
      </LineChart>
    </ResponsiveContainer>
  );
}
