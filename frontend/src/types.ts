export interface Role {
  id: string;
  title: string;
  jd_raw_text: string;
  required_skills_hint?: string;
  location?: string;
  target_company?: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
  created_at: string;
  must_have_skills?: string[];
  preferred_skills?: string[];
  seniority?: string;
  min_years_experience?: number;
  max_years_experience?: number;
  location_normalized?: string;
  compensation_max?: string;
  ai_summary?: string;
  stages?: RoleStage[];
  total_rounds?: number;
}

export interface Candidate {
  id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  linkedin_url?: string;
  source: string;
  resume_url?: string;
  notes?: string;
  created_at: string;
  pipeline_entries?: CandidatePipelineSummary[];
}

export interface PipelineRoleRef {
  id: string;
  title: string;
  total_rounds?: number;
}

export interface CandidatePipelineSummary {
  id: string;
  role_id: string;
  role?: PipelineRoleRef;
  current_stage_id?: string;
  current_stage?: RoleStage;
  total_rounds?: number;
  status: PipelineStatus;
  fit_score?: number;
  fit_strengths?: string[];
  fit_gaps?: string[];
  fit_summary?: string;
  source: string;
  added_at: string;
  calls?: CallRecord[];
}

export interface CandidateMemoryGraph {
  candidate_id: string;
  candidate_name: string;
  role_id: string;
  role_title: string;
  total_rounds_completed: number;
  verified_facts: {
    notice_period_days?: number;
    expected_ctc_min?: number;
    expected_ctc_max?: number;
    open_to_relocation?: boolean;
    location_confirmed?: string;
    reason_for_switching?: string;
    competing_offers?: boolean;
  };
  skills_matrix: Array<{
    skill: string;
    years?: number;
    depth: "surface" | "working" | "deep" | "unknown";
    verified_in_round: number;
  }>;
  rounds_history: Array<{
    call_id: string;
    round_number: number;
    stage_name: string;
    date?: string;
    duration_seconds?: number;
    recommendation: string;
    score_overall?: number;
    summary: string;
    concerns: string[];
    ai_concerns?: string;
  }>;
  briefing_text: string;
}

export interface Screening {
  id: string;
  call_id: string;
  interest_level?: string;
  notice_period_days?: number;
  expected_ctc_min?: number;
  expected_ctc_max?: number;
  location_confirmed?: string;
  open_to_relocation?: boolean;
  reason_for_switching?: string;
  concerns?: string[];
  competing_offers?: boolean;
  skill_assessments?: { skill: string; years?: number; depth?: string }[];
  score_technical?: number;
  score_experience?: number;
  score_location?: number;
  score_compensation?: number;
  score_availability?: number;
  score_overall?: number;
  recommendation?: "ADVANCE" | "HOLD" | "REJECT";
  ai_summary?: string;
  ai_concerns?: string;
  created_at: string;
}

export interface CallTurn {
  speaker: "AI" | "Candidate" | string;
  text: string;
}

export interface RoleStage {
  id: string;
  role_id: string;
  name: string;
  round_number: number;
  stage_type: "AI_VOICE" | "HUMAN" | "SYSTEM" | string;
  description?: string;
  created_at: string;
  hunar_agent_id?: string;
  call_script?: CallScript;
}

export interface RoleStageCreate {
  name: string;
  round_number?: number;
  stage_type?: string;
  description?: string;
}

export interface RoleStageUpdate {
  name?: string;
  round_number?: number;
  stage_type?: string;
  description?: string;
}

export interface CallRecord {
  id: string;
  role_candidate_id: string;
  role_id: string;
  candidate_id: string;
  stage_id?: string;
  stage?: RoleStage;
  total_rounds?: number;
  attempt_number: number;
  hunar_call_id?: string;
  agent_id?: string;
  request_id?: string;
  status: string;
  lifecycle_status?: string;
  recording_url?: string;
  result?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
  duration_seconds?: string;
  started_at?: string;
  ended_at?: string;
  transcript?: string;
  transcript_turns?: CallTurn[];
  candidate_name?: string;
  candidate_title?: string;
  candidate_phone?: string;
  role_title?: string;
  created_at: string;
  updated_at: string;
  screening?: Screening | null;
  has_pending_retry?: boolean;
  retry_attempt?: number;
  retry_scheduled_at?: string;
}

