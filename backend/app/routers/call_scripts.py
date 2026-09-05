import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.hunar_agent import assemble_agent_prompt, build_result_prompt, build_result_schema, sync_role_agent
from ..services.hunar_client import HunarAPIError, HunarClient
from ..services.call_sync import get_or_create_global_settings

router = APIRouter(prefix="/api/roles/{role_id}/call-script", tags=["call-script"])


def _get_role_and_script(role_id: str, db: Session) -> tuple[models.Role, models.CallScript]:
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    script = db.query(models.CallScript).filter(models.CallScript.role_id == role_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Call script not found for this role")
    return role, script


@router.get("", response_model=schemas.CallScriptOut)
def get_call_script(role_id: str, db: Session = Depends(get_db)):
    _, script = _get_role_and_script(role_id, db)
    return script


@router.put("", response_model=schemas.CallScriptOut)
async def update_call_script(role_id: str, payload: schemas.CallScriptUpdate, db: Session = Depends(get_db)):
    """Save the script, then create/update the Hunar Agent backing this role."""
    role, script = _get_role_and_script(role_id, db)

    updates = payload.model_dump(exclude_unset=True)
    if "questions" in updates and updates["questions"] is not None:
        updates["questions"] = [q if isinstance(q, dict) else q.model_dump() for q in payload.questions]
    if "objection_handlers" in updates and updates["objection_handlers"] is not None:
        updates["objection_handlers"] = [
            h if isinstance(h, dict) else h.model_dump() for h in payload.objection_handlers
        ]
    for key, value in updates.items():
        setattr(script, key, value)

    try:
        agent_id = await sync_role_agent(role, script)
        script.hunar_agent_id = agent_id
    except HunarAPIError as exc:
        db.add(script)
        db.commit()
        raise HTTPException(status_code=exc.status_code, detail=f"Saved locally, but Hunar agent sync failed: {exc.message}") from exc

    db.add(script)
    db.commit()
    db.refresh(script)
    return script


@router.get("/preview")
def preview_call_script(role_id: str, db: Session = Depends(get_db)):
    role, script = _get_role_and_script(role_id, db)
    return {
        "agent_prompt": assemble_agent_prompt(role, script),
        "introduction": script.introduction,
        "result_prompt": build_result_prompt(role),
        "result_schema": build_result_schema(script.questions or []),
    }


@router.post("/test-call", response_model=schemas.CallOut)
async def test_call_script(role_id: str, payload: schemas.TestCallRequest, db: Session = Depends(get_db)):
    """Place a real call to the recruiter's own number using this role's live agent,
    so they can hear exactly what candidates will experience."""
    role, script = _get_role_and_script(role_id, db)
    if not script.hunar_agent_id:
        raise HTTPException(status_code=400, detail="Save the call script at least once before testing it.")

    # Test calls use a throwaway candidate + pipeline entry so they show up in the role's
    # activity without polluting real sourcing pipelines.
    candidate = models.Candidate(
        full_name=payload.callee_name,
        phone_number=payload.mobile_number,
        source=models.CandidateSource.MANUAL,
        notes="Test call recipient",
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
    )
    db.add(rc)
    db.commit()
    db.refresh(rc)

    client = HunarClient()
    request_id = f"test-{role.id[:8]}-{uuid.uuid4().hex[:8]}"
    org_settings = get_or_create_global_settings(db)
    try:
        hunar_call = await client.create_call(
            agent_id=script.hunar_agent_id,
            callee_name=payload.callee_name,
            mobile_number=payload.mobile_number,
            custom_data={"candidate_name": payload.callee_name, "company_name": org_settings.company_name},
            request_id=request_id,
        )
    except HunarAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    call = models.Call(
        role_candidate_id=rc.id,
        role_id=role.id,
        candidate_id=candidate.id,
        attempt_number=1,
        hunar_call_id=hunar_call["id"],
        agent_id=script.hunar_agent_id,
        request_id=request_id,
        status=hunar_call.get("status", "NOT_STARTED"),
        custom_data={"candidate_name": payload.callee_name, "company_name": org_settings.company_name},
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call
