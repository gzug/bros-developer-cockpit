import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { getOwnerKpis } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/owner-kpi")({
  component: OwnerKpiPage,
});

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value ?? "—"}</div>
    </div>
  );
}

function MapTable({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 font-mono text-xs">{k}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtUsd(v: number): string {
  return `$${v.toFixed(v < 0.1 ? 4 : 2)}`;
}

function ModelUsageTable({
  data,
}: {
  data: Record<string, { requests: number; tokens: number; costUsd: number }>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1].costUsd - a[1].costUsd);
  if (entries.length === 0) return null;
  const maxCost = Math.max(...entries.map(([, v]) => v.costUsd), 0.000001);
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
        Usage by model
      </h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">Model</th>
              <th className="px-3 py-1.5 text-right font-medium">Requests</th>
              <th className="px-3 py-1.5 text-right font-medium">Tokens</th>
              <th className="px-3 py-1.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([model, v]) => (
              <tr key={model} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5">
                  <div className="font-mono text-xs">{model}</div>
                  <div className="mt-1 h-1 w-full rounded bg-muted">
                    <div
                      className="h-1 rounded bg-primary"
                      style={{ width: `${Math.max(2, (v.costUsd / maxCost) * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v.requests}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v.tokens.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtUsd(v.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JudgeSection({
  ok,
  risky,
  coverage,
  recentFlags,
}: {
  ok: number;
  risky: number;
  coverage: number;
  recentFlags: Array<{ reqId: string | null; reason: string | null; prUrl: string | null }>;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
        Post-PR Judge (tier0 sanity check)
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Nach jedem erfolgreichen PR prueft ein Billig-Model, ob die Aenderung zur Wish passt.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Bewertet" value={coverage} />
        <Stat label="OK" value={ok} />
        <Stat label="Risky" value={risky} />
      </div>
      {recentFlags.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-50/30 p-3 dark:bg-amber-900/10">
          <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            Letzte &ldquo;risky&rdquo;-Flags
          </p>
          <ul className="space-y-1">
            {recentFlags.map((f, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono text-muted-foreground">{f.reqId ?? "?"}</span>
                {" — "}
                {f.reason}
                {f.prUrl && (
                  <>
                    {" "}
                    <a
                      href={f.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      PR
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WhatIfTable({
  actual,
  scenarios,
}: {
  actual: number;
  scenarios: Array<{ tier: string; model: string; costUsd: number }>;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
        Routing what-if
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Gleiches Tokenvolumen, gerechnet mit Live-Preisen: was es gekostet hätte, wenn ALLE Runs
        auf einem Model gepinnt gewesen wären. Vergleich gegen das echte Routing.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border bg-muted/40">
              <td className="px-3 py-1.5 font-medium">Echt (geroutet)</td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fmtUsd(actual)}</td>
              <td className="px-3 py-1.5" />
            </tr>
            {scenarios.map((s) => {
              const delta = s.costUsd - actual;
              return (
                <tr key={s.tier} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">Alles {s.tier}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{s.model}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtUsd(s.costUsd)}</td>
                  <td
                    className={`px-3 py-1.5 text-right text-xs tabular-nums ${
                      delta > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {fmtUsd(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnerKpiPage() {
  const q = useQuery({
    queryKey: ["owner-kpi"],
    queryFn: () => getOwnerKpis(),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          &larr; Dashboard
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Owner KPIs</h1>
        <p className="mt-1 text-xs text-muted-foreground">Engine-Statistik aus task_log. Nur du siehst das.</p>

        {q.isLoading && <p className="mt-4 text-sm text-muted-foreground">Lade...</p>}

        {q.data && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Total Ideas" value={q.data.totalIdeas} />
              <Stat label="Engine Runs" value={q.data.totalTasks} />
              <Stat label="Success Rate" value={q.data.successRate != null ? `${q.data.successRate}%` : null} />
              <Stat label="Rework-free" value={q.data.reworkFreeRate != null ? `${q.data.reworkFreeRate}%` : null} />
              <Stat label="Shipped" value={q.data.shippedCount} />
              <Stat label="Reverted" value={q.data.revertedCount} />
              <Stat label="Escalated" value={q.data.escalated} />
              <Stat label="Total Spend" value={fmtUsd(q.data.totalCostUsd)} />
              <Stat label="Prompt Tokens" value={q.data.totalTokensPrompt.toLocaleString()} />
              <Stat label="Completion Tokens" value={q.data.totalTokensCompletion.toLocaleString()} />
            </div>

            <ModelUsageTable data={q.data.modelUsage} />
            {q.data.whatIf && (
              <WhatIfTable actual={q.data.totalCostUsd} scenarios={q.data.whatIf} />
            )}
            <JudgeSection
              ok={q.data.judgeOk}
              risky={q.data.judgeRisky}
              coverage={q.data.judgeCoverage}
              recentFlags={q.data.recentRiskyFlags}
            />
            <MapTable data={q.data.tierCounts} label="Runs per Tier" />
            <MapTable data={q.data.intentCounts} label="Intents" />
          </div>
        )}
      </main>
    </div>
  );
}
