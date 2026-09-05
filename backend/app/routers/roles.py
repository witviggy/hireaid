import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.hunar_client import HunarAPIError, HunarClient
from ..services.call_sync import get_or_create_global_settings
from ..services.call_memory import build_candidate_memory_graph
from ..services.llm_client import LLMError
from ..services.people_search_client import PeopleSearchError, search_people
from ..services.recruiting_intelligence import analyze_job_description, rank_candidates

router = APIRouter(prefix="/api/roles", tags=["roles"])


def _role_criteria(role: models.Role) -> dict:
    return {
        "must_have_skills": role.must_have_skills,
        "preferred_skills": role.preferred_skills,
        "seniority": role.seniority,
        "location_normalized": role.location_normalized,
        "ai_summary": role.ai_summary,
    }


@router.post("", response_model=schemas.RoleOut)
async def create_role(payload: schemas.RoleCreate, db: Session = Depends(get_db)):
    """Create a Role and immediately run AI Job Intelligence to extract structured criteria."""
    role = models.Role(
        title=payload.title,
        jd_raw_text=payload.jd_raw_text,
        required_skills_hint=payload.required_skills_hint,
        location=payload.location,
        target_company=payload.target_company,
        status=models.RoleStatus.DRAFT,
    )
    try:
        criteria = await analyze_job_description(
            payload.title, payload.jd_raw_text, payload.required_skills_hint, payload.location
        )
        role.must_have_skills = criteria["must_have_skills"]
        role.preferred_skills = criteria["preferred_skills"]
        role.seniority = criteria["seniority"]
        role.min_years_experience = criteria["min_years_experience"]
        role.location_normalized = criteria["location_normalized"]
        role.ai_summary = criteria["summary"]
    except LLMError:
        pass  # LLM not configured - role is still created, just without AI criteria

    db.add(role)
    db.commit()
    db.refresh(role)

    # Seed a default Stage 1 and call script for this role (recruiter can edit before activating)
    from ..services.hunar_agent import default_call_script_fields

    stage = models.RoleStage(
        role_id=role.id,
        name="Round 1: Screening",
        round_number=1,
        stage_type="AI_VOICE",
        description="Initial AI voice screening and qualification",
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)

    script = models.CallScript(
        role_id=role.id,
        stage_id=stage.id,
        **default_call_script_fields(role.title),
    )
    db.add(script)
    db.commit()
    db.refresh(role)
    return role


