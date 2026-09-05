import type {
  CallRecord,
  CallScript,
  CallScriptPreview,
  Candidate,
  CandidateMemoryGraph,
  DashboardStats,
  GlobalSettings,
  PipelineStatus,
  Role,
  RoleCandidate,
  RoleStage,
  RoleStageCreate,
  RoleStageUpdate,
  DigitalTwinPersona,
  DigitalTwinExperiment,
  SimulateResult,
  CreatePersonaInput,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface RoleCreateInput {
  title: string;
  jd_raw_text: string;
  required_skills_hint?: string;
  location?: string;
  target_company?: string;
}

export interface ManualCandidateInput {
  full_name: string;
  phone_number: string;
  email?: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  linkedin_url?: string;
  resume_url?: string;
  notes?: string;
}

export const api = {
  // Roles
  listRoles: () => request<Role[]>("/api/roles"),
  createRole: (payload: RoleCreateInput) =>
    request<Role>("/api/roles", { method: "POST", body: JSON.stringify(payload) }),
  getRole: (roleId: string) => request<Role>(`/api/roles/${roleId}`),
  updateRoleStatus: (roleId: string, status: string) =>
    request<Role>(`/api/roles/${roleId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateRole: (roleId: string, payload: Partial<RoleCreateInput> & { reanalyze_jd?: boolean }) =>
    request<Role>(`/api/roles/${roleId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRole: (roleId: string) =>
    request<{ ok: boolean; deleted_role_id: string }>(`/api/roles/${roleId}`, { method: "DELETE" }),

  // Role-scoped search + pipeline
  searchRoleCandidates: (roleId: string, limit = 10, provider?: string) =>
    request<RoleCandidate[]>(`/api/roles/${roleId}/search`, {
      method: "POST",
      body: JSON.stringify({ limit, provider }),
    }),
  getPipeline: (roleId: string) => request<RoleCandidate[]>(`/api/roles/${roleId}/pipeline`),
  rankRoleCandidates: (roleId: string) =>
    request<RoleCandidate[]>(`/api/roles/${roleId}/rank`, { method: "POST" }),
  addManualCandidate: (roleId: string, payload: ManualCandidateInput) =>
    request<RoleCandidate>(`/api/roles/${roleId}/candidates`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  queueForCall: (roleId: string, roleCandidateIds: string[]) =>
    request<CallRecord[]>(`/api/roles/${roleId}/pipeline/queue`, {
      method: "POST",
      body: JSON.stringify({ role_candidate_ids: roleCandidateIds }),
    }),
  updatePipelineStatus: (roleId: string, roleCandidateIds: string[], status: PipelineStatus) =>
    request<RoleCandidate[]>(`/api/roles/${roleId}/pipeline/status`, {
      method: "POST",
      body: JSON.stringify({ role_candidate_ids: roleCandidateIds, status }),
    }),
  removeCandidateFromRole: (roleId: string, rcId: string) =>
    request<{ ok: boolean; deleted_role_candidate_id: string }>(`/api/roles/${roleId}/pipeline/${rcId}`, {
      method: "DELETE",
    }),

  // Stages / Rounds
  listRoleStages: (roleId: string) => request<RoleStage[]>(`/api/roles/${roleId}/stages`),
  createRoleStage: (roleId: string, payload: RoleStageCreate) =>
    request<RoleStage>(`/api/roles/${roleId}/stages`, { method: "POST", body: JSON.stringify(payload) }),
  updateRoleStage: (roleId: string, stageId: string, payload: RoleStageUpdate) =>
    request<RoleStage>(`/api/roles/${roleId}/stages/${stageId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRoleStage: (roleId: string, stageId: string) =>
    request<{ ok: boolean; deleted_stage_id: string }>(`/api/roles/${roleId}/stages/${stageId}`, { method: "DELETE" }),
  getStageCallScript: (roleId: string, stageId: string) =>
    request<CallScript>(`/api/roles/${roleId}/stages/${stageId}/call-script`),
  updateStageCallScript: (roleId: string, stageId: string, payload: Partial<CallScript>) =>
    request<CallScript>(`/api/roles/${roleId}/stages/${stageId}/call-script`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  previewStageCallScript: (roleId: string, stageId: string) =>
    request<CallScriptPreview>(`/api/roles/${roleId}/stages/${stageId}/call-script/preview`),
  testStageCallScript: (roleId: string, stageId: string, calleeName: string, mobileNumber: string) =>
    request<CallRecord>(`/api/roles/${roleId}/stages/${stageId}/call-script/test-call`, {
      method: "POST",
      body: JSON.stringify({ callee_name: calleeName, mobile_number: mobileNumber }),
    }),
  advanceCandidate: (roleId: string, rcId: string, targetStageId?: string) =>
    request<RoleCandidate>(
      `/api/roles/${roleId}/stages/candidates/${rcId}/advance${targetStageId ? `?target_stage_id=${targetStageId}` : ""}`,
      { method: "POST" }
    ),


  // Call script
  getCallScript: (roleId: string) => request<CallScript>(`/api/roles/${roleId}/call-script`),
  updateCallScript: (roleId: string, payload: Partial<CallScript>) =>
    request<CallScript>(`/api/roles/${roleId}/call-script`, { method: "PUT", body: JSON.stringify(payload) }),
  previewCallScript: (roleId: string) =>
    request<CallScriptPreview>(`/api/roles/${roleId}/call-script/preview`),
  testCallScript: (roleId: string, calleeName: string, mobileNumber: string) =>
    request<CallRecord>(`/api/roles/${roleId}/call-script/test-call`, {
      method: "POST",
      body: JSON.stringify({ callee_name: calleeName, mobile_number: mobileNumber }),
    }),

  // Calls

  listCalls: (roleId?: string) => request<CallRecord[]>(`/api/calls${roleId ? `?role_id=${roleId}` : ""}`),
  getCall: (callId: string) => request<CallRecord>(`/api/calls/${callId}`),
  syncCall: (callId: string) => request<CallRecord>(`/api/calls/${callId}/sync`, { method: "POST" }),
  transcribeCall: (callId: string) => request<CallRecord>(`/api/calls/${callId}/transcribe`, { method: "POST" }),
  evaluateCall: (callId: string) => request<CallRecord>(`/api/calls/${callId}/evaluate`, { method: "POST" }),
  cancelCallRetry: (callId: string) =>
    request<CallRecord>(`/api/calls/${callId}/cancel-retry`, { method: "POST" }),
  updateCallStatus: (
    callId: string,
    payload: { status: string; pipeline_status?: string; cancel_pending_retry?: boolean }
  ) =>
    request<CallRecord>(`/api/calls/${callId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCall: (callId: string) =>
    request<{ ok: boolean; deleted_call_id: string }>(`/api/calls/${callId}`, { method: "DELETE" }),

  // Candidates (global)
  listCandidates: () => request<Candidate[]>("/api/candidates"),
  getCandidate: (candidateId: string) => request<Candidate>(`/api/candidates/${candidateId}`),
  getCandidateMemoryGraph: (candidateId: string, roleId?: string) =>
    request<CandidateMemoryGraph>(
      `/api/candidates/${candidateId}/memory-graph${roleId ? `?role_id=${roleId}` : ""}`
    ),
  deleteCandidate: (candidateId: string) =>
    request<{ status: string; id: string }>(`/api/candidates/${candidateId}`, { method: "DELETE" }),

  // Dashboard + settings
  getDashboard: () => request<DashboardStats>("/api/dashboard"),
  getSettings: () => request<GlobalSettings>("/api/settings"),
  updateSettings: (payload: Partial<GlobalSettings>) =>
    request<GlobalSettings>("/api/settings", { method: "PUT", body: JSON.stringify(payload) }),

  // Digital Twin Lab
  getPersonas: () => request<DigitalTwinPersona[]>("/api/digital-twin/personas"),
  createPersona: (data: CreatePersonaInput) =>
    request<DigitalTwinPersona>("/api/digital-twin/personas", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generatePersona: (idea: string) =>
    request<Partial<DigitalTwinPersona>>("/api/digital-twin/personas/generate", {
      method: "POST",
      body: JSON.stringify({ idea }),
    }),
  deletePersona: (personaId: string) =>
    request<{ status: string; id: string }>(`/api/digital-twin/personas/${personaId}`, {
      method: "DELETE",
    }),
  runSimulation: (payload: { role_id: string; stage_id?: string; persona_id: string; max_turns?: number }) =>
    request<SimulateResult>("/api/digital-twin/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getExperiments: (roleId?: string) =>
    request<DigitalTwinExperiment[]>(`/api/digital-twin/experiments${roleId ? `?role_id=${roleId}` : ""}`),
  getExperiment: (experimentId: string) =>
    request<DigitalTwinExperiment>(`/api/digital-twin/experiments/${experimentId}`),
  deleteExperiment: (experimentId: string) =>
    request<{ status: string; id: string }>(`/api/digital-twin/experiments/${experimentId}`, {
      method: "DELETE",
    }),
  applyRecommendation: (payload: { role_id: string; stage_id?: string; recommendation: string }) =>
    request<{ status: string; additional_instructions: string }>("/api/digital-twin/apply-recommendation", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
