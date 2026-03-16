from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import MonitorCreate, MonitorUpdate

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.get("")
async def list_monitors():
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT m.*,
                (SELECT status FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as current_status,
                (SELECT response_time_ms FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
                (SELECT COUNT(*) FROM checks WHERE monitor_id = m.id AND status = 'up' AND checked_at > datetime('now', '-24 hours')) * 100.0 /
                    NULLIF((SELECT COUNT(*) FROM checks WHERE monitor_id = m.id AND checked_at > datetime('now', '-24 hours')), 0) as uptime_24h
            FROM monitors m ORDER BY m.created_at DESC
        """)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.post("", status_code=201)
async def create_monitor(data: MonitorCreate):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO monitors (name, url, method, interval_seconds, timeout_seconds, expected_status) VALUES (?, ?, ?, ?, ?, ?)",
            (data.name, data.url, data.method, data.interval_seconds, data.timeout_seconds, data.expected_status),
        )
        await db.commit()
        monitor_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM monitors WHERE id = ?", (monitor_id,))
        row = await cursor.fetchone()
        return dict(row)
    finally:
        await db.close()


@router.get("/{monitor_id}")
async def get_monitor(monitor_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM monitors WHERE id = ?", (monitor_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return dict(row)
    finally:
        await db.close()


@router.put("/{monitor_id}")
async def update_monitor(monitor_id: int, data: MonitorUpdate):
    db = await get_db()
    try:
        await db.execute(
            "UPDATE monitors SET name=?, url=?, method=?, interval_seconds=?, timeout_seconds=?, expected_status=?, is_active=?, updated_at=datetime('now') WHERE id=?",
            (data.name, data.url, data.method, data.interval_seconds, data.timeout_seconds, data.expected_status, 1 if data.is_active else 0, monitor_id),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM monitors WHERE id = ?", (monitor_id,))
        row = await cursor.fetchone()
        return dict(row)
    finally:
        await db.close()


@router.delete("/{monitor_id}")
async def delete_monitor(monitor_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM monitors WHERE id = ?", (monitor_id,))
        await db.commit()
        return {"success": True}
    finally:
        await db.close()
