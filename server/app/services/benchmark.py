import asyncio
import time
from app.database import get_db
from app.services.benchmark_sites import get_benchmark_sites
from app.services.checker import perform_check

# Module-level state
_benchmark_task: asyncio.Task | None = None
_current_benchmark_id: int | None = None
_benchmark_started_at: float | None = None

PHASES = [25, 50, 100, 200, 400]
ROUNDS_PER_PHASE = 10
DEFAULT_CHECK_INTERVAL = 60


async def start_benchmark(check_interval_seconds: int = DEFAULT_CHECK_INTERVAL) -> dict:
    global _benchmark_task, _current_benchmark_id, _benchmark_started_at

    # Check no benchmark is currently running
    if _benchmark_task is not None and not _benchmark_task.done():
        raise RuntimeError("A benchmark is already running")

    # Also check DB for any stuck 'running' benchmarks
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM benchmarks WHERE status = 'running' LIMIT 1"
        )
        row = await cursor.fetchone()
        if row:
            raise RuntimeError(
                f"A benchmark (id={row['id']}) is already marked as running in the database"
            )

        total_rounds = ROUNDS_PER_PHASE * len(PHASES)
        duration_minutes = round(total_rounds * check_interval_seconds / 60, 1)

        # Create benchmark record
        cursor = await db.execute(
            """INSERT INTO benchmarks (site_count, status, total_rounds, completed_rounds,
               check_interval_seconds, duration_minutes, current_phase, total_phases)
               VALUES (?, 'running', ?, 0, ?, ?, 1, ?)""",
            (PHASES[-1], total_rounds, check_interval_seconds, duration_minutes, len(PHASES)),
        )
        benchmark_id = cursor.lastrowid
        await db.commit()

        _current_benchmark_id = benchmark_id
        _benchmark_started_at = time.monotonic()
    finally:
        await db.close()

    # Start background task
    _benchmark_task = asyncio.create_task(_run_benchmark(benchmark_id, check_interval_seconds))

    return {
        "id": benchmark_id,
        "site_count": PHASES[-1],
        "status": "running",
        "total_rounds": total_rounds,
        "total_phases": len(PHASES),
        "current_phase": 1,
        "completed_rounds": 0,
        "check_interval_seconds": check_interval_seconds,
        "duration_minutes": duration_minutes,
        "phases": [{"phase": i + 1, "site_count": PHASES[i]} for i in range(len(PHASES))],
    }


