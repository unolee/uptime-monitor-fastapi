import type { UptimeBarDay } from "../types";

export default function UptimeBar({ days }: { days: UptimeBarDay[] }) {
  const bars = days.length > 0 ? days.slice(-90) : [];

  return (
    <div className="flex gap-[1px] items-end h-8">
      {bars.length === 0 ? (
        <span className="text-gray-600 text-xs">No data yet</span>
      ) : (
        bars.map((d, i) => {
          let color = "bg-green-500";
          if (d.uptimePercent < 100) color = "bg-yellow-500";
          if (d.uptimePercent < 99) color = "bg-orange-500";
          if (d.uptimePercent < 95) color = "bg-red-500";
          return (
            <div
              key={i}
              className={`${color} w-1 rounded-sm h-full opacity-80 hover:opacity-100 transition`}
              title={`${d.date}: ${d.uptimePercent}%`}
            />
          );
        })
      )}
    </div>
  );
}
