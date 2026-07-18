import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getOwnerKpis } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/owner-kpi")({
  beforeLoad: async () => {
    const { checkAuth } = await import("@/lib/auth.server");
    const auth = await checkAuth();
    if (auth.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: OwnerKpiPage,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function OwnerKpiPage() {
  const query = useQuery({
    queryKey: ["owner-kpi"],
    queryFn: () => getOwnerKpis(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <Link
          to="/dashboard"
          className="rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          ← Ideas
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Status</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Quick overview of what is collected, checking, checked, ready, paused, published, or live
          confirmed.
        </p>

        {query.isLoading && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </div>
        )}

        {query.data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="All ideas" value={query.data.totalIdeas} />
              <Stat label="Live confirmed" value={query.data.liveCount} />
              <Stat label="Checked" value={query.data.approvedCount} />
              <Stat label="Published" value={query.data.shippedCount} />
              <Stat label="Paused" value={query.data.blockedCount} />
              <Stat label="Ready" value={query.data.sentCount} />
              <Stat label="Waiting on owner" value={query.data.requestedCount} />
              <Stat label="Collected" value={query.data.submittedCount} />
              <Stat label="Done" value={query.data.closedCount} />
              <Stat label="Total cost" value={`$${query.data.totalCostUsd.toFixed(4)}`} />
            </div>

            <section className="mt-6 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Needs owner</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Published entries need a phone check. Ready and waiting entries need a deliberate
                decision. Paused entries need a manual check.
              </p>

              {query.data.actionQueue.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing is waiting on the owner lane right now.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {query.data.actionQueue.map((idea) => (
                    <div
                      key={idea.id}
                      className="rounded-md border border-border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to="/idea/$id"
                            params={{ id: String(idea.id) }}
                            className="block truncate rounded text-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            #{idea.id} {idea.title}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">{idea.statusSummary}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[11px] uppercase text-muted-foreground">
                          {idea.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <a
                          href={idea.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open task #${idea.id} on GitHub (opens in a new tab)`}
                          className="rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Task
                        </a>
                        {idea.prUrl && (
                          <a
                            href={idea.prUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open review #${idea.prNumber} (opens in a new tab)`}
                            className="rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            Review #{idea.prNumber}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
