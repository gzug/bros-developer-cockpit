import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Database, HelpCircle, Loader2, PlayCircle, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { tasks, runs, approvals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// ---------------- SERVER FUNCTIONS ----------------

export const getDcDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/lib/auth-session.server");
  requireAuth();

  const db = getDb();
  if (!db) {
    return {
      dbConnected: false,
      queue: [],
      runs: [],
      approvals: [],
    };
  }

  try {
    const [queueData, runsData, approvalsData] = await Promise.all([
      db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(100),
      db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100),
      db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(100),
    ]);

    // Format fields for frontend serialization
    return {
      dbConnected: true,
      queue: queueData.map(q => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
      runs: runsData.map(r => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      })),
      approvals: approvalsData.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[db] getDcDashboardData query failed:", err);
    return {
      dbConnected: false,
      queue: [],
      runs: [],
      approvals: [],
    };
  }
});

import { z } from "zod";

const ApproveInput = z.object({
  approvalId: z.string(),
  issueNumber: z.number().int(),
  toStatus: z.string(),
});

export const submitApprovalDecision = createServerFn({ method: "POST" })
  .validator((input: unknown) => ApproveInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth-session.server");
    requireAuth();

    const { setIdeaStatus, addIdeaComment, getIdea } = await import("@/lib/github-issues.server");

    // 1. Transition the GitHub issue status
    try {
      const idea = await getIdea(data.issueNumber);
      await setIdeaStatus(data.issueNumber, data.toStatus as any, idea.intent);
      await addIdeaComment(
        data.issueNumber,
        `🤖 Owner approved transition to "${data.toStatus}" via DC Operational UI.`
      );
    } catch (err) {
      console.warn(`[dc-ui] GitHub status update failed for issue #${data.issueNumber}:`, err);
      throw new Error(`GitHub update failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Delete the pending approval record from database if connected
    const db = getDb();
    if (db) {
      try {
        await db.delete(approvals).where(eq(approvals.id, data.approvalId));
      } catch (err) {
        console.error(`[dc-ui] Failed to delete approval record:`, err);
      }
    }

    return { ok: true as const };
  });

// ---------------- ROUTE DEFINITION ----------------

export const Route = createFileRoute("/_authenticated/dc")({
  component: DcOperationalDashboard,
});

// ---------------- REACT COMPONENT ----------------

function DcOperationalDashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dc-dashboard"],
    queryFn: () => getDcDashboardData(),
    refetchInterval: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: (variables: { approvalId: string; issueNumber: number; toStatus: string }) =>
      submitApprovalDecision({ data: variables }),
    onSuccess: () => {
      toast.success("Approval submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["dc-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["owner-kpi"] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve decision.");
    },
  });

  const dbConnected = data?.dbConnected ?? false;
  const queueList = data?.queue ?? [];
  const runsList = data?.runs ?? [];
  const approvalsList = data?.approvals ?? [];

  // Cost Aggregation Calculations
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentDay = now.getDay();
  const diffDays = currentDay === 0 ? -6 : 1 - currentDay;
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays);
  startOfThisWeek.setHours(0, 0, 0, 0);

  let totalToday = 0;
  let totalThisWeek = 0;
  let totalAllTime = 0;
  const tierCosts: Record<string, number> = { tier0: 0, tier1: 0, tier2: 0 };

  runsList.forEach((run: any) => {
    const cost = parseFloat(run.costUsd || "0");
    const startedAtDate = new Date(run.startedAt);

    totalAllTime += cost;
    if (startedAtDate >= startOfToday) {
      totalToday += cost;
    }
    if (startedAtDate >= startOfThisWeek) {
      totalThisWeek += cost;
    }

    if (run.tier) {
      const tierKey = run.tier.toLowerCase();
      if (tierCosts[tierKey] !== undefined) {
        tierCosts[tierKey] += cost;
      } else {
        tierCosts[tierKey] = (tierCosts[tierKey] || 0) + cost;
      }
    }
  });

  // Helpers for Status Badges
  const getTaskStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "queued") {
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 gap-1">
          <HelpCircle className="h-3 w-3" /> Queued
        </Badge>
      );
    }
    if (normalized === "running") {
      return (
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-500 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </Badge>
      );
    }
    if (normalized === "done" || normalized === "completed") {
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 gap-1">
          <CheckCircle className="h-3 w-3" /> Done
        </Badge>
      );
    }
    if (normalized === "blocked" || normalized === "failed") {
      return (
        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-500 gap-1">
          <ShieldAlert className="h-3 w-3" /> Blocked
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getRunStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "started") {
      return <Badge variant="outline" className="border-blue-500/30 text-blue-400">Started</Badge>;
    }
    if (normalized === "completed") {
      return <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Completed</Badge>;
    }
    if (normalized === "failed") {
      return <Badge variant="outline" className="border-rose-500/30 text-rose-400">Failed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Developer Cockpit</h1>
            <Badge variant="outline" className="text-xs">Operational UI</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time engine metrics, task queues, costs, and manual approval gates.
          </p>
        </div>

        {/* DATABASE WARNING BANNER */}
        {!dbConnected && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-amber-500">DB not connected - set DATABASE_URL in Vercel</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Postgres observability features are disabled. Panels will function in static/empty fallback mode.
              </p>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading cockpit data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* PANEL 1: QUEUE */}
            <Card className="flex flex-col h-[420px]">
              <CardHeader className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Panel 1 — Queue</CardTitle>
                    <CardDescription className="text-xs">Active development tasks</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{queueList.length} Tasks</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {queueList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No tasks queued.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-24 text-xs">Issue</TableHead>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="w-24 text-xs">Intent</TableHead>
                        <TableHead className="w-28 text-xs text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queueList.map((task: any) => (
                        <TableRow key={task.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">
                            <a
                              href={`https://github.com/gzug/01-One-L1fe/issues/${task.issueNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-blue-500 hover:text-blue-400 font-semibold"
                            >
                              #{task.issueNumber}
                            </a>
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[200px] truncate" title={task.title}>
                            {task.title}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">{task.intent}</TableCell>
                          <TableCell className="text-right py-2">{getTaskStatusBadge(task.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* PANEL 4: APPROVALS */}
            <Card className="flex flex-col h-[420px]">
              <CardHeader className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Panel 4 — Approvals</CardTitle>
                    <CardDescription className="text-xs">Gated decisions pending owner action</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{approvalsList.length} Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {approvalsList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No approvals pending.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-20 text-xs">Issue</TableHead>
                        <TableHead className="w-24 text-xs">PR</TableHead>
                        <TableHead className="text-xs">Transition</TableHead>
                        <TableHead className="w-24 text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalsList.map((app: any) => (
                        <TableRow key={app.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">
                            <a
                              href={`https://github.com/gzug/01-One-L1fe/issues/${app.issueNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-semibold text-blue-500 hover:text-blue-400"
                            >
                              #{app.issueNumber}
                            </a>
                          </TableCell>
                          <TableCell className="text-xs">
                            {app.prNumber ? (
                              <a
                                href={`https://github.com/gzug/01-One-L1fe/pull/${app.prNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-medium text-blue-500"
                              >
                                PR #{app.prNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            <span className="text-muted-foreground">{app.fromStatus || "any"}</span>
                            <span className="mx-1">→</span>
                            <span className="font-semibold text-emerald-500">{app.toStatus}</span>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() =>
                                approveMutation.mutate({
                                  approvalId: app.id,
                                  issueNumber: app.issueNumber,
                                  toStatus: app.toStatus,
                                })
                              }
                              disabled={approveMutation.isPending}
                            >
                              Approve
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* PANEL 2: RUN LOG */}
            <Card className="flex flex-col h-[420px] lg:col-span-2">
              <CardHeader className="py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Panel 2 — Run Log</CardTitle>
                    <CardDescription className="text-xs">Observability flow of engine execution runs</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{runsList.length} Runs</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {runsList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No runs recorded yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-20 text-xs">Issue</TableHead>
                        <TableHead className="w-16 text-xs">Tier</TableHead>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="w-24 text-xs">Tokens</TableHead>
                        <TableHead className="w-24 text-xs">Cost</TableHead>
                        <TableHead className="w-24 text-xs">Status</TableHead>
                        <TableHead className="w-24 text-xs">PR</TableHead>
                        <TableHead className="w-32 text-xs">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runsList.map((run: any) => (
                        <TableRow key={run.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">
                            <a
                              href={`https://github.com/gzug/01-One-L1fe/issues/${run.issueNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-semibold text-blue-500 hover:text-blue-400"
                            >
                              #{run.issueNumber}
                            </a>
                          </TableCell>
                          <TableCell className="text-xs uppercase font-semibold text-muted-foreground">
                            {run.tier || "—"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]" title={run.model}>
                            {run.model || "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {run.tokensPrompt != null && run.tokensCompletion != null ? (
                              <span>
                                {run.tokensPrompt}+{run.tokensCompletion}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-emerald-500">
                            {formatCost(parseFloat(run.costUsd || "0"))}
                          </TableCell>
                          <TableCell className="py-1">{getRunStatusBadge(run.status)}</TableCell>
                          <TableCell className="text-xs">
                            {run.githubPrNumber ? (
                              <a
                                href={`https://github.com/gzug/01-One-L1fe/pull/${run.githubPrNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-medium text-blue-500"
                              >
                                PR #{run.githubPrNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {new Date(run.startedAt).toLocaleTimeString("en-AU", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* PANEL 3: COSTS */}
            <Card className="lg:col-span-2">
              <CardHeader className="py-4 border-b border-border">
                <CardTitle className="text-base font-semibold">Panel 3 — Costs</CardTitle>
                <CardDescription className="text-xs">Aggregate model spend metrics from engine execution logs</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {runsList.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No runs recorded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Timeframe Aggregates</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Period</TableHead>
                            <TableHead className="text-xs text-right">Spend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-xs font-medium">Today</TableCell>
                            <TableCell className="text-xs font-mono text-right text-emerald-500 font-bold">
                              {formatCost(totalToday)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs font-medium">This Week</TableCell>
                            <TableCell className="text-xs font-mono text-right text-emerald-500 font-bold">
                              {formatCost(totalThisWeek)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs font-medium">All Time</TableCell>
                            <TableCell className="text-xs font-mono text-right text-emerald-500 font-bold">
                              {formatCost(totalAllTime)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Tier Breakdown</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Tier</TableHead>
                            <TableHead className="text-xs text-right">Spend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-xs font-medium">Tier 0</TableCell>
                            <TableCell className="text-xs font-mono text-right font-medium">
                              {formatCost(tierCosts.tier0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs font-medium">Tier 1</TableCell>
                            <TableCell className="text-xs font-mono text-right font-medium">
                              {formatCost(tierCosts.tier1)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs font-medium">Tier 2</TableCell>
                            <TableCell className="text-xs font-mono text-right font-medium">
                              {formatCost(tierCosts.tier2)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </main>
    </div>
  );
}
