from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.call_sync import evaluate_call_internal, sync_call
from ..services.transcription import transcribe_call_audio

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("", response_model=list[schemas.CallOut])
def list_calls(role_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Call).options(
        joinedload(models.Call.screening),
        joinedload(models.Call.retry_entries),
        joinedload(models.Call.stage),
        joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
        joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
    )
    if role_id:
        q = q.filter(models.Call.role_id == role_id)
    return q.order_by(models.Call.created_at.desc()).all()


@router.get("/{call_id}", response_model=schemas.CallOut)
def get_call(call_id: str, db: Session = Depends(get_db)):
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.stage),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.post("/{call_id}/sync", response_model=schemas.CallOut)
async def sync_call_now(call_id: str, db: Session = Depends(get_db)):
    """Pull the latest status/result/recording from Hunar for this call right now,
    and automatically transcribe if recording is available."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call = await sync_call(db, call)

    # If call has recording but no transcript yet, auto-transcribe
    if call.recording_url and not call.transcript:
        callee = call.candidate_name or "Candidate"
        tx = await transcribe_call_audio(call.recording_url, callee_name=callee)
        if tx.get("transcript"):
            call.transcript = tx["transcript"]
            call.transcript_turns = tx.get("transcript_turns", [])
            db.add(call)
            db.commit()

    db.refresh(call)
    return call


@router.post("/{call_id}/transcribe", response_model=schemas.CallOut)
async def transcribe_call_endpoint(call_id: str, db: Session = Depends(get_db)):
    """Transcribe or re-transcribe call recording using Groq Whisper."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
            joinedload(models.Call.screening),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url:
        raise HTTPException(status_code=400, detail="Call has no recording URL to transcribe")

    callee = call.candidate_name or "Candidate"
    tx = await transcribe_call_audio(call.recording_url, callee_name=callee)
    if tx.get("transcript"):
        call.transcript = tx["transcript"]
        call.transcript_turns = tx.get("transcript_turns", [])
        db.add(call)
        db.commit()
        db.refresh(call)
        # Automatically update screening scorecard using new transcript
        try:
            await evaluate_call_internal(db, call)
            db.refresh(call)
        except Exception:
            pass

    return call


@router.post("/{call_id}/evaluate", response_model=schemas.CallOut)
async def evaluate_call_endpoint(call_id: str, db: Session = Depends(get_db)):
    """Evaluate or re-evaluate screening scorecard for this call using its transcript and role criteria."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await evaluate_call_internal(db, call)
    db.refresh(call)
    return call


@router.post("/{call_id}/cancel-retry", response_model=schemas.CallOut)
def cancel_call_retry(call_id: str, db: Session = Depends(get_db)):
    """Cancel any pending reschedule/retry for this call and update candidate status."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    for r in call.retry_entries:
        if r.status == models.RetryStatus.PENDING:
            r.status = models.RetryStatus.CANCELLED
            db.add(r)

    if call.role_candidate and call.role_candidate.status == models.PipelineStatus.RETRY_PENDING:
        call.role_candidate.status = models.PipelineStatus.UNREACHABLE
        db.add(call.role_candidate)

    db.commit()
    db.refresh(call)
    return call


@router.patch("/{call_id}/status", response_model=schemas.CallOut)
def update_call_status(call_id: str, payload: schemas.UpdateCallStatusRequest, db: Session = Depends(get_db)):
    """Manually update the call's status (and optionally candidate pipeline status),
    cancelling any pending retry if requested."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    call.status = payload.status
    db.add(call)

    if payload.cancel_pending_retry:
        for r in call.retry_entries:
            if r.status == models.RetryStatus.PENDING:
                r.status = models.RetryStatus.CANCELLED
                db.add(r)

    if payload.pipeline_status and call.role_candidate:
        try:
            call.role_candidate.status = models.PipelineStatus(payload.pipeline_status)
            db.add(call.role_candidate)
        except ValueError:
            pass

    db.commit()
    db.refresh(call)
    return call


@router.delete("/{call_id}")
def delete_call(call_id: str, db: Session = Depends(get_db)):
    """Delete a call record."""
    call = db.query(models.Call).filter(models.Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    rc = call.role_candidate
    db.delete(call)
    db.commit()

    if rc:
        remaining_calls = db.query(models.Call).filter(models.Call.role_candidate_id == rc.id).count()
        if remaining_calls == 0 and rc.status in {
            models.PipelineStatus.CALLING,
            models.PipelineStatus.RETRY_PENDING,
            models.PipelineStatus.NO_ANSWER,
        }:
            rc.status = models.PipelineStatus.SOURCED
            db.add(rc)
            db.commit()

    return {"ok": True, "deleted_call_id": call_id}

