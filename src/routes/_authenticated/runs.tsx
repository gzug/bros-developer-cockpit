import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { listRunsData, type RunRow, type TaskRow } from "@/lib/runs.functions";

export const Route = createFileRoute("/_authenticated/runs")({
  beforeLoad: async () => {
    const { checkAuth } = await import("@/lib/auth.server");
    const auth = await checkAuth();
    if (auth.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: RunsPage,
});

const TASK_STATUS_CLASS: Record<string, string> = {
  queued: "bg-zinc-500",
  sent: "bg-amber-500",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
  blocked: "bg-rose-500",
};

const RUN_STATUS_CLASS: Record<string, string> = {
  started: "bg-amber-500",
  running: "bg-sky-500",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
  blocked: "bg-zinc-500",
};

function dot(cls: string) {
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function usd(val: string | null) {
  if (!val) return "n/a";
  const n = parseFloat(val);
  return n < 0.0001 ? "<$0.0001" : `$${n.toFixed(4)}`;
}

function TaskCard({ task, runs }: { task: TaskRow; runs: RunRow[] }) {
  const taskRuns = runs.filter((r) => r.issueNumber === task.issueNumber);
  const totalCost = taskRuns.reduce((s, r) => s + (r.costUsd ? parseFloat(r.costUsd) : 0), 0);
  const latestRun = taskRuns[0];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {dot(TASK_STATUS_CLASS[task.status] ?? "bg-zinc-400")}
          <span className="text-sm font-medium truncate">{task.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase">{task.intent}</span>
          <span>#{task.issueNumber}</span>
        </div>
      </div>

      {latestRun?.githubPrNumber && (
        <a
          href={`https://github.com/gzug/01-One-L1fe/pull/${latestRun.githubPrNumber}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          PR #{latestRun.githubPrNumber} &gt;
        </a>
      )}

      {taskRuns.length > 0 && (
        <div className="space-y-1">
          {taskRuns.map((run) => (
            <div key={run.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {dot(RUN_STATUS_CLASS[run.status] ?? "bg-zinc-400")}
              <span className="font-mono">{run.tier ?? "n/a"}</span>
              <span className="truncate">{run.model ?? "n/a"}</span>
              <span className="ml-auto shrink-0">{usd(run.costUsd)}</span>
            </div>
          ))}
          {totalCost > 0 && (
            <div className="text-right text-xs text-muted-foreground">
              Total: <span className="font-medium text-foreground">${totalCost.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}

      {latestRun?.error && (
        <p className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-400 break-words">
          {latestRun.error}
        </p>
      )}
    </div>
  );
}

function RunsPage() {
  const data = useQuery({
    queryKey: ["runs"],
    queryFn: () => listRunsData(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Check runs</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Visible for Don: which idea was prepared, with what result, and at what cost.
        </p>

        <div className="mt-6 space-y-3">
          {data.isLoading && (
            <>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </>
          )}

          {data.isSuccess && data.data.tasks.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No check runs yet. They appear once Don prepares a collected idea.
            </p>
          )}

          {data.isSuccess &&
            data.data.tasks.map((task) => (
              <TaskCard key={task.issueNumber} task={task} runs={data.data.runs} />
            ))}
        </div>
      </main>
    </div>
  );
}
