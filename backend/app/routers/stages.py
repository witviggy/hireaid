from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.hunar_agent import (
    assemble_agent_prompt,
    build_result_prompt,
    build_result_schema,
    default_call_script_fields,
    sync_role_agent,
)
from ..services.hunar_client import HunarAPIError

router = APIRouter(prefix="/api/roles/{role_id}/stages", tags=["stages"])


def _get_role_and_stage(role_id: str, stage_id: str, db: Session) -> tuple[models.Role, models.RoleStage]:
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    stage = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.id == stage_id, models.RoleStage.role_id == role_id)
        .first()
    )
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found for this role")
    return role, stage


@router.get("", response_model=list[schemas.RoleStageOut])
def list_role_stages(role_id: str, db: Session = Depends(get_db)):
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return (
        db.query(models.RoleStage)
        .options(joinedload(models.RoleStage.call_script))
        .filter(models.RoleStage.role_id == role_id)
        .order_by(models.RoleStage.round_number.asc())
        .all()
    )


@router.post("", response_model=schemas.RoleStageOut)
async def create_role_stage(
    role_id: str, payload: schemas.RoleStageCreate, db: Session = Depends(get_db)
):
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    existing_stages = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role_id)
        .order_by(models.RoleStage.round_number.asc())
        .all()
    )
    next_round = (
        max((s.round_number for s in existing_stages), default=0) + 1
        if payload.round_number is None or payload.round_number <= 0
        else payload.round_number
    )

    stage = models.RoleStage(
        role_id=role.id,
        name=payload.name or f"Round {next_round}",
        round_number=next_round,
        stage_type=payload.stage_type or "AI_VOICE",
        description=payload.description,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)

    # If AI Voice stage, initialize a tailored call script
    if stage.stage_type == "AI_VOICE":
        defaults = default_call_script_fields(role.title)
        script = models.CallScript(
            role_id=role.id,
            stage_id=stage.id,
            **defaults,
        )
        db.add(script)
        db.commit()
        db.refresh(script)
        stage.call_script = script

    return stage


@router.put("/{stage_id}", response_model=schemas.RoleStageOut)
def update_role_stage(
    role_id: str, stage_id: str, payload: schemas.RoleStageUpdate, db: Session = Depends(get_db)
):
    _, stage = _get_role_and_stage(role_id, stage_id, db)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(stage, key, value)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/{stage_id}")
def delete_role_stage(role_id: str, stage_id: str, db: Session = Depends(get_db)):
    role, stage = _get_role_and_stage(role_id, stage_id, db)
    total_stages = db.query(models.RoleStage).filter(models.RoleStage.role_id == role_id).count()
    if total_stages <= 1:
        raise HTTPException(
            status_code=400, detail="Cannot delete the only remaining stage for this role."
        )

    # Reassign candidates currently in this stage to the first stage
    first_other_stage = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role_id, models.RoleStage.id != stage_id)
        .order_by(models.RoleStage.round_number.asc())
        .first()
    )
    if first_other_stage:
        db.query(models.RoleCandidate).filter(
            models.RoleCandidate.role_id == role_id,
            models.RoleCandidate.current_stage_id == stage_id,
        ).update({"current_stage_id": first_other_stage.id})

    db.delete(stage)
    db.commit()

    # Re-number remaining stages sequentially
    remaining_stages = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role_id)
        .order_by(models.RoleStage.round_number.asc())
        .all()
    )
    for idx, s in enumerate(remaining_stages, 1):
        s.round_number = idx
        db.add(s)
    db.commit()

    return {"ok": True, "deleted_stage_id": stage_id}


@router.get("/{stage_id}/call-script", response_model=schemas.CallScriptOut)
def get_stage_call_script(role_id: str, stage_id: str, db: Session = Depends(get_db)):
    role, stage = _get_role_and_stage(role_id, stage_id, db)
    script = (
        db.query(models.CallScript)
        .filter(models.CallScript.stage_id == stage_id)
        .first()
    )
    if not script:
        # Check if role has a script without stage_id
        script = (
            db.query(models.CallScript)
            .filter(models.CallScript.role_id == role_id, models.CallScript.stage_id.is_(None))
            .first()
        )
        if script:
            script.stage_id = stage.id
            db.add(script)
            db.commit()
            db.refresh(script)
        else:
            defaults = default_call_script_fields(role.title)
            script = models.CallScript(role_id=role.id, stage_id=stage.id, **defaults)
            db.add(script)
            db.commit()
            db.refresh(script)
    return script


@router.put("/{stage_id}/call-script", response_model=schemas.CallScriptOut)
async def update_stage_call_script(
    role_id: str,
    stage_id: str,
    payload: schemas.CallScriptUpdate,
    db: Session = Depends(get_db),
):
    role, stage = _get_role_and_stage(role_id, stage_id, db)
    script = (
        db.query(models.CallScript)
        .filter(models.CallScript.stage_id == stage_id)
        .first()
    )
    if not script:
        defaults = default_call_script_fields(role.title)
        script = models.CallScript(role_id=role.id, stage_id=stage.id, **defaults)
        db.add(script)
        db.commit()
        db.refresh(script)

    updates = payload.model_dump(exclude_unset=True)
    if "questions" in updates and updates["questions"] is not None:
        updates["questions"] = [
            q if isinstance(q, dict) else q.model_dump() for q in payload.questions
        ]
    if "objection_handlers" in updates and updates["objection_handlers"] is not None:
        updates["objection_handlers"] = [
            h if isinstance(h, dict) else h.model_dump() for h in payload.objection_handlers
        ]
    for key, value in updates.items():
        setattr(script, key, value)

    try:
        agent_id = await sync_role_agent(role, script, stage=stage)
        script.hunar_agent_id = agent_id
    except HunarAPIError as exc:
        db.add(script)
        db.commit()
        raise HTTPException(
            status_code=exc.status_code,
            detail=f"Saved locally, but Hunar agent sync failed: {exc.message}",
        ) from exc

    db.add(script)
    db.commit()
    db.refresh(script)
    return script


