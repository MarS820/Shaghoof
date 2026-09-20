@echo off
REM Start GinAI backend (FastAPI) on port 8000
cd /d "%~dp0"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
