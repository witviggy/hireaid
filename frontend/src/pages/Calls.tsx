import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Download,
  ListFilter,
  RefreshCcw,
  Search as SearchIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { api } from "../api";
import { CallRecord, Role } from "../types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatRoundFraction } from "@/lib/utils";
import { formatStatus } from "../lib/format";

const CALL_STATUS_VARIANT: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  NOT_CONNECTED: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  NO_ANSWER: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  CALLING: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  QUEUED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

function formatDuration(secondsStr?: string | number | null): string {
  if (!secondsStr) return "—";
  const sec = Math.round(Number(secondsStr));
  if (isNaN(sec) || sec <= 0) return "—";
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins === 0) return `${remSec}s`;
  return `${mins}m ${remSec}s`;
}

const ROWS_PER_PAGE = 10;

export default function Calls() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Inline action loading state
  const [cancellingRetryId, setCancellingRetryId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([api.listCalls(), api.listRoles()])
      .then(([callList, roleList]) => {
        setCalls(callList);
        setRoles(roleList);
      })
      .catch((e: any) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCancelRetry(callId: string) {
    setCancellingRetryId(callId);
    setError(null);
    try {
      const updated = await api.cancelCallRetry(callId);
      setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCancellingRetryId(null);
    }
  }

  async function handleStatusChange(callId: string, newStatus: string) {
    setUpdatingStatusId(callId);
    setError(null);
    try {
      const updated = await api.updateCallStatus(callId, { status: newStatus, cancel_pending_retry: true });
      setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDeleteCall(callId: string) {
    if (!window.confirm("Are you sure you want to delete this call record? This action cannot be undone.")) return;
    setDeletingCallId(callId);
    setError(null);
    try {
      await api.deleteCall(callId);
      setCalls((prev) => prev.filter((c) => c.id !== callId));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setDeletingCallId(null);
    }
  }

  // Filter computation
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return calls.filter((c) => {
      if (statusFilter !== "ALL" && c.status?.toUpperCase() !== statusFilter) {
        return false;
      }
      if (roleFilter !== "ALL" && c.role_id !== roleFilter) {
        return false;
      }
      if (q) {
        const words = (c.candidate_name || "").toLowerCase().split(/\s+/);
        const nameMatch =
          (c.candidate_name || "").toLowerCase().startsWith(q) ||
          words.some((w) => w.startsWith(q));
        const phoneMatch = (c.candidate_phone || "").toLowerCase().startsWith(q);
        const roleWords = (c.role_title || "").toLowerCase().split(/\s+/);
        const roleMatch =
          (c.role_title || "").toLowerCase().startsWith(q) ||
          roleWords.some((w) => w.startsWith(q));
        if (!nameMatch && !phoneMatch && !roleMatch) {
          return false;
        }
      }
      return true;
    });
  }, [calls, search, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const roleTotalRounds = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of roles) {
      map[r.id] = r.stages?.length || 1;
    }
    return map;
  }, [roles]);

  function exportCsv() {
    const rows = [["Candidate", "Phone", "Role", "Round", "Date", "Duration", "Status", "Recommendation", "Score", "Recording"]].concat(
      filtered.map((c) => {
        const roundNum = c.stage?.round_number || 1;
        const totalRounds = c.total_rounds || (c.role_id ? roleTotalRounds[c.role_id] : 1) || 1;
        const roundText = formatRoundFraction(roundNum, totalRounds);
        return [
          c.candidate_name || "",
          c.candidate_phone || "",
          c.role_title || "",
          roundText,
          new Date(c.created_at).toLocaleString(),
          formatDuration(c.duration_seconds),
          c.status,
          c.screening?.recommendation || "",
          c.screening?.score_overall != null ? String(c.screening.score_overall) : "",
          c.recording_url || "",
        ];
      })
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">Call Logs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searchable index of all automated voice screening calls. Click any row to view complete candidate details and evaluation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-muted-foreground dark:border-[#27272A] dark:bg-[#121215] dark:text-slate-400">
            Total calls
            <span className="font-semibold text-slate-900 dark:text-[#FAFAFA]">{calls.length}</span>
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
            placeholder="Search calls by candidate name or phone"
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
          <option value="COMPLETED">Completed</option>
          <option value="NOT_CONNECTED">Not connected</option>
          <option value="NO_ANSWER">No answer</option>
          <option value="CALLING">Calling</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
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
              <th className="px-4 py-3 font-medium">Phone Number</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Round</th>
              <th className="px-4 py-3 font-medium">Date &amp; Time</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Status &amp; Override</th>
              <th className="px-4 py-3 font-medium">AI Screening</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const rec = c.screening?.recommendation;
              const hasRetry = c.has_pending_retry;
              const isUpdatingThis = updatingStatusId === c.id;
              const isCancellingThis = cancellingRetryId === c.id;
              const isDeletingThis = deletingCallId === c.id;
              const durationSec = Math.round(Number(c.duration_seconds || 0));
              const hasDuration = !isNaN(durationSec) && durationSec > 0;

              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-b border-slate-50 last:border-0 transition-colors",
                    hasDuration
                      ? "cursor-pointer hover:bg-slate-50 dark:border-[#27272A] dark:hover:bg-[#18181B]"
                      : "cursor-default"
                  )}
                  onClick={() => {
                    if (hasDuration && c.candidate_id) {
                      navigate(`/candidates/${c.candidate_id}`);
                    }
                  }}
                  title={hasDuration ? "Click to view candidate screening review" : undefined}
                >
                  {/* Candidate */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.candidate_name || "Candidate"} />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-[#FAFAFA]">
                          {c.candidate_name || "Candidate"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground dark:text-slate-400">
                    {c.candidate_phone || "—"}
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 text-muted-foreground dark:text-slate-400">
                    <span className="font-medium text-slate-900 dark:text-[#FAFAFA]">{c.role_title || "—"}</span>
                  </td>

                  {/* Round */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {(() => {
                      const roundNum = c.stage?.round_number || 1;
                      const totalRounds = c.total_rounds || (c.role_id ? roleTotalRounds[c.role_id] : 1) || 1;
                      const fraction = formatRoundFraction(roundNum, totalRounds);
                      const stageTitle = c.stage?.name
                        ? `Round ${roundNum}: ${c.stage.name} (out of ${totalRounds} rounds)`
                        : `Round ${roundNum} of ${totalRounds}`;
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

                  {/* Date & Time */}
                  <td className="px-4 py-3 text-xs text-muted-foreground dark:text-slate-400">
                    {new Date(c.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground dark:text-slate-400">
                    {formatDuration(c.duration_seconds)}
                  </td>

                  {/* Status & Inline Override */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-1 items-start">
                      <div className="relative">
                        <select
                          value={c.status}
                          disabled={isUpdatingThis}
                          onChange={(e) => handleStatusChange(c.id, e.target.value)}
                          className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-black transition-all focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 shadow-2xs dark:border-[#27272A] dark:bg-[#18181B] dark:text-white"
                          title="Click to manually change call status"
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

                      {hasRetry && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                            <Clock className="h-2.5 w-2.5" /> Retry #{c.retry_attempt || 2}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelRetry(c.id);
                            }}
                            disabled={isCancellingThis}
                            title="Cancel scheduled retry"
                            className="text-[10px] text-amber-700 hover:text-amber-900 underline font-medium px-1 py-0.5 rounded hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                          >
                            {isCancellingThis ? "Cancelling..." : "Cancel"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* AI Screening */}
                  <td className="px-4 py-3">
                    {c.screening ? (
                      <Badge
                        variant={
                          rec === "ADVANCE"
                            ? "success"
                            : rec === "REJECT"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {formatStatus(rec)} · {c.screening.score_overall}/100
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground dark:text-slate-400">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()} />
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground dark:text-slate-400">
                  No call records match your filters.
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
