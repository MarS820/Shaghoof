@echo off
REM Start Shaghoof backend (FastAPI) on port 8080.

cd /d "%~dp0"

echo [start.bat] Releasing port 8080 if it is in use...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr :8080') do (
    echo [start.bat] Killing PID %%P on 8080...
    taskkill /PID %%P /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [start.bat] Starting backend at http://localhost:8080 ...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
