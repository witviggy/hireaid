from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from .config import get_settings
from .database import Base, engine
from .routers import calls, call_scripts, candidates, dashboard, digital_twin, roles, settings as settings_router, stages, webhooks
from .scheduler import start_scheduler, stop_scheduler

settings = get_settings()

app = FastAPI(title="HireAId — AI Recruiter", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(roles.router)
app.include_router(stages.router)
app.include_router(candidates.router)
app.include_router(call_scripts.router)
app.include_router(calls.router)
app.include_router(digital_twin.router)
app.include_router(dashboard.router)
app.include_router(settings_router.router)
app.include_router(webhooks.router)


@app.on_event("startup")
def on_startup():
    # Simple setup for this project; use Alembic migrations for production changes.
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TYPE pipelinestatus ADD VALUE IF NOT EXISTS 'ARCHIVED'"))
            conn.execute(text("ALTER TYPE candidatesource ADD VALUE IF NOT EXISTS 'SANDBOX'"))
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript TEXT"))
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_turns JSONB"))
            conn.execute(text("ALTER TABLE call_scripts ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES role_stages(id)"))
            conn.execute(text("ALTER TABLE role_candidates ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES role_stages(id)"))
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES role_stages(id)"))
            conn.execute(text("ALTER TABLE call_scripts DROP CONSTRAINT IF EXISTS call_scripts_role_id_key"))
            conn.commit()

        from .models import Role, RoleStage, CallScript, RoleCandidate, Call
        from sqlalchemy.orm import Session
        with Session(engine) as db:
            roles = db.query(Role).all()
            for r in roles:
                existing_stages = db.query(RoleStage).filter(RoleStage.role_id == r.id).all()
                if not existing_stages:
                    default_stage = RoleStage(
                        role_id=r.id,
                        name="Round 1: Screening",
                        round_number=1,
                        stage_type="AI_VOICE",
                        description="Initial AI voice screening and qualification"
                    )
                    db.add(default_stage)
                    db.commit()
                    db.refresh(default_stage)

                    scripts = db.query(CallScript).filter(CallScript.role_id == r.id, CallScript.stage_id.is_(None)).all()
                    for s in scripts:
                        s.stage_id = default_stage.id
                        db.add(s)

                    db.query(RoleCandidate).filter(RoleCandidate.role_id == r.id, RoleCandidate.current_stage_id.is_(None)).update(
                        {"current_stage_id": default_stage.id}
                    )
                    db.query(Call).filter(Call.role_id == r.id, Call.stage_id.is_(None)).update(
                        {"stage_id": default_stage.id}
                    )
                    db.commit()

            from .services.digital_twin import seed_default_personas
            seed_default_personas(db)
    except Exception as e:
        print(f"Startup migration warning: {e}")
    start_scheduler()



@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


@app.get("/")
def root():
    return {"status": "ok", "app": "HireAId API", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok"}

