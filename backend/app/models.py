import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class RoleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"


class CandidateSource(str, enum.Enum):
    APOLLO = "APOLLO"
    PDL = "PDL"
    SANDBOX = "SANDBOX"
    PROXYCURL = "PROXYCURL"
    CORESIGNAL = "CORESIGNAL"
    MANUAL = "MANUAL"


class PipelineStatus(str, enum.Enum):
    SOURCED = "SOURCED"
    QUEUED = "QUEUED"
    CALLING = "CALLING"
    NO_ANSWER = "NO_ANSWER"
    RETRY_PENDING = "RETRY_PENDING"
    UNREACHABLE = "UNREACHABLE"
    SCREENED = "SCREENED"
    SHORTLISTED = "SHORTLISTED"
    REJECTED = "REJECTED"
    REVIEW_NEEDED = "REVIEW_NEEDED"
    ARCHIVED = "ARCHIVED"


class AddedBy(str, enum.Enum):
    SEARCH = "SEARCH"
    MANUAL = "MANUAL"
    RECRUITER = "RECRUITER"


class CallStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    DIALING = "DIALING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NO_ANSWER = "NO_ANSWER"
    FAILED = "FAILED"


class Recommendation(str, enum.Enum):
    ADVANCE = "ADVANCE"
    HOLD = "HOLD"
    REJECT = "REJECT"


class RetryStatus(str, enum.Enum):
    PENDING = "PENDING"
    FIRED = "FIRED"
    CANCELLED = "CANCELLED"


class Role(Base):
    """The atomic unit of HireOS: a job requisition with AI-extracted hiring criteria
    and its own call script (assembled into a dedicated Hunar Agent)."""

    __tablename__ = "roles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String(255), nullable=False)
    jd_raw_text = Column(Text, nullable=False)
    required_skills_hint = Column(String(1024), nullable=True)
    location = Column(String(255), nullable=True)
    target_company = Column(String(255), nullable=True)
    status = Column(Enum(RoleStatus), nullable=False, default=RoleStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # AI-extracted hiring criteria (Groq JD-analysis)
    must_have_skills = Column(JSONB, nullable=True)
    preferred_skills = Column(JSONB, nullable=True)
    seniority = Column(String(32), nullable=True)
    min_years_experience = Column(Integer, nullable=True)
    max_years_experience = Column(Integer, nullable=True)
    location_normalized = Column(String(255), nullable=True)
    compensation_max = Column(String(64), nullable=True)
    ai_summary = Column(Text, nullable=True)

    pipeline_entries = relationship("RoleCandidate", back_populates="role", cascade="all, delete-orphan")
    call_script = relationship("CallScript", back_populates="role", uselist=False, cascade="all, delete-orphan")
    stages = relationship("RoleStage", back_populates="role", order_by="RoleStage.round_number", cascade="all, delete-orphan")

    @property
    def total_rounds(self) -> int:
        return len(self.stages) if self.stages else 1

    @property
    def description(self) -> str:
        return self.ai_summary or self.jd_raw_text or ""


class Candidate(Base):
    """A person, independent of any specific role. Reused across multiple role pipelines."""

    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(32), nullable=False)
    email = Column(String(255), nullable=True)
    current_title = Column(String(255), nullable=True)
    current_company = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    linkedin_url = Column(String(512), nullable=True)
    source = Column(Enum(CandidateSource), nullable=False, default=CandidateSource.MANUAL)
    resume_url = Column(String(512), nullable=True)
    notes = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pipeline_entries = relationship("RoleCandidate", back_populates="candidate", cascade="all, delete-orphan")


