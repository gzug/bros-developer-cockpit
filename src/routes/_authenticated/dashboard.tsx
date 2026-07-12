import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { listContributions, usageLast5h } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">
      Konnte deine Liste nicht laden: {String((error as Error)?.message ?? error)}
    </div>
  ),
});

const STATUS_TEXT: Record<string, string> = {
  draft: "Wird gerade abgeschickt…",
  sent: "Abgeschickt — wird gelesen",
  reviewing: "Wird gerade angeguckt",
  live: "In der App drin",
  reverted: "Wieder zurückgenommen",
  saved: "Gespeichert — Bruder kümmert sich",
  blocked: "Gespeichert — Bruder guckt drüber",
  failed: "Hat nicht geklappt",
  generating: "Wird gebaut…",
  ready: "Bereit",
  shipping: "Wird gebaut…",
  shipped: "In der App drin",
  blocked_native: "Muss der Bruder von Hand machen",
};

// Traffic light: green = done/in the app, amber = on its way, red = stopped/needs attention.
type Light = "green" | "amber" | "red";
const STATUS_LIGHT: Record<string, Light> = {
  live: "green",
  shipped: "green",
  generating: "amber",
  shipping: "amber",
  sent: "amber",
  reviewing: "amber",
  ready: "amber",
  draft: "amber",
  reverted: "red",
  failed: "red",
  blocked: "red",
  blocked_native: "red",
  saved: "red",
};
const LIGHT_CLASS: Record<Light, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

function StatusDot({ status }: { status: string }) {
  const light = STATUS_LIGHT[status] ?? "amber";
  return (
    <span
      className={"h-2.5 w-2.5 shrink-0 rounded-full " + LIGHT_CLASS[light]}
      aria-hidden
    />
  );
}

function Dashboard() {
  const router = useRouter();
  const list = useQuery({
    queryKey: ["contributions"],
    queryFn: () => listContributions(),
  });
  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageLast5h(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deine Wünsche</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {usage.data?.count ?? 0} Wünsche in den letzten{" "}
              {usage.data?.windowHours ?? 5} Stunden.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/submit">Neu</Link>
          </Button>
        </div>

        <div className="mt-6 space-y-2">
          {list.isLoading && (
            <p className="text-sm text-muted-foreground">Lade…</p>
          )}
          {list.isSuccess && list.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Noch nichts hier. <Link to="/submit" className="underline">Ersten Wunsch schreiben</Link>.
            </div>
          )}
          {list.isSuccess &&
            list.data.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() =>
                  router.navigate({ to: "/idea/$id", params: { id: it.id } })
                }
                className="flex w-full flex-col rounded-md border border-border bg-card p-3 text-left hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusDot status={it.status} />
                    <span className="truncate text-sm font-medium">{it.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(it.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
                <span className="mt-1 pl-[18px] text-xs text-muted-foreground">
                  {STATUS_TEXT[it.status] ?? it.status}
                </span>
              </button>
            ))}
        </div>
      </main>
    </div>
  );
}
