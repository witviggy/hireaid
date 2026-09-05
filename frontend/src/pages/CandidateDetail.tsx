import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Headphones,
  IndianRupee,
  MapPin,
  Mic,
  RefreshCcw,
  BarChart3,
  Bot,
  FileCheck,
  Trash2,
  TrendingUp,
  User,
  Layers,
  Brain,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api";
import { CallRecord, Candidate, RoleStage, CandidateMemoryGraph } from "../types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatRoundFraction } from "@/lib/utils";
import { formatStatus } from "../lib/format";

type CandidateTabKey = "details" | "calls" | "evals";

function formatDuration(secondsStr?: string | number | null): string {
  if (!secondsStr) return "—";
  const sec = Math.round(Number(secondsStr));
  if (isNaN(sec) || sec <= 0) return "—";
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins === 0) return `${remSec}s`;
  return `${mins}m ${remSec}s`;
}

function cleanStageName(name?: string | null, roundNum?: number): string {
  if (!name) return "";
  if (roundNum != null) {
    const cleaned = name.replace(new RegExp(`^Round\\s*${roundNum}[:\\s-]*`, "i"), "").trim();
    if (cleaned) return cleaned;
  }
  const genericCleaned = name.replace(/^Round\s*\d+[:\s-]*/i, "").trim();
  return genericCleaned || name;
}

