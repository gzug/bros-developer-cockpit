import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDoneIdeaEntries } from "@/lib/ideas.functions";
import { getIdeaDisplay } from "@/lib/idea-status";
import { DataStateMessage } from "@/components/DataStateMessage";
import { getUiDataState } from "@/lib/ui-data-state";

export const Route = createFileRoute("/_authenticated/done")({
  component: DonePage,
});

function dateOnly(value?: string) {
  if (!value) return "Unknown date";
  return value.slice(0, 10);
}

function DonePage() {
  const done = useQuery({
    queryKey: ["done-ideas"],
    queryFn: () => listDoneIdeaEntries(),
  });
  const groups = done.data ?? [];
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const doneState = getUiDataState({
    status: done.status,
    hasData: done.data != null,
    hasItems: groups.length > 0,
    isFetching: done.isFetching,
  });
  const visibleGroups = doneState === "success" || doneState === "stale" ? groups : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Done</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed ideas, grouped by area. {total} done so far.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pipeline">Plan</Link>
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          <DataStateMessage
            state={doneState}
            loading="Loading done ideas..."
            error="Done ideas could not be loaded. Try again."
            empty="No done ideas yet. Once something is completed, it stays visible here as history."
            onRetry={() => void done.refetch()}
          />
          {visibleGroups.map((group) => (
            <details key={group.category} className="rounded-md border border-border bg-card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                <span className="text-sm font-semibold">{group.label}</span>
                <Badge variant="secondary">{group.count}</Badge>
              </summary>
              <div className="mt-3 space-y-2">
                {group.ideas.map((idea) => {
                  const display = getIdeaDisplay({
                    status: idea.status,
                    statusSummary: idea.statusSummary,
                    doneCategory: idea.doneCategory,
                  });
                  return (
                    <Link
                      key={idea.id}
                      to="/idea/$id"
                      params={{ id: String(idea.id) }}
                      aria-label={`Open done idea ${idea.title}. Status: ${display.label}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      <span className="min-w-0 truncate font-medium">{idea.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {display.label} · {dateOnly(idea.closedAt)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