async def _run_benchmark(benchmark_id: int, check_interval_seconds: int):
    """The actual background loop for running benchmark checks across all phases."""
    global _benchmark_task, _current_benchmark_id, _benchmark_started_at

    try:
        for phase_idx, phase_site_count in enumerate(PHASES):
            phase_num = phase_idx + 1
            print(f"[Benchmark] Starting phase {phase_num}/{len(PHASES)} ({phase_site_count} sites)")

            # Update benchmark: current_phase and site_count for this phase
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE benchmarks SET current_phase = ?, site_count = ? WHERE id = ?",
                    (phase_num, phase_site_count, benchmark_id),
                )
                await db.commit()
            finally:
                await db.close()

            # Create monitors for this phase
            sites = get_benchmark_sites(phase_site_count)
            db = await get_db()
            try:
                for site in sites:
                    await db.execute(
                        """INSERT INTO monitors (name, url, method, interval_seconds, timeout_seconds,
                           expected_status, is_active, benchmark_id)
                           VALUES (?, ?, 'GET', ?, 30, 200, 0, ?)""",
                        (f"[Bench P{phase_num}] {site['name']}", site["url"],
                         check_interval_seconds, benchmark_id),
                    )
                await db.commit()
            finally:
                await db.close()

            # Run ROUNDS_PER_PHASE rounds for this phase
            for round_in_phase in range(1, ROUNDS_PER_PHASE + 1):
                overall_round = phase_idx * ROUNDS_PER_PHASE + round_in_phase
                print(f"[Benchmark] Phase {phase_num} - Round {round_in_phase}/{ROUNDS_PER_PHASE} (overall {overall_round})")

                # Fetch monitors for this phase
                db = await get_db()
                try:
                    cursor = await db.execute(
                        """SELECT id, url, method, timeout_seconds, expected_status
                           FROM monitors
                           WHERE benchmark_id = ? AND name LIKE ?""",
                        (benchmark_id, f"[Bench P{phase_num}]%"),
                    )
                    monitors = [dict(m) for m in await cursor.fetchall()]
                finally:
                    await db.close()

                # Check all sites with concurrency limit
                semaphore = asyncio.Semaphore(10)

                async def check_site(monitor: dict):
                    async with semaphore:
                        result = await perform_check(
                            monitor["url"],
                            monitor.get("method", "GET"),
                            monitor.get("timeout_seconds", 30),
                            monitor.get("expected_status", 200),
                        )
                        db2 = await get_db()
                        try:
                            await db2.execute(
                                """INSERT INTO checks
                                   (monitor_id, status, status_code, response_time_ms, response_size_bytes, error_message)
                                   VALUES (?, ?, ?, ?, ?, ?)""",
                                (
                                    monitor["id"],
                                    result["status"],
                                    result["status_code"],
                                    result["response_time_ms"],
                                    result["response_size_bytes"],
                                    result["error_message"],
                                ),
                            )
                            await db2.commit()
                        finally:
                            await db2.close()
                        return result

                tasks = [check_site(m) for m in monitors]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                up = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "up")
                down = len(results) - up
                print(f"[Benchmark] Phase {phase_num} Round {round_in_phase}: {up} up, {down} down")

                # Update completed_rounds (overall)
                db = await get_db()
                try:
                    await db.execute(
                        "UPDATE benchmarks SET completed_rounds = ? WHERE id = ?",
                        (overall_round, benchmark_id),
                    )
                    await db.commit()
                finally:
                    await db.close()

                # Sleep between rounds (except after the last round of the last phase)
                is_last_round_of_phase = round_in_phase == ROUNDS_PER_PHASE
                is_last_phase = phase_num == len(PHASES)
                if not (is_last_round_of_phase and is_last_phase):
                    if not is_last_round_of_phase:
                        await asyncio.sleep(check_interval_seconds)
            # Proceed to next phase immediately (no sleep between phases)

        # Benchmark completed
        db = await get_db()
        try:
            await db.execute(
                "UPDATE benchmarks SET status = 'completed', ended_at = datetime('now'), site_count = ? WHERE id = ?",
                (PHASES[-1], benchmark_id),
            )
            await db.commit()
        finally:
            await db.close()

        print(f"[Benchmark] Benchmark {benchmark_id} completed successfully")

    except asyncio.CancelledError:
        print(f"[Benchmark] Benchmark {benchmark_id} was cancelled")
        raise

    except Exception as e:
        print(f"[Benchmark] Benchmark {benchmark_id} failed: {e}")
        db = await get_db()
        try:
            await db.execute(
                "UPDATE benchmarks SET status = 'failed', ended_at = datetime('now'), error_message = ? WHERE id = ?",
                (str(e), benchmark_id),
            )
            await db.commit()
        finally:
            await db.close()

    finally:
        _benchmark_task = None
        _current_benchmark_id = None
        _benchmark_started_at = None


async def get_benchmark_status() -> dict:
    """Return current/latest benchmark status with per-phase round stats and progress."""
    db = await get_db()
    try:
        # Get current or most recent benchmark
        cursor = await db.execute(
            "SELECT * FROM benchmarks ORDER BY id DESC LIMIT 1"
        )
        benchmark = await cursor.fetchone()
        if not benchmark:
            return {"current": None, "history": []}

        benchmark_dict = dict(benchmark)
        bid = benchmark_dict["id"]

        # Build phase info
        current_phase = benchmark_dict.get("current_phase", 1) or 1
        total_phases = benchmark_dict.get("total_phases", len(PHASES)) or len(PHASES)
        phases_data = []

        for phase_num in range(1, total_phases + 1):
            phase_site_count = PHASES[phase_num - 1] if phase_num <= len(PHASES) else PHASES[-1]
            completed_for_phase = max(0, min(ROUNDS_PER_PHASE,
                benchmark_dict["completed_rounds"] - (phase_num - 1) * ROUNDS_PER_PHASE))
            phase_completed = completed_for_phase >= ROUNDS_PER_PHASE

            # Get rounds for this phase
            rounds = await _get_phase_round_stats(db, bid, phase_num, phase_site_count)

            phases_data.append({
                "phase": phase_num,
                "site_count": phase_site_count,
                "completed": phase_completed,
                "rounds": rounds,
            })

        benchmark_dict["phases"] = phases_data
        benchmark_dict["site_count"] = PHASES[current_phase - 1] if current_phase <= len(PHASES) else PHASES[-1]

        # Calculate progress
        total = benchmark_dict["total_rounds"]
        completed = benchmark_dict["completed_rounds"]
        check_interval = benchmark_dict.get("check_interval_seconds", DEFAULT_CHECK_INTERVAL)

        elapsed_seconds = 0
        if _benchmark_started_at is not None:
            elapsed_seconds = round(time.monotonic() - _benchmark_started_at)

        total_seconds = total * check_interval
        remaining_seconds = max(0, total_seconds - elapsed_seconds)
        percent = round(completed / total * 100, 1) if total > 0 else 0

        benchmark_dict["progress"] = {
            "elapsed_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "percent": percent,
        }

        # History: last 10 benchmarks
        cursor = await db.execute(
            "SELECT * FROM benchmarks ORDER BY id DESC LIMIT 10"
        )
        rows = await cursor.fetchall()
        history = [dict(r) for r in rows]

        return {"current": benchmark_dict, "history": history}
    finally:
        await db.close()


