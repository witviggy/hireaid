import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Briefcase,
  ChevronRight,
  PhoneCall,
  Plus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatProgressCard } from "@/components/stat-progress-card";
import { api } from "../api";
import { DashboardStats } from "../types";
import { formatStatus } from "../lib/format";

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setStats)
      .catch((e) => setError(e.message || String(e)));
  }, []);

  const totalDecisions = stats ? stats.advance_count + stats.hold_count + stats.reject_count : 0;
  const totalScreened = totalDecisions || 1;
  const reachRate =
    stats && stats.total_candidates > 0
      ? Math.round((stats.calls_made / stats.total_candidates) * 100)
      : 0;
  const shortlistRate =
    stats && stats.total_candidates > 0
      ? Math.round((stats.shortlisted / stats.total_candidates) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of candidate pipeline, voice screening outcomes, and open requisitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 text-xs">
            <Link to="/roles">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
              Manage Roles
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9 text-xs">
            <Link to="/roles">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Role
            </Link>
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Overall Performance Cards */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Overall performance
        </div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatProgressCard
            label="Active roles"
            value={stats ? stats.active_roles : 0}
            subtitle={
              stats
                ? stats.draft_roles > 0
                  ? `${stats.draft_roles} draft requisition${stats.draft_roles > 1 ? "s" : ""}`
                  : "All requisitions active"
                : undefined
            }
            icon={Briefcase}
          />
          <StatProgressCard
            label="Candidates sourced"
            value={stats ? stats.total_candidates : 0}
            subtitle={stats ? `${stats.calls_made} contacted by AI` : undefined}
            icon={Users}
          />
          <StatProgressCard
            label="Calls conducted"
            value={stats ? stats.calls_made : 0}
            subtitle={
              stats
                ? `${stats.calls_completed} completed call${stats.calls_completed !== 1 ? "s" : ""}`
                : undefined
            }
            icon={PhoneCall}
          />
          <StatProgressCard
            label="Shortlisted"
            value={stats ? stats.shortlisted : 0}
            subtitle={
              stats && stats.total_candidates > 0
                ? `${Math.round((stats.shortlisted / stats.total_candidates) * 100)}% conversion rate`
                : "0% conversion rate"
            }
            icon={Award}
          />
        </section>
      </div>

      {/* Middle Row: Balanced 2-Column Grid (Pipeline Funnel & AI Screening Decisions) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card 1: Hiring Pipeline Funnel */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Hiring Pipeline Funnel</CardTitle>
                  <CardDescription className="text-xs">
                    Candidate stage progression & conversion
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    Reach: <span className="ml-1 font-semibold">{reachRate}%</span>
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    Shortlist: <span className="ml-1 font-semibold">{shortlistRate}%</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {stats && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300">1. Sourced & Queued</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{stats.sourced}</span>
                    </div>
                    <Progress
                      value={stats.total_candidates ? (stats.sourced / stats.total_candidates) * 100 : 0}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300">2. Calls Placed</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{stats.calls_made}</span>
                    </div>
                    <Progress
                      value={stats.total_candidates ? (stats.calls_made / stats.total_candidates) * 100 : 0}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300">3. AI Screened</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{stats.screened}</span>
                    </div>
                    <Progress
                      value={stats.total_candidates ? (stats.screened / stats.total_candidates) * 100 : 0}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400">4. Shortlisted</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.shortlisted}</span>
                    </div>
                    <Progress
                      value={stats.total_candidates ? (stats.shortlisted / stats.total_candidates) * 100 : 0}
                      className="h-2 bg-emerald-100 dark:bg-emerald-950/40"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-[#27272A] dark:text-slate-400">
            <span>Pipeline Conversion Rate</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {shortlistRate}% overall
            </span>
          </div>
        </Card>

        {/* Card 2: AI Screening Decisions */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">AI Screening Decisions</CardTitle>
                  <CardDescription className="text-xs">
                    Voice recruiter recommendations & outcomes
                  </CardDescription>
                </div>
                {stats?.avg_score != null && stats.avg_score > 0 ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    Avg Score: <span className="ml-1 font-semibold">{stats.avg_score}/100</span>
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {stats && (
                <>
                  {/* Equal visual weight for Advance, Hold, Reject */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-[#27272A] dark:bg-[#18181B]">
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Advance</div>
                      <div className="mt-0.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.advance_count}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {totalDecisions > 0 ? Math.round((stats.advance_count / totalDecisions) * 100) : 0}%
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-[#27272A] dark:bg-[#18181B]">
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Hold</div>
                      <div className="mt-0.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.hold_count}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {totalDecisions > 0 ? Math.round((stats.hold_count / totalDecisions) * 100) : 0}%
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-[#27272A] dark:bg-[#18181B]">
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Reject</div>
                      <div className="mt-0.5 text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {stats.reject_count}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {totalDecisions > 0 ? Math.round((stats.reject_count / totalDecisions) * 100) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Visual ratio distribution bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Decision Distribution</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {totalDecisions} evaluated
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#27272A]">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${(stats.advance_count / totalScreened) * 100}%` }}
                      />
                      <div
                        className="bg-amber-500 transition-all"
                        style={{ width: `${(stats.hold_count / totalScreened) * 100}%` }}
                      />
                      <div
                        className="bg-rose-500 transition-all"
                        style={{ width: `${(stats.reject_count / totalScreened) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-[#27272A] dark:text-slate-400">
            <span>Total AI Evaluated</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {totalDecisions} candidate{totalDecisions !== 1 ? "s" : ""}
            </span>
          </div>
        </Card>
      </div>

      {/* Bottom Row: Balanced 2-Column Grid (Open Requisitions & Recent Calls) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Open Requisitions */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">Open Requisitions</CardTitle>
                <CardDescription className="text-xs">
                  Role pipelines and candidate sourcing status
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/roles">
                  View All <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {stats && stats.roles_summary && stats.roles_summary.length > 0 ? (
                <div className="-mx-2.5 divide-y divide-slate-100 dark:divide-[#27272A]">
                  {stats.roles_summary.slice(0, 4).map((role) => (
                    <Link
                      key={role.id}
                      to={`/roles/${role.id}`}
                      className="group flex flex-col gap-2 rounded-lg p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-[#18181B] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#111827] group-hover:text-primary dark:text-[#FAFAFA]">
                            {role.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              role.status === "ACTIVE"
                                ? "border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-slate-200 bg-slate-50 text-[10px] text-slate-600 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-400"
                            }
                          >
                            {formatStatus(role.status)}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {role.location || "—"}
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {role.candidate_count} candidate{role.candidate_count !== 1 ? "s" : ""}
                        </div>
                        <div className="text-emerald-600 dark:text-emerald-400">
                          {role.shortlisted_count} shortlisted
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No requisitions found. Create your first role to start AI screening.
                </div>
              )}
            </CardContent>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-[#27272A] dark:text-slate-400">
            <span>Total Requisitions</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {stats?.total_roles || 0}
            </span>
          </div>
        </Card>

        {/* Recent Calls */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Calls</CardTitle>
                <CardDescription className="text-xs">
                  Latest voice screenings & outcomes
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/calls">
                  All Calls <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {stats && stats.recent_activity && stats.recent_activity.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.recent_activity.slice(0, 4).map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-xs dark:border-[#27272A] dark:bg-[#18181B]"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {act.candidate_name || "Candidate"}
                        </div>
                        <div className="max-w-[170px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {act.role_title || "—"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {act.recommendation === "ADVANCE" && (
                          <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Advance
                          </Badge>
                        )}
                        {act.recommendation === "HOLD" && (
                          <Badge className="border-0 bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Hold
                          </Badge>
                        )}
                        {act.recommendation === "REJECT" && (
                          <Badge className="border-0 bg-rose-100 text-[10px] text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Reject
                          </Badge>
                        )}
                        {!act.recommendation && (
                          <Badge variant="outline" className="text-[10px]">
                            {formatStatus(act.status)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No recent calls recorded.
                </div>
              )}
            </CardContent>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-[#27272A] dark:text-slate-400">
            <span>Total Calls Conducted</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {stats?.calls_made || 0}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
