"""Lightweight in-process background scheduler: periodically syncs active calls from
Hunar (stand-in for webhooks when no public HTTPS callback URL is configured) and fires
due retry-queue entries."""
import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .database import SessionLocal
from .services.call_sync import process_due_retries, sync_active_calls

logger = logging.getLogger("scheduler")

scheduler = AsyncIOScheduler()


async def _job_sync_and_retry() -> None:
    db = SessionLocal()
    try:
        synced = await sync_active_calls(db)
        fired = await process_due_retries(db)
        if synced or fired:
            logger.info("Background job: synced=%s retries_fired=%s", synced, fired)
    except Exception:
        logger.exception("Background sync job failed")
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(_job_sync_and_retry, "interval", seconds=30, id="sync_and_retry", max_instances=1)
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
