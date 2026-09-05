import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  ListFilter,
  Plus,
  RefreshCcw,
  Search as SearchIcon,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../api";
import { Role } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { StepSection } from "@/components/ui/step-section";
import { cn } from "@/lib/utils";
import { formatStatus } from "../lib/format";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PAUSED: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  CLOSED: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const ROWS_PER_PAGE = 10;

export default function Roles() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    api
      .listRoles()
      .then(setRoles)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }

  async function handleDeleteRole(roleId: string, title: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete role "${title}"? All associated pipeline candidates, call scripts, and call records will be permanently removed.`)) return;
    setDeletingId(roleId);
    setError(null);
    try {
      await api.deleteRole(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.trim().toLowerCase();
        const words = (r.title || "").toLowerCase().split(/\s+/);
        const matches = (r.title || "").toLowerCase().startsWith(q) || words.some((w) => w.startsWith(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [roles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const activeCount = roles.filter((r) => r.status === "ACTIVE").length;
  const draftCount = roles.filter((r) => r.status === "DRAFT").length;
  const scoredCount = roles.filter((r) => (r.must_have_skills?.length || 0) > 0).length;

  function exportCsv() {
    const rows = [["Title", "Skills", "Total Rounds", "Status", "Seniority", "Location", "Created"]].concat(
      filtered.map((r) => [
        r.title,
        (r.must_have_skills || []).join(", "),
        String(r.total_rounds || (r.stages?.length ? r.stages.length : 1)),
        r.status,
        r.seniority || "",
        r.location_normalized || r.location || "",
        r.created_at,
      ])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roles.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">Roles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure job requisitions, multi-round voice agent scripts, and screening pipelines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-muted-foreground dark:border-[#27272A] dark:bg-[#121215] dark:text-slate-400">
            Total roles
            <span className="font-semibold text-slate-900 dark:text-[#FAFAFA]">{roles.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-9 text-xs">
            <RefreshCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search roles by title"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-40 h-9 text-xs"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Button variant="outline" size="sm" className="h-9 text-xs">
          <Filter className="h-3.5 w-3.5 mr-1.5" /> All filters
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export data
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-9 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New role
        </Button>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[12px] font-medium text-[#6B7280] dark:border-[#27272A] dark:text-[#9CA3AF]">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Skills</th>
              <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Total Rounds</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Seniority</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((role) => (
              <tr
                key={role.id}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-[#27272A] dark:hover:bg-[#18181B]"
                onClick={() => navigate(`/roles/${role.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-[#FAFAFA]">{role.title}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(role.must_have_skills || []).length > 0 ? (
                      (role.must_have_skills || []).slice(0, 3).map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-[10px] font-normal dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300"
                        >
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground dark:text-slate-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {(() => {
                    const rounds = role.total_rounds || (role.stages?.length ? role.stages.length : 1);
                    return (
                      <span
                        className="font-medium text-slate-800 dark:text-slate-200"
                        title={`${rounds} round${rounds > 1 ? "s" : ""} configured`}
                      >
                        {rounds}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLE[role.status] || STATUS_STYLE.DRAFT)}>
                    {formatStatus(role.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">{role.seniority || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">{role.location_normalized || role.location || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">{new Date(role.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground dark:text-slate-400">
                  No roles match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-muted-foreground dark:border-[#27272A] dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ListFilter className="h-3.5 w-3.5" /> {ROWS_PER_PAGE} rows per page
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]">
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} widthClassName="max-w-3xl">
        <CreateRoleDrawer
          onClose={() => setShowCreate(false)}
          onCreated={(role) => {
            setShowCreate(false);
            refresh();
            navigate(`/roles/${role.id}`);
          }}
        />
      </Sheet>
    </div>
  );
}

function CreateRoleDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (role: Role) => void }) {
  const [form, setForm] = useState({
    title: "",
    jd_raw_text: "",
    required_skills_hint: "",
    location: "",
    target_company: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsComplete = form.title.trim().length > 0;
  const jdComplete = form.jd_raw_text.trim().length > 0;
  const prioritySkills = form.required_skills_hint
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const role = await api.createRole(form);
      onCreated(role);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <SheetHeader
        title="Create role"
        subtitle="Define requirements and initialize the dedicated AI voice recruiter."
        onClose={onClose}
      />
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <StepSection
            index={1}
            title="Role details"
            description="Role title, location, and target company."
            complete={detailsComplete}
            defaultOpen
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Role title *</Label>
                <Input
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location (optional)</Label>
                <Input
                  placeholder="e.g. Bangalore, Remote, San Francisco"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target company (optional)</Label>
                <Input
                  placeholder="e.g. Stripe, Swiggy, Google"
                  value={form.target_company}
                  onChange={(e) => setForm({ ...form, target_company: e.target.value })}
                />
              </div>
            </div>
          </StepSection>

          <StepSection
            index={2}
            title="Job description & criteria"
            description="AI extracts must-have skills, seniority, and required experience from the JD."
            complete={jdComplete}
            defaultOpen
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Key skills override / priority (optional)</Label>
                <p className="text-[11px] text-muted-foreground dark:text-slate-400">
                  AI extracts skills automatically from the JD below. Add specific skills here only to mandate or prioritize them.
                </p>
                <Input
                  placeholder="e.g. Python, FastAPI, PostgreSQL, Distributed Systems"
                  value={form.required_skills_hint}
                  onChange={(e) => setForm({ ...form, required_skills_hint: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Full job description *</Label>
                <Textarea
                  required
                  className="min-h-[160px]"
                  placeholder="Paste the full job description or key responsibilities here..."
                  value={form.jd_raw_text}
                  onChange={(e) => setForm({ ...form, jd_raw_text: e.target.value })}
                />
              </div>
            </div>
          </StepSection>

          <StepSection
            index={3}
            title="Guardrails & call defaults"
            description="Inherited from global settings — a custom screening script is created automatically."
            complete={detailsComplete && jdComplete}
          >
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              A standard voice screening script (introduction, qualification questions, objection handling, closing)
              is generated automatically. You can customize questions, evaluation criteria, and tone once created.
            </p>
          </StepSection>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right sidebar preview */}
        <div className="space-y-4">
          <div className="rounded-[8px] border border-[#E5E7EB] bg-slate-50/50 p-4 dark:border-[#27272A] dark:bg-[#18181B]">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Configuration
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {form.title.trim() || "Untitled Role"}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {form.location.trim() || "Remote / Unspecified"}
            </div>

            {prioritySkills.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Priority Skills:
                </div>
                <div className="flex flex-wrap gap-1">
                  {prioritySkills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[8px] border border-[#E5E7EB] p-4 dark:border-[#27272A]">
            <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-primary" /> What happens on create
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground dark:text-slate-400">
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                AI extracts must-have skills &amp; experience levels from JD
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                A tailored call script and 4-dimension scorecard are generated
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                Role starts in <span className="font-medium text-slate-700 dark:text-slate-300">Draft</span> status
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pinned Action Footer */}
      <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4 dark:border-[#27272A] dark:bg-[#121215]">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={creating || !detailsComplete || !jdComplete}>
          {creating && <Spinner className="mr-1.5" />} Create role
        </Button>
      </div>
    </form>
  );
}


