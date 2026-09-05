import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Headphones,
  Layers,
  ListChecks,
  MessageSquareText,
  Phone,
  PhoneCall,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search as SearchIcon,
  Star,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { api } from "../api";
import { CallScript, ObjectionHandler, PipelineStatus, Question, Role, RoleCandidate, RoleStage } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatRoundFraction } from "@/lib/utils";
import { formatStatus, formatEmpty } from "../lib/format";

type TabKey = "role" | "people" | "script" | "testing";

function formatDuration(secondsStr?: string | number | null): string {
  if (!secondsStr) return "";
  const sec = Math.round(Number(secondsStr));
  if (isNaN(sec) || sec <= 0) return "";
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins === 0) return `${remSec}s`;
  return `${mins}m ${remSec}s`;
}

const PIPELINE_VARIANT: Record<string, string> = {
  SOURCED: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  QUEUED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  CALLING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  NO_ANSWER: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  RETRY_PENDING: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  UNREACHABLE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  SCREENED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  SHORTLISTED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  REVIEW_NEEDED: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  ARCHIVED: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const TONE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Professional — formal, direct" },
  { value: "CONVERSATIONAL", label: "Conversational — warm, efficient" },
  { value: "CASUAL", label: "Casual — relaxed, friendly" },
];

export default function RoleDetail() {
  const { roleId = "" } = useParams();
  const [role, setRole] = useState<Role | null>(null);
  const [pipeline, setPipeline] = useState<RoleCandidate[]>([]);
  const [stages, setStages] = useState<RoleStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("role");

  function refreshAll() {
    api.getRole(roleId).then(setRole).catch((e) => setError(e.message || String(e)));
    api.getPipeline(roleId).then(setPipeline).catch((e) => setError(e.message || String(e)));
    api.listRoleStages(roleId).then(setStages).catch(() => {});
  }

  useEffect(refreshAll, [roleId]);

  if (!role) {
    return error ? <ErrorBanner message={error} /> : <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  const shortlistedCount = pipeline.filter((rc) => rc.status === "SHORTLISTED").length;

  return (
    <div className="space-y-4">
      <RoleTopNav
        role={role}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onChangeRole={setRole}
        setError={setError}
        candidateCount={pipeline.length}
        shortlistedCount={shortlistedCount}
      />

      {error && <ErrorBanner message={error} />}

      {activeTab === "role" && (
        <RoleAndSearchTab
          role={role}
          onRoleUpdate={(updated) => {
            setRole(updated);
            refreshAll();
          }}
          setError={setError}
        />
      )}

      {activeTab === "people" && (
        <PipelineSection
          roleId={roleId}
          pipeline={pipeline}
          stages={stages}
          onDone={refreshAll}
          onGoToSearch={() => setActiveTab("role")}
          setError={setError}
        />
      )}

      {activeTab === "script" && (
        <CallScriptSection
          roleId={roleId}
          role={role}
          stages={stages}
          onRefreshStages={refreshAll}
          setError={setError}
          onGoToTesting={() => setActiveTab("testing")}
        />
      )}

      {activeTab === "testing" && (
        <TestingTab roleId={roleId} stages={stages} setError={setError} />
      )}
    </div>
  );
}


function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function RoleTopNav({
  role,
  activeTab,
  onTabChange,
  onChangeRole,
  setError,
  candidateCount,
  shortlistedCount,
}: {
  role: Role;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onChangeRole: (r: Role) => void;
  setError: (e: string | null) => void;
  candidateCount: number;
  shortlistedCount: number;
}) {
  const navigate = useNavigate();
  const [deletingRole, setDeletingRole] = useState(false);

  async function handleStatusChange(status: string) {
    try {
      const updated = await api.updateRoleStatus(role.id, status);
      onChangeRole(updated);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleDeleteRole() {
    if (!window.confirm(`Are you sure you want to delete role "${role.title}"? All associated pipeline candidates, call scripts, and call records will be permanently removed.`)) return;
    setDeletingRole(true);
    setError(null);
    try {
      await api.deleteRole(role.id);
      navigate("/roles");
    } catch (e: any) {
      setError(e.message || String(e));
      setDeletingRole(false);
    }
  }

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "role", label: "Role Details", icon: Briefcase },
    { key: "people", label: "People & Pipeline", icon: Users, count: candidateCount },
    { key: "script", label: "Rounds & Voice Scripts", icon: Layers },
    { key: "testing", label: "Live Testing", icon: Play },
  ];

  return (
    <div className="space-y-3 border-b border-slate-200 dark:border-[#27272A] pb-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/roles" className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Roles
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{role.title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">{role.title}</h1>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">ID: {role.id.slice(0, 8)}</span>
            {shortlistedCount > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Star className="h-3 w-3 fill-emerald-600" /> {shortlistedCount} shortlisted
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <Select
              value={role.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-32 h-8 text-xs font-medium"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={handleDeleteRole}
            disabled={deletingRole}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {deletingRole ? "Deleting..." : "Delete Role"}
          </Button>
        </div>
      </div>

      {/* 4 Tab Buttons — Lightweight Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs transition-all cursor-pointer",
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold border border-slate-200 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                  : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent font-medium"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                    isActive ? "bg-slate-200 text-slate-900 dark:bg-zinc-700 dark:text-zinc-100" : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
  );
}

/* =========================================================================
   TAB 1: ROLE DETAILS & SEARCH
   ========================================================================= */

function RoleAndSearchTab({
  role,
  onRoleUpdate,
  setError,
}: {
  role: Role;
  onRoleUpdate: (r: Role) => void;
  setError: (e: string | null) => void;
}) {
  const [form, setForm] = useState({
    title: role.title || "",
    location: role.location || "",
    target_company: role.target_company || "",
    required_skills_hint: role.required_skills_hint || "",
    jd_raw_text: role.jd_raw_text || "",
  });
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setForm({
      title: role.title || "",
      location: role.location || "",
      target_company: role.target_company || "",
      required_skills_hint: role.required_skills_hint || "",
      jd_raw_text: role.jd_raw_text || "",
    });
  }, [role]);

  async function handleSaveRole(reanalyze: boolean = false) {
    setError(null);
    if (reanalyze) setReanalyzing(true);
    else setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.updateRole(role.id, {
        ...form,
        reanalyze_jd: reanalyze,
      });
      onRoleUpdate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
      setReanalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Role Details & JD Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Role Details &amp; Job Description
          </CardTitle>
          <CardDescription>
            Edit job details. Click &ldquo;Save &amp; Re-analyze JD with AI&rdquo; to refresh criteria extracted by Groq LLM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={form.location}
                placeholder="e.g. Bangalore, Remote, San Francisco"
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target company (optional)</Label>
              <Input
                value={form.target_company}
                placeholder="e.g. Swiggy, Stripe, Google"
                onChange={(e) => setForm({ ...form, target_company: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Key skills hint (comma-separated)</Label>
              <Input
                value={form.required_skills_hint}
                placeholder="e.g. Python, FastAPI, PostgreSQL"
                onChange={(e) => setForm({ ...form, required_skills_hint: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Raw Job Description</Label>
            <Textarea
              rows={9}
              value={form.jd_raw_text}
              onChange={(e) => setForm({ ...form, jd_raw_text: e.target.value })}
              placeholder="Paste the full job description here..."
              className="font-sans text-xs leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={() => handleSaveRole(false)}
              disabled={saving || reanalyzing}
            >
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} Save details
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveRole(true)}
              disabled={saving || reanalyzing}
              className="border-primary/40 text-primary hover:bg-primary/5"
            >
              {reanalyzing ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Save &amp; Re-analyze JD with AI
            </Button>
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Changes saved successfully!
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. AI-Extracted Criteria — Placed Directly Below Role Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" /> AI-Extracted Criteria
          </CardTitle>
          <CardDescription>
            Automatic single source of truth for People Search, Fit Scoring, and Voice Screening.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {role.ai_summary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300">
              {role.ai_summary}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 pt-1">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-800 dark:text-slate-200">Must-have Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {(role.must_have_skills || []).length > 0 ? (
                    role.must_have_skills!.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None extracted</span>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-slate-800 dark:text-slate-200">Preferred Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {(role.preferred_skills || []).length > 0 ? (
                    role.preferred_skills!.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-400"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None extracted</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 h-fit text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#27272A] dark:bg-[#18181B]">
                <div className="text-[11px] font-medium text-muted-foreground">Seniority</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 text-sm">{role.seniority || "Not specified"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#27272A] dark:bg-[#18181B]">
                <div className="text-[11px] font-medium text-muted-foreground">Min Experience</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {role.min_years_experience != null ? `${role.min_years_experience}+ years` : "Flexible"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FindCandidates({
  roleId,
  onDone,
  onGoToPeople,
  setError,
}: {
  roleId: string;
  onDone: () => void;
  onGoToPeople?: () => void;
  setError: (e: string | null) => void;
}) {
  const [limit, setLimit] = useState(10);
  const [provider, setProvider] = useState("sandbox");
  const [loading, setLoading] = useState(false);
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    full_name: "",
    phone_number: "",
    current_title: "",
    current_company: "",
    location: "",
  });
  const [addingManual, setAddingManual] = useState(false);

  async function handleSearch() {
    setError(null);
    setLoading(true);
    setSearchCount(null);
    try {
      const candidates = await api.searchRoleCandidates(roleId, limit, provider);
      setSearchCount(candidates.length);
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddManual(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAddingManual(true);
    try {
      await api.addManualCandidate(roleId, manualForm);
      setManualForm({ full_name: "", phone_number: "", current_title: "", current_company: "", location: "" });
      setShowManual(false);
      onDone();
      if (onGoToPeople) onGoToPeople();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setAddingManual(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SearchIcon className="h-4 w-4 text-primary" /> Find Candidates (People Search)
        </CardTitle>
        <CardDescription>Auto-applies this role&apos;s criteria. Found profiles are ranked and ingested into the pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1 sm:max-w-xs">
            <Label className="text-xs font-medium text-muted-foreground">Provider</Label>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 text-xs">
              <option value="sandbox">Custom Sandbox (Free Demo)</option>
              <option value="apollo">Apollo.io</option>
              <option value="pdl">People Data Labs (PDL)</option>
            </Select>
          </div>
          <div className="space-y-1.5 w-28">
            <Label className="text-xs font-medium text-muted-foreground">Max results</Label>
            <Input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-9 text-xs" />
          </div>
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Button onClick={handleSearch} disabled={loading} className="h-9 text-xs">
              {loading ? <Spinner className="mr-1.5" /> : <SearchIcon className="mr-1.5 h-3.5 w-3.5" />} Search &amp; rank
            </Button>
            <Button variant="outline" onClick={() => setShowManual((v) => !v)} className="h-9 text-xs">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> {showManual ? "Hide manual form" : "Add manually"}
            </Button>
          </div>
        </div>

        {searchCount !== null && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-900">
            <span className="font-semibold">
              ✓ Sourced &amp; AI-ranked {searchCount} candidate{searchCount !== 1 ? "s" : ""}! Results updated in pipeline below.
            </span>
          </div>
        )}

        {showManual && (
          <form className="space-y-4 rounded-lg border border-border bg-slate-50/50 dark:bg-zinc-900/40 p-4" onSubmit={handleAddManual}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full name *</Label>
                <Input required value={manualForm.full_name} onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })} placeholder="e.g. Alex Morgan" className="h-8 text-xs bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone (E.164) *</Label>
                <Input required value={manualForm.phone_number} onChange={(e) => setManualForm({ ...manualForm, phone_number: e.target.value })} placeholder="e.g. +14155552671" className="h-8 text-xs bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Current title</Label>
                <Input value={manualForm.current_title} onChange={(e) => setManualForm({ ...manualForm, current_title: e.target.value })} placeholder="e.g. Marketing Specialist" className="h-8 text-xs bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Current company</Label>
                <Input value={manualForm.current_company} onChange={(e) => setManualForm({ ...manualForm, current_company: e.target.value })} placeholder="e.g. Acme Corp" className="h-8 text-xs bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Location</Label>
                <Input value={manualForm.location} onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })} placeholder="e.g. San Francisco, CA" className="h-8 text-xs bg-white dark:bg-zinc-900" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowManual(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={addingManual} className="h-8 text-xs">
                {addingManual ? <Spinner className="mr-1.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />} Add to pipeline
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   TAB 2: PEOPLE & PIPELINE
   ========================================================================= */

function MatchScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground dark:text-slate-400">—</span>;
  const tone =
    score >= 70
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-700/40"
      : score >= 40
        ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-700/40"
        : "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-700/40";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", tone)}>
      {score}/100
    </span>
  );
}

function PipelineSection({
  roleId,
  pipeline,
  stages = [],
  onDone,
  onGoToSearch,
  setError,
}: {
  roleId: string;
  pipeline: RoleCandidate[];
  stages?: RoleStage[];
  onDone: () => void;
  onGoToSearch?: () => void;
  setError: (e: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<"active" | "shortlisted" | "archived">("active");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState(false);
  const [advancingRcId, setAdvancingRcId] = useState<string | null>(null);
  const [ranking, setRanking] = useState(false);

  async function handleRankCandidates() {
    setError(null);
    setRanking(true);
    try {
      await api.rankRoleCandidates(roleId);
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRanking(false);
    }
  }

  const displayedPipeline = pipeline.filter((rc) => {
    if (activeTab === "archived" && rc.status !== "ARCHIVED") return false;
    if (activeTab === "shortlisted" && rc.status !== "SHORTLISTED") return false;
    if (activeTab === "active" && rc.status === "ARCHIVED") return false;
    if (selectedStageFilter !== "ALL" && rc.current_stage_id !== selectedStageFilter) return false;
    return true;
  });

  const activeCount = pipeline.filter((rc) => rc.status !== "ARCHIVED").length;
  const shortlistedCount = pipeline.filter((rc) => rc.status === "SHORTLISTED").length;
  const archivedCount = pipeline.filter((rc) => rc.status === "ARCHIVED").length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const [removingRcId, setRemovingRcId] = useState<string | null>(null);

  async function handleAdvance(rcId: string, candidateName: string, nextRoundName: string) {
    setError(null);
    setAdvancingRcId(rcId);
    try {
      await api.advanceCandidate(roleId, rcId);
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setAdvancingRcId(null);
    }
  }

  async function handleRemoveFromPipeline(rcId: string, candidateName: string) {
    if (!window.confirm(`Are you sure you want to remove ${candidateName} from this role pipeline?`)) return;
    setRemovingRcId(rcId);
    setError(null);
    try {
      await api.removeCandidateFromRole(roleId, rcId);
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRemovingRcId(null);
    }
  }

  async function handleQueue(ids: string[]) {
    setError(null);
    setActionInProgress(true);
    try {
      await api.queueForCall(roleId, ids);
      setSelected(new Set());
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleUpdateStatus(ids: string[], status: PipelineStatus) {

    setError(null);
    setActionInProgress(true);
    try {
      await api.updatePipelineStatus(roleId, ids, status);
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleShortlistAndArchiveRest(shortlistIds: string[]) {
    setError(null);
    setActionInProgress(true);
    try {
      await api.updatePipelineStatus(roleId, shortlistIds, "SHORTLISTED");
      const remainingSourcedIds = pipeline
        .filter((rc) => rc.status === "SOURCED" && !shortlistIds.includes(rc.id))
        .map((rc) => rc.id);
      if (remainingSourcedIds.length > 0) {
        await api.updatePipelineStatus(roleId, remainingSourcedIds, "ARCHIVED");
      }
      setSelected(new Set());
      onDone();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setActionInProgress(false);
    }
  }

  const selectableIds = displayedPipeline.map((rc) => rc.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  return (
    <div className="space-y-6">
      {/* 1. Find Candidates Panel (Moved to People & Pipeline) */}
      <FindCandidates
        roleId={roleId}
        onDone={onDone}
        setError={setError}
      />

      {/* 2. Candidate Pipeline Table */}
      <div className="overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215]">
        {/* Table Top Toolbar */}
        <div className="border-b border-slate-100 p-4 dark:border-[#27272A]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">
                <ListChecks className="h-4 w-4 text-primary" /> Candidate Pipeline
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {displayedPipeline.length}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => { setActiveTab("active"); setSelected(new Set()); }}
                className={cn(
                  "rounded px-3 py-1.5 font-medium transition-colors",
                  activeTab === "active" ? "bg-white text-slate-900 shadow-sm dark:bg-[#18181B] dark:text-[#FAFAFA]" : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("shortlisted"); setSelected(new Set()); }}
                className={cn(
                  "rounded px-3 py-1.5 font-medium transition-colors",
                  activeTab === "shortlisted" ? "bg-white text-slate-900 shadow-sm dark:bg-[#18181B] dark:text-[#FAFAFA]" : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Shortlisted ({shortlistedCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("archived"); setSelected(new Set()); }}
                className={cn(
                  "rounded px-3 py-1.5 font-medium transition-colors",
                  activeTab === "archived" ? "bg-white text-slate-900 shadow-sm dark:bg-[#18181B] dark:text-[#FAFAFA]" : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Archived ({archivedCount})
              </button>
            </div>
          </div>

          {/* Round Filter Funnel Bar */}
          {stages.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-[#27272A]">
              <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1 dark:text-slate-400">
                <Layers className="h-3 w-3" /> Round:
              </span>
              <button
                type="button"
                onClick={() => { setSelectedStageFilter("ALL"); setSelected(new Set()); }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                  selectedStageFilter === "ALL"
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                )}
              >
                All Rounds ({pipeline.length})
              </button>
              {stages.map((st) => {
                const count = pipeline.filter((rc) => rc.current_stage_id === st.id).length;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => { setSelectedStageFilter(st.id); setSelected(new Set()); }}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                      selectedStageFilter === st.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                    )}
                  >
                    {st.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {selected.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {selected.size} candidate{selected.size > 1 ? "s" : ""} selected:
              </span>
              {activeTab !== "archived" ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleUpdateStatus([...selected], "SHORTLISTED")}
                    disabled={actionInProgress}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                  >
                    <Star className="mr-1 h-3.5 w-3.5 fill-current" /> Shortlist selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShortlistAndArchiveRest([...selected])}
                    disabled={actionInProgress}
                    className="h-7 text-xs"
                    title="Shortlist selected candidates and archive all other unselected sourced candidates"
                  >
                    Shortlist &amp; archive rest
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQueue([...selected])}
                    disabled={actionInProgress}
                    className="h-7 text-xs"
                  >
                    <PhoneCall className="mr-1 h-3.5 w-3.5" /> Queue for call
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdateStatus([...selected], "ARCHIVED")}
                    disabled={actionInProgress}
                    className="h-7 text-xs text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Archive selected
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus([...selected], "SOURCED")}
                  disabled={actionInProgress}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore to pipeline
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[12px] font-medium text-[#6B7280] dark:border-[#27272A] dark:text-[#9CA3AF]">
                <th className="w-10 pl-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(selectableIds) : new Set())}
                    className="rounded border-slate-300 dark:border-zinc-700"
                  />
                </th>
                <th className="px-4 py-3 font-medium align-middle">Candidate</th>
                <th className="px-4 py-3 font-medium align-middle">Current Role</th>
                <th className="px-4 py-3 font-medium text-center align-middle whitespace-nowrap">Round</th>
                <th className="px-4 py-3 font-medium align-middle whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium text-center align-middle whitespace-nowrap">Fit Score</th>
                <th className="px-4 py-3 font-medium align-middle whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 font-medium align-middle whitespace-nowrap">Call Status</th>
                <th className="px-4 py-3 font-medium align-middle whitespace-nowrap">AI Screening</th>
                <th className="px-4 py-3 font-medium text-right align-middle whitespace-nowrap pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedPipeline.map((rc) => {
                const latestCall = rc.calls?.[0];
                const screening = latestCall?.screening;
                const hasEvidence = (rc.fit_strengths?.length || 0) > 0 || (rc.fit_gaps?.length || 0) > 0;
                const hasPhone = Boolean(rc.candidate.phone_number);

                const currentStageIndex = stages.findIndex((s) => s.id === rc.current_stage_id);
                const nextStage =
                  currentStageIndex >= 0 && currentStageIndex + 1 < stages.length
                    ? stages[currentStageIndex + 1]
                    : null;
                const canAdvance =
                  nextStage !== null &&
                  (rc.status === "SHORTLISTED" ||
                    screening?.recommendation === "ADVANCE" ||
                    latestCall?.status === "COMPLETED");

                const currentRound = rc.current_stage?.round_number || (currentStageIndex >= 0 ? currentStageIndex + 1 : 1);
                const totalRounds = stages.length > 0 ? stages.length : 1;
                const fraction = formatRoundFraction(currentRound, totalRounds);
                const stageTitle = rc.current_stage?.name
                  ? `Round ${currentRound}: ${rc.current_stage.name} (out of ${totalRounds} rounds)`
                  : `Round ${currentRound} of ${totalRounds}`;

                return (
                  <tr
                    key={rc.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-[#27272A] dark:hover:bg-[#18181B] transition-colors"
                  >
                    {/* 1. Checkbox */}
                    <td className="w-10 pl-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(rc.id)}
                        onChange={() => toggle(rc.id)}
                        className="rounded border-slate-300 dark:border-zinc-700"
                      />
                    </td>

                    {/* 2. Candidate Info (Avatar + Name + Location) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={rc.candidate.full_name} />
                        <div className="min-w-0">
                          <Link
                            to={`/candidates/${rc.candidate_id}`}
                            className="font-medium text-slate-900 hover:text-primary hover:underline block truncate dark:text-[#FAFAFA]"
                          >
                            {rc.candidate.full_name}
                          </Link>
                          <div className="text-xs text-muted-foreground dark:text-slate-400 truncate">
                            {rc.candidate.location || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 3. Current Role (Title + Company) */}
                    <td className="px-4 py-3 align-middle text-muted-foreground dark:text-slate-400">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {rc.candidate.current_title || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground dark:text-slate-400 truncate">
                        {rc.candidate.current_company || "—"}
                      </div>
                    </td>

                    {/* 4. Round (Clean Centered Fraction matching Candidates & Calls) */}
                    <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                      <span
                        className="font-medium text-slate-800 dark:text-slate-200"
                        title={stageTitle}
                      >
                        {fraction}
                      </span>
                    </td>

                    {/* 5. Pipeline Stage — Interactive Dropdown */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <div className="relative inline-block">
                        <select
                          value={rc.status}
                          disabled={actionInProgress}
                          onChange={(e) => handleUpdateStatus([rc.id], e.target.value as PipelineStatus)}
                          className={cn(
                            "h-7 cursor-pointer appearance-none rounded-full border pl-2.5 pr-6 text-[11px] font-semibold tracking-tight transition-colors focus:outline-none focus:ring-1 focus:ring-primary dark:bg-[#18181B]",
                            PIPELINE_VARIANT[rc.status] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          )}
                          title="Change candidate pipeline status"
                        >
                          <option value="SOURCED">Sourced</option>
                          <option value="SCREENED">Screened</option>
                          <option value="SHORTLISTED">Shortlisted</option>
                          <option value="REVIEW_NEEDED">Review Needed</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60" />
                      </div>
                    </td>

                    {/* 6. Fit Score */}
                    <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                      <div className="inline-flex flex-col items-center">
                        <MatchScoreBadge score={rc.fit_score} />
                        {hasEvidence && (
                          <details className="relative mt-0.5">
                            <summary className="cursor-pointer list-none text-[10px] font-medium text-primary hover:underline focus:outline-none select-none">
                              Why?
                            </summary>
                            <div className="absolute left-1/2 -translate-x-1/2 z-50 mt-1 w-56 space-y-1 rounded-md border border-slate-200 bg-white dark:border-[#27272A] dark:bg-[#18181B] p-2.5 shadow-lg text-left text-[11px] whitespace-normal break-words">
                              {(rc.fit_strengths || []).map((s, i) => (
                                <div key={`s-${i}`} className="text-emerald-700 dark:text-emerald-400">✓ {s}</div>
                              ))}
                              {(rc.fit_gaps || []).map((s, i) => (
                                <div key={`g-${i}`} className="text-amber-700 dark:text-amber-400">⚠ {s}</div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </td>

                    {/* 7. Phone */}
                    <td className="px-4 py-3 align-middle font-mono text-xs text-muted-foreground dark:text-slate-400 whitespace-nowrap">
                      {hasPhone ? (
                        <span>{rc.candidate.phone_number}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-sans">
                          <AlertCircle className="h-3 w-3 shrink-0" /> No phone
                        </span>
                      )}
                    </td>

                    {/* 8. Call Status */}
                    <td className="px-4 py-3 align-middle text-xs text-muted-foreground dark:text-slate-400 whitespace-nowrap">
                      {latestCall ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              latestCall.status === "COMPLETED"
                                ? "bg-emerald-500"
                                : latestCall.status === "NO_ANSWER" || latestCall.status === "CALLING"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            )}
                          />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatStatus(latestCall.status)}
                          </span>
                          {formatDuration(latestCall.duration_seconds) ? (
                            <span className="text-[11px] text-muted-foreground dark:text-slate-400">
                              ({formatDuration(latestCall.duration_seconds)})
                            </span>
                          ) : null}
                          {latestCall.status === "COMPLETED" && (
                            <Link
                              to={`/candidates/${rc.candidate_id}`}
                              className="inline-flex items-center text-primary hover:text-primary/80 ml-0.5"
                              title="Listen to audio & view transcript"
                            >
                              <Headphones className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* 9. AI Screening */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      {screening ? (
                        <details className="group relative inline-block text-left">
                          <summary className="cursor-pointer list-none text-xs font-medium focus:outline-none select-none">
                            <Badge
                              variant={
                                screening.recommendation === "ADVANCE"
                                  ? "success"
                                  : screening.recommendation === "REJECT"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="cursor-pointer hover:opacity-90 transition-opacity"
                              title={screening.ai_summary || undefined}
                            >
                              {screening.recommendation}
                            </Badge>
                          </summary>
                          {screening.ai_summary && (
                            <div className="absolute right-0 z-50 mt-1.5 w-80 max-w-sm rounded-lg border border-slate-200 bg-white dark:border-[#27272A] dark:bg-[#18181B] p-3 shadow-xl text-xs space-y-1 text-slate-700 dark:text-slate-300 whitespace-normal break-words">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                AI Screening Summary
                              </div>
                              <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400 whitespace-normal break-words">
                                {screening.ai_summary}
                              </p>
                            </div>
                          )}
                        </details>
                      ) : (
                        <span className="text-muted-foreground/60 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* 10. Actions (Clean and focused) */}
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {rc.status === "ARCHIVED" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus([rc.id], "SOURCED")}
                              disabled={actionInProgress}
                              className="h-7 text-xs"
                              title="Restore candidate to active pipeline"
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveFromPipeline(rc.id, rc.candidate.full_name)}
                              disabled={actionInProgress || removingRcId === rc.id}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Permanently remove candidate from this role"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {canAdvance && nextStage && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAdvance(rc.id, rc.candidate.full_name, nextStage.name)}
                                disabled={actionInProgress || advancingRcId === rc.id}
                                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs"
                                title={`Advance ${rc.candidate.full_name} to Round ${nextStage.round_number}: ${nextStage.name}`}
                              >
                                {advancingRcId === rc.id ? (
                                  <Spinner className="mr-1 h-3 w-3" />
                                ) : (
                                  <ArrowRight className="mr-1 h-3.5 w-3.5" />
                                )}
                                <span>Advance (R{nextStage.round_number})</span>
                              </Button>
                            )}
                            {(rc.status === "SOURCED" || rc.status === "SHORTLISTED") && (
                              <Button
                                size="sm"
                                variant={rc.status === "SHORTLISTED" && !screening ? "default" : "outline"}
                                onClick={() => handleQueue([rc.id])}
                                disabled={actionInProgress || !hasPhone}
                                className={cn(
                                  "h-7 text-xs",
                                  rc.status === "SHORTLISTED" && !screening ? "bg-primary hover:bg-primary/90 text-white" : ""
                                )}
                                title={
                                  latestCall?.status === "COMPLETED"
                                    ? "Re-dial candidate with Hunar AI"
                                    : hasPhone
                                    ? "Trigger Hunar voice call"
                                    : "Cannot call without a phone number"
                                }
                              >
                                <PhoneCall className="mr-1 h-3.5 w-3.5" />
                                <span>{latestCall?.status === "COMPLETED" ? "Re-call" : "Call"}</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveFromPipeline(rc.id, rc.candidate.full_name)}
                              disabled={actionInProgress || removingRcId === rc.id}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Remove candidate from this role"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedPipeline.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground dark:text-slate-400">
                    <div className="mx-auto max-w-sm space-y-3">
                      <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <div>
                        {activeTab === "archived"
                          ? "No archived candidates."
                          : activeTab === "shortlisted"
                            ? "No shortlisted candidates yet. Select candidates from the Active tab and click 'Shortlist'."
                            : "No candidates in this pipeline yet."}
                      </div>
                      {activeTab === "active" && onGoToSearch && (
                        <Button size="sm" variant="outline" onClick={onGoToSearch}>
                          <SearchIcon className="mr-1.5 h-3.5 w-3.5" /> Go to Role Details &amp; Search
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  </div>
);
}


/* =========================================================================
   TAB 3: ROUNDS & VOICE AGENTS (MULTI-STAGE CALL SCRIPTS)
   ========================================================================= */

function CallScriptSection({
  roleId,
  role,
  stages = [],
  onRefreshStages,
  setError,
  onGoToTesting,
}: {
  roleId: string;
  role: Role;
  stages?: RoleStage[];
  onRefreshStages: () => void;
  setError: (e: string | null) => void;
  onGoToTesting?: () => void;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id || "");
  const [script, setScript] = useState<CallScript | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingStage, setDeletingStage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];
  const [stageName, setStageName] = useState(activeStage?.name || "");
  const [stageDescription, setStageDescription] = useState(activeStage?.description || "");
  const [stageType, setStageType] = useState(activeStage?.stage_type || "AI_VOICE");

  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageDesc, setNewStageDesc] = useState("");
  const [addingStage, setAddingStage] = useState(false);

  useEffect(() => {
    if (stages.length > 0 && (!selectedStageId || !stages.some((s) => s.id === selectedStageId))) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  useEffect(() => {
    if (activeStage) {
      setStageName(activeStage.name);
      setStageDescription(activeStage.description || "");
      setStageType(activeStage.stage_type || "AI_VOICE");
      setLoadingScript(true);
      setError(null);
      api
        .getStageCallScript(roleId, activeStage.id)
        .then((sc) => setScript(sc))
        .catch((e) => setError(e.message || String(e)))
        .finally(() => setLoadingScript(false));
    }
  }, [selectedStageId, activeStage?.id]);

  if (stages.length === 0) {
    return <div className="flex h-32 items-center justify-center"><Spinner /></div>;
  }

  function update<K extends keyof CallScript>(key: K, value: CallScript[K]) {
    setScript((s) => (s ? { ...s, [key]: value } : s));
  }

  function updateQuestion(index: number, patch: Partial<Question>) {
    const next = [...(script!.questions || [])];
    next[index] = { ...next[index], ...patch };
    update("questions", next);
  }

  function addQuestion() {
    update("questions", [
      ...(script!.questions || []),
      { text: "", type: "Open-ended", required: false, is_system: false } as Question,
    ]);
  }

  function removeQuestion(index: number) {
    update(
      "questions",
      (script!.questions || []).filter((_, i) => i !== index)
    );
  }

  function updateHandler(index: number, patch: Partial<ObjectionHandler>) {
    const next = [...(script!.objection_handlers || [])];
    next[index] = { ...next[index], ...patch };
    update("objection_handlers", next);
  }

  function addHandler() {
    update("objection_handlers", [...(script!.objection_handlers || []), { trigger: "", response: "" }]);
  }

  function removeHandler(index: number) {
    update(
      "objection_handlers",
      (script!.objection_handlers || []).filter((_, i) => i !== index)
    );
  }

  async function handleAddStage(e: FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setError(null);
    setAddingStage(true);
    try {
      const created = await api.createRoleStage(roleId, {
        name: newStageName.trim(),
        description: newStageDesc.trim() || undefined,
        stage_type: "AI_VOICE",
      });
      setShowAddStage(false);
      setNewStageName("");
      setNewStageDesc("");
      onRefreshStages();
      setSelectedStageId(created.id);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setAddingStage(false);
    }
  }

  async function handleDeleteStage() {
    if (stages.length <= 1) {
      alert("A role must have at least one round.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${activeStage.name}"? Any candidates in this round will be moved back to Round 1.`)) {
      return;
    }
    setError(null);
    setDeletingStage(true);
    try {
      await api.deleteRoleStage(roleId, activeStage.id);
      onRefreshStages();
      const remaining = stages.filter((s) => s.id !== activeStage.id);
      if (remaining.length > 0) {
        setSelectedStageId(remaining[0].id);
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setDeletingStage(false);
    }
  }

  async function handleSave() {
    if (!activeStage || !script) return;
    setError(null);
    setSaving(true);
    try {
      if (
        stageName !== activeStage.name ||
        stageDescription !== (activeStage.description || "") ||
        stageType !== activeStage.stage_type
      ) {
        await api.updateRoleStage(roleId, activeStage.id, {
          name: stageName,
          description: stageDescription,
          stage_type: stageType,
        });
      }
      const updated = await api.updateStageCallScript(roleId, activeStage.id, script);
      setScript(updated);
      onRefreshStages();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setError(null);
    try {
      const p = await api.previewStageCallScript(roleId, activeStage.id);
      setPreview(p.agent_prompt);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Round Switcher Pills & Creator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-zinc-900 border border-border p-3 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Layers className="h-3.5 w-3.5 text-indigo-600" /> Rounds:
          </span>
          {stages.map((st) => {
            const isSelected = (activeStage?.id || "") === st.id;
            const hasAgent = Boolean(st.call_script?.hunar_agent_id || (isSelected && script?.hunar_agent_id));
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStageId(st.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap border",
                  isSelected
                    ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold shadow-2xs dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-200"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-slate-300"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    hasAgent ? "bg-emerald-500" : "bg-amber-400"
                  )}
                  title={hasAgent ? "Hunar AI Agent connected" : "Agent not synced yet"}
                />
                <span>{st.name}</span>
                <span className="text-[10px] opacity-70">
                  {st.stage_type === "AI_VOICE" ? "AI Voice" : st.stage_type}
                </span>
              </button>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddStage((v) => !v)}
            className="h-7 text-xs border-dashed text-primary hover:bg-primary/5 shrink-0"
          >
            <Plus className="mr-1 h-3 w-3" /> Add Round
          </Button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {script?.hunar_agent_id ? (
            <Badge variant="success" className="gap-1.5 py-1 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Agent Connected ({script.hunar_agent_id.slice(0, 8)})
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 py-1 text-[11px] text-amber-700 bg-amber-50">
              Not Synced — Save to Activate
            </Badge>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1.5 text-xs">
            {saving ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
            Save &amp; Sync Round
          </Button>
        </div>
      </div>

      {/* Inline Add Round Modal / Card */}
      {showAddStage && (
        <form
          onSubmit={handleAddStage}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create New Interview Round / Stage
            </span>
            <button
              type="button"
              onClick={() => setShowAddStage(false)}
              className="text-xs text-muted-foreground hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Round Name *</Label>
              <Input
                required
                placeholder={`e.g. Round ${stages.length + 1}: Technical Voice Screen`}
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-zinc-900"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Round Focus / Goal</Label>
              <Input
                placeholder="e.g. Probe distributed caching, API concurrency, and system design"
                value={newStageDesc}
                onChange={(e) => setNewStageDesc(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-zinc-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAddStage(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addingStage || !newStageName.trim()}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addingStage ? <Spinner className="mr-1" /> : <Plus className="mr-1 h-3 w-3" />} Create Round
            </Button>
          </div>
        </form>
      )}

      {/* 2. Round Details & Voice Script Editor */}
      {loadingScript || !script ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-white p-6 dark:bg-zinc-900">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquareText className="h-4 w-4 text-primary" /> {stageName || "Interview Round"} — Voice Agent Configuration
                  </CardTitle>
                  <CardDescription>
                    Customizes the conversational persona, questions, and evaluation criteria compiled into this round&apos;s Hunar AI agent.
                  </CardDescription>
                </div>
                {stages.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteStage}
                    disabled={deletingStage}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10 self-start sm:self-auto"
                    title="Delete this round"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Round
                  </Button>
                )}
              </div>

              {/* Round Metadata Inputs */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-lg bg-slate-50/70 dark:bg-zinc-900/60 p-3 border border-border/80">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Round Title</Label>
                  <Input
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder="e.g. Round 1: Screening"
                    className="h-8 text-xs bg-white dark:bg-zinc-900"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Round Focus &amp; Context</Label>
                  <Input
                    value={stageDescription}
                    onChange={(e) => setStageDescription(e.target.value)}
                    placeholder="e.g. Initial recruiter screening assessing communication, CTC, and notice period"
                    className="h-8 text-xs bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Agent Persona Bar */}
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>AI Recruiter Name</Label>
                <Input value={script.ai_name} onChange={(e) => update("ai_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tone</Label>
                <Select value={script.tone} onChange={(e) => update("tone", e.target.value as CallScript["tone"])}>
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={script.language} onChange={(e) => update("language", e.target.value)}>
                  {["ENGLISH", "HINDI", "TAMIL", "TELUGU", "KANNADA", "MALAYALAM"].map((l) => (
                    <option key={l} value={l}>
                      {l[0] + l.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Speaking Pace</Label>
                <Select value={script.pace} onChange={(e) => update("pace", e.target.value as CallScript["pace"])}>
                  <option value="STANDARD">Standard</option>
                  <option value="GIVE_SPACE">Give Space — allow pauses</option>
                </Select>
              </div>
            </div>

            {/* Introduction */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Round Opening Line / Introduction</Label>
                <span className="text-[11px] text-muted-foreground">Available variables: {"{candidate_name}"}, {"{company_name}"}, {"{persona_name}"}</span>
              </div>
              <Textarea
                rows={2}
                value={script.introduction || ""}
                onChange={(e) => update("introduction", e.target.value)}
                placeholder="Hi {candidate_name}, this is {persona_name} calling from {company_name}..."
              />
            </div>

            {/* Questions for This Round */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <Label className="text-sm font-semibold">Questions for {stageName || "this Round"}</Label>
                  <p className="text-xs text-muted-foreground">
                    The voice agent will ask these questions in order. Evaluation guidelines will instruct how candidate answers are scored.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addQuestion} className="h-8 text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add question
                </Button>
              </div>

              {(script.questions || []).map((q, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3.5 bg-slate-50/40 dark:bg-zinc-900/30">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={q.text}
                        className="text-xs font-medium"
                        placeholder="e.g. Can you describe your experience architecting microservices?"
                        onChange={(e) => updateQuestion(i, { text: e.target.value })}
                      />
                    </div>
                    <Select
                      value={q.type}
                      className="w-28 text-xs"
                      onChange={(e) => updateQuestion(i, { type: e.target.value as Question["type"] })}
                    >
                      <option value="Open-ended">Open-ended</option>
                      <option value="Yes-No">Yes-No</option>
                      <option value="Numeric">Numeric</option>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none pt-2">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span>Req</span>
                    </label>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(i)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 pl-8">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Follow-up probe (if vague)</span>
                      <Input
                        value={q.follow_up || ""}
                        className="h-8 text-xs bg-slate-50/70 dark:bg-zinc-800/60"
                        placeholder="e.g. What specific tools or frameworks did you choose?"
                        onChange={(e) => updateQuestion(i, { follow_up: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Evaluation / scoring guidance</span>
                      <Input
                        value={q.ai_note || ""}
                        className="h-8 text-xs bg-slate-50/70 dark:bg-zinc-800/60"
                        placeholder="e.g. Score high if candidate demonstrates deep system tradeoff knowledge"
                        onChange={(e) => updateQuestion(i, { ai_note: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Objection Handlers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <Label className="text-sm font-semibold">Objection Handlers</Label>
                  <p className="text-xs text-muted-foreground">Responses if candidate raises questions or hesitation during this round.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addHandler} className="h-8 text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add handler
                </Button>
              </div>
              {(script.objection_handlers || []).map((h, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={h.trigger} placeholder="Candidate says (Trigger)" onChange={(e) => updateHandler(i, { trigger: e.target.value })} />
                  <Input value={h.response} placeholder="AI responds (Scripted response)" onChange={(e) => updateHandler(i, { response: e.target.value })} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeHandler(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Closings */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Label>Closing — Interested</Label>
                </div>
                <Textarea rows={3} value={script.closing_interested || ""} onChange={(e) => update("closing_interested", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <Label>Closing — Not interested</Label>
                </div>
                <Textarea rows={3} value={script.closing_not_interested || ""} onChange={(e) => update("closing_not_interested", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <Label>Closing — Human handoff</Label>
                </div>
                <Textarea rows={3} value={script.closing_handoff || ""} onChange={(e) => update("closing_handoff", e.target.value)} />
              </div>
            </div>

            {/* Additional Instructions */}
            <div className="space-y-1.5">
              <Label>Additional AI Instructions ({(script.additional_instructions || "").length}/500)</Label>
              <Textarea
                maxLength={500}
                rows={2}
                value={script.additional_instructions || ""}
                onChange={(e) => update("additional_instructions", e.target.value)}
                placeholder="e.g. In this round, pay close attention to depth of answers; ask clarifying questions if necessary..."
              />
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <Save className="h-4 w-4" />} Save &amp; sync to Hunar
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                <FileText className="h-4 w-4" /> Preview assembled prompt
              </Button>
              {onGoToTesting && (
                <Button variant="outline" onClick={onGoToTesting} className="ml-auto">
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Open Live Testing Tab
                </Button>
              )}
            </div>

            {preview && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Assembled Prompt Preview:</div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/60 p-3 text-xs text-muted-foreground font-mono">
                  {preview}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =========================================================================
   TAB 4: LIVE TESTING (MULTI-STAGE TESTING)
   ========================================================================= */

function TestingTab({
  roleId,
  stages = [],
  setError,
}: {
  roleId: string;
  stages?: RoleStage[];
  setError: (e: string | null) => void;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id || "");
  const [script, setScript] = useState<CallScript | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [testForm, setTestForm] = useState({ callee_name: "", mobile_number: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (stages.length > 0 && (!selectedStageId || !stages.some((s) => s.id === selectedStageId))) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  useEffect(() => {
    if (selectedStageId) {
      api
        .getStageCallScript(roleId, selectedStageId)
        .then(setScript)
        .catch((e) => setError(e.message || String(e)));
    } else {
      api.getCallScript(roleId).then(setScript).catch((e) => setError(e.message || String(e)));
    }
    loadPreview();
  }, [roleId, selectedStageId]);

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const p = await api.previewStageCallScript(roleId, selectedStageId);
      setPreview(p.agent_prompt);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTestCall(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setTesting(true);
    setTestResult(null);
    try {
      const call = await api.testStageCallScript(roleId, selectedStageId, testForm.callee_name, testForm.mobile_number);
      setTestResult(`Call dispatched! Status: ${call.status} (Call ID: ${call.id})`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setTesting(false);
    }
  }

  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

  return (
    <div className="space-y-6">
      {/* Round Selector if multiple rounds exist */}
      {stages.length > 1 && (
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-border p-3 rounded-xl shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Layers className="h-3.5 w-3.5 text-indigo-600" /> Test Round:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto">
            {stages.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStageId(st.id)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors border",
                  selectedStageId === st.id
                    ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-slate-300"
                )}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Col: Live Call Tester */}
        <div className="space-y-6 lg:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="h-4 w-4 text-primary" /> Simulate Voice Call ({activeStage?.name || "Screening"})
              </CardTitle>
              <CardDescription>
                Dial your personal phone number to test the conversation flow, questions, and tone firsthand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={handleTestCall}>
                <div className="space-y-1.5">
                  <Label>Your Name</Label>
                  <Input
                    required
                    placeholder="e.g. John Doe"
                    value={testForm.callee_name}
                    onChange={(e) => setTestForm({ ...testForm, callee_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Your Phone Number (E.164 format)</Label>
                  <Input
                    required
                    placeholder="e.g. +919876543210 or +14155552671"
                    value={testForm.mobile_number}
                    onChange={(e) => setTestForm({ ...testForm, mobile_number: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Include country code (+91 for India, +1 for US). The AI agent will dial immediately.
                  </p>
                </div>
                <Button type="submit" disabled={testing} className="w-full">
                  {testing ? <Spinner /> : <Phone className="h-4 w-4" />} Call me now
                </Button>
              </form>

              {testResult && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{testResult}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Spec Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Active Agent Configuration ({activeStage?.name || "Round 1"})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Hunar Agent ID</span>
                <span className="font-mono font-medium">{script?.hunar_agent_id || "Not created yet (save round script first)"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Persona / Name</span>
                <span className="font-medium">{script?.ai_name || "Alex"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Tone &amp; Pace</span>
                <span className="font-medium">{script?.tone} · {script?.pace}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Language</span>
                <span className="font-medium">{script?.language}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Questions &amp; Objections</span>
                <span className="font-medium">
                  {script?.questions?.length || 0} questions · {script?.objection_handlers?.length || 0} objection handlers
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Compiled Prompt Inspector */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" /> Assembled Agent Prompt
                  </CardTitle>
                  <CardDescription>The exact system instructions injected into the voice LLM.</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={loadPreview} disabled={loadingPreview}>
                  {loadingPreview ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <pre className="h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-3.5 text-xs text-slate-700 font-mono leading-relaxed">
                {preview || "No prompt generated yet. Save your call script first."}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
