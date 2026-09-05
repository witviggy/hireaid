from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ---------- Roles ----------


class RoleCreate(BaseModel):
    title: str
    jd_raw_text: str
    required_skills_hint: Optional[str] = None
    location: Optional[str] = None
    target_company: Optional[str] = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    jd_raw_text: str
    required_skills_hint: Optional[str] = None
    location: Optional[str] = None
    target_company: Optional[str] = None
    status: str
    created_at: datetime
    must_have_skills: Optional[list[str]] = None
    preferred_skills: Optional[list[str]] = None
    seniority: Optional[str] = None
    min_years_experience: Optional[int] = None
    max_years_experience: Optional[int] = None
    location_normalized: Optional[str] = None
    compensation_max: Optional[str] = None
    ai_summary: Optional[str] = None
    stages: list[RoleStageOut] = []
    total_rounds: Optional[int] = 1


class RoleStatusUpdate(BaseModel):
    status: str


class RoleUpdate(BaseModel):
    title: Optional[str] = None
    jd_raw_text: Optional[str] = None
    required_skills_hint: Optional[str] = None
    location: Optional[str] = None
    target_company: Optional[str] = None
    reanalyze_jd: bool = False


# ---------- Candidates ----------


class CandidateCreate(BaseModel):
    full_name: str
    phone_number: str
    email: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    resume_url: Optional[str] = None
    notes: Optional[str] = None
    role_id: Optional[str] = None  # if given, also creates a RoleCandidate pipeline entry


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    phone_number: str
    email: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: str
    resume_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    pipeline_entries: list[CandidatePipelineSummary] = []


# ---------- Search (role-scoped) ----------


class RoleSearchRequest(BaseModel):
    limit: int = 10
    provider: Optional[str] = None


# ---------- Pipeline (RoleCandidate) ----------


class ScreeningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    call_id: str
    interest_level: Optional[str] = None
    notice_period_days: Optional[int] = None
    expected_ctc_min: Optional[int] = None
    expected_ctc_max: Optional[int] = None
    location_confirmed: Optional[str] = None
    open_to_relocation: Optional[bool] = None
    reason_for_switching: Optional[str] = None
    concerns: Optional[list[str]] = None
    competing_offers: Optional[bool] = None
    skill_assessments: Optional[list[dict[str, Any]]] = None
    score_technical: Optional[int] = None
    score_experience: Optional[int] = None
    score_location: Optional[int] = None
    score_compensation: Optional[int] = None
    score_availability: Optional[int] = None
    score_overall: Optional[int] = None
    recommendation: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_concerns: Optional[str] = None
    created_at: datetime


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_candidate_id: str
    role_id: str
    candidate_id: str
    stage_id: Optional[str] = None
    stage: Optional["RoleStageOut"] = None
    attempt_number: int
    hunar_call_id: Optional[str] = None
    agent_id: Optional[str] = None
    request_id: Optional[str] = None
    status: str
    lifecycle_status: Optional[str] = None
    recording_url: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    custom_data: Optional[dict[str, Any]] = None
    duration_seconds: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    transcript: Optional[str] = None
    transcript_turns: Optional[list[dict[str, Any]]] = None
    candidate_name: Optional[str] = None
    candidate_title: Optional[str] = None
    candidate_phone: Optional[str] = None
    role_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    screening: Optional[ScreeningOut] = None
    has_pending_retry: Optional[bool] = False
    retry_attempt: Optional[int] = None
    retry_scheduled_at: Optional[datetime] = None
    total_rounds: Optional[int] = 1


class UpdateCallStatusRequest(BaseModel):
    status: str
    pipeline_status: Optional[str] = None
    cancel_pending_retry: Optional[bool] = True


class PipelineRoleRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    total_rounds: Optional[int] = 1


class CandidatePipelineSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_id: str
    role: Optional[PipelineRoleRef] = None
    current_stage_id: Optional[str] = None
    current_stage: Optional["RoleStageOut"] = None
    total_rounds: Optional[int] = 1
    status: str
    fit_score: Optional[int] = None
    fit_strengths: Optional[list[str]] = None
    fit_gaps: Optional[list[str]] = None
    fit_summary: Optional[str] = None
    source: str
    added_at: datetime
    calls: list[CallOut] = []


# ---------- Stages / Rounds ----------


class RoleStageBase(BaseModel):
    name: str
    round_number: int = 1
    stage_type: str = "AI_VOICE"  # AI_VOICE | HUMAN | SYSTEM
    description: Optional[str] = None


class RoleStageCreate(RoleStageBase):
    pass


class RoleStageUpdate(BaseModel):
    name: Optional[str] = None
    round_number: Optional[int] = None
    stage_type: Optional[str] = None
    description: Optional[str] = None


