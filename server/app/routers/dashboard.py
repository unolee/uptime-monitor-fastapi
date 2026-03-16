from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) as count FROM monitors")
        total_monitors = (await cursor.fetchone())["count"]

        cursor = await db.execute("SELECT COUNT(*) as count FROM monitors WHERE is_active = 1")
        active_monitors = (await cursor.fetchone())["count"]

        cursor = await db.execute("""
            SELECT m.id, m.name, m.url, m.is_active, m.interval_seconds,
                (SELECT status FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as current_status,
                (SELECT response_time_ms FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
                (SELECT checked_at FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_checked_at
            FROM monitors m ORDER BY m.created_at DESC
        """)
        monitors = [dict(r) for r in await cursor.fetchall()]

        up_count = sum(1 for m in monitors if m["current_status"] == "up")
        down_count = sum(1 for m in monitors if m["current_status"] == "down")

        cursor = await db.execute("SELECT AVG(response_time_ms) as avg_ms FROM checks WHERE checked_at > datetime('now', '-1 hour') AND status = 'up'")
        avg_row = await cursor.fetchone()
        avg_response_time = round(avg_row["avg_ms"]) if avg_row["avg_ms"] else 0

        cursor = await db.execute("""
            SELECT i.*, m.name as monitor_name, m.url as monitor_url
            FROM incidents i JOIN monitors m ON i.monitor_id = m.id
            WHERE i.resolved_at IS NULL ORDER BY i.started_at DESC
        """)
        active_incidents = [dict(r) for r in await cursor.fetchall()]

        # 90-day uptime bars
        uptime_bars = []
        for m in monitors:
            cursor = await db.execute("""
                SELECT date(checked_at) as day, COUNT(*) as total,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
                FROM checks WHERE monitor_id = ? AND checked_at > datetime('now', '-90 days')
                GROUP BY date(checked_at) ORDER BY day ASC
            """, (m["id"],))
            days = []
            for row in await cursor.fetchall():
                days.append({
                    "date": row["day"],
                    "uptimePercent": round((row["up_count"] / row["total"]) * 10000) / 100,
                })
            uptime_bars.append({"monitorId": m["id"], "monitorName": m["name"], "days": days})

        return {
            "totalMonitors": total_monitors,
            "activeMonitors": active_monitors,
            "upCount": up_count,
            "downCount": down_count,
            "avgResponseTime": avg_response_time,
            "monitors": monitors,
            "activeIncidents": active_incidents,
            "uptimeBars": uptime_bars,
        }
    finally:
        await db.close()
