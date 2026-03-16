import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import init_db
from app.services.scheduler import start_scheduler, stop_scheduler
from app.routers import monitors, checks, dashboard, load_test, cron, ssl_api, benchmark


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Mark any benchmarks left in 'running' state as interrupted (server restarted)
    from app.services.benchmark import cleanup_interrupted_benchmarks
    await cleanup_interrupted_benchmarks()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Uptime Monitor (FastAPI)", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(monitors.router)
app.include_router(checks.router)
app.include_router(dashboard.router)
app.include_router(load_test.router)
app.include_router(cron.router)
app.include_router(ssl_api.router)
app.include_router(benchmark.router)


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/")
async def root():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Uptime Monitor API Server (FastAPI)"}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
