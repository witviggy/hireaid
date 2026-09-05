import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Cpu,
  ExternalLink,
  FlaskConical,
  History,
  Layers,
  MessageSquare,
  Play,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { api } from "../api";
import {
  DigitalTwinExperiment,
  DigitalTwinPersona,
  Role,
  RoleStage,
  SimulateResult,
} from "../types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LabTab = "arena" | "studio" | "history";

export default function DigitalTwinLab() {
  const [activeTab, setActiveTab] = useState<LabTab>("arena");
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [stages, setStages] = useState<RoleStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [maxTurns, setMaxTurns] = useState<number>(8);

  const [personas, setPersonas] = useState<DigitalTwinPersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [loadingPersonas, setLoadingPersonas] = useState(true);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulateResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Apply recommendation state
  const [applyingRec, setApplyingRec] = useState(false);
  const [appliedRecSuccess, setAppliedRecSuccess] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Experiments history state
  const [experiments, setExperiments] = useState<DigitalTwinExperiment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [historyApplyingRecId, setHistoryApplyingRecId] = useState<string | null>(null);
  const [historyAppliedSuccessId, setHistoryAppliedSuccessId] = useState<string | null>(null);
  const [historyCopiedPromptId, setHistoryCopiedPromptId] = useState<string | null>(null);
  const [deletingExpId, setDeletingExpId] = useState<string | null>(null);

  // Studio / Creator state
  const [promptIdea, setPromptIdea] = useState("");
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customDifficulty, setCustomDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "EXTREME">("MEDIUM");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaCreateSuccess, setPersonaCreateSuccess] = useState(false);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(null);

  // Load initial roles and personas
  useEffect(() => {
    api.listRoles()
      .then((rList) => {
        setRoles(rList);
        if (rList.length > 0) {
          setSelectedRoleId(rList[0].id);
        }
      })
      .catch((err) => console.warn("Failed to load roles", err));

    loadPersonas();
  }, []);

  function loadPersonas() {
    setLoadingPersonas(true);
    api.getPersonas()
      .then((pList) => {
        setPersonas(pList);
        if (pList.length > 0 && !selectedPersonaId) {
          setSelectedPersonaId(pList[0].id);
        }
      })
      .catch((err) => console.warn("Failed to load personas", err))
      .finally(() => setLoadingPersonas(false));
  }

  // Load stages when role changes
  useEffect(() => {
    if (!selectedRoleId) {
      setStages([]);
      setSelectedStageId("");
      return;
    }
    api.listRoleStages(selectedRoleId)
      .then((sList) => {
        setStages(sList);
        if (sList.length > 0) {
          setSelectedStageId(sList[0].id);
        } else {
          setSelectedStageId("");
        }
      })
      .catch(() => {
        setStages([]);
        setSelectedStageId("");
      });
  }, [selectedRoleId]);

  // Load experiment history when history tab is activated
  useEffect(() => {
    if (activeTab === "history") {
      setLoadingHistory(true);
      api.getExperiments()
        .then(setExperiments)
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [activeTab]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId]
  );

  const selectedPersona = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId),
    [personas, selectedPersonaId]
  );

  async function handleRunSimulation() {
    if (!selectedRoleId || !selectedPersonaId) return;
    setSimulating(true);
    setSimulationError(null);
    setAppliedRecSuccess(false);
    try {
      const result = await api.runSimulation({
        role_id: selectedRoleId,
        stage_id: selectedStageId || undefined,
        persona_id: selectedPersonaId,
        max_turns: maxTurns,
      });
      setSimulationResult(result);
    } catch (err: any) {
      setSimulationError(err.message || String(err));
    } finally {
      setSimulating(false);
    }
  }

  async function handleApplyRecommendation() {
    if (!simulationResult || !simulationResult.prompt_recommendation) return;
    setApplyingRec(true);
    try {
      await api.applyRecommendation({
        role_id: simulationResult.role_id,
        stage_id: simulationResult.stage_id || undefined,
        recommendation: simulationResult.prompt_recommendation,
      });
      setAppliedRecSuccess(true);
      setTimeout(() => setAppliedRecSuccess(false), 3500);
    } catch (err: any) {
      alert("Failed to apply recommendation: " + (err.message || String(err)));
    } finally {
      setApplyingRec(false);
    }
  }

  function handleCopyRecommendation() {
    if (!simulationResult?.prompt_recommendation) return;
    navigator.clipboard.writeText(simulationResult.prompt_recommendation);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  async function handleToggleExpand(expId: string) {
    if (expandedExpId === expId) {
      setExpandedExpId(null);
      return;
    }
    setExpandedExpId(expId);
    const target = experiments.find((e) => e.id === expId);
    if (target && (!target.turns || target.turns.length === 0)) {
      try {
        const fullExp = await api.getExperiment(expId);
        setExperiments((prev) => prev.map((e) => (e.id === expId ? fullExp : e)));
      } catch (err) {
        console.warn("Failed to fetch full experiment record", err);
      }
    }
  }

  function handleLoadIntoArena(exp: DigitalTwinExperiment) {
    const persona = personas.find((p) => p.id === exp.persona_id);
    const role = roles.find((r) => r.id === exp.role_id);
    const simRes: SimulateResult = {
      experiment_id: exp.id,
      role_id: exp.role_id,
      role_title: exp.role_title || role?.title || "Role Requisition",
      stage_id: exp.stage_id,
      stage_name: exp.stage_name || "Round 1: Screening",
      persona_id: exp.persona_id,
      persona_name: exp.persona_name || persona?.name || "Candidate Persona",
      persona_difficulty: exp.persona_difficulty || persona?.difficulty || "MEDIUM",
      turns: exp.turns || [],
      score_resilience: exp.score_resilience ?? 70,
      score_clarity: exp.score_clarity ?? 75,
      score_information_capture: exp.score_information_capture ?? 70,
      score_overall: exp.score_overall ?? 72,
      strengths: exp.strengths || [],
      weaknesses: exp.weaknesses || [],
      ai_analysis: exp.ai_analysis || "",
      prompt_recommendation: exp.prompt_recommendation || "",
      created_at: exp.created_at,
    };
    setSimulationResult(simRes);
    if (exp.role_id) setSelectedRoleId(exp.role_id);
    if (exp.stage_id) setSelectedStageId(exp.stage_id);
    if (exp.persona_id) setSelectedPersonaId(exp.persona_id);
    setActiveTab("arena");
  }

  async function handleApplyHistoryRecommendation(exp: DigitalTwinExperiment) {
    if (!exp.prompt_recommendation) return;
    setHistoryApplyingRecId(exp.id);
    try {
      await api.applyRecommendation({
        role_id: exp.role_id,
        stage_id: exp.stage_id || undefined,
        recommendation: exp.prompt_recommendation,
      });
      setHistoryAppliedSuccessId(exp.id);
      setTimeout(() => setHistoryAppliedSuccessId(null), 3500);
    } catch (err: any) {
      alert("Failed to apply recommendation: " + (err.message || String(err)));
    } finally {
      setHistoryApplyingRecId(null);
    }
  }

  function handleCopyHistoryRecommendation(expId: string, text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setHistoryCopiedPromptId(expId);
    setTimeout(() => setHistoryCopiedPromptId(null), 2000);
  }

  async function handleDeleteExperiment(expId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this experiment run?")) return;
    setDeletingExpId(expId);
    try {
      await api.deleteExperiment(expId);
      setExperiments((prev) => prev.filter((exp) => exp.id !== expId));
      if (expandedExpId === expId) setExpandedExpId(null);
    } catch (err: any) {
      alert("Failed to delete experiment: " + (err.message || String(err)));
    } finally {
      setDeletingExpId(null);
    }
  }

  async function handleGeneratePersonaIdea() {
    if (!promptIdea.trim()) return;
    setGeneratingPersona(true);
    try {
      const draft = await api.generatePersona(promptIdea.trim());
      if (draft.name) setCustomName(draft.name);
      if (draft.description) setCustomDesc(draft.description);
      if (draft.difficulty) setCustomDifficulty(draft.difficulty as any);
      if (draft.system_prompt) setCustomSystemPrompt(draft.system_prompt);
    } catch (err: any) {
      alert("Failed to generate persona draft: " + (err.message || String(err)));
    } finally {
      setGeneratingPersona(false);
    }
  }

  async function handleSaveCustomPersona(e: React.FormEvent) {
    e.preventDefault();
    if (!customName.trim() || !customSystemPrompt.trim()) return;
    setSavingPersona(true);
    try {
      const created = await api.createPersona({
        name: customName.trim(),
        description: customDesc.trim() || "Custom synthetic persona",
        difficulty: customDifficulty,
        system_prompt: customSystemPrompt.trim(),
      });
      setPersonas((prev) => [created, ...prev]);
      setSelectedPersonaId(created.id);
      setCustomName("");
      setCustomDesc("");
      setCustomSystemPrompt("");
      setPromptIdea("");
      setPersonaCreateSuccess(true);
      setTimeout(() => setPersonaCreateSuccess(false), 3000);
      setActiveTab("arena");
    } catch (err: any) {
      alert("Failed to create persona: " + (err.message || String(err)));
    } finally {
      setSavingPersona(false);
    }
  }

  async function handleDeletePersona(personaId: string) {
    if (!confirm("Are you sure you want to delete this custom persona?")) return;
    setDeletingPersonaId(personaId);
    try {
      await api.deletePersona(personaId);
      setPersonas((prev) => prev.filter((p) => p.id !== personaId));
      if (selectedPersonaId === personaId) {
        setSelectedPersonaId(personas[0]?.id || "");
      }
    } catch (err: any) {
      alert("Failed to delete persona: " + (err.message || String(err)));
    } finally {
      setDeletingPersonaId(null);
    }
  }

  function getDifficultyBadge(diff: string) {
    switch (diff?.toUpperCase()) {
      case "EASY":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200";
      case "MEDIUM":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200";
      case "HARD":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200";
      case "EXTREME":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200";
    }
  }

  const tabs: { key: LabTab; label: string; icon: any; count?: number | string }[] = [
    { key: "arena", label: "Simulation Arena", icon: Play },
    { key: "studio", label: "Persona Studio", icon: Users, count: personas.length },
    { key: "history", label: "Experiment History", icon: History, count: experiments.length > 0 ? experiments.length : undefined },
  ];

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header Hero */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
              Digital Twin Lab
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stress-test voice agent roles against realistic candidate personas, benchmark resilience scores, and generate AI prompt patches.
            </p>
          </div>
        </div>

        {/* 2. Persistent Segmented Tab Bar (Matching CandidateDetail & RoleDetail) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-b border-slate-200 dark:border-[#27272A] pb-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
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

      {/* ========================================================================= */}
      {/* TAB 1: SIMULATION ARENA                                                   */}
      {/* ========================================================================= */}
      {activeTab === "arena" && (
        <div className="space-y-6">
          {/* Controls Bar: Select Role, Stage, Persona */}
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Select Role &amp; Stage to Stress-Test
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Evaluates agent script against synthetic pushback
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Role Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Target Role Requisition
                </Label>
                <Select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="h-9 text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} {r.seniority ? `(${r.seniority})` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Stage Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Interview Round / Stage
                </Label>
                <Select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className="h-9 text-xs"
                >
                  {stages.length > 0 ? (
                    stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        Round {st.round_number}: {st.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Round 1: Screening (Default)</option>
                  )}
                </Select>
              </div>

              {/* Simulation Depth Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Simulation Depth
                </Label>
                <Select
                  value={String(maxTurns)}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  className="h-9 text-xs"
                >
                  <option value="4">4 Rounds (~7 turns · Quick)</option>
                  <option value="6">6 Rounds (~11 turns · Standard)</option>
                  <option value="8">8 Rounds (~15 turns · Deep)</option>
                  <option value="10">10 Rounds (~19 turns · Comprehensive)</option>
                </Select>
              </div>

              {/* Simulation Action Trigger */}
              <div className="flex flex-col justify-end">
                <Button
                  onClick={handleRunSimulation}
                  disabled={simulating || !selectedRoleId || !selectedPersonaId}
                  className="w-full h-9 text-xs font-semibold shadow-xs"
                >
                  {simulating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Running Multi-Turn Twin Simulation...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Run Digital Twin Simulation
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Persona Selector Grid */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#27272A]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Choose Candidate Digital Twin Persona
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("studio")}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Create custom persona
                </button>
              </div>

              {loadingPersonas ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Spinner className="inline-block mr-2 h-4 w-4" /> Loading personas...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {personas.map((p) => {
                    const isSelected = p.id === selectedPersonaId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPersonaId(p.id)}
                        className={cn(
                          "group relative rounded-xl border p-3.5 transition-all cursor-pointer text-xs space-y-2 flex flex-col justify-between",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-2xs ring-2 ring-primary/20 dark:bg-primary/10 dark:border-primary/80"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 dark:border-[#27272A] dark:bg-[#18181B]/40 dark:hover:bg-[#18181B]"
                        )}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 text-[9.5px] font-bold uppercase rounded border",
                                getDifficultyBadge(p.difficulty)
                              )}
                            >
                              {p.difficulty}
                            </span>
                            {isSelected && (
                              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-snug">
                            {p.name}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                            {p.description}
                          </p>
                        </div>

                        {p.candidate_profile?.key_traits && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
                            {p.candidate_profile.key_traits.slice(0, 2).map((tr, i) => (
                              <span
                                key={i}
                                className="text-[9.5px] px-1.5 py-0.2 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-medium"
                              >
                                {tr}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Simulation Error Alert */}
          {simulationError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{simulationError}</span>
            </div>
          )}

          {/* Simulation Results Section */}
          {simulationResult && (
            <div className="space-y-5">
              {/* Overall Benchmark Banner & Readiness Dial */}
              <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300 uppercase">
                      Experiment Complete
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Tested against <strong className="text-slate-900 dark:text-slate-100">{simulationResult.persona_name}</strong>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Agent Persona Stress-Test Result: {simulationResult.role_title} ({simulationResult.stage_name})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {simulationResult.ai_analysis}
                  </p>
                </div>

                {/* Scorecards Dial */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 w-full md:w-auto">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Overall Readiness
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {simulationResult.score_overall}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Resilience
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-primary">
                      {simulationResult.score_resilience}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Clarity &amp; Pace
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {simulationResult.score_clarity}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Info Capture
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {simulationResult.score_information_capture}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Prompt Improvement Recommendation & Strengths/Weaknesses */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left 2 Cols: AI Prompt Patch Recommendation */}
                <div className="lg:col-span-2 rounded-[8px] border border-purple-200 bg-purple-50/40 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-purple-900/50 dark:bg-purple-950/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        AI Recommended Prompt Improvement
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                      1-Click Script Patch
                    </span>
                  </div>

                  <div className="rounded-lg border border-purple-200 bg-white p-4 dark:border-purple-900/60 dark:bg-[#121215] space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Recommendation Rationale:
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {simulationResult.ai_analysis}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                        Suggested System Prompt Extension:
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyRecommendation}
                        className="h-6 px-2 text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" /> Copy Patch
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-3.5 text-[11px] font-mono text-slate-100 dark:bg-[#18181B] dark:text-zinc-200 leading-relaxed border border-slate-800 dark:border-zinc-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {simulationResult.prompt_recommendation}
                    </div>
                  </div>

                  {/* Patch Actions */}
                  <div className="pt-2 border-t border-purple-200 dark:border-purple-900/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleApplyRecommendation}
                        disabled={applyingRec || appliedRecSuccess}
                        className={cn(
                          "text-xs font-semibold shadow-xs",
                          appliedRecSuccess
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-purple-700 hover:bg-purple-800 text-white"
                        )}
                      >
                        {applyingRec ? (
                          <>
                            <Spinner className="mr-1.5 h-3.5 w-3.5" /> Applying Patch...
                          </>
                        ) : appliedRecSuccess ? (
                          <>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Prompt Updated Successfully!
                          </>
                        ) : (
                          <>
                            <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" /> Apply Prompt Update to Role
                          </>
                        )}
                      </Button>
                      {appliedRecSuccess && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Saved to live agent script!
                        </span>
                      )}
                    </div>

                    {simulationResult.role_id && (
                      <Link
                        to={`/roles/${simulationResult.role_id}?tab=stages`}
                        className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1 transition-colors"
                      >
                        Edit Script in Role Stages <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Right 1 Col: Strengths & Weaknesses */}
                <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Demonstrated Strengths
                    </div>
                    <div className="space-y-1.5">
                      {simulationResult.strengths.map((str, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{str}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#27272A]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Vulnerabilities Detected
                    </div>
                    <div className="space-y-1.5">
                      {simulationResult.weaknesses.map((wk, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <span>{wk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Turn Simulated Dialogue Transcript */}
              <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#27272A]">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Simulated Multi-Turn Dialogue Transcript
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {simulationResult.turns.length} turns recorded
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2">
                  {simulationResult.turns
                    .filter((turn) => turn.text && turn.text.trim())
                    .map((turn, idx) => {
                      const isAgent = turn.speaker === "AGENT";
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex gap-3 text-xs",
                          isAgent ? "flex-row" : "flex-row-reverse"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold shadow-2xs",
                            isAgent ? "bg-slate-900 dark:bg-zinc-800" : "bg-purple-600"
                          )}
                        >
                          {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 max-w-[80%] leading-relaxed shadow-2xs space-y-1",
                            isAgent
                              ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tl-xs"
                              : "bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-100 rounded-tr-xs border border-purple-100 dark:border-purple-900/40"
                          )}
                        >
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase">
                            <span>{isAgent ? "AI Recruiter Agent" : simulationResult.persona_name}</span>
                            <span>·</span>
                            <span>Turn {idx + 1}</span>
                          </div>
                          <div className="text-xs whitespace-pre-wrap">{turn.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONA STUDIO                                                     */}
      {/* ========================================================================= */}
      {activeTab === "studio" && (
        <div className="space-y-6">
          {/* Create Persona Card with AI Prompt Generator */}
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-5">
            <div className="border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Create New Candidate Persona with Prompt
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type any candidate behavior or objection idea. The AI will instantly generate the full system prompt, profile, and difficulty rating.
              </p>
            </div>

            {/* AI Generator Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Persona Concept / Prompt
              </Label>
              <div className="flex gap-2.5">
                <Input
                  type="text"
                  value={promptIdea}
                  onChange={(e) => setPromptIdea(e.target.value)}
                  placeholder="e.g. A senior candidate with an NDA who refuses to name past clients and gets suspicious if pressed"
                  className="flex-1 h-9 text-xs"
                />
                <Button
                  onClick={handleGeneratePersonaIdea}
                  disabled={generatingPersona || !promptIdea.trim()}
                  className="h-9 text-xs font-medium shrink-0"
                >
                  {generatingPersona ? (
                    <>
                      <Spinner className="mr-1.5 h-3.5 w-3.5" /> Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Generate with AI
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Full Form Preview / Edit */}
            <form onSubmit={handleSaveCustomPersona} className="space-y-4 pt-2 border-t border-slate-100 dark:border-[#27272A]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">
                    Persona Name
                  </Label>
                  <Input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. The NDA-Bound Senior Dev"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Difficulty Level
                  </Label>
                  <Select
                    value={customDifficulty}
                    onChange={(e) => setCustomDifficulty(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                    <option value="EXTREME">EXTREME</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Short Description
                </Label>
                <Input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Summary of what this persona tests..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Candidate Persona System Prompt
                </Label>
                <Textarea
                  rows={5}
                  required
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  placeholder="Detailed LLM instructions for simulating this candidate's speech, objections, and quirks..."
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {personaCreateSuccess && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Persona saved to library!
                  </span>
                )}
                <div className="ml-auto">
                  <Button
                    type="submit"
                    disabled={savingPersona || !customName.trim() || !customSystemPrompt.trim()}
                    className="h-9 text-xs font-medium shadow-xs"
                  >
                    {savingPersona ? (
                      <>
                        <Spinner className="mr-1.5 h-3.5 w-3.5" /> Saving Persona...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Save Persona to Library
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* All Personas Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                All Available Personas ({personas.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                5 Built-in + {personas.filter((p) => !p.is_builtin).length} Custom
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((p) => (
                <div
                  key={p.id}
                  className="rounded-[8px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase rounded border",
                          getDifficultyBadge(p.difficulty)
                        )}
                      >
                        {p.difficulty}
                      </span>
                      {p.is_builtin ? (
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">
                          Standard Built-in
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePersona(p.id)}
                          disabled={deletingPersonaId === p.id}
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          title="Delete custom persona"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {p.name}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {p.description}
                    </p>

                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] font-mono text-slate-700 dark:bg-[#18181B] dark:text-zinc-300 max-h-24 overflow-y-auto border border-slate-100 dark:border-zinc-800 whitespace-pre-wrap">
                      {p.system_prompt}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#27272A] flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Added {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPersonaId(p.id);
                        setActiveTab("arena");
                      }}
                      className="text-xs h-7"
                    >
                      <Play className="mr-1 h-3 w-3" /> Test in Arena
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPERIMENT HISTORY                                                 */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Recent Digital Twin Stress-Test Runs
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadingHistory(true);
                  api.getExperiments()
                    .then(setExperiments)
                    .finally(() => setLoadingHistory(false));
                }}
                disabled={loadingHistory}
                className="h-8 text-xs"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5 mr-1.5", loadingHistory && "animate-spin")} /> Refresh
              </Button>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Spinner className="inline-block mr-2 h-4 w-4" /> Loading history...
              </div>
            ) : experiments.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">No experiments executed yet.</span>
                <p className="mt-1">Head to the Simulation Arena to run your first digital twin benchmark!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {experiments.map((exp) => {
                  const p = personas.find((pe) => pe.id === exp.persona_id);
                  const r = roles.find((ro) => ro.id === exp.role_id);
                  const isExpanded = expandedExpId === exp.id;
                  const roleTitle = exp.role_title || r?.title || "Role Requisition";
                  const personaName = exp.persona_name || p?.name || "Synthetic Persona";
                  const difficulty = exp.persona_difficulty || p?.difficulty || "MEDIUM";
                  const stageName = exp.stage_name || "Round 1: Screening";
                  const turns = exp.turns || [];

                  return (
                    <div
                      key={exp.id}
                      className={cn(
                        "rounded-xl border transition-all overflow-hidden",
                        isExpanded
                          ? "border-primary/50 bg-white shadow-md ring-1 ring-primary/20 dark:border-primary/60 dark:bg-[#121215]"
                          : "border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 dark:border-zinc-800 dark:bg-[#18181B]/50 dark:hover:bg-[#18181B]"
                      )}
                    >
                      {/* Clickable Card Header */}
                      <div
                        onClick={() => handleToggleExpand(exp.id)}
                        className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {roleTitle}
                            </span>
                            <span className="text-xs text-muted-foreground">vs</span>
                            <span className="font-semibold text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                              {personaName}
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.2 text-[9.5px] font-bold uppercase rounded border",
                                getDifficultyBadge(difficulty)
                              )}
                            >
                              {difficulty}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-slate-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                              {stageName}
                            </span>
                          </div>

                          {!isExpanded && exp.ai_analysis && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                              {exp.ai_analysis}
                            </p>
                          )}

                          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span>Executed {new Date(exp.created_at).toLocaleString()}</span>
                            <span>·</span>
                            <span className="text-primary font-medium hover:underline">
                              {isExpanded ? "Click to collapse" : "Click to view full result & transcript"}
                            </span>
                          </div>
                        </div>

                        {/* Scores & Toggle Action */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Readiness</div>
                            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                              {exp.score_overall ?? "—"}
                              <span className="text-xs font-normal text-muted-foreground">/100</span>
                            </div>
                          </div>
                          <div className="text-right pl-3 border-l border-slate-200 dark:border-zinc-800">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resilience</div>
                            <div className="text-lg font-extrabold text-primary">
                              {exp.score_resilience ?? "—"}
                              <span className="text-xs font-normal text-muted-foreground">/100</span>
                            </div>
                          </div>
                          <div className="p-1 rounded-full bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Full Experiment Result */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-zinc-800 p-5 space-y-5 bg-white dark:bg-[#121215]">
                          {/* Top Action Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300 uppercase">
                                Archived Benchmark Result
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Recorded {new Date(exp.created_at).toLocaleDateString()} at {new Date(exp.created_at).toLocaleTimeString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadIntoArena(exp);
                                }}
                                className="h-8 text-xs font-medium text-slate-700 dark:text-slate-200"
                                title="Load this experiment into the Simulation Arena"
                              >
                                <Play className="mr-1.5 h-3.5 w-3.5 fill-current text-primary" /> Load into Arena
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleDeleteExperiment(exp.id, e)}
                                disabled={deletingExpId === exp.id}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                title="Delete this experiment run"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* 4 Scorecard Dials */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Overall Readiness
                              </div>
                              <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                                {exp.score_overall ?? "—"}
                                <span className="text-xs font-normal text-muted-foreground">/100</span>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Resilience
                              </div>
                              <div className="mt-1 text-2xl font-extrabold text-primary">
                                {exp.score_resilience ?? "—"}
                                <span className="text-xs font-normal text-muted-foreground">/100</span>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Clarity &amp; Pace
                              </div>
                              <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                                {exp.score_clarity ?? "—"}
                                <span className="text-xs font-normal text-muted-foreground">/100</span>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#18181B] border border-slate-200 dark:border-zinc-800 text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Info Capture
                              </div>
                              <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                                {exp.score_information_capture ?? "—"}
                                <span className="text-xs font-normal text-muted-foreground">/100</span>
                              </div>
                            </div>
                          </div>

                          {/* AI Prompt Patch & Strengths/Weaknesses Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* Left 2 Cols: AI Prompt Recommendation */}
                            <div className="lg:col-span-2 rounded-[8px] border border-purple-200 bg-purple-50/40 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-purple-900/50 dark:bg-purple-950/20 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    AI Recommended Prompt Improvement
                                  </h3>
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                                  1-Click Script Patch
                                </span>
                              </div>

                              {exp.ai_analysis && (
                                <div className="rounded-lg border border-purple-200 bg-white p-4 dark:border-purple-900/60 dark:bg-[#121215] space-y-1">
                                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    AI Performance Evaluation:
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {exp.ai_analysis}
                                  </p>
                                </div>
                              )}

                              {exp.prompt_recommendation ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                                      Suggested System Prompt Extension:
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopyHistoryRecommendation(exp.id, exp.prompt_recommendation)}
                                      className="h-6 px-2 text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                    >
                                      {historyCopiedPromptId === exp.id ? (
                                        <>
                                          <Check className="mr-1 h-3 w-3 text-emerald-600" /> Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="mr-1 h-3 w-3" /> Copy Patch
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  <div className="rounded-lg bg-slate-900 p-3.5 text-[11px] font-mono text-slate-100 dark:bg-[#18181B] dark:text-zinc-200 leading-relaxed border border-slate-800 dark:border-zinc-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {exp.prompt_recommendation}
                                  </div>

                                  {/* 1-Click Patch Apply Button */}
                                  <div className="pt-2 border-t border-purple-200 dark:border-purple-900/50 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleApplyHistoryRecommendation(exp)}
                                        disabled={historyApplyingRecId === exp.id || historyAppliedSuccessId === exp.id}
                                        className={cn(
                                          "text-xs font-semibold shadow-xs",
                                          historyAppliedSuccessId === exp.id
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            : "bg-purple-700 hover:bg-purple-800 text-white"
                                        )}
                                      >
                                        {historyApplyingRecId === exp.id ? (
                                          <>
                                            <Spinner className="mr-1.5 h-3.5 w-3.5" /> Applying Patch...
                                          </>
                                        ) : historyAppliedSuccessId === exp.id ? (
                                          <>
                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Prompt Updated Successfully!
                                          </>
                                        ) : (
                                          <>
                                            <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" /> Apply Prompt Update to Role
                                          </>
                                        )}
                                      </Button>
                                      {historyAppliedSuccessId === exp.id && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                          Saved to live agent script!
                                        </span>
                                      )}
                                    </div>

                                    {exp.role_id && (
                                      <Link
                                        to={`/roles/${exp.role_id}?tab=stages`}
                                        className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1 transition-colors"
                                      >
                                        Edit Script in Role Stages <ExternalLink className="h-3 w-3" />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Right 1 Col: Strengths & Weaknesses */}
                            <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Demonstrated Strengths
                                </div>
                                <div className="space-y-1.5">
                                  {(exp.strengths || []).map((str, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                                      <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                      <span>{str}</span>
                                    </div>
                                  ))}
                                  {(!exp.strengths || exp.strengths.length === 0) && (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-100 dark:border-[#27272A]">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Vulnerabilities Detected
                                </div>
                                <div className="space-y-1.5">
                                  {(exp.weaknesses || []).map((wk, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                      <span>{wk}</span>
                                    </div>
                                  ))}
                                  {(!exp.weaknesses || exp.weaknesses.length === 0) && (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Dialogue Transcript */}
                          <div className="rounded-[8px] border border-[#E5E7EB] bg-slate-50/50 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215] space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#27272A]">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  Simulated Multi-Turn Dialogue Transcript
                                </h3>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {turns.length} turns recorded
                              </span>
                            </div>

                            {turns.length === 0 ? (
                              <div className="py-6 text-center text-xs text-muted-foreground">
                                No dialogue transcript recorded for this experiment run.
                              </div>
                            ) : (
                              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2">
                                {turns
                                  .filter((turn) => turn.text && turn.text.trim())
                                  .map((turn, idx) => {
                                    const isAgent = turn.speaker === "AGENT";
                                  return (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "flex gap-3 text-xs",
                                        isAgent ? "flex-row" : "flex-row-reverse"
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold shadow-2xs",
                                          isAgent ? "bg-slate-900 dark:bg-zinc-800" : "bg-purple-600"
                                        )}
                                      >
                                        {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                      </div>

                                      <div
                                        className={cn(
                                          "rounded-2xl px-4 py-2.5 max-w-[80%] leading-relaxed shadow-2xs space-y-1",
                                          isAgent
                                            ? "bg-white text-slate-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tl-xs border border-slate-200/70 dark:border-zinc-700"
                                            : "bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-100 rounded-tr-xs border border-purple-100 dark:border-purple-900/40"
                                        )}
                                      >
                                        <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase">
                                          <span>{isAgent ? "AI Recruiter Agent" : personaName}</span>
                                          <span>·</span>
                                          <span>Turn {idx + 1}</span>
                                        </div>
                                        <div className="text-xs whitespace-pre-wrap">{turn.text}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