@router.get("/{stage_id}/call-script/preview")
def preview_stage_call_script(role_id: str, stage_id: str, db: Session = Depends(get_db)):
    role, stage = _get_role_and_stage(role_id, stage_id, db)
    script = (
        db.query(models.CallScript)
        .filter(models.CallScript.stage_id == stage_id)
        .first()
    )
    if not script:
        script = db.query(models.CallScript).filter(models.CallScript.role_id == role_id).first()
    return {
        "agent_prompt": assemble_agent_prompt(role, script, stage=stage) if script else "",
        "introduction": script.introduction if script else "",
        "result_prompt": build_result_prompt(role, stage=stage),
        "result_schema": build_result_schema(script.questions or []) if script else {},
    }


@router.post("/{stage_id}/call-script/test-call", response_model=schemas.CallOut)
async def test_stage_call_script(
    role_id: str,
    stage_id: str,
    payload: schemas.TestCallRequest,
    db: Session = Depends(get_db),
):
    import uuid
    from ..services.hunar_client import HunarClient
    from ..services.call_sync import get_or_create_global_settings

    role, stage = _get_role_and_stage(role_id, stage_id, db)
    script = (
        db.query(models.CallScript)
        .filter(models.CallScript.stage_id == stage_id)
        .first()
    )
    if not script or not script.hunar_agent_id:
        raise HTTPException(
            status_code=400,
            detail="Save this round's call script at least once before testing it.",
        )

    candidate = models.Candidate(
        full_name=payload.callee_name,
        phone_number=payload.mobile_number,
        source=models.CandidateSource.MANUAL,
        notes=f"Test call recipient ({stage.name})",
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    rc = models.RoleCandidate(
        role_id=role.id,
        candidate_id=candidate.id,
        status=models.PipelineStatus.CALLING,
        source=models.CandidateSource.MANUAL,
        added_by=models.AddedBy.RECRUITER,
        current_stage_id=stage.id,
    )
    db.add(rc)
    db.commit()
    db.refresh(rc)

    client = HunarClient()
    request_id = f"test-{role.id[:8]}-{stage.id[:4]}-{uuid.uuid4().hex[:8]}"
    org_settings = get_or_create_global_settings(db)
    custom_data = {
        "candidate_name": payload.callee_name,
        "company_name": org_settings.company_name,
        "candidate_memory": f"Stage test call for {stage.name}. Verify competencies for this round.",
    }
    try:
        hunar_call = await client.create_call(
            agent_id=script.hunar_agent_id,
            callee_name=payload.callee_name,
            mobile_number=payload.mobile_number,
            custom_data=custom_data,
            request_id=request_id,
        )
    except HunarAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    call = models.Call(
        role_candidate_id=rc.id,
        role_id=role.id,
        candidate_id=candidate.id,
        stage_id=stage.id,
        attempt_number=1,
        hunar_call_id=hunar_call["id"],
        agent_id=script.hunar_agent_id,
        request_id=request_id,
        status=hunar_call.get("status", "NOT_STARTED"),
        custom_data=custom_data,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


@router.post("/candidates/{rc_id}/advance", response_model=schemas.RoleCandidateOut)

def advance_candidate_stage(
    role_id: str,
    rc_id: str,
    target_stage_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Advance candidate to the next sequential round or a specific target stage."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    rc = (
        db.query(models.RoleCandidate)
        .options(
            joinedload(models.RoleCandidate.candidate),
            joinedload(models.RoleCandidate.current_stage),
            joinedload(models.RoleCandidate.calls),
        )
        .filter(models.RoleCandidate.id == rc_id, models.RoleCandidate.role_id == role_id)
        .first()
    )
    if not rc:
        raise HTTPException(status_code=404, detail="Pipeline candidate not found")

    stages = (
        db.query(models.RoleStage)
        .filter(models.RoleStage.role_id == role_id)
        .order_by(models.RoleStage.round_number.asc())
        .all()
    )
    if not stages:
        raise HTTPException(status_code=400, detail="No stages defined for this role")

    if target_stage_id:
        target_stage = next((s for s in stages if s.id == target_stage_id), None)
        if not target_stage:
            raise HTTPException(status_code=404, detail="Target stage not found")
        rc.current_stage_id = target_stage.id
    else:
        # Find next stage after current_stage
        current_idx = -1
        for idx, s in enumerate(stages):
            if s.id == rc.current_stage_id:
                current_idx = idx
                break

        if current_idx >= 0 and current_idx + 1 < len(stages):
            rc.current_stage_id = stages[current_idx + 1].id
        elif current_idx == -1:
            # Not assigned yet, assign to first stage
            rc.current_stage_id = stages[0].id
        else:
            raise HTTPException(
                status_code=400, detail="Candidate is already at the final round for this role."
            )

    # Mark status as SHORTLISTED so recruiter can queue next call
    rc.status = models.PipelineStatus.SHORTLISTED
    db.add(rc)
    db.commit()
    db.refresh(rc)
    return rc
