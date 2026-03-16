# Uptime Monitor (FastAPI)

BetterStack 스타일의 업타임 모니터링 시스템 — FastAPI + SQLite 백엔드

## 구조

```
server/   — FastAPI 서버 (port 4001)
client/   — React (Vite) 프론트엔드 (port 5173)
```

## 기능

- **모니터링**: HTTP/HTTPS 사이트 업타임 모니터링 (주기적 체크)
- **대시보드**: 실시간 상태, 응답시간, 가동률 표시
- **로드 테스트**: 동시 접속 부하 테스트
- **벤치마크**: 25→50→100→200→400 사이트 순차 성능 테스트 (5단계, 총 50분)
- **SSL 인증서**: 만료일 모니터링
- **인시던트 추적**: 장애 기록 및 복구 시간 추적

## 실행

### 서버 (FastAPI)
```bash
cd server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 4001 --reload
```

### 클라이언트 (React)
```bash
cd client
npm install
npm run dev    # http://localhost:5173
```

## 기술 스택

- **Backend**: FastAPI, aiosqlite, APScheduler, httpx
- **Frontend**: React 19, Vite, TailwindCSS, React Router
- **Database**: SQLite (WAL mode)