async def _get_phase_round_stats(db, benchmark_id: int, phase_num: int, phase_site_count: int) -> list:
    """Get per-round statistics for a specific phase of a benchmark."""
    cursor = await db.execute(
        """SELECT
            c.checked_at,
            c.status,
            c.response_time_ms,
            c.status_code
        FROM checks c
        JOIN monitors m ON c.monitor_id = m.id
        WHERE m.benchmark_id = ? AND m.name LIKE ?
        ORDER BY c.checked_at ASC""",
        (benchmark_id, f"[Bench P{phase_num}]%"),
    )
    all_checks = await cursor.fetchall()
    if not all_checks:
        return []

    # Split into rounds based on phase_site_count
    rounds = []
    for i in range(0, len(all_checks), phase_site_count):
        chunk = all_checks[i: i + phase_site_count]
        if not chunk:
            break
        round_num = len(rounds) + 1
        up = sum(1 for c in chunk if c["status"] == "up")
        down = sum(1 for c in chunk if c["status"] == "down")
        times = [c["response_time_ms"] for c in chunk if c["response_time_ms"] is not None]
        avg_ms = round(sum(times) / len(times), 1) if times else 0
        min_ms = min(times) if times else 0
        max_ms = max(times) if times else 0
        rounds.append({
            "round": round_num,
            "checked_at": chunk[0]["checked_at"] if chunk else None,
            "total_checks": len(chunk),
            "up_count": up,
            "down_count": down,
            "avg_response_ms": avg_ms,
            "min_response_ms": min_ms,
            "max_response_ms": max_ms,
        })

    return rounds