@router.get("", response_model=list[schemas.RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return (
        db.query(models.Role)
        .options(joinedload(models.Role.stages).joinedload(models.RoleStage.call_script))
        .order_by(models.Role.created_at.desc())
        .all()
    )


@router.get("/{role_id}", response_model=schemas.RoleOut)
def get_role(role_id: str, db: Session = Depends(get_db)):
    role = (
        db.query(models.Role)
        .options(joinedload(models.Role.stages).joinedload(models.RoleStage.call_script))
        .filter(models.Role.id == role_id)
        .first()
    )
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.patch("/{role_id}/status", response_model=schemas.RoleOut)
def update_role_status(role_id: str, payload: schemas.RoleStatusUpdate, db: Session = Depends(get_db)):
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.status not in models.RoleStatus.__members__:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'")
    role.status = models.RoleStatus[payload.status]
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=schemas.RoleOut)
async def update_role(role_id: str, payload: schemas.RoleUpdate, db: Session = Depends(get_db)):
    """Update role details and optionally re-analyze JD to refresh AI criteria."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.title is not None:
        role.title = payload.title
    if payload.jd_raw_text is not None:
        role.jd_raw_text = payload.jd_raw_text
    if payload.required_skills_hint is not None:
        role.required_skills_hint = payload.required_skills_hint
    if payload.location is not None:
        role.location = payload.location
    if payload.target_company is not None:
        role.target_company = payload.target_company

    if payload.reanalyze_jd and role.jd_raw_text:
        try:
            criteria = await analyze_job_description(
                role.title, role.jd_raw_text, role.required_skills_hint, role.location
            )
            role.must_have_skills = criteria["must_have_skills"]
            role.preferred_skills = criteria["preferred_skills"]
            role.seniority = criteria["seniority"]
            role.min_years_experience = criteria["min_years_experience"]
            role.location_normalized = criteria["location_normalized"]
            role.ai_summary = criteria["summary"]
        except LLMError:
            pass

    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.post("/{role_id}/search", response_model=list[schemas.RoleCandidateOut])
async def search_role_candidates(role_id: str, payload: schemas.RoleSearchRequest, db: Session = Depends(get_db)):
    """Role-scoped people search: uses the role's AI-extracted criteria automatically,
    sources candidates, ranks them, and adds them to this role's pipeline as SOURCED."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    effective_skills = (
        ", ".join((role.must_have_skills or []) + (role.preferred_skills or [])) or role.required_skills_hint
    )
    try:
        people = await search_people(
            provider=payload.provider,
            job_title=role.title,
            required_skills=effective_skills,
            location=role.location_normalized or role.location,
            target_company=role.target_company,
            limit=payload.limit,
        )
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except PeopleSearchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    first_stage = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role.id)
        .order_by(models.RoleStage.round_number.asc())
        .first()
    )

    role_candidates: list[models.RoleCandidate] = []
    for person in people:
        # Dedupe by phone number when available; otherwise always create a new Candidate.
        candidate = None
        if person.get("phone_number"):
            candidate = (
                db.query(models.Candidate)
                .filter(models.Candidate.phone_number == person["phone_number"])
                .first()
            )
        if not candidate:
            candidate = models.Candidate(
                full_name=person["full_name"],
                phone_number=person.get("phone_number") or "",
                email=person.get("email"),
                current_title=person.get("job_title"),
                current_company=person.get("company"),
                location=person.get("location"),
                linkedin_url=person.get("linkedin_url"),
                source=models.CandidateSource(person.get("source_provider", "manual").upper())
                if person.get("source_provider", "").upper() in models.CandidateSource.__members__
                else models.CandidateSource.MANUAL,
                raw_data=person.get("raw_data"),
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)

        existing = (
            db.query(models.RoleCandidate)
            .filter(models.RoleCandidate.role_id == role.id, models.RoleCandidate.candidate_id == candidate.id)
            .first()
        )
        if existing:
            role_candidates.append(existing)
            continue

        rc = models.RoleCandidate(
            role_id=role.id,
            candidate_id=candidate.id,
            status=models.PipelineStatus.SOURCED,
            source=candidate.source,
            added_by=models.AddedBy.SEARCH,
            current_stage_id=first_stage.id if first_stage else None,
        )
        db.add(rc)
        role_candidates.append(rc)
    db.commit()
    for rc in role_candidates:
        db.refresh(rc)

    # AI Candidate Ranking against this role's criteria
    criteria = _role_criteria(role)
    if any(criteria.values()):
        ranking_input = [
            {
                "index": i,
                "full_name": rc.candidate.full_name,
                "job_title": rc.candidate.current_title,
                "company": rc.candidate.current_company,
                "location": rc.candidate.location,
            }
            for i, rc in enumerate(role_candidates)
        ]
        try:
            rankings = await rank_candidates(criteria, ranking_input)
        except LLMError:
            rankings = {}
        for i, rc in enumerate(role_candidates):
            r = rankings.get(i)
            if not r:
                continue
            rc.fit_score = r["match_score"]
            rc.fit_strengths = r["strengths"]
            rc.fit_gaps = r["gaps"]
            rc.fit_summary = r["summary"]
        db.commit()
        for rc in role_candidates:
            db.refresh(rc)
        role_candidates.sort(key=lambda rc: (rc.fit_score if rc.fit_score is not None else -1), reverse=True)

    return role_candidates


@router.get("/{role_id}/pipeline", response_model=list[schemas.RoleCandidateOut])
def get_role_pipeline(role_id: str, status: Optional[str] = None, db: Session = Depends(get_db)):
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    query = (
        db.query(models.RoleCandidate)
        .options(
            joinedload(models.RoleCandidate.candidate),
            joinedload(models.RoleCandidate.calls),
            joinedload(models.RoleCandidate.current_stage),
        )
        .filter(models.RoleCandidate.role_id == role_id)
    )
    if status and status in models.PipelineStatus.__members__:
        query = query.filter(models.RoleCandidate.status == models.PipelineStatus[status])
    entries = query.order_by(models.RoleCandidate.added_at.desc()).all()
    entries.sort(key=lambda rc: (rc.fit_score if rc.fit_score is not None else -1), reverse=True)
    return entries


