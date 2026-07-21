import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DcStatusBadge } from "@/components/DcStatusBadge";
import { PublishingTrustNotice } from "@/components/PublishingTrustNotice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approvePrFn,
  markLiveFn,
  pollNewBdcIssuesFn,
  processContribution,
  requestChangesFn,
} from "@/lib/ideas.functions";
import { getDb } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { listMemoryRuns } from "@/lib/db/runs.server";
import { formatDcCost } from "@/lib/dc-display";
import type { DCIdea } from "@/lib/github-issues.server";
import type { RunRow } from "@/lib/runs.functions";
import { desc } from "drizzle-orm";
import { DataStateMessage } from "@/components/DataStateMessage";
import { getUiDataState } from "@/lib/ui-data-state";

type DcDashboardData = {
  envStatus: {
    githubTokenSet: boolean;
    openrouterKeySet: boolean;
    bdcPaused: boolean;
  };
  githubConnected: boolean;
  githubError: string | null;
  dbConnected: boolean;
  queue: DCIdea[];
  runs: RunRow[];
};

export const getDcDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DcDashboardData> => {
    const { requireOwner } = await import("@/lib/auth-session.server");
    requireOwner();

    const envStatus = {
      githubTokenSet: Boolean(process.env.GITHUB_TOKEN),
      openrouterKeySet: Boolean(process.env.OPENROUTER_API_KEY),
      bdcPaused: process.env.BDC_PAUSED?.trim().toLowerCase() !== "false",
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
        runs: listMemoryRuns()
          .slice(0, 100)
          .map((run) => ({
            ...run,
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt?.toISOString() ?? null,
          })),
      };
    }

    try {
      const runsData = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100);

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
      };
    } catch (error) {
      console.error("[db] getDcDashboardData query failed:", error);
      return {
        envStatus,
        githubConnected,
        githubError,
        dbConnected: false,
        queue,
        runs: listMemoryRuns()
          .slice(0, 100)
          .map((run) => ({
            ...run,
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt?.toISOString() ?? null,
          })),
      };
    }
  },
);

