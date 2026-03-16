from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.benchmark import (
    start_benchmark,
    get_benchmark_status,
    stop_benchmark,
    get_benchmark_report,
    get_benchmark_history,
    delete_benchmark,
    DEFAULT_CHECK_INTERVAL,
)

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


class BenchmarkStartRequest(BaseModel):
    check_interval_seconds: Optional[int] = DEFAULT_CHECK_INTERVAL


@router.post("")
async def start_benchmark_endpoint(data: BenchmarkStartRequest):
    try:
        result = await start_benchmark(data.check_interval_seconds)
        return result
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def get_status_and_history():
    status = await get_benchmark_status()
    return status


@router.get("/{benchmark_id}")
async def get_report(benchmark_id: int):
    report = await get_benchmark_report(benchmark_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Benchmark not found")
    return report


@router.post("/stop")
async def stop_benchmark_endpoint():
    try:
        result = await stop_benchmark()
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{benchmark_id}")
async def delete_benchmark_endpoint(benchmark_id: int):
    try:
        result = await delete_benchmark(benchmark_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