class RoleCandidate(Base):
    """The pipeline entry: one row per (role, candidate) pair. All call/screening
    activity for a candidate on a given role is scoped to this row."""

    __tablename__ = "role_candidates"
    __table_args__ = (UniqueConstraint("role_id", "candidate_id", name="uq_role_candidate"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    role_id = Column(UUID(as_uuid=False), ForeignKey("roles.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=False), ForeignKey("candidates.id"), nullable=False)
    current_stage_id = Column(UUID(as_uuid=False), ForeignKey("role_stages.id"), nullable=True)
    status = Column(Enum(PipelineStatus), nullable=False, default=PipelineStatus.SOURCED)
    fit_score = Column(Integer, nullable=True)
    fit_strengths = Column(JSONB, nullable=True)
    fit_gaps = Column(JSONB, nullable=True)
    fit_summary = Column(Text, nullable=True)
    source = Column(Enum(CandidateSource), nullable=False, default=CandidateSource.MANUAL)
    added_by = Column(Enum(AddedBy), nullable=False, default=AddedBy.MANUAL)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("Role", back_populates="pipeline_entries")
    candidate = relationship("Candidate", back_populates="pipeline_entries")
    calls = relationship(
        "Call", back_populates="role_candidate", cascade="all, delete-orphan", order_by="desc(Call.created_at)"
    )
    current_stage = relationship("RoleStage")

    @property
    def total_rounds(self) -> int:
        if self.role and self.role.stages:
            return len(self.role.stages)
        return 1


class Call(Base):
    """A single Hunar voice-agent call attempt for a role/candidate pipeline entry."""

    __tablename__ = "calls"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    role_candidate_id = Column(UUID(as_uuid=False), ForeignKey("role_candidates.id"), nullable=False)
    # Denormalized for easy querying without a join
    role_id = Column(UUID(as_uuid=False), ForeignKey("roles.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=False), ForeignKey("candidates.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=False), ForeignKey("role_stages.id"), nullable=True)

    attempt_number = Column(Integer, nullable=False, default=1)
    hunar_call_id = Column(String(64), nullable=True, index=True)
    agent_id = Column(String(64), nullable=True)
    request_id = Column(String(64), nullable=True)

    status = Column(String(32), nullable=False, default="NOT_STARTED")
    lifecycle_status = Column(String(32), nullable=True)
    recording_url = Column(String(512), nullable=True)
    result = Column(JSONB, nullable=True)
    custom_data = Column(JSONB, nullable=True)
    transcript = Column(Text, nullable=True)
    transcript_turns = Column(JSONB, nullable=True)

    duration_seconds = Column(String(32), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role_candidate = relationship("RoleCandidate", back_populates="calls")
    screening = relationship("Screening", back_populates="call", uselist=False, cascade="all, delete-orphan")
    retry_entries = relationship("CallRetryQueue", back_populates="call", cascade="all, delete-orphan")
    stage = relationship("RoleStage", back_populates="calls")

    @property
    def candidate_name(self) -> Optional[str]:
        if self.role_candidate and self.role_candidate.candidate:
            return self.role_candidate.candidate.full_name
        return None

    @property
    def candidate_title(self) -> Optional[str]:
        if self.role_candidate and self.role_candidate.candidate:
            return self.role_candidate.candidate.current_title
        return None

    @property
    def candidate_phone(self) -> Optional[str]:
        if self.role_candidate and self.role_candidate.candidate:
            return self.role_candidate.candidate.phone_number
        return None

    @property
    def role_title(self) -> Optional[str]:
        if self.role_candidate and self.role_candidate.role:
            return self.role_candidate.role.title
        return None

    @property
    def has_pending_retry(self) -> bool:
        if self.retry_entries:
            return any(r.status == RetryStatus.PENDING for r in self.retry_entries)
        return False

    @property
    def retry_attempt(self) -> Optional[int]:
        if self.retry_entries:
            for r in self.retry_entries:
                if r.status == RetryStatus.PENDING:
                    return r.attempt_number
        return None

    @property
    def retry_scheduled_at(self) -> Optional[object]:
        if self.retry_entries:
            for r in self.retry_entries:
                if r.status == RetryStatus.PENDING:
                    return r.scheduled_at
        return None

    @property
    def total_rounds(self) -> int:
        if self.role_candidate and self.role_candidate.role and self.role_candidate.role.stages:
            return len(self.role_candidate.role.stages)
        return 1


class Screening(Base):
    """AI-generated scorecard produced after a call completes, from Hunar's structured
    call result plus the role's hiring criteria. One per completed call."""

    __tablename__ = "screenings"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False, unique=True)
    role_candidate_id = Column(UUID(as_uuid=False), ForeignKey("role_candidates.id"), nullable=False)

    interest_level = Column(String(32), nullable=True)  # high | medium | low | not_interested
    notice_period_days = Column(Integer, nullable=True)
    expected_ctc_min = Column(Integer, nullable=True)
    expected_ctc_max = Column(Integer, nullable=True)
    location_confirmed = Column(String(32), nullable=True)  # exact | open_to | mismatch
    open_to_relocation = Column(Boolean, nullable=True)
    reason_for_switching = Column(Text, nullable=True)
    concerns = Column(JSONB, nullable=True)
    competing_offers = Column(Boolean, nullable=True)
    skill_assessments = Column(JSONB, nullable=True)

    score_technical = Column(Integer, nullable=True)
    score_experience = Column(Integer, nullable=True)
    score_location = Column(Integer, nullable=True)
    score_compensation = Column(Integer, nullable=True)
    score_availability = Column(Integer, nullable=True)
    score_overall = Column(Integer, nullable=True)

    recommendation = Column(Enum(Recommendation), nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_concerns = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call = relationship("Call", back_populates="screening")



class RoleStage(Base):
    """An evaluation stage/round for a role (e.g. Round 1: Phone Screen, Round 2: Tech Deep-Dive)."""

    __tablename__ = "role_stages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    role_id = Column(UUID(as_uuid=False), ForeignKey("roles.id"), nullable=False)
    name = Column(String(128), nullable=False)  # e.g. "Round 1: Screening", "Round 2: Technical Assessment"
    round_number = Column(Integer, nullable=False, default=1)
    stage_type = Column(String(32), nullable=False, default="AI_VOICE")  # AI_VOICE | HUMAN | SYSTEM
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("Role", back_populates="stages")
    call_script = relationship("CallScript", back_populates="stage", uselist=False, cascade="all, delete-orphan")
    calls = relationship("Call", back_populates="stage")


class CallScript(Base):
    """Role or Stage-level call-script configuration. Assembled into a dedicated Hunar Agent
    whenever it's saved (see services/hunar_agent.py)."""

    __tablename__ = "call_scripts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    role_id = Column(UUID(as_uuid=False), ForeignKey("roles.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=False), ForeignKey("role_stages.id"), nullable=True)

    ai_name = Column(String(64), nullable=False, default="Alex")
    tone = Column(String(32), nullable=False, default="CONVERSATIONAL")  # PROFESSIONAL | CONVERSATIONAL | CASUAL
    language = Column(String(32), nullable=False, default="ENGLISH")
    pace = Column(String(32), nullable=False, default="STANDARD")  # STANDARD | GIVE_SPACE

    introduction = Column(Text, nullable=True)
    questions = Column(JSONB, nullable=True)  # [{text, type, follow_up, required, ai_note, is_system}]
    objection_handlers = Column(JSONB, nullable=True)  # [{trigger, response}]
    closing_interested = Column(Text, nullable=True)
    closing_not_interested = Column(Text, nullable=True)
    closing_handoff = Column(Text, nullable=True)
    additional_instructions = Column(String(500), nullable=True)

    hunar_agent_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role = relationship("Role", back_populates="call_script")
    stage = relationship("RoleStage", back_populates="call_script")


class GlobalSettings(Base):
    """Singleton row of org-wide defaults that roles inherit unless overridden."""

    __tablename__ = "global_settings"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    ai_name = Column(String(64), nullable=False, default="Alex")
    company_name = Column(String(255), nullable=False, default="HireAId")
    tone = Column(String(32), nullable=False, default="CONVERSATIONAL")
    language = Column(String(32), nullable=False, default="ENGLISH")
    calling_hours_start = Column(String(8), nullable=False, default="09:00")
    calling_hours_end = Column(String(8), nullable=False, default="18:00")
    retry_enabled = Column(Boolean, nullable=False, default=True)
    retry_delay_minutes = Column(Integer, nullable=False, default=20)
    max_retries = Column(Integer, nullable=False, default=2)
    system_questions = Column(JSONB, nullable=True)


class CallRetryQueue(Base):
    """Scheduled redial attempts for calls that ended NO_ANSWER."""

    __tablename__ = "call_retry_queue"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    role_candidate_id = Column(UUID(as_uuid=False), ForeignKey("role_candidates.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(RetryStatus), nullable=False, default=RetryStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call = relationship("Call", back_populates="retry_entries")


class DigitalTwinPersona(Base):
    """Synthetic candidate persona for stress-testing AI voice agents."""

    __tablename__ = "digital_twin_personas"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(String(32), nullable=False, default="MEDIUM")  # EASY | MEDIUM | HARD | EXTREME
    system_prompt = Column(Text, nullable=False)
    candidate_profile = Column(JSONB, nullable=True)  # { claimed_title, notice_period, target_ctc, key_traits, objections }
    is_builtin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    experiments = relationship("DigitalTwinExperiment", back_populates="persona", cascade="all, delete-orphan")


class DigitalTwinExperiment(Base):
    """A simulated multi-turn interview experiment run against a voice agent."""

    __tablename__ = "digital_twin_experiments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    role_id = Column(UUID(as_uuid=False), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(UUID(as_uuid=False), ForeignKey("role_stages.id", ondelete="SET NULL"), nullable=True)
    persona_id = Column(UUID(as_uuid=False), ForeignKey("digital_twin_personas.id", ondelete="CASCADE"), nullable=False)

    turns = Column(JSONB, nullable=False, default=list)  # list of { speaker: "AGENT"|"CANDIDATE", text: str }
    score_resilience = Column(Integer, nullable=True)
    score_clarity = Column(Integer, nullable=True)
    score_information_capture = Column(Integer, nullable=True)
    score_overall = Column(Integer, nullable=True)

    strengths = Column(JSONB, nullable=True, default=list)
    weaknesses = Column(JSONB, nullable=True, default=list)
    ai_analysis = Column(Text, nullable=True)
    prompt_recommendation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("Role")
    stage = relationship("RoleStage")
    persona = relationship("DigitalTwinPersona", back_populates="experiments")

    @property
    def role_title(self) -> Optional[str]:
        return self.role.title if self.role else None

    @property
    def stage_name(self) -> Optional[str]:
        return self.stage.name if self.stage else "Round 1: Screening"

    @property
    def persona_name(self) -> Optional[str]:
        return self.persona.name if self.persona else None

    @property
    def persona_difficulty(self) -> Optional[str]:
        return self.persona.difficulty if self.persona else "MEDIUM"


