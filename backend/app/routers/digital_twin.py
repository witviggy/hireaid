"""Digital Twin Lab Router (Phase 3).

Endpoints for synthetic candidate persona management, multi-turn interview
simulation against role stage voice agents, and AI prompt improvement loops.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.digital_twin import (
    evaluate_digital_twin_run,
    generate_persona_from_prompt,
    seed_default_personas,
    simulate_digital_twin_dialogue,
)
from ..services.hunar_agent import sync_role_agent
from ..services.hunar_client import HunarAPIError

router = APIRouter(prefix="/api/digital-twin", tags=["digital-twin"])


@router.get("/personas", response_model=list[schemas.DigitalTwinPersonaOut])
def list_personas(db: Session = Depends(get_db)):
    """List all available digital twin personas (builtin & custom)."""
    seed_default_personas(db)
    return (
        db.query(models.DigitalTwinPersona)
        .order_by(models.DigitalTwinPersona.is_builtin.desc(), models.DigitalTwinPersona.created_at.asc())
        .all()
    )


@router.post("/personas", response_model=schemas.DigitalTwinPersonaOut)
def create_persona(req: schemas.CreatePersonaRequest, db: Session = Depends(get_db)):
    """Create a new custom digital twin persona."""
    persona = models.DigitalTwinPersona(
        name=req.name.strip(),
        description=req.description.strip(),
        difficulty=req.difficulty,
        system_prompt=req.system_prompt.strip(),
        candidate_profile=req.candidate_profile,
        is_builtin=False,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@router.post("/personas/generate")
async def generate_persona(req: schemas.GeneratePersonaRequest):
    """Use AI to draft a full persona from a simple natural language prompt."""
    if not req.idea or len(req.idea.strip()) < 3:
        raise HTTPException(status_code=400, detail="Please provide a descriptive persona idea.")
    try:
        return await generate_persona_from_prompt(req.idea.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persona generation failed: {e}")


@router.delete("/personas/{persona_id}")
def delete_persona(persona_id: str, db: Session = Depends(get_db)):
    """Delete a custom persona (cannot delete built-in personas)."""
    persona = db.query(models.DigitalTwinPersona).filter(models.DigitalTwinPersona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot delete standard built-in personas")
    db.delete(persona)
    db.commit()
    return {"status": "deleted", "id": persona_id}


@router.post("/simulate", response_model=schemas.SimulateResultOut)
async def simulate_experiment(req: schemas.SimulateRequest, db: Session = Depends(get_db)):
    """Execute a simulated multi-turn phone interview between a Role Stage Agent and a Persona."""
    role = db.query(models.Role).filter(models.Role.id == req.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    persona = db.query(models.DigitalTwinPersona).filter(models.DigitalTwinPersona.id == req.persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Resolve stage
    stage = None
    if req.stage_id:
        stage = db.query(models.RoleStage).filter(models.RoleStage.id == req.stage_id).first()
    if not stage:
        stage = (
            db.query(models.RoleStage)
            .filter(models.RoleStage.role_id == role.id)
            .order_by(models.RoleStage.round_number.asc())
            .first()
        )

    # Resolve CallScript
    script = None
    if stage:
        script = db.query(models.CallScript).filter(models.CallScript.stage_id == stage.id).first()
    if not script:
        script = db.query(models.CallScript).filter(models.CallScript.role_id == role.id).first()

    if not script:
        # Fallback default script
        script = models.CallScript(
            role_id=role.id,
            stage_id=stage.id if stage else None,
            ai_name="Alex",
            tone="CONVERSATIONAL",
            language="ENGLISH",
            pace="STANDARD",
            introduction=f"Hi, I'm Alex calling from HireAId regarding the {role.title} position. Do you have a few minutes?",
            additional_instructions="Conduct a polite, professional screening call.",
        )
        db.add(script)
        db.commit()
        db.refresh(script)

    global_settings = db.query(models.GlobalSettings).first()

    # 1. Run dialogue simulation
    max_turns = max(4, min(req.max_turns or 8, 20))
    try:
        turns = await simulate_digital_twin_dialogue(
            role=role,
            stage=stage,
            script=script,
            global_settings=global_settings,
            persona=persona,
            max_turns=max_turns,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation dialogue failed: {e}")

    # 2. Evaluate performance & generate prompt recommendation
    try:
        eval_result = await evaluate_digital_twin_run(
            turns=turns,
            role=role,
            stage=stage,
            persona=persona,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation evaluation failed: {e}")

    # 3. Persist experiment record
    experiment = models.DigitalTwinExperiment(
        role_id=role.id,
        stage_id=stage.id if stage else None,
        persona_id=persona.id,
        turns=turns,
        score_resilience=eval_result["score_resilience"],
        score_clarity=eval_result["score_clarity"],
        score_information_capture=eval_result["score_information_capture"],
        score_overall=eval_result["score_overall"],
        strengths=eval_result["strengths"],
        weaknesses=eval_result["weaknesses"],
        ai_analysis=eval_result["ai_analysis"],
        prompt_recommendation=eval_result["prompt_recommendation"],
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    return schemas.SimulateResultOut(
        experiment_id=experiment.id,
        role_id=role.id,
        role_title=role.title,
        stage_id=stage.id if stage else None,
        stage_name=stage.name if stage else "Round 1: Screening",
        persona_id=persona.id,
        persona_name=persona.name,
        persona_difficulty=persona.difficulty,
        turns=turns,
        score_resilience=eval_result["score_resilience"],
        score_clarity=eval_result["score_clarity"],
        score_information_capture=eval_result["score_information_capture"],
        score_overall=eval_result["score_overall"],
        strengths=eval_result["strengths"],
        weaknesses=eval_result["weaknesses"],
        ai_analysis=eval_result["ai_analysis"],
        prompt_recommendation=eval_result["prompt_recommendation"],
        created_at=experiment.created_at,
    )


@router.get("/experiments", response_model=list[schemas.DigitalTwinExperimentOut])
def list_experiments(role_id: Optional[str] = None, db: Session = Depends(get_db)):
    """List recent digital twin experiment runs with full turns and metrics."""
    q = (
        db.query(models.DigitalTwinExperiment)
        .options(
            joinedload(models.DigitalTwinExperiment.role),
            joinedload(models.DigitalTwinExperiment.stage),
            joinedload(models.DigitalTwinExperiment.persona),
        )
    )
    if role_id:
        q = q.filter(models.DigitalTwinExperiment.role_id == role_id)
    return q.order_by(models.DigitalTwinExperiment.created_at.desc()).limit(50).all()


@router.get("/experiments/{experiment_id}", response_model=schemas.DigitalTwinExperimentOut)
def get_experiment(experiment_id: str, db: Session = Depends(get_db)):
    """Retrieve full experiment record with transcript, scores, and recommendations."""
    exp = (
        db.query(models.DigitalTwinExperiment)
        .options(
            joinedload(models.DigitalTwinExperiment.role),
            joinedload(models.DigitalTwinExperiment.stage),
            joinedload(models.DigitalTwinExperiment.persona),
        )
        .filter(models.DigitalTwinExperiment.id == experiment_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.delete("/experiments/{experiment_id}")
def delete_experiment(experiment_id: str, db: Session = Depends(get_db)):
    """Delete an experiment record."""
    exp = db.query(models.DigitalTwinExperiment).filter(models.DigitalTwinExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    db.delete(exp)
    db.commit()
    return {"status": "deleted", "id": experiment_id}


@router.post("/apply-recommendation")
async def apply_recommendation(req: schemas.ApplyRecommendationRequest, db: Session = Depends(get_db)):
    """Apply an AI prompt improvement recommendation directly into the Stage's CallScript."""
    role = db.query(models.Role).filter(models.Role.id == req.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    stage = None
    if req.stage_id:
        stage = db.query(models.RoleStage).filter(models.RoleStage.id == req.stage_id).first()
    if not stage:
        stage = (
            db.query(models.RoleStage)
            .filter(models.RoleStage.role_id == role.id)
            .order_by(models.RoleStage.round_number.asc())
            .first()
        )

    script = None
    if stage:
        script = db.query(models.CallScript).filter(models.CallScript.stage_id == stage.id).first()
    if not script:
        script = db.query(models.CallScript).filter(models.CallScript.role_id == role.id).first()

    if not script:
        raise HTTPException(status_code=404, detail="No script found for this role stage")

    # Append the recommendation to additional_instructions
    patch_text = f"\n- [Digital Twin Patch]: {req.recommendation.strip()}"
    if script.additional_instructions:
        script.additional_instructions += patch_text
    else:
        script.additional_instructions = req.recommendation.strip()

    db.add(script)
    db.commit()
    db.refresh(script)

    # Re-sync Hunar Agent if configured
    try:
        agent_id = await sync_role_agent(role, script, stage=stage)
        script.hunar_agent_id = agent_id
        db.add(script)
        db.commit()
        db.refresh(script)
    except HunarAPIError:
        pass

    return {
        "status": "applied",
        "script_id": script.id,
        "additional_instructions": script.additional_instructions,
    }
