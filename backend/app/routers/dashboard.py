from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    total_roles = db.query(func.count(models.Role.id)).scalar() or 0
    active_roles = (
        db.query(func.count(models.Role.id)).filter(models.Role.status == models.RoleStatus.ACTIVE).scalar() or 0
    )
    draft_roles = total_roles - active_roles
    total_candidates = db.query(func.count(models.Candidate.id)).scalar() or 0
    calls_made = db.query(func.count(models.Call.id)).scalar() or 0
    calls_completed = (
        db.query(func.count(models.Call.id)).filter(models.Call.status == "COMPLETED").scalar() or 0
    )

    def _count(status: models.PipelineStatus) -> int:
        return (
            db.query(func.count(models.RoleCandidate.id))
            .filter(models.RoleCandidate.status == status)
            .scalar()
            or 0
        )

    shortlisted = _count(models.PipelineStatus.SHORTLISTED)
    review_needed = _count(models.PipelineStatus.REVIEW_NEEDED)
    unreachable = _count(models.PipelineStatus.UNREACHABLE)
    retry_pending = _count(models.PipelineStatus.RETRY_PENDING)
    screened = _count(models.PipelineStatus.SCREENED)
    sourced = _count(models.PipelineStatus.SOURCED)
    archived = _count(models.PipelineStatus.ARCHIVED)

    # Screening Outcomes
    advance_count = (
        db.query(func.count(models.Screening.id))
        .filter(models.Screening.recommendation == "ADVANCE")
        .scalar()
        or 0
    )
    hold_count = (
        db.query(func.count(models.Screening.id))
        .filter(models.Screening.recommendation == "HOLD")
        .scalar()
        or 0
    )
    reject_count = (
        db.query(func.count(models.Screening.id))
        .filter(models.Screening.recommendation == "REJECT")
        .scalar()
        or 0
    )
    avg_score_val = db.query(func.avg(models.Screening.score_overall)).scalar()
    avg_score = round(avg_score_val) if avg_score_val is not None else None

    # Providers
    sandbox_candidates = (
        db.query(func.count(models.Candidate.id))
        .filter(models.Candidate.source == models.CandidateSource.SANDBOX)
        .scalar()
        or 0
    )
    apollo_candidates = (
        db.query(func.count(models.Candidate.id))
        .filter(models.Candidate.source == models.CandidateSource.APOLLO)
        .scalar()
        or 0
    )
    pdl_candidates = (
        db.query(func.count(models.Candidate.id))
        .filter(models.Candidate.source == models.CandidateSource.PDL)
        .scalar()
        or 0
    )
    manual_candidates = (
        db.query(func.count(models.Candidate.id))
        .filter(models.Candidate.source == models.CandidateSource.MANUAL)
        .scalar()
        or 0
    )

    # Roles summary
    roles_list = db.query(models.Role).order_by(models.Role.created_at.desc()).limit(6).all()
    roles_summary = []
    for r in roles_list:
        cand_count = len(r.pipeline_entries or [])
        sl_count = len([p for p in (r.pipeline_entries or []) if p.status == models.PipelineStatus.SHORTLISTED])
        roles_summary.append({
            "id": r.id,
            "title": r.title,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "location": r.location_normalized or r.location or "Remote",
            "candidate_count": cand_count,
            "shortlisted_count": sl_count,
        })

    # Recent activity
    recent_calls = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
            joinedload(models.Call.screening),
        )
        .order_by(models.Call.created_at.desc())
        .limit(5)
        .all()
    )
    recent_activity = []
    for c in recent_calls:
        recent_activity.append({
            "type": "call",
            "id": c.id,
            "candidate_name": c.candidate_name or "Candidate",
            "role_title": c.role_title or "Role",
            "status": c.status,
            "recommendation": c.screening.recommendation if c.screening else None,
            "score": c.screening.score_overall if c.screening else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return schemas.DashboardOut(
        total_roles=total_roles,
        active_roles=active_roles,
        draft_roles=draft_roles,
        total_candidates=total_candidates,
        calls_made=calls_made,
        calls_completed=calls_completed,
        shortlisted=shortlisted,
        review_needed=review_needed,
        unreachable=unreachable,
        retry_pending=retry_pending,
        screened=screened,
        sourced=sourced,
        archived=archived,
        advance_count=advance_count,
        hold_count=hold_count,
        reject_count=reject_count,
        avg_score=avg_score,
        sandbox_candidates=sandbox_candidates,
        apollo_candidates=apollo_candidates,
        pdl_candidates=pdl_candidates,
        manual_candidates=manual_candidates,
        roles_summary=roles_summary,
        recent_activity=recent_activity,
    )
