import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.checker import check_all_monitors

scheduler = AsyncIOScheduler()


def start_scheduler():
    async def job():
        print(f"[Scheduler] Running checks...")
        try:
            results = await check_all_monitors()
            print(f"[Scheduler] Checked {len(results)} monitors")
        except Exception as e:
            print(f"[Scheduler] Error: {e}")

    scheduler.add_job(job, "interval", seconds=60, id="monitor_checks", replace_existing=True)
    scheduler.start()
    print("[Scheduler] Started - checking every minute")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
