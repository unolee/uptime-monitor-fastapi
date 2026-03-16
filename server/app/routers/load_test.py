import json
from fastapi import APIRouter
from app.database import get_db
from app.models import LoadTestRequest
from app.services.load_tester import run_load_test

router = APIRouter(prefix="/api/load-test", tags=["load-test"])


@router.post("")
async def execute_load_test(data: LoadTestRequest):
    result = await run_load_test(data.target_url, data.concurrent_users, data.total_requests, data.timeout_seconds)

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO load_tests (target_url, concurrent_users, total_requests, timeout_seconds,
            total_duration_ms, avg_response_ms, min_response_ms, max_response_ms,
            p95_response_ms, p99_response_ms, success_count, failure_count, rps, status_code_distribution)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                result["target_url"], result["concurrent_users"], result["total_requests"], result["timeout_seconds"],
                result["total_duration_ms"], result["avg_response_ms"], result["min_response_ms"], result["max_response_ms"],
                result["p95_response_ms"], result["p99_response_ms"], result["success_count"], result["failure_count"],
                result["rps"], json.dumps(result["status_code_distribution"]),
            ),
        )
        await db.commit()
    finally:
        await db.close()

    return result


@router.get("")
async def list_load_tests():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM load_tests ORDER BY created_at DESC LIMIT 50")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()