class RoleStageOut(RoleStageBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_id: str
    created_at: datetime
    hunar_agent_id: Optional[str] = None
    call_script: Optional[CallScriptOut] = None


class RoleCandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_id: str
    candidate_id: str
    current_stage_id: Optional[str] = None
    current_stage: Optional[RoleStageOut] = None
    status: str
    fit_score: Optional[int] = None
    fit_strengths: Optional[list[str]] = None
    fit_gaps: Optional[list[str]] = None
    fit_summary: Optional[str] = None
    source: str
    added_by: str
    added_at: datetime
    candidate: CandidateOut
    calls: list[CallOut] = []


class QueueForCallRequest(BaseModel):
    role_candidate_ids: list[str]


class PipelineStatusUpdate(BaseModel):
    role_candidate_ids: list[str]
    status: str  # PipelineStatus string: SHORTLISTED, ARCHIVED, SOURCED, etc.


# ---------- Call Script ----------


class QuestionSchema(BaseModel):
    text: str
    type: str = "Open-ended"  # Open-ended | Yes-No | Numeric
    follow_up: Optional[str] = None
    required: bool = False
    ai_note: Optional[str] = None
    is_system: bool = False
    key: Optional[str] = None


class ObjectionHandlerSchema(BaseModel):
    trigger: str
    response: str


class CallScriptUpdate(BaseModel):
    ai_name: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    pace: Optional[str] = None
    introduction: Optional[str] = None
    questions: Optional[list[QuestionSchema]] = None
    objection_handlers: Optional[list[ObjectionHandlerSchema]] = None
    closing_interested: Optional[str] = None
    closing_not_interested: Optional[str] = None
    closing_handoff: Optional[str] = None
    additional_instructions: Optional[str] = None


class CallScriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_id: str
    stage_id: Optional[str] = None
    ai_name: str
    tone: str
    language: str
    pace: str
    introduction: Optional[str] = None
    questions: Optional[list[dict[str, Any]]] = None
    objection_handlers: Optional[list[dict[str, Any]]] = None
    closing_interested: Optional[str] = None
    closing_not_interested: Optional[str] = None
    closing_handoff: Optional[str] = None
    additional_instructions: Optional[str] = None
    hunar_agent_id: Optional[str] = None
    updated_at: datetime


class TestCallRequest(BaseModel):
    callee_name: str
    mobile_number: str


# ---------- Global Settings ----------


class GlobalSettingsUpdate(BaseModel):
    ai_name: Optional[str] = None
    company_name: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    calling_hours_start: Optional[str] = None
    calling_hours_end: Optional[str] = None
    retry_enabled: Optional[bool] = None
    retry_delay_minutes: Optional[int] = None
    max_retries: Optional[int] = None


class GlobalSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    ai_name: str
    company_name: str
    tone: str
    language: str
    calling_hours_start: str
    calling_hours_end: str
    retry_enabled: bool
    retry_delay_minutes: int
    max_retries: int


# ---------- Dashboard ----------


class DashboardOut(BaseModel):
    total_roles: int
    active_roles: int
    draft_roles: int = 0
    total_candidates: int
    calls_made: int
    calls_completed: int = 0
    shortlisted: int
    review_needed: int
    unreachable: int
    retry_pending: int
    screened: int = 0
    sourced: int = 0
    archived: int = 0
    advance_count: int = 0
    hold_count: int = 0
    reject_count: int = 0
    avg_score: Optional[int] = None
    sandbox_candidates: int = 0
    apollo_candidates: int = 0
    pdl_candidates: int = 0
    manual_candidates: int = 0
    roles_summary: list[dict[str, Any]] = []
    recent_activity: list[dict[str, Any]] = []


class CandidateMemoryGraphOut(BaseModel):
    candidate_id: str
    candidate_name: str
    role_id: str
    role_title: str
    total_rounds_completed: int
    verified_facts: dict[str, Any] = {}
    skills_matrix: list[dict[str, Any]] = []
    rounds_history: list[dict[str, Any]] = []
    briefing_text: str


class DigitalTwinPersonaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    difficulty: str
    system_prompt: str
    candidate_profile: Optional[dict[str, Any]] = None
    is_builtin: bool
    created_at: datetime
    updated_at: datetime


class CreatePersonaRequest(BaseModel):
    name: str
    description: str
    difficulty: str = "MEDIUM"
    system_prompt: str
    candidate_profile: Optional[dict[str, Any]] = None


class GeneratePersonaRequest(BaseModel):
    idea: str


class SimulateRequest(BaseModel):
    role_id: str
    stage_id: Optional[str] = None
    persona_id: str
    max_turns: Optional[int] = 6


class SimulateResultOut(BaseModel):
    experiment_id: str
    role_id: str
    role_title: str
    stage_id: Optional[str] = None
    stage_name: Optional[str] = None
    persona_id: str
    persona_name: str
    persona_difficulty: str
    turns: list[dict[str, str]]
    score_resilience: int
    score_clarity: int
    score_information_capture: int
    score_overall: int
    strengths: list[str]
    weaknesses: list[str]
    ai_analysis: str
    prompt_recommendation: str
    created_at: datetime


class DigitalTwinExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role_id: str
    role_title: Optional[str] = None
    stage_id: Optional[str] = None
    stage_name: Optional[str] = None
    persona_id: str
    persona_name: Optional[str] = None
    persona_difficulty: Optional[str] = None
    turns: list[dict[str, str]] = []
    score_resilience: Optional[int] = None
    score_clarity: Optional[int] = None
    score_information_capture: Optional[int] = None
    score_overall: Optional[int] = None
    strengths: Optional[list[str]] = None
    weaknesses: Optional[list[str]] = None
    ai_analysis: Optional[str] = None
    prompt_recommendation: Optional[str] = None
    created_at: datetime


class ApplyRecommendationRequest(BaseModel):
    role_id: str
    stage_id: Optional[str] = None
    recommendation: str




RoleOut.model_rebuild()
RoleStageOut.model_rebuild()
RoleCandidateOut.model_rebuild()
CallOut.model_rebuild()
CandidatePipelineSummary.model_rebuild()
CandidateOut.model_rebuild()

