import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  ListFilter,
  PhoneCall,
  RefreshCcw,
  Search as SearchIcon,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../api";
import { Candidate, Role } from "../types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatRoundFraction } from "@/lib/utils";
import { formatStatus, formatEmpty } from "../lib/format";

const PIPELINE_VARIANT: Record<string, string> = {
  SOURCED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  QUEUED: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  CALLING: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  NO_ANSWER: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  RETRY_PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  UNREACHABLE: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  SCREENED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SHORTLISTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  REVIEW_NEEDED: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  ARCHIVED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

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

const ROWS_PER_PAGE = 10;

export default function Candidates() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteCandidate(candidateId: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete candidate ${name}? All associated pipeline entries and call records will be permanently removed.`)) return;
    setDeletingId(candidateId);
    setError(null);
    try {
      await api.deleteCandidate(candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setDeletingId(null);
    }
  }

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([api.listCandidates(), api.listRoles()])
      .then(([candidateList, roleList]) => {
        setCandidates(candidateList);
        setRoles(roleList);
      })
      .catch((e: any) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleCopyPhone(phone: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  }

  // Filter computation
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return candidates.filter((c) => {
      if (statusFilter !== "ALL") {
        const hasStatus = c.pipeline_entries?.some(
          (p) => p.status?.toUpperCase() === statusFilter.toUpperCase()
        );
        if (!hasStatus) return false;
      }
      if (roleFilter !== "ALL") {
        const matchesRole = c.pipeline_entries?.some((p) => p.role_id === roleFilter);
        if (!matchesRole) return false;
      }
      if (q) {
        const nameWords = (c.full_name || "").toLowerCase().split(/\s+/);
        const nameMatch =
          (c.full_name || "").toLowerCase().startsWith(q) ||
          nameWords.some((w) => w.startsWith(q));
        const phoneMatch = (c.phone_number || "").startsWith(q);
        if (!nameMatch && !phoneMatch) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, search, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // Performance metrics
  const shortlistedCount = useMemo(
    () => candidates.filter((c) => c.pipeline_entries?.some((p) => p.status === "SHORTLISTED")).length,
    [candidates]
  );
  const screenedCount = useMemo(
    () =>
      candidates.filter((c) =>
        c.pipeline_entries?.some((p) => p.status === "SCREENED" || p.calls?.some((call) => call.screening))
      ).length,
    [candidates]
  );

  const roleTotalRounds = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of roles) {
      map[r.id] = r.stages?.length || 1;
    }
    return map;
  }, [roles]);

  function exportCsv() {
    const rows = [["Name", "Title", "Company", "Location", "Phone", "Assigned Role", "Current Round", "Status", "Fit Score"]].concat(
      filtered.map((c) => {
        const p = c.pipeline_entries?.[0];
        const currentRound = p?.current_stage?.round_number || 1;
        const totalRounds = p?.total_rounds || p?.role?.total_rounds || (p?.role_id ? roleTotalRounds[p.role_id] : 1) || 1;
        const roundText = formatRoundFraction(currentRound, totalRounds);
        return [
          c.full_name,
          c.current_title || "",
          c.current_company || "",
          c.location || "",
          c.phone_number,
          p?.role?.title || "",
          roundText,
          p?.status || "SOURCED",
          p?.fit_score != null ? String(p.fit_score) : "",
        ];
      })
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">Candidates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track candidate outreach, voice screening records, match scores, and interview stages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-muted-foreground dark:border-[#27272A] dark:bg-[#121215] dark:text-slate-400">
            Total candidates
            <span className="font-semibold text-slate-900 dark:text-[#FAFAFA]">{candidates.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-9 text-xs">
            <RefreshCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filters Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search candidates by name, company, or title"
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
          <option value="SOURCED">Sourced</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="SCREENED">Screened</option>
          <option value="CALLING">Calling</option>
          <option value="ARCHIVED">Archived</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="w-48 h-9 text-xs"
        >
          <option value="ALL">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export data
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-[#27272A] dark:bg-[#121215]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[12px] font-medium text-[#6B7280] dark:border-[#27272A] dark:text-[#9CA3AF]">
              <th className="px-4 py-3 font-medium">Candidate</th>
              <th className="px-4 py-3 font-medium">Current Role</th>
              <th className="px-4 py-3 font-medium">Assigned Role</th>
              <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Round</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Fit Score</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const primaryPipeline = c.pipeline_entries?.[0];
              const fitScore = primaryPipeline?.fit_score;
              const roleTitle = primaryPipeline?.role?.title;
              const status = primaryPipeline?.status || "SOURCED";

              return (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-[#27272A] dark:hover:bg-[#18181B]"
                  onClick={() => navigate(`/candidates/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.full_name} />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-[#FAFAFA]">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground dark:text-slate-400">{c.location || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{c.current_title || "—"}</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">{c.current_company || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">
                    {roleTitle ? (
                      <span className="font-medium text-slate-900 dark:text-[#FAFAFA]">{roleTitle}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {(() => {
                      const currentRound = primaryPipeline?.current_stage?.round_number || 1;
                      const totalRounds = primaryPipeline?.total_rounds || primaryPipeline?.role?.total_rounds || (primaryPipeline?.role_id ? roleTotalRounds[primaryPipeline.role_id] : 1) || 1;
                      const fraction = formatRoundFraction(currentRound, totalRounds);
                      const stageTitle = primaryPipeline?.current_stage?.name
                        ? `Round ${currentRound}: ${primaryPipeline.current_stage.name} (out of ${totalRounds} rounds)`
                        : `Round ${currentRound} of ${totalRounds}`;
                      return (
                        <span
                          className="font-medium text-slate-800 dark:text-slate-200"
                          title={stageTitle}
                        >
                          {fraction}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                        PIPELINE_VARIANT[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {formatStatus(status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MatchScoreBadge score={fitScore} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground dark:text-slate-400">
                    {c.phone_number}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteCandidate(c.id, c.full_name, e)}
                      disabled={deletingId === c.id}
                      title="Delete candidate"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground dark:text-slate-400">
                  No candidates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-muted-foreground dark:border-[#27272A] dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ListFilter className="h-3.5 w-3.5" /> {ROWS_PER_PAGE} rows per page
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]"
            >
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
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded p-1 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#18181B]"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      </div>
  );
}
