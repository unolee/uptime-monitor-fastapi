import asyncio
import time
import httpx


async def single_request(client: httpx.AsyncClient, url: str, timeout: float) -> dict:
    start = time.monotonic()
    try:
        response = await client.get(url, timeout=timeout)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return {
            "status_code": response.status_code,
            "response_time_ms": elapsed_ms,
            "success": 200 <= response.status_code < 400,
        }
    except Exception:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return {"status_code": 0, "response_time_ms": elapsed_ms, "success": False}


def percentile(sorted_arr: list[int], p: float) -> int:
    if not sorted_arr:
        return 0
    idx = max(0, int((p / 100) * len(sorted_arr)) - 1)
    return sorted_arr[idx]


async def run_load_test(target_url: str, concurrent_users: int, total_requests: int, timeout_seconds: int) -> dict:
    concurrent_users = max(1, min(concurrent_users, 500))
    total_requests = max(10, min(total_requests, 10000))

    response_times: list[int] = []
    status_codes: dict[str, int] = {}
    success_count = 0
    failure_count = 0

    total_start = time.monotonic()

    async with httpx.AsyncClient(verify=False, headers={"User-Agent": "UptimeMonitor-LoadTest/1.0"}) as client:
        completed = 0
        while completed < total_requests:
            batch_size = min(concurrent_users, total_requests - completed)
            tasks = [single_request(client, target_url, timeout_seconds) for _ in range(batch_size)]
            results = await asyncio.gather(*tasks)

            for r in results:
                response_times.append(r["response_time_ms"])
                key = str(r["status_code"])
                status_codes[key] = status_codes.get(key, 0) + 1
                if r["success"]:
                    success_count += 1
                else:
                    failure_count += 1

            completed += batch_size

    total_duration_ms = int((time.monotonic() - total_start) * 1000)
    response_times.sort()

    avg_ms = round(sum(response_times) / len(response_times)) if response_times else 0

    return {
        "target_url": target_url,
        "concurrent_users": concurrent_users,
        "total_requests": total_requests,
        "timeout_seconds": timeout_seconds,
        "total_duration_ms": total_duration_ms,
        "avg_response_ms": avg_ms,
        "min_response_ms": response_times[0] if response_times else 0,
        "max_response_ms": response_times[-1] if response_times else 0,
        "p95_response_ms": percentile(response_times, 95),
        "p99_response_ms": percentile(response_times, 99),
        "success_count": success_count,
        "failure_count": failure_count,
        "rps": round((total_requests / total_duration_ms) * 1000, 2) if total_duration_ms > 0 else 0,
        "status_code_distribution": status_codes,
    }
