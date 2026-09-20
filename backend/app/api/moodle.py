import os
import uuid
import json
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Header
from ..schemas import (MoodleConnectRequest, MoodleConnectionResponse, MoodleStatusResponse,
                        MoodleCourseSchema, MoodleFileSchema, ActivateCourseResponse,
                        SyncJobResponse, MoodleRagQueryRequest, MoodleRagQueryResponse)
from ..services.moodle import MoodleService, MoodleSecurityException
from ..services import moodle_rag

router = APIRouter(prefix="/moodle", tags=["Moodle LMS Integration"])

_moodle_db: dict[str, dict] = {}
_moodle_courses: dict[str, list[dict]] = {}
_moodle_files: dict[str, list[dict]] = {}
_sync_jobs: dict[str, dict] = {}


def _uid(x: Optional[str] = Header(default="default")) -> str:
    return x or "default"


@router.post("/connect", response_model=MoodleConnectionResponse)
def connect_moodle(req: MoodleConnectRequest, current_user: str = Depends(_uid)):
    user_id = req.user_id if req.user_id and req.user_id != "default" else current_user
    try:
        clean = MoodleService.validate_url(req.moodle_url)
    except MoodleSecurityException as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        info = MoodleService.get_site_info(clean, req.token)
    except MoodleSecurityException as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {e}")
    uid = info.get("userid")
    if not uid:
        raise HTTPException(status_code=400, detail="No user ID from Moodle.")
    _moodle_db[user_id] = {"moodle_url": clean, "token": req.token, "moodle_user_id": uid,
                           "moodle_username": info.get("username", ""), "moodle_fullname": info.get("fullname", ""),
                           "site_name": info.get("sitename", "Moodle"), "moodle_version": info.get("release", ""),
                           "status": "active"}
    try:
        courses = MoodleService.get_enrolled_courses(clean, req.token, uid)
    except Exception:
        courses = []
    saved = []
    for c in courses:
        mid = c.get("id") or c.get("moodle_course_id")
        entry = {"moodle_course_id": mid, "course_name": c.get("fullname") or c.get("course_name") or "Unnamed",
                 "course_code": c.get("shortname") or c.get("course_code") or "",
                 "summary": c.get("summary") or "", "activation_status": "not_activated", "sync_status": "idle",
                 "pdf_count": 0, "synced_pdf_count": 0, "total_pages": 0, "total_chunks": 0, "last_synced_at": None}
        saved.append(entry)
    _moodle_courses[user_id] = saved
    return MoodleConnectionResponse(
        status="connected", moodle_url=clean, site_name=info.get("sitename", ""),
        moodle_user_id=uid, moodle_username=info.get("username", ""),
        moodle_fullname=info.get("fullname", ""), moodle_version=info.get("release", ""),
        courses_count=len(saved), courses=[MoodleCourseSchema(**c) for c in saved])


@router.get("/status", response_model=MoodleStatusResponse)
def moodle_status(user_id: Optional[str] = None, current_user: str = Depends(_uid)):
    target = user_id or current_user
    conn = _moodle_db.get(target)
    if not conn or conn.get("status") != "active":
        return MoodleStatusResponse(is_connected=False)
    courses = _moodle_courses.get(target, [])
    activated = [c for c in courses if c.get("activation_status") == "activated"]
    safe = {k: conn.get(k) for k in ["moodle_url", "site_name", "moodle_username", "moodle_fullname", "moodle_version"]}
    return MoodleStatusResponse(is_connected=True, connection=safe,
                                enrolled_courses_count=len(courses), activated_courses_count=len(activated))


@router.post("/disconnect")
def disconnect(user_id: Optional[str] = None, current_user: str = Depends(_uid)):
    target = user_id or current_user
    if target in _moodle_db:
        _moodle_db[target]["status"] = "disconnected"
    return {"status": "disconnected"}


@router.get("/courses")
def list_courses(user_id: Optional[str] = None, current_user: str = Depends(_uid)):
    target = user_id or current_user
    return [MoodleCourseSchema(**c) for c in _moodle_courses.get(target, [])]


@router.post("/courses/{course_id}/activate", response_model=ActivateCourseResponse)
def activate_course(course_id: int, user_id: Optional[str] = None, current_user: str = Depends(_uid)):
    target = user_id or current_user
    courses = _moodle_courses.get(target, [])
    course = next((c for c in courses if c.get("moodle_course_id") == course_id), None)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    job_id = f"sync_{uuid.uuid4().hex[:12]}"
    _sync_jobs[job_id] = {"job_id": job_id, "user_id": target, "course_id": course_id,
                          "status": "completed", "progress": 100, "total_files": 0,
                          "downloaded_files": 0, "processed_files": 0, "failed_files": 0}
    course["activation_status"] = "activated"
    course["sync_status"] = "synced"
    return ActivateCourseResponse(job_id=job_id, course_id=course_id, status="started",
                                  message=f"Activation of '{course.get('course_name')}' started.")


@router.get("/sync/jobs/{job_id}", response_model=SyncJobResponse)
def sync_job_status(job_id: str):
    job = _sync_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return SyncJobResponse(**{k: job.get(k, 0) for k in SyncJobResponse.model_fields})


@router.post("/rag/query", response_model=MoodleRagQueryResponse)
def moodle_rag_query(req: MoodleRagQueryRequest):
    result = moodle_rag.query_user_kb(
        user_id=req.user_id, query=req.query, course_id=req.course_id, language=req.language,
    )
    return MoodleRagQueryResponse(
        answer=result.get("answer", ""),
        citations=result.get("citations", []),
        course_filtered=result.get("course_filtered", "all"),
    )
