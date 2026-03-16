from fastapi import APIRouter
from datetime import datetime
from app.services.checker import check_all_monitors

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.post("")
async def trigger_check():
    results = await check_all_monitors()
    return {"checked": len(results), "timestamp": datetime.utcnow().isoformat()}
