import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  approvePrFn,
  markLiveFn,
  pollNewBdcIssuesFn,
  requestChangesFn,
} from "@/lib/ideas.functions";
import { getDb } from "@/lib/db";
import { approvals, runs } from "@/lib/db/schema";
import { listMemoryRuns } from "@/lib/db/runs.server";
import { desc } from "drizzle-orm";

export const getDcDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/lib/auth-session.server");
  requireAuth();

  const envStatus = {
    githubTokenSet: Boolean(process.env.GITHUB_TOKEN),
    openrouterKeySet: Boolean(process.env.OPENROUTER_API_KEY),
  };
  let githubConnected = true;
  let githubError: string | null = null;
  const { listIdeas } = await import("@/lib/github-issues.server");
  const queue = await listIdeas().catch((error) => {
    githubConnected = false;
    githubError = error instanceof Error ? error.message : String(error);
    return [];
  });

  const db = getDb();
  if (!db) {
    return {
      envStatus,
      githubConnected,
      githubError,
      dbConnected: false,
      queue,
      runs: listMemoryRuns().slice(0, 100).map((run) => ({
        ...run,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      approvals: [],
    };
  }

  try {
    const [runsData, approvalsData] = await Promise.all([
      db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100),
      db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(100),
    ]);

    return {
      envStatus,
      githubConnected,
      githubError,
      dbConnected: true,
      queue,
      runs: runsData.map((run) => ({
        ...run,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      })),
      approvals: approvalsData.map((approval) => ({
        ...approval,
        createdAt: approval.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[db] getDcDashboardData query failed:", error);
    return {
      envStatus,
      githubConnected,
      githubError,
      dbConnected: false,
      queue,
      runs: listMemoryRuns().slice(0, 100).map((run) => ({
        ...run,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      approvals: [],
    };
  }
});

export const Route = createFileRoute("/_authenticated/dc")({
  component: DcOperationalDashboard,
});

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "submitted") {
    return <Badge variant="outline" className="border-amber-500/30 text-amber-600">Submitted</Badge>;
  }
  if (normalized === "processing") {
    return <Badge variant="outline" className="border-blue-500/30 text-blue-600">Processing</Badge>;
  }
  if (normalized === "sent") {
    return <Badge variant="outline" className="border-sky-500/30 text-sky-600">Sent</Badge>;
  }
  if (normalized === "approved") {
    return <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">Approved</Badge>;
  }
  if (normalized === "live") {
    return <Badge variant="outline" className="border-emerald-700/30 text-emerald-700">Live</Badge>;
  }
  if (normalized === "blocked" || normalized === "failed") {
    return (
      <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600">
        <ShieldAlert className="h-3 w-3" /> Blocked
      </Badge>
    );
  }
  if (normalized === "completed") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600">
        <CheckCircle className="h-3 w-3" /> Completed
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function formatCost(value: string | number | null | undefined) {
  const cost = typeof value === "number" ? value : parseFloat(value || "0");
  return `$${cost.toFixed(4)}`;
}

function generateSubmissionLink() {
  const context = window.prompt("Screen context (optional)", "")?.trim() ?? "";
  const url = new URL("/submit", window.location.origin);
  url.searchParams.set("type", "idea");
  if (context) url.searchParams.set("context", context);
  void navigator.clipboard.writeText(url.toString());
  toast.success("Link copied");
}

function DcOperationalDashboard() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["dc-dashboard"],
    queryFn: () => getDcDashboardData(),
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dc-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["ideas"] });
    queryClient.invalidateQueries({ queryKey: ["owner-kpi"] });
  };

  const pollMutation = useMutation({
    mutationFn: () => pollNewBdcIssuesFn(),
    onSuccess: (result) => {
      if (result.claimed > 0) toast.success(`Processed ${result.claimed} new issue${result.claimed === 1 ? "" : "s"}.`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Issue poll failed."),
  });

  const approveMutation = useMutation({
    mutationFn: (input: { issueNumber: number; prNumber: number }) => approvePrFn({ data: input }),
    onSuccess: (result) => {
      toast.success(result.message);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Approve failed."),
  });

  const requestChangesMutation = useMutation({
    mutationFn: (input: { issueNumber: number; prNumber: number }) => requestChangesFn({ data: input }),
    onSuccess: () => {
      toast.success("Changes requested.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Request changes failed."),
  });

  const markLiveMutation = useMutation({
    mutationFn: (id: number) => markLiveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked live.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Mark live failed."),
  });

  useEffect(() => {
    pollMutation.mutate();
    const interval = window.setInterval(() => pollMutation.mutate(), 60_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = dashboard.data;
  const queue = data?.queue ?? [];
  const runsList = data?.runs ?? [];
  const dbConnected = data?.dbConnected ?? false;
  const githubConnected = data?.githubConnected ?? false;
  const envStatus = data?.envStatus;
  const totalCost = runsList.reduce((sum: number, run: any) => sum + parseFloat(run.costUsd || "0"), 0);

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Developer Cockpit</h1>
              <Badge variant="outline" className="text-xs">BDC</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Issue queue, held PRs, approval, and One L1fe ship lane.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generateSubmissionLink}>
              <Copy className="mr-2 h-4 w-4" /> Generate submission link
            </Button>
            <Button size="sm" onClick={() => pollMutation.mutate()} disabled={pollMutation.isPending}>
              {pollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {(!dbConnected || !githubConnected || envStatus?.openrouterKeySet === false) && (
          <div className="mb-6 grid gap-3">
            {envStatus?.openrouterKeySet === false && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-rose-600">OpenRouter not connected</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The OpenRouter server key is missing. BDC can collect ideas, but the engine cannot create held PRs.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!githubConnected && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-rose-600">GitHub not connected</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{data?.githubError ?? "Set GITHUB_TOKEN."}</p>
                  </div>
                </div>
              </div>
            )}
            {!dbConnected && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-amber-600">DB not connected</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      DATABASE_URL is missing or unavailable. Run data uses in-memory fallback for this server process.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {dashboard.isLoading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading cockpit data...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex h-[460px] flex-col lg:col-span-2">
              <CardHeader className="border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Queue</CardTitle>
                    <CardDescription className="text-xs">Live issues from gzug/01-One-L1fe</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{queue.length} Items</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {queue.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No BDC submissions.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/30">
                      <TableRow>
                        <TableHead className="w-20 text-xs">Issue</TableHead>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="w-24 text-xs">Type</TableHead>
                        <TableHead className="w-28 text-xs">Status</TableHead>
                        <TableHead className="w-20 text-xs">PR</TableHead>
                        <TableHead className="w-64 text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queue.map((idea: any) => (
                        <TableRow key={idea.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">
                            <a href={idea.issueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                              #{idea.id} <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell className="max-w-[320px] truncate text-xs font-medium" title={idea.title}>
                            {idea.title}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">{idea.intent}</TableCell>
                          <TableCell>{statusBadge(idea.status)}</TableCell>
                          <TableCell className="text-xs">
                            {idea.prNumber && idea.prUrl ? (
                              <a href={idea.prUrl} target="_blank" rel="noreferrer" className="underline">
                                #{idea.prNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {idea.status === "sent" && idea.prNumber && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approveMutation.mutate({ issueNumber: idea.id, prNumber: idea.prNumber })}
                                    disabled={approveMutation.isPending}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => requestChangesMutation.mutate({ issueNumber: idea.id, prNumber: idea.prNumber })}
                                    disabled={requestChangesMutation.isPending}
                                  >
                                    Request Changes
                                  </Button>
                                </>
                              )}
                              {idea.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markLiveMutation.mutate(idea.id)}
                                  disabled={markLiveMutation.isPending}
                                >
                                  Mark Live
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="flex h-[420px] flex-col lg:col-span-2">
              <CardHeader className="border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Run Log</CardTitle>
                    <CardDescription className="text-xs">Engine execution and PR creation</CardDescription>
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
                    <TableHeader className="sticky top-0 z-10 bg-muted/30">
                      <TableRow>
                        <TableHead className="w-20 text-xs">Issue</TableHead>
                        <TableHead className="w-16 text-xs">Tier</TableHead>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="w-24 text-xs">Tokens</TableHead>
                        <TableHead className="w-24 text-xs">Cost</TableHead>
                        <TableHead className="w-24 text-xs">Status</TableHead>
                        <TableHead className="w-24 text-xs">PR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runsList.map((run: any) => (
                        <TableRow key={run.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">#{run.issueNumber}</TableCell>
                          <TableCell className="text-xs uppercase text-muted-foreground">{run.tier || "-"}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs" title={run.model || ""}>
                            {run.model || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {run.tokensPrompt != null && run.tokensCompletion != null
                              ? `${run.tokensPrompt}+${run.tokensCompletion}`
                              : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatCost(run.costUsd)}</TableCell>
                          <TableCell>{statusBadge(run.status)}</TableCell>
                          <TableCell className="text-xs">
                            {run.githubPrNumber ? (
                              <a
                                href={`https://github.com/gzug/01-One-L1fe/pull/${run.githubPrNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                #{run.githubPrNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-base font-semibold">Costs</CardTitle>
                <CardDescription className="text-xs">Aggregate model spend from recorded runs</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-sm">
                Total recorded spend: <span className="font-mono font-semibold">{formatCost(totalCost)}</span>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