async def get_benchmark_report(benchmark_id: int) -> dict:
    """Detailed report with per-phase summary, rounds, top fastest/slowest, failures."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM benchmarks WHERE id = ?", (benchmark_id,)
        )
        benchmark = await cursor.fetchone()
        if not benchmark:
            return None

        benchmark_dict = dict(benchmark)
        total_phases = benchmark_dict.get("total_phases", len(PHASES)) or len(PHASES)

        phases_report = []
        all_response_times = []
        overall_total_checks = 0
        overall_success_count = 0
        overall_failure_count = 0
        overall_sum_ms = 0
        overall_count_ms = 0

        for phase_num in range(1, total_phases + 1):
            phase_site_count = PHASES[phase_num - 1] if phase_num <= len(PHASES) else PHASES[-1]

            # Get rounds for this phase
            rounds = await _get_phase_round_stats(db, benchmark_id, phase_num, phase_site_count)

            # Get per-site stats for this phase
            cursor = await db.execute(
                "SELECT id, name, url FROM monitors WHERE benchmark_id = ? AND name LIKE ?",
                (benchmark_id, f"[Bench P{phase_num}]%"),
            )
            monitors = await cursor.fetchall()

            site_stats = []
            failures_list = []
            for m in monitors:
                mid = m["id"]
                cursor = await db.execute(
                    """SELECT
                        COUNT(*) as total_checks,
                        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
                        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_count,
                        AVG(response_time_ms) as avg_response_ms,
                        MIN(response_time_ms) as min_response_ms,
                        MAX(response_time_ms) as max_response_ms
                    FROM checks WHERE monitor_id = ?""",
                    (mid,),
                )
                stats = dict(await cursor.fetchone())
                avg_ms = round(stats["avg_response_ms"], 1) if stats["avg_response_ms"] is not None else None
                site_stats.append({
                    "name": m["name"],
                    "url": m["url"],
                    "avg_ms": avg_ms,
                    "total_checks": stats["total_checks"],
                    "up_count": stats["up_count"] or 0,
                    "down_count": stats["down_count"] or 0,
                })

                if (stats["down_count"] or 0) > 0:
                    # Get last error
                    cursor = await db.execute(
                        """SELECT error_message FROM checks
                           WHERE monitor_id = ? AND status = 'down'
                           ORDER BY checked_at DESC LIMIT 1""",
                        (mid,),
                    )
                    err_row = await cursor.fetchone()
                    failures_list.append({
                        "name": m["name"],
                        "url": m["url"],
                        "fail_count": stats["down_count"],
                        "last_error": err_row["error_message"] if err_row else None,
                    })

            # Phase summary
            cursor = await db.execute(
                """SELECT
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN c.status = 'up' THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN c.status = 'down' THEN 1 ELSE 0 END) as failure_count,
                    AVG(c.response_time_ms) as avg_response_ms,
                    MIN(c.response_time_ms) as min_response_ms,
                    MAX(c.response_time_ms) as max_response_ms
                FROM checks c
                JOIN monitors m ON c.monitor_id = m.id
                WHERE m.benchmark_id = ? AND m.name LIKE ?""",
                (benchmark_id, f"[Bench P{phase_num}]%"),
            )
            phase_summary_row = dict(await cursor.fetchone())

            # Get all response times for percentiles
            cursor = await db.execute(
                """SELECT c.response_time_ms FROM checks c
                   JOIN monitors m ON c.monitor_id = m.id
                   WHERE m.benchmark_id = ? AND m.name LIKE ? AND c.response_time_ms IS NOT NULL
                   ORDER BY c.response_time_ms ASC""",
                (benchmark_id, f"[Bench P{phase_num}]%"),
            )
            phase_times = [row["response_time_ms"] for row in await cursor.fetchall()]
            all_response_times.extend(phase_times)

            p95 = _percentile(phase_times, 95)
            p99 = _percentile(phase_times, 99)

            total_c = phase_summary_row["total_checks"] or 0
            success_c = phase_summary_row["success_count"] or 0
            failure_c = phase_summary_row["failure_count"] or 0
            success_rate = round(success_c / total_c * 100, 1) if total_c > 0 else 0

            overall_total_checks += total_c
            overall_success_count += success_c
            overall_failure_count += failure_c
            if phase_summary_row["avg_response_ms"] is not None:
                overall_sum_ms += phase_summary_row["avg_response_ms"] * len(phase_times)
                overall_count_ms += len(phase_times)

            # Top fastest/slowest
            valid_sites = [s for s in site_stats if s["avg_ms"] is not None]
            top_fastest = sorted(valid_sites, key=lambda x: x["avg_ms"])[:5]
            top_slowest = sorted(valid_sites, key=lambda x: x["avg_ms"], reverse=True)[:5]

            phases_report.append({
                "phase": phase_num,
                "site_count": phase_site_count,
                "summary": {
                    "total_checks": total_c,
                    "success_count": success_c,
                    "failure_count": failure_c,
                    "success_rate": success_rate,
                    "avg_response_ms": round(phase_summary_row["avg_response_ms"], 1) if phase_summary_row["avg_response_ms"] else 0,
                    "min_response_ms": phase_summary_row["min_response_ms"] or 0,
                    "max_response_ms": phase_summary_row["max_response_ms"] or 0,
                    "p95_response_ms": p95,
                    "p99_response_ms": p99,
                },
                "rounds": rounds,
                "top_fastest": [{"name": s["name"], "url": s["url"], "avg_ms": s["avg_ms"]} for s in top_fastest],
                "top_slowest": [{"name": s["name"], "url": s["url"], "avg_ms": s["avg_ms"]} for s in top_slowest],
                "failures": failures_list,
            })

        # Overall summary
        all_response_times.sort()
        overall_avg = round(overall_sum_ms / overall_count_ms, 1) if overall_count_ms > 0 else 0
        overall_success_rate = round(overall_success_count / overall_total_checks * 100, 1) if overall_total_checks > 0 else 0
        overall_p95 = _percentile(all_response_times, 95)
        overall_p99 = _percentile(all_response_times, 99)

        return {
            "benchmark": benchmark_dict,
            "phases": phases_report,
            "overall_summary": {
                "total_checks": overall_total_checks,
                "success_count": overall_success_count,
                "failure_count": overall_failure_count,
                "success_rate": overall_success_rate,
                "avg_response_ms": overall_avg,
                "min_response_ms": all_response_times[0] if all_response_times else 0,
                "max_response_ms": all_response_times[-1] if all_response_times else 0,
                "p95_response_ms": overall_p95,
                "p99_response_ms": overall_p99,
            },
        }
    finally:
        await db.close()


def _percentile(sorted_values: list, pct: int) -> int:
    """Calculate percentile from a sorted list of values."""
    if not sorted_values:
        return 0
    k = (len(sorted_values) - 1) * pct / 100
    f = int(k)
    c = f + 1
    if c >= len(sorted_values):
        return sorted_values[-1]
    return round(sorted_values[f] + (k - f) * (sorted_values[c] - sorted_values[f]))


async def get_benchmark_history() -> list:
    """List all benchmarks."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM benchmarks ORDER BY id DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def stop_benchmark() -> dict:
    global _benchmark_task, _current_benchmark_id, _benchmark_started_at

    if _benchmark_task is None or _benchmark_task.done():
        # Try to stop any DB-level running benchmark
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT id FROM benchmarks WHERE status = 'running' LIMIT 1"
            )
            row = await cursor.fetchone()
            if row:
                await db.execute(
                    "UPDATE benchmarks SET status = 'stopped', ended_at = datetime('now') WHERE id = ?",
                    (row["id"],),
                )
                await db.commit()
                _current_benchmark_id = None
                _benchmark_started_at = None
                return {"message": "Benchmark stopped", "id": row["id"]}
        finally:
            await db.close()
        raise RuntimeError("No benchmark is currently running")

    # Save the ID before cancelling (finally block in _run_benchmark clears it)
    bid = _current_benchmark_id

    # Cancel the task
    _benchmark_task.cancel()
    try:
        await _benchmark_task
    except asyncio.CancelledError:
        pass

    # Update DB status to stopped
    db = await get_db()
    try:
        await db.execute(
            "UPDATE benchmarks SET status = 'stopped', ended_at = datetime('now') WHERE id = ?",
            (bid,),
        )
        await db.commit()
    finally:
        await db.close()

    _benchmark_task = None
    _current_benchmark_id = None
    _benchmark_started_at = None

    return {"message": "Benchmark stopped", "id": bid}


