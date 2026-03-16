import aiosqlite
import os
from pathlib import Path

DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "uptime.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    interval_seconds INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 30,
    expected_status INTEGER DEFAULT 200,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    response_size_bytes INTEGER,
    error_message TEXT,
    checked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ssl_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    issuer TEXT,
    subject TEXT,
    valid_from TEXT,
    valid_to TEXT,
    days_remaining INTEGER,
    checked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    resolved_at TEXT,
    duration_seconds INTEGER,
    cause TEXT
);

CREATE TABLE IF NOT EXISTS load_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_url TEXT NOT NULL,
    concurrent_users INTEGER NOT NULL,
    total_requests INTEGER NOT NULL,
    timeout_seconds INTEGER DEFAULT 30,
    total_duration_ms INTEGER,
    avg_response_ms REAL,
    min_response_ms INTEGER,
    max_response_ms INTEGER,
    p95_response_ms INTEGER,
    p99_response_ms INTEGER,
    success_count INTEGER,
    failure_count INTEGER,
    rps REAL,
    status_code_distribution TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    total_rounds INTEGER NOT NULL DEFAULT 10,
    completed_rounds INTEGER NOT NULL DEFAULT 0,
    check_interval_seconds INTEGER NOT NULL DEFAULT 60,
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor ON checks(monitor_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_load_tests_created ON load_tests(created_at);
"""


async def get_db() -> aiosqlite.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    db = await get_db()
    try:
        await db.executescript(SCHEMA)
        await db.commit()
        # Add benchmark_id column to monitors if it doesn't exist
        try:
            await db.execute(
                "ALTER TABLE monitors ADD COLUMN benchmark_id INTEGER REFERENCES benchmarks(id) ON DELETE CASCADE"
            )
            await db.commit()
        except Exception:
            pass  # Column already exists
        try:
            await db.execute("ALTER TABLE benchmarks ADD COLUMN current_phase INTEGER DEFAULT 1")
            await db.commit()
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE benchmarks ADD COLUMN total_phases INTEGER DEFAULT 5")
            await db.commit()
        except Exception:
            pass
    finally:
        await db.close()
