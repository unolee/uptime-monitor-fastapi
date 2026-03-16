from pydantic import BaseModel
from typing import Optional


class MonitorCreate(BaseModel):
    name: str
    url: str
    method: str = "GET"
    interval_seconds: int = 60
    timeout_seconds: int = 30
    expected_status: int = 200


class MonitorUpdate(BaseModel):
    name: str
    url: str
    method: str = "GET"
    interval_seconds: int = 60
    timeout_seconds: int = 30
    expected_status: int = 200
    is_active: bool = True


class LoadTestRequest(BaseModel):
    target_url: str
    concurrent_users: int = 10
    total_requests: int = 100
    timeout_seconds: int = 30


class LoadTestResult(BaseModel):
    target_url: str
    concurrent_users: int
    total_requests: int
    timeout_seconds: int
    total_duration_ms: int
    avg_response_ms: float
    min_response_ms: int
    max_response_ms: int
    p95_response_ms: int
    p99_response_ms: int
    success_count: int
    failure_count: int
    rps: float
    status_code_distribution: dict[str, int]