async def delete_benchmark(benchmark_id: int) -> dict:
    """Delete a benchmark and its associated monitors and check data."""
    global _benchmark_task, _current_benchmark_id

    # Don't allow deleting a running benchmark
    if _current_benchmark_id == benchmark_id and _benchmark_task and not _benchmark_task.done():
        raise RuntimeError("Cannot delete a running benchmark. Stop it first.")

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM benchmarks WHERE id = ?", (benchmark_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None

        # Delete checks for benchmark monitors
        await db.execute(
            """DELETE FROM checks WHERE monitor_id IN
               (SELECT id FROM monitors WHERE benchmark_id = ?)""",
            (benchmark_id,),
        )
        # Delete benchmark monitors
        await db.execute(
            "DELETE FROM monitors WHERE benchmark_id = ?", (benchmark_id,)
        )
        # Delete benchmark record
        await db.execute(
            "DELETE FROM benchmarks WHERE id = ?", (benchmark_id,)
        )
        await db.commit()
        return {"message": "Benchmark deleted", "id": benchmark_id}
    finally:
        await db.close()


async def cleanup_interrupted_benchmarks():
    """Mark any 'running' benchmarks as 'interrupted'. Called at startup."""
    db = await get_db()
    try:
        await db.execute(
            "UPDATE benchmarks SET status = 'interrupted', ended_at = datetime('now') WHERE status = 'running'"
        )
        await db.commit()
    finally:
        await db.close()
