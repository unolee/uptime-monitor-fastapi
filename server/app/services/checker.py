import httpx
import time
from app.database import get_db


async def perform_check(url: str, method: str = "GET", timeout_seconds: int = 30, expected_status: int = 200) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
            response = await client.request(method, url, timeout=timeout_seconds, headers={"User-Agent": "UptimeMonitor/1.0"})
            elapsed_ms = int((time.monotonic() - start) * 1000)
            code = response.status_code
            size = len(response.content)
            status = "up" if 200 <= code < 400 else "down"
            error = None if code == expected_status else f"Expected {expected_status}, got {code}"
            return {
                "status": status,
                "status_code": code,
                "response_time_ms": elapsed_ms,
                "response_size_bytes": size,
                "error_message": error,
            }
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return {
            "status": "down",
            "status_code": None,
            "response_time_ms": elapsed_ms,
            "response_size_bytes": 0,
            "error_message": str(e),
        }


async def check_monitor(monitor_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM monitors WHERE id = ?", (monitor_id,))
        monitor = await cursor.fetchone()
        if not monitor:
            return None

        result = await perform_check(monitor["url"], monitor["method"], monitor["timeout_seconds"], monitor["expected_status"])

        await db.execute(
            "INSERT INTO checks (monitor_id, status, status_code, response_time_ms, response_size_bytes, error_message) VALUES (?, ?, ?, ?, ?, ?)",
            (monitor_id, result["status"], result["status_code"], result["response_time_ms"], result["response_size_bytes"], result["error_message"]),
        )

        # Incident management
        cursor = await db.execute(
            "SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1",
            (monitor_id,),
        )
        last_incident = await cursor.fetchone()

        if result["status"] == "down" and not last_incident:
            await db.execute(
                "INSERT INTO incidents (monitor_id, started_at, cause) VALUES (?, datetime('now'), ?)",
                (monitor_id, result["error_message"]),
            )
        elif result["status"] == "up" and last_incident:
            await db.execute(
                "UPDATE incidents SET resolved_at = datetime('now'), duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER) WHERE id = ?",
                (last_incident["id"],),
            )

        await db.commit()
        return result
    finally:
        await db.close()


async def check_all_monitors():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM monitors WHERE is_active = 1")
        monitors = await cursor.fetchall()
    finally:
        await db.close()

    results = []
    for m in monitors:
        r = await check_monitor(m["id"])
        results.append(r)
    return results