export const Route = createFileRoute("/_authenticated/dc")({
  beforeLoad: async () => {
    const { checkAuth } = await import("@/lib/auth.server");
    const auth = await checkAuth();
    if (auth.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: DcOperationalDashboard,
});

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
      if (result.claimed > 0)
        toast.success(`Processed ${result.claimed} new issue${result.claimed === 1 ? "" : "s"}.`);
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

  const processMutation = useMutation({
    mutationFn: (id: number) => processContribution({ data: { id } }),
    onSuccess: (result) => {
      if (result.ok)
        toast.success(`Prepared review #${result.prNumber} is ready for owner review.`);
      else toast.error(result.reason);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Processing failed."),
  });

  const requestChangesMutation = useMutation({
    mutationFn: (input: { issueNumber: number; prNumber: number }) =>
      requestChangesFn({ data: input }),
    onSuccess: () => {
      toast.success("Changes requested.");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Request changes failed."),
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
  const dashboardState = getUiDataState({
    status: dashboard.status,
    hasData: data != null,
    isFetching: dashboard.isFetching,
  });
  const showDashboard = dashboardState === "success" || dashboardState === "stale";
  const showConnectionWarnings =
    !dbConnected ||
    !githubConnected ||
    envStatus?.openrouterKeySet === false ||
    envStatus?.bdcPaused;
  const totalCost = runsList.reduce((sum, run) => sum + parseFloat(run.costUsd || "0"), 0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-12 text-foreground">
      <AppHeader />
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Owner control</h1>
              <Badge variant="outline" className="text-xs">
                safely paused
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Don checks collected ideas, prepared review links, and the final owner-controlled step
              here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generateSubmissionLink}>
              <Copy className="mr-2 h-4 w-4" /> Copy idea link
            </Button>
            <Button
              size="sm"
              onClick={() => pollMutation.mutate()}
              disabled={pollMutation.isPending}
            >
              {pollMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {showDashboard && showConnectionWarnings && (
          <div className="mb-6 grid gap-3">
            {envStatus?.bdcPaused && <PublishingTrustNotice />}
            {envStatus?.openrouterKeySet === false && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-rose-600">
                      AI help is not connected
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The OpenRouter key is missing. The cockpit can collect ideas, but cannot
                      refine or prepare suggestions.
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
                    <h2 className="text-sm font-semibold text-rose-600">GitHub is not connected</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data?.githubError ?? "Set GITHUB_TOKEN."}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!dbConnected && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-amber-600">
                      Database is not connected
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Run data stays visible only in this server process memory.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!showDashboard ? (
          <div className="mt-6">
            <DataStateMessage
              state={dashboardState}
              loading="Loading cockpit data..."
              error="The owner control data could not be loaded. Try again."
              onRetry={() => void dashboard.refetch()}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex h-[460px] min-w-0 flex-col lg:col-span-2">
              <CardHeader className="border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Ideas and tasks</CardTitle>
                    <CardDescription className="text-xs">
                      Collected, checking, ready for owner, approved, blocked, and waiting on owner
                      are working states, not publication.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {queue.length} entries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                {queue.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No ideas collected yet. Once someone submits one, it appears here.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/30">
                      <TableRow>
                        <TableHead className="w-20 text-xs">Issue</TableHead>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="w-24 text-xs">Type</TableHead>
                        <TableHead className="w-28 text-xs">Status</TableHead>
                        <TableHead className="w-20 text-xs">Review</TableHead>
                        <TableHead className="w-64 text-xs text-right">Next step</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queue.map((idea) => (
                        <TableRow key={idea.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">
                            <a
                              href={idea.issueUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 underline"
                            >
                              #{idea.id} <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell
                            className="max-w-[320px] truncate text-xs font-medium"
                            title={idea.title}
                          >
                            {idea.title}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {idea.intent}
                          </TableCell>
                          <TableCell>
                            <DcStatusBadge status={idea.status} />
                          </TableCell>
                          <TableCell className="text-xs">
                            {idea.prNumber && idea.prUrl ? (
                              <a
                                href={idea.prUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                #{idea.prNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {(idea.status === "submitted" ||
                                idea.status === "requested" ||
                                idea.status === "processing") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => processMutation.mutate(idea.id)}
                                  disabled={
                                    envStatus?.bdcPaused !== false || processMutation.isPending
                                  }
                                >
                                  {idea.status === "processing" ? "Check again" : "Check"}
                                </Button>
                              )}
                              {(idea.status === "sent" ||
                                (idea.status === "blocked" && !idea.prMerged)) &&
                                idea.prNumber && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        approveMutation.mutate({
                                          issueNumber: idea.id,
                                          prNumber: idea.prNumber!,
                                        })
                                      }
                                      disabled={
                                        envStatus?.bdcPaused !== false || approveMutation.isPending
                                      }
                                    >
                                      {idea.status === "blocked"
                                        ? "Check approval again"
                                        : "Approve"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        requestChangesMutation.mutate({
                                          issueNumber: idea.id,
                                          prNumber: idea.prNumber!,
                                        })
                                      }
                                      disabled={requestChangesMutation.isPending}
                                    >
                                      Request changes
                                    </Button>
                                  </>
                                )}
                              {idea.status === "blocked" && idea.prMerged && (
                                <span className="self-center text-xs text-muted-foreground">
                                  Check publication manually
                                </span>
                              )}
                              {idea.status === "blocked" && !idea.prNumber && (
                                <span className="self-center text-xs text-muted-foreground">
                                  Manual check needed
                                </span>
                              )}
                              {idea.status === "shipped" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markLiveMutation.mutate(idea.id)}
                                  disabled={markLiveMutation.isPending}
                                >
                                  Confirm on phone
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
                    <CardTitle className="text-base font-semibold">Prep log</CardTitle>
                    <CardDescription className="text-xs">
                      What the cockpit prepared and whether errors happened.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {runsList.length} runs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {runsList.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No preparation log recorded yet.
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
                        <TableHead className="w-24 text-xs">Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runsList.map((run) => (
                        <TableRow key={run.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">#{run.issueNumber}</TableCell>
                          <TableCell className="text-xs uppercase text-muted-foreground">
                            {run.tier || "-"}
                          </TableCell>
                          <TableCell
                            className="max-w-[220px] truncate text-xs"
                            title={run.model || ""}
                          >
                            {run.model || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {run.tokensPrompt != null && run.tokensCompletion != null
                              ? `${run.tokensPrompt}+${run.tokensCompletion}`
                              : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatDcCost(run.costUsd)}
                          </TableCell>
                          <TableCell>
                            <DcStatusBadge status={run.status} />
                          </TableCell>
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
                <CardDescription className="text-xs">Total from recorded AI runs</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-sm">
                Total recorded cost:{" "}
                <span className="font-mono font-semibold">{formatDcCost(totalCost)}</span>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