function getTurnTimestamp(idx: number, totalTurns: number, durationSec?: number | string | null): string {
  const total = Math.max(30, Math.round(Number(durationSec) || totalTurns * 6));
  const sec = Math.round((idx / Math.max(1, totalTurns - 1)) * total);
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins}:${remSec.toString().padStart(2, "0")}`;
}

function detectTurnFriction(
  turn: { speaker: string; text: string },
  idx: number,
  turns: { speaker: string; text: string }[]
): string | null {
  const isAI = turn.speaker?.toUpperCase() === "AI";
  const lowerText = turn.text.toLowerCase();

  if (isAI) {
    const prevTurns = turns.slice(0, idx);
    const mentionsCTC =
      lowerText.includes("ctc") ||
      lowerText.includes("compensation") ||
      lowerText.includes("lakhs") ||
      lowerText.includes("current package");
    const mentionsNotice = lowerText.includes("notice period") || lowerText.includes("notice");

    if (mentionsCTC) {
      const priorCTCTurns = prevTurns.filter(
        (t) =>
          t.speaker?.toUpperCase() === "AI" &&
          (t.text.toLowerCase().includes("ctc") ||
            t.text.toLowerCase().includes("compensation") ||
            t.text.toLowerCase().includes("lakhs"))
      );
      if (priorCTCTurns.length >= 1) {
        return "Repeated clarifying question (compensation)";
      }
    }
    if (mentionsNotice) {
      const priorNoticeTurns = prevTurns.filter(
        (t) => t.speaker?.toUpperCase() === "AI" && t.text.toLowerCase().includes("notice")
      );
      if (priorNoticeTurns.length >= 1) {
        return "Repeated clarifying question (notice period)";
      }
    }
  } else {
    if (
      lowerText.includes("call you later") ||
      lowerText.includes("call back") ||
      lowerText.includes("busy right now") ||
      lowerText.includes("not a good time") ||
      lowerText.includes("can you email")
    ) {
      return "Candidate deflection / requested callback";
    }
  }
  return null;
}

export default function CandidateDetail() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab navigation state: 'details' | 'calls' | 'evals'
  const urlTab = searchParams.get("tab") as CandidateTabKey | null;
  const [activeTab, setActiveTab] = useState<CandidateTabKey>(
    urlTab && ["details", "calls", "evals"].includes(urlTab) ? urlTab : "details"
  );

  function handleTabChange(tab: CandidateTabKey) {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  const [transcribing, setTranscribing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Actions state
  const [cancellingRetry, setCancellingRetry] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [copiedBriefing, setCopiedBriefing] = useState(false);

  // Stages & Advancement state
  const [roleStages, setRoleStages] = useState<RoleStage[]>([]);
  const [advancingStage, setAdvancingStage] = useState(false);

  // Cross-round memory graph state
  const [memoryGraph, setMemoryGraph] = useState<CandidateMemoryGraph | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);

  function refresh() {
    if (!candidateId) return;
    setLoading(true);
    setError(null);
    api.getCandidate(candidateId)
      .then((c) => {
        setCandidate(c);
      })
      .catch((e: any) => setError(e.message || String(e)))
      .finally(() => setLoading(false));

    api.getCandidateMemoryGraph(candidateId)
      .then(setMemoryGraph)
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, [candidateId]);

  const primaryPipeline = candidate?.pipeline_entries?.[0];

  useEffect(() => {
    if (primaryPipeline?.role_id) {
      api.listRoleStages(primaryPipeline.role_id)
        .then(setRoleStages)
        .catch(() => {});
    }
    if (candidateId) {
      setLoadingMemory(true);
      api.getCandidateMemoryGraph(candidateId, primaryPipeline?.role_id)
        .then(setMemoryGraph)
        .catch(() => {})
        .finally(() => setLoadingMemory(false));
    }
  }, [candidateId, primaryPipeline?.role_id]);

  const allCalls = useMemo(() => {
    if (!candidate?.pipeline_entries) return [];
    const calls: CallRecord[] = [];
    for (const entry of candidate.pipeline_entries) {
      if (entry.calls) {
        for (const call of entry.calls) {
          calls.push({
            ...call,
            role_title: entry.role?.title || "Role",
            candidate_name: candidate.full_name,
            candidate_phone: candidate.phone_number,
          } as CallRecord);
        }
      }
    }
    return calls.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());
  }, [candidate]);

  // Primary call record
  const selectedCall = useMemo(() => {
    if (allCalls.length === 0) return null;
    if (selectedCallId) {
      const found = allCalls.find((cl) => cl.id === selectedCallId);
      if (found) return found;
    }
    if (selectedStageId) {
      const foundByStage = allCalls.find(
        (cl) => cl.stage_id === selectedStageId || cl.stage?.id === selectedStageId
      );
      if (foundByStage) return foundByStage;
    }
    const completed = allCalls.find((cl) => cl.status === "COMPLETED");
    return completed || allCalls[0] || null;
  }, [allCalls, selectedCallId, selectedStageId]);

  const activeSelectedStage = useMemo(() => {
    if (selectedStageId) {
      const st = roleStages.find((s) => s.id === selectedStageId);
      if (st) return st;
    }
    if (selectedCall?.stage) {
      return selectedCall.stage;
    }
    return primaryPipeline?.current_stage || roleStages[0] || null;
  }, [roleStages, selectedStageId, selectedCall, primaryPipeline]);

  function handleCopyBriefing(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2000);
  }

  function handleCopyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  function handleCopyTranscript(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  }

  async function handleTranscribe(callId: string) {
    setTranscribing(true);
    setError(null);
    try {
      await api.transcribeCall(callId);
      refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setTranscribing(false);
    }
  }

  async function handleEvaluate(callId: string) {
    setEvaluating(true);
    setError(null);
    try {
      await api.evaluateCall(callId);
      refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setEvaluating(false);
    }
  }

  async function handleCancelRetry(callId: string) {
    setCancellingRetry(true);
    setError(null);
    try {
      await api.cancelCallRetry(callId);
      refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCancellingRetry(false);
    }
  }

  async function handleCallStatusChange(callId: string, newStatus: string) {
    setUpdatingStatus(true);
    setError(null);
    try {
      await api.updateCallStatus(callId, { status: newStatus, cancel_pending_retry: true });
      refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteCandidate() {
    if (!candidate) return;
    if (!window.confirm(`Are you sure you want to delete candidate ${candidate.full_name}? All associated pipeline entries and call records will be permanently removed.`)) return;
    setDeletingCandidate(true);
    setError(null);
    try {
      await api.deleteCandidate(candidate.id);
      navigate("/candidates");
    } catch (e: any) {
      setError(e.message || String(e));
      setDeletingCandidate(false);
    }
  }

  async function handleAdvanceCandidate(targetStageId?: string) {
    if (!primaryPipeline) return;
    setAdvancingStage(true);
    setError(null);
    try {
      await api.advanceCandidate(primaryPipeline.role_id, primaryPipeline.id, targetStageId);
      refresh();
      const stages = await api.listRoleStages(primaryPipeline.role_id);
      setRoleStages(stages);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setAdvancingStage(false);
    }
  }

  if (loading && !candidate) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">Candidate not found.</p>
        <Button variant="outline" onClick={() => navigate("/candidates")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Candidates
        </Button>
      </div>
    );
  }

  const fitScore = primaryPipeline?.fit_score ?? selectedCall?.screening?.score_overall;
  const pipelineStatus = primaryPipeline?.status || (selectedCall?.screening?.recommendation === "ADVANCE" ? "SHORTLISTED" : "SCREENED");
  const primaryRoleTitle = primaryPipeline?.role?.title || candidate.current_title || "Candidate";

  const tabs: { key: CandidateTabKey; label: string; icon: any; count?: number | string }[] = [
    { key: "details", label: "Details", icon: User },
    { key: "calls", label: "Call Recordings & Transcripts", icon: Headphones, count: allCalls.length > 0 ? allCalls.length : undefined },
    { key: "evals", label: "AI Evals & Rounds", icon: Bot, count: fitScore != null ? `${fitScore}/100` : undefined },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Ultra-Clean Candidate Header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/candidates" className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Candidates
              </Link>
              <span>/</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{candidate.full_name}</span>
            </div>

            <div className="flex items-center gap-3 pt-0.5">
              <Avatar name={candidate.full_name} className="h-10 w-10 text-base font-semibold shadow-sm" />
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
                  {candidate.full_name}
                </h1>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {formatRoundFraction(primaryPipeline?.current_stage?.round_number || 1, primaryPipeline?.total_rounds || primaryPipeline?.role?.total_rounds || 1)}
                  {primaryPipeline?.current_stage?.name && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      ({cleanStageName(primaryPipeline.current_stage.name, primaryPipeline.current_stage.round_number)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteCandidate}
              disabled={deletingCandidate}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {deletingCandidate ? "Deleting..." : "Delete Candidate"}
            </Button>
          </div>
        </div>

        {/* 2. Persistent Segmented Tab Bar (Matching RoleDetail.tsx) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-b border-slate-200 dark:border-[#27272A] pb-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold border border-slate-200 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                    : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent font-medium"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                      isActive
                        ? "bg-slate-200 text-slate-900 dark:bg-zinc-700 dark:text-zinc-100"
                        : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: DETAILS                                                            */}
      {/* ========================================================================= */}
      {activeTab === "details" && (
        <div className="space-y-5">
          {/* Profile & Contact Details Card */}
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile &amp; Contact Information</h2>
              </div>
              <span className="text-xs text-muted-foreground">ID: {candidate.id.slice(0, 8)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4 text-xs">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Applied Role</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {primaryPipeline?.role_id ? (
                    <Link to={`/roles/${primaryPipeline.role_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                      {primaryRoleTitle} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ) : (
                    primaryRoleTitle
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Current Round</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {formatRoundFraction(primaryPipeline?.current_stage?.round_number || 1, primaryPipeline?.total_rounds || primaryPipeline?.role?.total_rounds || 1)}
                  {primaryPipeline?.current_stage?.name && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">({primaryPipeline.current_stage.name})</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Phone Number</div>
                <div className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{candidate.phone_number}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(candidate.phone_number)}
                    className="text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 transition-colors p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Copy phone number"
                  >
                    {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Location</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {candidate.location || "Not specified"}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Pipeline Status</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {pipelineStatus ? formatStatus(pipelineStatus) : "—"}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Match Score</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {fitScore != null ? `${fitScore}/100` : "—"}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Profile Added</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(candidate.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Candidate Source</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {candidate.source || "Manual"}
                </div>
              </div>

              {candidate.email && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Email Address</div>
                  <a
                    href={`mailto:${candidate.email}`}
                    className="mt-1 inline-block font-semibold text-primary hover:underline truncate max-w-full"
                  >
                    {candidate.email}
                  </a>
                </div>
              )}

              {candidate.linkedin_url && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">LinkedIn Profile</div>
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    View profile <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {candidate.current_company && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Current Company</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.current_company}
                  </div>
                </div>
              )}

              {candidate.current_title && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Current Title</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.current_title}
                  </div>
                </div>
              )}
            </div>

            {candidate.notes && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-[#27272A] text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> Recruiter Notes:
                </div>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {candidate.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CALL RECORDINGS & TRANSCRIPTS                                      */}
      {/* ========================================================================= */}
      {activeTab === "calls" && (
        <div className="space-y-5">
          {selectedCall ? (
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] overflow-hidden">
              {/* Card Header & Controls */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-[#111827] dark:text-[#FAFAFA]">
                        Call Recording &amp; Dialogue Transcript
                      </h2>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Round {formatRoundFraction(selectedCall.stage?.round_number || 1, selectedCall.total_rounds || 1)}
                        {selectedCall.stage?.name && (
                          <span className="font-normal text-muted-foreground ml-1">({selectedCall.stage.name})</span>
                        )}
                      </span>
                      {selectedCall.attempt_number > 1 && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Attempt #{selectedCall.attempt_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {selectedCall.created_at
                          ? new Date(selectedCall.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                      <span>·</span>
                      <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{formatDuration(selectedCall.duration_seconds)}</strong></span>
                      {selectedCall.role_title && (
                        <>
                          <span>·</span>
                          <span>Role: <strong className="text-slate-800 dark:text-slate-200">{selectedCall.role_title}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right-Aligned Action Controls: Call Status Selector */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-[#27272A] dark:bg-[#18181B]">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</span>
                      <select
                        value={selectedCall.status}
                        onChange={(e) => handleCallStatusChange(selectedCall.id, e.target.value)}
                        disabled={updatingStatus}
                        className="cursor-pointer bg-transparent border-0 outline-none text-xs font-semibold text-black focus:outline-none focus:ring-0 dark:text-white p-0 pr-1"
                        title="Change call status"
                      >
                        <option value="COMPLETED" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Completed</option>
                        <option value="NOT_CONNECTED" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Not Connected</option>
                        <option value="NO_ANSWER" className="bg-white text-black dark:bg-[#18181B] dark:text-white">No Answer</option>
                        <option value="CALLING" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Calling</option>
                        <option value="QUEUED" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Queued</option>
                        <option value="FAILED" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Failed</option>
                        <option value="CANCELLED" className="bg-white text-black dark:bg-[#18181B] dark:text-white">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Multi-Call / Multi-Round switcher if candidate has multiple calls */}
                {allCalls.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-[#27272A] flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Recorded Calls:</span>
                    {allCalls.map((call, idx) => {
                      const isSelected = call.id === selectedCall.id;
                      const stageLabel = call.stage
                        ? `Round ${formatRoundFraction(call.stage.round_number, call.total_rounds || 1)}: ${call.stage.name}`
                        : `Attempt #${call.attempt_number || idx + 1}`;
                      return (
                        <button
                          key={call.id}
                          type="button"
                          onClick={() => setSelectedCallId(call.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300"
                          )}
                        >
                          <span>{stageLabel}</span>
                          {call.status === "COMPLETED" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reschedule Alert banner if pending retry */}
                {selectedCall.has_pending_retry && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-800/80 dark:bg-amber-950/40">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <div className="font-semibold text-amber-900 dark:text-amber-200">
                          Automatic Retry Rescheduled (Attempt #{selectedCall.retry_attempt || 2})
                        </div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300">
                          {selectedCall.retry_scheduled_at
                            ? `Scheduled for ${new Date(selectedCall.retry_scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Scheduled in queue"}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100 shrink-0"
                      onClick={() => handleCancelRetry(selectedCall.id)}
                      disabled={cancellingRetry}
                    >
                      {cancellingRetry ? "Cancelling..." : "Cancel Reschedule"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 pt-1 space-y-4">
                {/* Audio Recording Player */}
                {selectedCall.recording_url ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 dark:border-[#27272A] dark:bg-[#18181B]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                        <Headphones className="h-4 w-4 text-primary" /> Audio Recording (WAV)
                      </span>
                      <a
                        href={selectedCall.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        Open Audio file <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <audio
                      controls
                      src={selectedCall.recording_url}
                      className="w-full h-10 rounded-md"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-muted-foreground dark:border-[#27272A]">
                    No audio recording available for this call attempt.
                  </div>
                )}

                {/* Transcript Header Toolbar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-[#27272A]">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-primary" /> Verbatim Dialogue Transcript
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedCall.transcript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCopyTranscript(selectedCall.transcript || "")}
                      >
                        {copiedTranscript ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copy text
                          </>
                        )}
                      </Button>
                    )}
                    {selectedCall.recording_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleTranscribe(selectedCall.id)}
                        disabled={transcribing}
                      >
                        {transcribing ? (
                          <>
                            <Spinner className="mr-1 h-3 w-3" /> Transcribing...
                          </>
                        ) : (
                          <>
                            <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Re-transcribe
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dialogue Turns */}
                {selectedCall.transcript_turns && selectedCall.transcript_turns.length > 0 ? (
                  <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                    {selectedCall.transcript_turns.map((turn, idx) => {
                      const isAI = turn.speaker?.toUpperCase() === "AI";
                      const timeStr = getTurnTimestamp(
                        idx,
                        selectedCall.transcript_turns!.length,
                        selectedCall.duration_seconds
                      );
                      const friction = detectTurnFriction(
                        turn,
                        idx,
                        selectedCall.transcript_turns!
                      );

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "rounded-xl p-3.5 text-xs leading-relaxed transition-colors space-y-1.5 shadow-2xs",
                            isAI
                              ? "border border-slate-200 bg-slate-50/80 dark:border-[#27272A] dark:bg-[#18181B]"
                              : "border border-blue-200 bg-blue-50/50 dark:border-blue-950/60 dark:bg-blue-950/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-semibold flex items-center gap-1",
                                  isAI
                                    ? "text-slate-800 dark:text-slate-200"
                                    : "text-blue-900 dark:text-blue-300"
                                )}
                              >
                                {isAI ? (
                                  <>
                                    <Bot className="h-3 w-3 text-primary" /> AI Voice Recruiter
                                  </>
                                ) : (
                                  <>
                                    <User className="h-3 w-3 text-blue-600" /> {candidate.full_name}
                                  </>
                                )}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                {timeStr}
                              </span>
                            </div>
                            {friction && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                                {friction}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                            {turn.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : selectedCall.transcript ? (
                  <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-line dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-200">
                    {selectedCall.transcript}
                  </div>
                ) : (
                  <div className="rounded-[8px] border border-dashed border-slate-200 p-8 text-center space-y-2 dark:border-[#27272A]">
                    <p className="text-xs text-muted-foreground">
                      Transcript not yet generated for this call.
                    </p>
                    {selectedCall.recording_url && (
                      <Button
                        size="sm"
                        onClick={() => handleTranscribe(selectedCall.id)}
                        disabled={transcribing}
                      >
                        {transcribing ? <Spinner className="mr-1.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                        Transcribe Audio with Whisper AI
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-300 p-12 text-center space-y-3 dark:border-[#27272A] w-full bg-white dark:bg-[#121215]">
              <Headphones className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No Screening Calls Recorded Yet
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Screening calls triggered for this candidate will automatically appear here with their audio recording, Whisper AI transcript, and dialogue turns.
                </p>
              </div>
              {candidate.pipeline_entries && candidate.pipeline_entries.length > 0 && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/roles/${candidate.pipeline_entries![0].role_id}?tab=people`)}
                  >
                    Go to Role Pipeline to Trigger Call →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AI EVALS & ROUNDS                                                  */}
      {/* ========================================================================= */}
      {activeTab === "evals" && (
        <div className="space-y-5">
          {/* 1. Rounds & Interview Stages Funnel Card */}
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Interview Rounds &amp; Candidate Stage Progression
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Role: <span className="font-medium text-slate-800 dark:text-slate-200">{primaryRoleTitle}</span> · Current Round: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatRoundFraction(primaryPipeline?.current_stage?.round_number || 1, primaryPipeline?.total_rounds || primaryPipeline?.role?.total_rounds || 1)}</span>
                </p>
              </div>

              {/* 1-Click Advance to Next Round Button */}
              {(() => {
                if (!primaryPipeline || !roleStages.length) return null;
                const currentStage = primaryPipeline.current_stage;
                const currentRoundNum = currentStage?.round_number || 1;
                const sortedStages = [...roleStages].sort((a, b) => a.round_number - b.round_number);
                const nextStage = sortedStages.find((s) => s.round_number > currentRoundNum);

                if (!nextStage) {
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Candidate at Final Round
                    </span>
                  );
                }

                return (
                  <Button
                    size="sm"
                    onClick={() => handleAdvanceCandidate(nextStage.id)}
                    disabled={advancingStage}
                    className="bg-primary hover:bg-primary/90 text-xs font-semibold shadow-sm"
                  >
                    {advancingStage ? (
                      <>
                        <Spinner className="mr-1.5 h-3.5 w-3.5" /> Advancing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                        Advance to Round {nextStage.round_number}: {cleanStageName(nextStage.name, nextStage.round_number)}
                      </>
                    )}
                  </Button>
                );
              })()}
            </div>

            {/* Interactive Stages Pipeline Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
              {roleStages.length > 0 ? (
                [...roleStages]
                  .sort((a, b) => a.round_number - b.round_number)
                  .map((stage) => {
                    const currentRoundNum = primaryPipeline?.current_stage?.round_number || 1;
                    const isCurrent = stage.id === primaryPipeline?.current_stage_id || stage.round_number === currentRoundNum;
                    const isPast = stage.round_number < currentRoundNum;
                    const isFuture = stage.round_number > currentRoundNum;
                    const isSelected = activeSelectedStage?.id === stage.id || selectedCall?.stage_id === stage.id;

                    // Find call for this stage if any
                    const stageCall = allCalls.find((c) => c.stage_id === stage.id || c.stage?.round_number === stage.round_number);

                    return (
                      <div
                        key={stage.id}
                        onClick={() => {
                          setSelectedStageId(stage.id);
                          if (stageCall) {
                            setSelectedCallId(stageCall.id);
                          }
                        }}
                        className={cn(
                          "rounded-lg border p-3.5 transition-all text-xs space-y-2 cursor-pointer hover:border-primary/60",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-2xs dark:border-primary/60 dark:bg-primary/10 ring-2 ring-primary/30"
                            : isPast
                              ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                              : "border-slate-200 bg-slate-50/50 dark:border-[#27272A] dark:bg-[#18181B]/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                              isCurrent
                                ? "bg-primary text-white"
                                : isPast
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                            )}
                          >
                            Round {stage.round_number}
                          </span>

                          {isCurrent && (
                            <span className="flex items-center gap-1 font-semibold text-primary text-[11px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Active Stage
                            </span>
                          )}
                          {isPast && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                              <Check className="h-3 w-3" /> Completed
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-muted-foreground text-[11px]">Upcoming</span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate" title={stage.name}>
                            {cleanStageName(stage.name, stage.round_number)}
                          </div>
                          {stage.description && (
                            <p className="text-muted-foreground text-[11px] line-clamp-2 mt-0.5">
                              {stage.description}
                            </p>
                          )}
                        </div>

                        {stageCall ? (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-[#27272A] flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">
                              {stageCall.status === "COMPLETED" ? "Call completed" : formatStatus(stageCall.status)}
                            </span>
                            {stageCall.screening?.score_overall != null && (
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {stageCall.screening.score_overall}/100
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-[#27272A] text-[11px] text-muted-foreground">
                            No call placed for this round
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-muted-foreground dark:border-[#27272A] dark:bg-[#18181B]">
                  Round 1: Screening (Default)
                </div>
              )}
            </div>
          </div>

          {/* 2. Selected Round Screening Intelligence & AI Evaluation Scorecard */}
          {selectedCall ? (
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-[#111827] dark:text-[#FAFAFA]">
                    Round {selectedCall.stage?.round_number || (activeSelectedStage?.round_number || 1)}: {cleanStageName(selectedCall.stage?.name || activeSelectedStage?.name || "Screening", selectedCall.stage?.round_number || activeSelectedStage?.round_number || 1)} — Evaluation Scorecard
                  </h2>
                </div>

                {selectedCall.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3 font-medium border-slate-200 bg-white hover:bg-slate-50 dark:bg-[#18181B] dark:border-slate-700 shadow-sm"
                    onClick={() => handleEvaluate(selectedCall.id)}
                    disabled={evaluating}
                    title="Re-run AI evaluation on call transcript"
                  >
                    {evaluating ? (
                      <>
                        <Spinner className="mr-1.5 h-3.5 w-3.5" /> Evaluating...
                      </>
                    ) : (
                      <>
                        <Bot className="mr-1.5 h-3.5 w-3.5 text-primary" /> Re-evaluate with AI
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="p-5 space-y-5">
                {selectedCall.screening ? (
                  <div className="space-y-5">
                    {/* Recommendation Hero Banner */}
                    <div
                      className={cn(
                        "rounded-xl border p-5 transition-all shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                        selectedCall.screening.recommendation === "ADVANCE"
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                          : selectedCall.screening.recommendation === "HOLD"
                            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30"
                            : "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/30"
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-4">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Screening Recommendation
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "text-xl font-bold tracking-tight",
                              selectedCall.screening.recommendation === "ADVANCE"
                                ? "text-emerald-950 dark:text-emerald-100"
                                : selectedCall.screening.recommendation === "HOLD"
                                  ? "text-amber-950 dark:text-amber-100"
                                  : "text-rose-950 dark:text-rose-100"
                            )}
                          >
                            {selectedCall.screening.recommendation === "ADVANCE" && "Advance to Next Round"}
                            {selectedCall.screening.recommendation === "HOLD" && "Under Review / Hold"}
                            {selectedCall.screening.recommendation === "REJECT" && "Not a Match / Reject"}
                          </span>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 text-xs font-bold uppercase rounded-md shadow-2xs shrink-0",
                              selectedCall.screening.recommendation === "ADVANCE"
                                ? "bg-emerald-600 text-white"
                                : selectedCall.screening.recommendation === "HOLD"
                                  ? "bg-amber-600 text-white"
                                  : "bg-rose-600 text-white"
                            )}
                          >
                            {selectedCall.screening.recommendation}
                          </span>
                        </div>
                        <p
                          className="text-xs text-slate-600 dark:text-slate-300 pt-0.5 truncate"
                          title={
                            selectedCall.screening.recommendation === "ADVANCE"
                              ? "Candidate verified qualifications, meets compensation & availability targets, and answered screening questions with confidence."
                              : selectedCall.screening.recommendation === "HOLD"
                                ? "Candidate answered questions with minor discrepancies requiring recruiter review."
                                : "Candidate did not satisfy mandatory criteria or expressed compensation/timeline mismatch."
                          }
                        >
                          {selectedCall.screening.recommendation === "ADVANCE"
                            ? "Candidate verified qualifications, meets compensation & availability targets, and answered screening questions with confidence."
                            : selectedCall.screening.recommendation === "HOLD"
                              ? "Candidate answered questions with minor discrepancies requiring recruiter review."
                              : "Candidate did not satisfy mandatory criteria or expressed compensation/timeline mismatch."}
                        </p>
                      </div>

                      {/* Overall Fit Score Dial */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/50">
                        <div className="text-[11px] font-semibold text-muted-foreground">Overall Fit Score</div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={cn(
                              "text-4xl font-extrabold tracking-tight",
                              (selectedCall.screening.score_overall || 0) >= 70
                                ? "text-emerald-700 dark:text-emerald-400"
                                : (selectedCall.screening.score_overall || 0) >= 50
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-rose-700 dark:text-rose-400"
                            )}
                          >
                            {selectedCall.screening.score_overall ?? "—"}
                          </span>
                          <span className="text-sm font-semibold text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                    </div>

                    {/* Cohesive AI Analysis Card */}
                    <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-5">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#27272A]">
                        <TrendingUp className="h-4 w-4 text-primary" /> AI Analysis &amp; Verified Qualifications
                      </div>

                      {/* Unified Candidate Facts & Memory Anchors */}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Candidate Facts &amp; Memory Anchors
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                          {/* Notice Period */}
                          <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-100 dark:border-[#27272A]/80">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                              <Clock className="h-3.5 w-3.5 text-blue-600" /> Notice Period
                            </div>
                            <div className="mt-1 font-bold text-sm text-slate-900 dark:text-slate-100">
                              {selectedCall.screening.notice_period_days != null
                                ? `${selectedCall.screening.notice_period_days} days`
                                : memoryGraph?.verified_facts?.notice_period_days != null
                                  ? `${memoryGraph.verified_facts.notice_period_days} days`
                                  : "Not stated"}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Locked in memory
                            </div>
                          </div>

                          {/* Expected CTC */}
                          <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-100 dark:border-[#27272A]/80">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                              <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> Expected CTC
                            </div>
                            <div className="mt-1 font-bold text-sm text-slate-900 dark:text-slate-100">
                              {selectedCall.screening.expected_ctc_min || selectedCall.screening.expected_ctc_max
                                ? `₹${selectedCall.screening.expected_ctc_min || selectedCall.screening.expected_ctc_max} LPA`
                                : memoryGraph?.verified_facts?.expected_ctc_min || memoryGraph?.verified_facts?.expected_ctc_max
                                  ? `₹${memoryGraph.verified_facts.expected_ctc_min || memoryGraph.verified_facts.expected_ctc_max} LPA`
                                  : "Not stated"}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Agent won't re-ask
                            </div>
                          </div>

                          {/* Relocation Openness */}
                          <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-100 dark:border-[#27272A]/80">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                              <MapPin className="h-3.5 w-3.5 text-amber-600" /> Relocation Openness
                            </div>
                            <div className="mt-1 font-bold text-sm text-slate-900 dark:text-slate-100">
                              {selectedCall.screening.open_to_relocation === true
                                ? "Open to Relocate"
                                : selectedCall.screening.open_to_relocation === false
                                  ? "Not Open"
                                  : memoryGraph?.verified_facts?.open_to_relocation === true
                                    ? "Open to Relocate"
                                    : "Not specified"}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {candidate?.location || memoryGraph?.verified_facts?.location_confirmed || "Location anchored"}
                            </div>
                          </div>

                          {/* Reason for Switch */}
                          <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-100 dark:border-[#27272A]/80">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                              <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> Reason for Switch
                            </div>
                            <div className="mt-1 font-semibold text-sm text-slate-900 dark:text-slate-100 truncate" title={memoryGraph?.verified_facts?.reason_for_switching || "Seeking career growth"}>
                              {memoryGraph?.verified_facts?.reason_for_switching || "Seeking career growth"}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Career motivation
                            </div>
                          </div>

                          {/* Interest Level */}
                          <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-100 dark:border-[#27272A]/80">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                              <Flame className="h-3.5 w-3.5 text-rose-500" /> Interest Level
                            </div>
                            <div className="mt-1 font-bold text-sm text-slate-900 dark:text-slate-100 capitalize">
                              {selectedCall.screening.interest_level || "High"}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Engagement score
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="pt-2 border-t border-slate-100 dark:border-[#27272A]">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                          Score Breakdown
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Technical Fit</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {selectedCall.screening.score_technical != null ? `${selectedCall.screening.score_technical} / 100` : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-800">
                              <div
                                className="h-full bg-slate-700 dark:bg-slate-300 rounded-full transition-all"
                                style={{ width: `${selectedCall.screening.score_technical || 0}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Experience &amp; Seniority</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {selectedCall.screening.score_experience != null ? `${selectedCall.screening.score_experience} / 100` : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-800">
                              <div
                                className="h-full bg-slate-700 dark:bg-slate-300 rounded-full transition-all"
                                style={{ width: `${selectedCall.screening.score_experience || 0}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Location Alignment</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {selectedCall.screening.score_location != null ? `${selectedCall.screening.score_location} / 100` : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-800">
                              <div
                                className="h-full bg-slate-700 dark:bg-slate-300 rounded-full transition-all"
                                style={{ width: `${selectedCall.screening.score_location || 0}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Compensation Fit</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {selectedCall.screening.score_compensation != null ? `${selectedCall.screening.score_compensation} / 100` : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-800">
                              <div
                                className="h-full bg-slate-700 dark:bg-slate-300 rounded-full transition-all"
                                style={{ width: `${selectedCall.screening.score_compensation || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Unified Verified Skills & Competencies */}
                      {(() => {
                        const assessments = selectedCall.screening.skill_assessments || [];
                        const matrixSkills = memoryGraph?.skills_matrix || [];
                        const skillsToDisplay = assessments.length > 0 ? assessments : matrixSkills;

                        if (skillsToDisplay.length === 0) return null;

                        return (
                          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-[#27272A]">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>Verified Skills &amp; Competencies</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-normal">
                                {skillsToDisplay.length} competencies assessed
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {skillsToDisplay.map((sa: any, i: number) => {
                                const matrixMatch = matrixSkills.find(
                                  (ms) => ms.skill?.toLowerCase() === sa.skill?.toLowerCase()
                                );
                                const depth = sa.depth || matrixMatch?.depth;
                                const years = sa.years ?? matrixMatch?.years;
                                const roundNum = sa.verified_in_round || matrixMatch?.verified_in_round || selectedCall.stage?.round_number || 1;

                                return (
                                  <div
                                    key={i}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs dark:border-zinc-800 dark:bg-[#18181B]"
                                  >
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sa.skill}</span>
                                    {years != null && (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                        {years}y
                                      </span>
                                    )}
                                    {depth && depth !== "unknown" && (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary capitalize">
                                        {depth}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      (R{roundNum})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Recruiter Evaluation Summary */}
                      {selectedCall.screening.ai_summary && (
                        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-[#27272A]">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <FileCheck className="h-4 w-4 text-primary shrink-0" />
                            <span>Recruiter Evaluation Summary</span>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-normal">
                            {selectedCall.screening.ai_summary}
                          </p>
                        </div>
                      )}

                      {/* Hiring Considerations */}
                      {selectedCall.screening.ai_concerns ? (
                        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-[#27272A]">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <ClipboardList className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>Hiring Considerations &amp; Follow-up Areas</span>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                            {selectedCall.screening.ai_concerns}
                          </p>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-100 dark:border-[#27272A] flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>No disqualifying concerns or compensation gaps detected during screening.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[8px] border border-dashed border-slate-300 p-8 text-center space-y-3 dark:border-[#27272A]">
                    <FileText className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Screening Scorecard Pending
                      </div>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {selectedCall.transcript
                          ? "The call transcript is recorded and ready. Click below to generate the comprehensive AI screening evaluation."
                          : "Transcribe the audio recording first to generate the candidate screening scorecard."}
                      </p>
                    </div>
                    {selectedCall.transcript ? (
                      <Button
                        size="sm"
                        onClick={() => handleEvaluate(selectedCall.id)}
                        disabled={evaluating}
                      >
                        {evaluating ? <Spinner className="mr-1.5" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}
                        Generate AI Screening Scorecard
                      </Button>
                    ) : selectedCall.recording_url ? (
                      <Button
                        size="sm"
                        onClick={() => handleTranscribe(selectedCall.id)}
                        disabled={transcribing}
                      >
                        {transcribing ? <Spinner className="mr-1.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                        Transcribe Audio with Whisper AI
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-300 p-12 text-center space-y-3 dark:border-[#27272A] w-full bg-white dark:bg-[#121215]">
              <Bot className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No Call Placed for Round {activeSelectedStage?.round_number || 1}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Place an AI interview call for this round to generate the conversation transcript and multi-criteria scorecard.
                </p>
              </div>
            </div>
          )}

          {/* 3. Cross-Round Adaptive Agent Memory & AI Continuity Card */}
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Cross-Round Conversation Memory &amp; AI Continuity
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <Sparkles className="h-3 w-3" /> Adaptive Agent Brain
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Zero-latency memory continuity: Preserved facts and demonstrated competencies from completed rounds are compiled and briefed into subsequent stage AI voice callers.
                </p>
              </div>

              {memoryGraph && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {memoryGraph.total_rounds_completed} {memoryGraph.total_rounds_completed === 1 ? "Round" : "Rounds"} Memorized
                  </span>
                </div>
              )}
            </div>

            {loadingMemory ? (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Spinner className="h-4 w-4" /> Synthesizing candidate conversation memory...
              </div>
            ) : !memoryGraph || memoryGraph.total_rounds_completed === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/30">
                <Brain className="h-5 w-5 mx-auto mb-1.5 text-slate-400 opacity-70" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">No completed rounds recorded yet.</span>
                <p className="mt-0.5 text-[11px]">
                  When this candidate finishes Round 1, verified facts (Notice, CTC, Relocation) and demonstrated competencies will be anchored into this graph and briefed to subsequent stage agents.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Memory Continuity Status Banner */}
                <div className="rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span>Memory Graph Active across {memoryGraph.total_rounds_completed} Completed {memoryGraph.total_rounds_completed === 1 ? "Round" : "Rounds"}</span>
                    </div>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Upcoming stage voice agents automatically receive candidate facts, avoiding re-asking notice period, salary expectations, or already-verified skills.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-purple-800 dark:bg-zinc-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      ✓ Notice Period Locked
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-purple-800 dark:bg-zinc-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      ✓ CTC Band Locked
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-purple-800 dark:bg-zinc-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      ✓ {memoryGraph.skills_matrix?.length || 0} Skills Cataloged
                    </span>
                  </div>
                </div>

                {/* Prior Rounds Chronicle: ONLY rounds prior to the current selected round */}
                {(() => {
                  const currentSelectedRoundNum = selectedCall?.stage?.round_number || (activeSelectedStage?.round_number || 1);
                  const priorRounds = (memoryGraph.rounds_history || []).filter(
                    (rnd) => rnd.round_number < currentSelectedRoundNum
                  );

                  if (priorRounds.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 text-indigo-600" /> Prior Rounds Chronicle
                      </div>
                      <div className="space-y-2">
                        {priorRounds.map((rnd) => (
                          <div
                            key={rnd.round_number}
                            className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-zinc-800/80 dark:bg-[#18181B]/50 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  Round {rnd.round_number}: {cleanStageName(rnd.stage_name, rnd.round_number)}
                                </span>
                                {rnd.recommendation && (
                                  <span
                                    className={cn(
                                      "px-2 py-0.2 text-[10px] font-bold uppercase rounded",
                                      rnd.recommendation === "ADVANCE"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : rnd.recommendation === "HOLD"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    )}
                                  >
                                    {rnd.recommendation}
                                  </span>
                                )}
                              </div>
                              {rnd.summary && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                                  {rnd.summary}
                                </p>
                              )}
                            </div>

                            {rnd.score_overall != null && (
                              <div className="shrink-0 text-right sm:border-l border-slate-200 dark:border-zinc-800 sm:pl-3">
                                <div className="text-[10px] text-muted-foreground">Score</div>
                                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                                  {rnd.score_overall}/100
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Briefing Text Carried to Active / Next Agent */}
                {memoryGraph.briefing_text && (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#27272A]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-primary" /> Live Voice Agent Memory Briefing (Injected via custom_data)
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyBriefing(memoryGraph.briefing_text)}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedBriefing ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy Briefing
                          </>
                        )}
                      </button>
                    </div>
                    <div className="rounded-lg bg-slate-900 text-slate-200 p-3 font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap dark:bg-black border border-slate-800">
                      {memoryGraph.briefing_text}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
