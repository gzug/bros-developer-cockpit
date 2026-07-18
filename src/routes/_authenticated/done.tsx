import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDoneIdeaEntries } from "@/lib/ideas.functions";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Completed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Finished ideas, grouped by category. {total} done so far.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pipeline">Pipeline</Link>
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {done.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!done.isLoading && groups.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No completed ideas yet.
            </div>
          )}
          {groups.map((group) => (
            <details key={group.category} className="rounded-md border border-border bg-card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-sm font-semibold">{group.label}</span>
                <Badge variant="secondary">{group.count}</Badge>
              </summary>
              <div className="mt-3 space-y-2">
                {group.ideas.map((idea) => (
                  <a
                    key={idea.id}
                    href={idea.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm hover:bg-muted/40"
                  >
                    <span className="min-w-0 truncate font-medium">{idea.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateOnly(idea.closedAt)}</span>
                  </a>
                ))}
              </div>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
