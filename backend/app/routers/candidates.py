from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("", response_model=list[schemas.CandidateOut])
def list_candidates(db: Session = Depends(get_db)):
    return (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.current_stage),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.screening),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.stage),
        )
        .order_by(models.Candidate.created_at.desc())
        .all()
    )


@router.get("/{candidate_id}", response_model=schemas.CandidateOut)
def get_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.current_stage),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.screening),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.retry_entries),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.stage),
        )
        .filter(models.Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = db.get(models.Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(candidate)
    db.commit()
    return {"status": "deleted", "id": candidate_id}


@router.get("/{candidate_id}/memory-graph", response_model=schemas.CandidateMemoryGraphOut)
def get_candidate_memory_graph(
    candidate_id: str,
    role_id: str = None,
    db: Session = Depends(get_db),
):
    """Retrieve the accumulated cross-round conversation memory graph for a candidate."""
    candidate = (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.role),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.screening),
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.calls).joinedload(models.Call.stage),
        )
        .filter(models.Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    target_entry = None
    if role_id:
        target_entry = next((e for e in candidate.pipeline_entries if e.role_id == role_id), None)
    if not target_entry and candidate.pipeline_entries:
        target_entry = candidate.pipeline_entries[0]

    from ..services.call_memory import build_candidate_memory_graph
    return build_candidate_memory_graph(target_entry)

