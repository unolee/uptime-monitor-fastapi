from fastapi import APIRouter
from app.database import get_db
from app.services.ssl_checker import check_monitor_ssl

router = APIRouter(prefix="/api/ssl", tags=["ssl"])


@router.get("/{monitor_id}")
async def get_ssl(monitor_id: int):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM ssl_certificates WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1",
            (monitor_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


@router.post("/{monitor_id}")
async def refresh_ssl(monitor_id: int):
    info = await check_monitor_ssl(monitor_id)
    return info