@router.post("/{role_id}/pipeline/status", response_model=list[schemas.RoleCandidateOut])
def update_pipeline_status(
    role_id: str,
    payload: schemas.PipelineStatusUpdate,
    db: Session = Depends(get_db),
):
    """Bulk update candidate pipeline status (e.g. SHORTLISTED, ARCHIVED, SOURCED)."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.status not in models.PipelineStatus.__members__:
        raise HTTPException(status_code=400, detail=f"Invalid pipeline status '{payload.status}'")

    target_status = models.PipelineStatus[payload.status]
    updated_entries: list[models.RoleCandidate] = []
    for rc_id in payload.role_candidate_ids:
        rc = (
            db.query(models.RoleCandidate)
            .options(
                joinedload(models.RoleCandidate.candidate),
                joinedload(models.RoleCandidate.calls),
                joinedload(models.RoleCandidate.current_stage),
            )
            .filter(models.RoleCandidate.id == rc_id, models.RoleCandidate.role_id == role_id)
            .first()
        )
        if not rc:
            continue
        rc.status = target_status
        db.add(rc)
        updated_entries.append(rc)

    db.commit()
    for rc in updated_entries:
        db.refresh(rc)
    return updated_entries


@router.post("/{role_id}/candidates", response_model=schemas.RoleCandidateOut)
async def add_manual_candidate(role_id: str, payload: schemas.CandidateCreate, db: Session = Depends(get_db)):
    """Manual candidate entry, scoped directly to this role's pipeline."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    candidate = models.Candidate(
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        email=payload.email,
        current_title=payload.current_title,
        current_company=payload.current_company,
        location=payload.location,
        linkedin_url=payload.linkedin_url,
        resume_url=payload.resume_url,
        notes=payload.notes,
        source=models.CandidateSource.MANUAL,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    first_stage = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role.id)
        .order_by(models.RoleStage.round_number.asc())
        .first()
    )

    rc = models.RoleCandidate(
        role_id=role.id,
        candidate_id=candidate.id,
        status=models.PipelineStatus.SOURCED,
        source=models.CandidateSource.MANUAL,
        added_by=models.AddedBy.MANUAL,
        current_stage_id=first_stage.id if first_stage else None,
    )
    db.add(rc)
    db.commit()
    db.refresh(rc)

    # Immediately score new candidate against role's structured hiring criteria
    criteria = _role_criteria(role)
    criteria["min_years_experience"] = role.min_years_experience
    criteria["title"] = role.title
    try:
        ranking_input = [{
            "index": 0,
            "full_name": candidate.full_name,
            "job_title": candidate.current_title,
            "company": candidate.current_company,
            "location": candidate.location,
            "notes": candidate.notes or "",
        }]
        rankings = await rank_candidates(criteria, ranking_input)
        if 0 in rankings:
            rc.fit_score = rankings[0]["match_score"]
            rc.fit_strengths = rankings[0]["strengths"]
            rc.fit_gaps = rankings[0]["gaps"]
            rc.fit_summary = rankings[0]["summary"]
            db.add(rc)
            db.commit()
            db.refresh(rc)
    except Exception:
        pass

    return rc


