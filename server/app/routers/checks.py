from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/checks", tags=["checks"])

PERIOD_MAP = {
    "1h": "-1 hour",
    "24h": "-1 day",
    "7d": "-7 days",
    "30d": "-30 days",
    "90d": "-90 days",
}


@router.get("/{monitor_id}")
async def get_checks(monitor_id: int, period: str = "24h"):
    time_offset = PERIOD_MAP.get(period, "-1 day")

    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT id, status, status_code, response_time_ms, response_size_bytes, error_message, checked_at FROM checks WHERE monitor_id = ? AND checked_at > datetime('now', ?) ORDER BY checked_at ASC",
            (monitor_id, time_offset),
        )
        rows = await cursor.fetchall()
        checks = [dict(r) for r in rows]

        total = len(checks)
        up = sum(1 for c in checks if c["status"] == "up")
        uptime_percent = round((up / total) * 10000) / 100 if total > 0 else 0

        response_times = [c["response_time_ms"] for c in checks if c["response_time_ms"] and c["response_time_ms"] > 0]
        avg_response_time = round(sum(response_times) / len(response_times)) if response_times else 0

        return {"checks": checks, "uptimePercent": uptime_percent, "avgResponseTime": avg_response_time, "total": total}
    finally:
        await db.close()
