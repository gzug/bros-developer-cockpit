import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { getOwnerKpis } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/owner-kpi")({
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
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Owner KPI</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Overview from GitHub Issues and engine comments.
        </p>

        {query.data && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Total ideas" value={query.data.totalIdeas} />
            <Stat label="Live" value={query.data.liveCount} />
            <Stat label="Blocked" value={query.data.blockedCount} />
            <Stat label="Sent" value={query.data.sentCount} />
            <Stat label="Open" value={query.data.submittedCount} />
            <Stat label="Closed" value={query.data.closedCount} />
            <Stat label="Total cost" value={`$${query.data.totalCostUsd.toFixed(4)}`} />
          </div>
        )}
      </main>
    </div>
  );
}