export type PipelineStatus =
  | "SOURCED"
  | "QUEUED"
  | "CALLING"
  | "NO_ANSWER"
  | "RETRY_PENDING"
  | "UNREACHABLE"
  | "SCREENED"
  | "SHORTLISTED"
  | "REJECTED"
  | "REVIEW_NEEDED"
  | "ARCHIVED";

export interface RoleCandidate {
  id: string;
  role_id: string;
  candidate_id: string;
  current_stage_id?: string;
  current_stage?: RoleStage;
  status: PipelineStatus;
  fit_score?: number;
  fit_strengths?: string[];
  fit_gaps?: string[];
  fit_summary?: string;
  source: string;
  added_by: string;
  added_at: string;
  candidate: Candidate;
  calls: CallRecord[];
}

export interface Question {
  text: string;
  type: "Open-ended" | "Yes-No" | "Numeric";
  follow_up?: string;
  required: boolean;
  ai_note?: string;
  is_system: boolean;
  key?: string;
}

export interface ObjectionHandler {
  trigger: string;
  response: string;
}

export interface CallScript {
  id: string;
  role_id: string;
  stage_id?: string;
  ai_name: string;
  tone: "PROFESSIONAL" | "CONVERSATIONAL" | "CASUAL";
  language: string;
  pace: "STANDARD" | "GIVE_SPACE";
  introduction?: string;
  questions?: Question[];
  objection_handlers?: ObjectionHandler[];
  closing_interested?: string;
  closing_not_interested?: string;
  closing_handoff?: string;
  additional_instructions?: string;
  hunar_agent_id?: string;
  updated_at: string;
}


export interface CallScriptPreview {
  agent_prompt: string;
  introduction?: string;
  result_prompt: string;
  result_schema: Record<string, string>;
}

export interface GlobalSettings {
  id: string;
  ai_name: string;
  company_name: string;
  tone: string;
  language: string;
  calling_hours_start: string;
  calling_hours_end: string;
  retry_enabled: boolean;
  retry_delay_minutes: number;
  max_retries: number;
}

export interface DashboardRoleSummary {
  id: string;
  title: string;
  status: string;
  location: string;
  candidate_count: number;
  shortlisted_count: number;
}

export interface DashboardActivity {
  type: string;
  id: string;
  candidate_name: string;
  role_title: string;
  status: string;
  recommendation?: "ADVANCE" | "HOLD" | "REJECT" | null;
  score?: number | null;
  created_at?: string | null;
}

export interface DashboardStats {
  total_roles: number;
  active_roles: number;
  draft_roles: number;
  total_candidates: number;
  calls_made: number;
  calls_completed: number;
  shortlisted: number;
  review_needed: number;
  unreachable: number;
  retry_pending: number;
  screened: number;
  sourced: number;
  archived: number;
  advance_count: number;
  hold_count: number;
  reject_count: number;
  avg_score?: number | null;
  sandbox_candidates: number;
  apollo_candidates: number;
  pdl_candidates: number;
  manual_candidates: number;
  roles_summary: DashboardRoleSummary[];
  recent_activity: DashboardActivity[];
}

export interface DigitalTwinPersona {
  id: string;
  name: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  system_prompt: string;
  candidate_profile?: {
    claimed_title?: string;
    notice_period?: string;
    target_ctc?: string;
    key_traits?: string[];
    objections?: string[];
  };
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface DigitalTwinExperiment {
  id: string;
  role_id: string;
  role_title?: string;
  stage_id?: string | null;
  stage_name?: string | null;
  persona_id: string;
  persona_name?: string;
  persona_difficulty?: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  turns: Array<{ speaker: string; text: string }>;
  score_resilience?: number | null;
  score_clarity?: number | null;
  score_information_capture?: number | null;
  score_overall?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  ai_analysis?: string | null;
  prompt_recommendation?: string | null;
  created_at: string;
}

export interface SimulateResult {
  experiment_id: string;
  role_id: string;
  role_title: string;
  stage_id?: string | null;
  stage_name?: string | null;
  persona_id: string;
  persona_name: string;
  persona_difficulty: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  turns: Array<{ speaker: string; text: string }>;
  score_resilience: number;
  score_clarity: number;
  score_information_capture: number;
  score_overall: number;
  strengths: string[];
  weaknesses: string[];
  ai_analysis: string;
  prompt_recommendation: string;
  created_at: string;
}

export interface CreatePersonaInput {
  name: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  system_prompt: string;
  candidate_profile?: Record<string, any>;
}