@router.post("/{role_id}/rank", response_model=list[schemas.RoleCandidateOut])
async def rank_role_candidates_endpoint(role_id: str, db: Session = Depends(get_db)):
    """Evaluate and rank all candidates in this role's pipeline against the structured hiring criteria."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    role_candidates = (
        db.query(models.RoleCandidate)
        .options(
            joinedload(models.RoleCandidate.candidate),
            joinedload(models.RoleCandidate.calls),
            joinedload(models.RoleCandidate.current_stage),
        )
        .filter(models.RoleCandidate.role_id == role.id)
        .all()
    )
    if not role_candidates:
        return []

    criteria = _role_criteria(role)
    criteria["min_years_experience"] = role.min_years_experience
    criteria["title"] = role.title

    ranking_input = [
        {
            "index": i,
            "full_name": rc.candidate.full_name,
            "job_title": rc.candidate.current_title,
            "company": rc.candidate.current_company,
            "location": rc.candidate.location,
            "notes": rc.candidate.notes or "",
        }
        for i, rc in enumerate(role_candidates)
    ]

    try:
        rankings = await rank_candidates(criteria, ranking_input)
    except LLMError:
        rankings = {}

    for i, rc in enumerate(role_candidates):
        r = rankings.get(i)
        if not r:
            continue
        rc.fit_score = r["match_score"]
        rc.fit_strengths = r["strengths"]
        rc.fit_gaps = r["gaps"]
        rc.fit_summary = r["summary"]

    db.commit()
    for rc in role_candidates:
        db.refresh(rc)

    role_candidates.sort(key=lambda rc: (rc.fit_score if rc.fit_score is not None else -1), reverse=True)
    return role_candidates


@router.post("/{role_id}/pipeline/queue", response_model=list[schemas.CallOut])
async def queue_for_call(role_id: str, payload: schemas.QueueForCallRequest, db: Session = Depends(get_db)):
    """Queue one or more pipeline entries for an AI call using this role's Hunar agent.
    Enforces: one active call per candidate per role at a time."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    script = db.query(models.CallScript).filter(models.CallScript.role_id == role_id).first()

    active_statuses = {models.PipelineStatus.CALLING, models.PipelineStatus.RETRY_PENDING}
    created_calls: list[models.Call] = []
    client = HunarClient()
    org_settings = get_or_create_global_settings(db)

    for rc_id in payload.role_candidate_ids:
        rc = (
            db.query(models.RoleCandidate)
            .options(
                joinedload(models.RoleCandidate.candidate),
                joinedload(models.RoleCandidate.current_stage),
            )
            .filter(models.RoleCandidate.id == rc_id, models.RoleCandidate.role_id == role_id)
            .first()
        )
        if not rc:
            continue
        if rc.status in active_statuses:
            continue  # Rule: one active call per candidate per role at a time
        if not rc.candidate.phone_number:
            continue

        # Resolve agent from candidate's current stage script, falling back to role script
        target_agent_id = None
        if rc.current_stage_id:
            stage = (
                db.query(models.RoleStage)
                .options(joinedload(models.RoleStage.call_script))
                .filter(models.RoleStage.id == rc.current_stage_id)
                .first()
            )
            if stage and stage.call_script and stage.call_script.hunar_agent_id:
                target_agent_id = stage.call_script.hunar_agent_id

        if not target_agent_id and script and script.hunar_agent_id:
            target_agent_id = script.hunar_agent_id

        if not target_agent_id:
            raise HTTPException(
                status_code=400,
                detail="No voice agent configured for this stage yet. Save the Call Script first.",
            )

        request_id = f"role-{role.id[:8]}-{rc.id[:8]}-{uuid.uuid4().hex[:8]}"
        memory_graph = build_candidate_memory_graph(rc)
        custom_data = {
            "candidate_name": rc.candidate.full_name,
            "company_name": org_settings.company_name,
            "candidate_memory": memory_graph.get("briefing_text", ""),
        }
        try:
            hunar_call = await client.create_call(
                agent_id=target_agent_id,
                callee_name=rc.candidate.full_name,
                mobile_number=rc.candidate.phone_number,
                custom_data=custom_data,
                request_id=request_id,
            )
        except HunarAPIError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

        prior_attempts = db.query(models.Call).filter(models.Call.role_candidate_id == rc.id).count()
        call = models.Call(
            role_candidate_id=rc.id,
            role_id=role.id,
            candidate_id=rc.candidate_id,
            stage_id=rc.current_stage_id,
            attempt_number=prior_attempts + 1,
            hunar_call_id=hunar_call["id"],
            agent_id=target_agent_id,
            request_id=request_id,
            status=hunar_call.get("status", "NOT_STARTED"),
            custom_data=custom_data,
        )
        rc.status = models.PipelineStatus.CALLING
        db.add(call)
        db.add(rc)
        created_calls.append(call)

    db.commit()
    for c in created_calls:
        db.refresh(c)
    return created_calls



@router.delete("/{role_id}")
def delete_role(role_id: str, db: Session = Depends(get_db)):
    """Delete a role and all its pipeline entries, calls, script, and screenings."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
    return {"ok": True, "deleted_role_id": role_id}


@router.delete("/{role_id}/pipeline/{rc_id}")
def remove_candidate_from_role(role_id: str, rc_id: str, db: Session = Depends(get_db)):
    """Remove a candidate from a role's pipeline (keeps the global candidate record intact)."""
    rc = (
        db.query(models.RoleCandidate)
        .filter(models.RoleCandidate.id == rc_id, models.RoleCandidate.role_id == role_id)
        .first()
    )
    if not rc:
        raise HTTPException(status_code=404, detail="Pipeline entry not found")
    db.delete(rc)
    db.commit()
    return {"ok": True, "deleted_role_candidate_id": rc_id}
