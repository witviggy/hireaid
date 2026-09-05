import base64
import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from ..config import get_settings
from ..database import get_db
from ..services.call_sync import TERMINAL_STATUSES, _handle_terminal

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()
logger = logging.getLogger("hunar.webhooks")


def _verify_signature(raw_body: bytes, timestamp: str, signature_header: str) -> bool:
    """Verify X-Hunar-Signature against HMAC-SHA256(secret, "{timestamp}.{body}").

    If HUNAR_WEBHOOK_SECRET is not configured, verification is skipped (dev only).
    Multiple comma-separated signatures may be present (key rotation) - any match passes.
    """
    if not settings.hunar_webhook_secret:
        return True

    message = f"{timestamp}.".encode() + raw_body
    expected = base64.b64encode(
        hmac.new(settings.hunar_webhook_secret.encode(), message, hashlib.sha256).digest()
    ).decode()

    candidates = [s.strip() for s in signature_header.split(",") if s.strip()]
    return any(hmac.compare_digest(expected, c) for c in candidates)


@router.post("/hunar")
async def hunar_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    timestamp = request.headers.get("X-Hunar-Timestamp", "")
    signature = request.headers.get("X-Hunar-Signature", "")

    if not _verify_signature(raw_body, timestamp, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()
    event_type = payload.get("event_type")
    hunar_call_id = payload.get("call_id")
    logger.info("Received Hunar webhook %s for call %s", event_type, hunar_call_id)

    if not hunar_call_id:
        return {"status": "ignored"}

    call = db.query(models.Call).filter(models.Call.hunar_call_id == hunar_call_id).first()
    if not call:
        logger.warning("Webhook for unknown call_id=%s", hunar_call_id)
        return {"status": "ignored"}

    was_terminal = call.status in TERMINAL_STATUSES

    if event_type in ("call_status_updated", "call_summary"):
        call.status = payload.get("status", call.status)
        call.lifecycle_status = payload.get("lifecycle_status", call.lifecycle_status)
        if payload.get("duration_seconds") is not None:
            call.duration_seconds = str(payload["duration_seconds"])

    if event_type in ("call_recording_done", "call_summary"):
        if payload.get("recording_url"):
            call.recording_url = payload["recording_url"]

    if event_type in ("call_result_done", "call_summary"):
        if payload.get("result") is not None:
            call.result = payload["result"]

    db.add(call)
    db.commit()
    db.refresh(call)

    if not was_terminal and call.status in TERMINAL_STATUSES:
        await _handle_terminal(db, call)
        db.commit()

    return {"status": "processed"}

