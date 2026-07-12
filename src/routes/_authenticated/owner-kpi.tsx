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
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Owner KPI</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Übersicht aus GitHub-Issues und Engine-Kommentaren.
        </p>

        {query.data && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Ideen gesamt" value={query.data.totalIdeas} />
            <Stat label="Live" value={query.data.liveCount} />
            <Stat label="Blockiert" value={query.data.blockedCount} />
            <Stat label="Gesendet" value={query.data.sentCount} />
            <Stat label="Offen" value={query.data.submittedCount} />
            <Stat label="Geschlossen" value={query.data.closedCount} />
            <Stat label="Kosten gesamt" value={`$${query.data.totalCostUsd.toFixed(4)}`} />
          </div>
        )}
      </main>
    </div>
  );
}
