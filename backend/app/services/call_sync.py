"""Background sync: since Hunar webhooks require a public HTTPS callback URL (often
unavailable in local dev), we poll Hunar for any non-terminal call and update our DB —
this also drives post-call screening generation and the no-answer retry queue."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from .. import models
from .hunar_client import HunarAPIError, HunarClient
from .recruiting_intelligence import generate_screening

logger = logging.getLogger("call_sync")

TERMINAL_STATUSES = {"COMPLETED", "NOT_CONNECTED", "FAILED", "CANCELLED"}


def _role_criteria(role: models.Role) -> dict:
    return {
        "must_have_skills": role.must_have_skills,
        "preferred_skills": role.preferred_skills,
        "seniority": role.seniority,
        "location_normalized": role.location_normalized,
        "ai_summary": role.ai_summary,
    }


def get_or_create_global_settings(db: Session) -> models.GlobalSettings:
    row = db.query(models.GlobalSettings).first()
    if not row:
        row = models.GlobalSettings()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


async def evaluate_call_internal(db: Session, call: models.Call) -> Optional[models.Screening]:
    """Generate or update a screening scorecard for a call using its transcript and role criteria."""
    role_candidate = call.role_candidate
    if not role_candidate:
        return None
    role = role_candidate.role
    if not role:
        return None

    # If call has recording but no transcript, transcribe first
    if call.recording_url and not call.transcript:
        from .transcription import transcribe_call_audio
        callee = call.candidate_name or (role_candidate.candidate.full_name if role_candidate.candidate else "Candidate")
        try:
            tx = await transcribe_call_audio(call.recording_url, callee_name=callee)
            if tx.get("transcript"):
                call.transcript = tx["transcript"]
                call.transcript_turns = tx.get("transcript_turns", [])
                db.add(call)
                db.commit()
                db.refresh(call)
        except Exception as exc:
            logger.warning("Auto-transcription before evaluation failed for call %s: %s", call.id, exc)

    criteria = _role_criteria(role)
    criteria["title"] = role.title

    screening_data = await generate_screening(
        criteria,
        call.result or {},
        call.custom_data,
        transcript=call.transcript,
        transcript_turns=call.transcript_turns,
    )
    if not screening_data:
        return None

    is_callback = bool(screening_data.pop("is_callback_requested", False))
    screening_data.pop("call_disposition", None)

    existing_screening = db.query(models.Screening).filter(models.Screening.call_id == call.id).first()
    if existing_screening:
        for k, v in screening_data.items():
            setattr(existing_screening, k, v)
        screening = existing_screening
    else:
        screening = models.Screening(call_id=call.id, role_candidate_id=role_candidate.id, **screening_data)
        db.add(screening)

    rec = screening_data.get("recommendation")
    if is_callback:
        # Candidate asked to speak later or was busy (e.g. driving) -> mark REVIEW_NEEDED, NEVER REJECTED
        role_candidate.status = models.PipelineStatus.REVIEW_NEEDED
    else:
        role_candidate.status = {
            "ADVANCE": models.PipelineStatus.SHORTLISTED,
            "HOLD": models.PipelineStatus.REVIEW_NEEDED,
            "REJECT": models.PipelineStatus.REJECTED,
        }.get(rec, models.PipelineStatus.SCREENED)

    # Only update fit_score if an actual interview score was produced (don't overwrite with None or 0)
    if screening_data.get("score_overall") is not None:
        role_candidate.fit_score = screening_data.get("score_overall")

    db.add(role_candidate)
    db.commit()
    db.refresh(screening)
    db.refresh(role_candidate)
    return screening


async def _handle_terminal(db: Session, call: models.Call) -> None:
    role_candidate = call.role_candidate
    if not role_candidate:
        return

    if call.status == "COMPLETED":
        await evaluate_call_internal(db, call)
    elif call.status == "NOT_CONNECTED":
        await _schedule_retry_or_mark_unreachable(db, call, role_candidate)
    else:  # FAILED, CANCELLED
        role_candidate.status = models.PipelineStatus.REVIEW_NEEDED
        db.add(role_candidate)


async def _schedule_retry_or_mark_unreachable(
    db: Session, call: models.Call, role_candidate: models.RoleCandidate
) -> None:
    settings_row = get_or_create_global_settings(db)
    if not settings_row.retry_enabled or call.attempt_number > settings_row.max_retries:
        role_candidate.status = models.PipelineStatus.UNREACHABLE
        return
    scheduled_at = datetime.now(timezone.utc) + timedelta(minutes=settings_row.retry_delay_minutes)
    retry = models.CallRetryQueue(
        call_id=call.id,
        role_candidate_id=role_candidate.id,
        attempt_number=call.attempt_number + 1,
        scheduled_at=scheduled_at,
        status=models.RetryStatus.PENDING,
    )
    db.add(retry)
    role_candidate.status = models.PipelineStatus.RETRY_PENDING


async def sync_call(db: Session, call: models.Call) -> models.Call:
    """Pull the latest state for one call from Hunar and react to any terminal transition."""
    if not call.hunar_call_id:
        return call
    client = HunarClient()
    try:
        hunar_call = await client.get_call(call.hunar_call_id)
    except HunarAPIError as exc:
        logger.warning("Failed to sync call %s: %s", call.hunar_call_id, exc)
        return call

    was_terminal = call.status in TERMINAL_STATUSES
    call.status = hunar_call.get("status", call.status)
    call.lifecycle_status = hunar_call.get("lifecycle_status")
    call.recording_url = hunar_call.get("recording_url")
    call.result = hunar_call.get("result")
    if hunar_call.get("duration_seconds") is not None:
        call.duration_seconds = str(hunar_call["duration_seconds"])
    if hunar_call.get("started_at"):
        call.started_at = hunar_call["started_at"]
    if hunar_call.get("ended_at"):
        call.ended_at = hunar_call["ended_at"]
    db.add(call)
    db.commit()
    # If recording is available and not yet transcribed, transcribe and evaluate immediately!
    if call.recording_url and not call.transcript:
        try:
            await evaluate_call_internal(db, call)
        except Exception as exc:
            logger.warning("Automatic post-recording transcription failed during sync for call %s: %s", call.id, exc)
    elif not was_terminal and call.status in TERMINAL_STATUSES:
        await _handle_terminal(db, call)
        db.commit()
    return call


async def sync_active_calls(db: Session) -> int:
    """Poll every non-terminal call. Returns the number synced. Called on a periodic job."""
    active_calls = db.query(models.Call).filter(~models.Call.status.in_(TERMINAL_STATUSES)).all()
    for call in active_calls:
        await sync_call(db, call)
    return len(active_calls)


async def fire_call_for_retry(db: Session, retry: models.CallRetryQueue) -> Optional[models.Call]:
    from .hunar_client import HunarClient as _HC  # local import to avoid cycle at module load

    role_candidate = (
        db.query(models.RoleCandidate).filter(models.RoleCandidate.id == retry.role_candidate_id).first()
    )
    if not role_candidate:
        retry.status = models.RetryStatus.CANCELLED
        return None
    previous_call = (
        db.query(models.Call)
        .filter(models.Call.id == retry.call_id)
        .first()
    )
    if not previous_call:
        retry.status = models.RetryStatus.CANCELLED
        return None

    candidate = role_candidate.candidate
    client = _HC()
    import uuid as _uuid

    request_id = f"retry-{role_candidate.id[:8]}-{_uuid.uuid4().hex[:8]}"
    try:
        hunar_call = await client.create_call(
            agent_id=previous_call.agent_id,
            callee_name=candidate.full_name,
            mobile_number=candidate.phone_number,
            custom_data=previous_call.custom_data,
            request_id=request_id,
        )
    except HunarAPIError as exc:
        logger.warning("Retry call creation failed for role_candidate=%s: %s", role_candidate.id, exc)
        retry.status = models.RetryStatus.CANCELLED
        return None

    new_call = models.Call(
        role_candidate_id=role_candidate.id,
        role_id=role_candidate.role_id,
        candidate_id=role_candidate.candidate_id,
        attempt_number=retry.attempt_number,
        hunar_call_id=hunar_call["id"],
        agent_id=previous_call.agent_id,
        request_id=request_id,
        status=hunar_call.get("status", "NOT_STARTED"),
        custom_data=previous_call.custom_data,
    )
    db.add(new_call)
    role_candidate.status = models.PipelineStatus.CALLING
    retry.status = models.RetryStatus.FIRED
    db.add(role_candidate)
    db.add(retry)
    db.commit()
    return new_call


async def process_due_retries(db: Session) -> int:
    now = datetime.now(timezone.utc)
    due = (
        db.query(models.CallRetryQueue)
        .filter(models.CallRetryQueue.status == models.RetryStatus.PENDING)
        .filter(models.CallRetryQueue.scheduled_at <= now)
        .all()
    )
    for retry in due:
        await fire_call_for_retry(db, retry)
    return len(due)
