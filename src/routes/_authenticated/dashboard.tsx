import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getIdeaStatusDotClass, getIdeaStatusLabel } from "@/lib/idea-status";
import { listIdeaEntries, recentIdeaUsage } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const list = useQuery({
    queryKey: ["ideas"],
    queryFn: () => listIdeaEntries(),
  });
  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: () => recentIdeaUsage(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deine Ideen</h1>
            {usage.isLoading && (
              <p className="mt-1 text-xs text-muted-foreground">Aktivität wird geprüft...</p>
            )}
            {usage.isError && (
              <p className="mt-1 text-xs text-rose-600">Aktivität ist gerade nicht verfügbar.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Tippe eine Idee an, um ihren Stand und den nächsten Schritt zu sehen.
              {usage.data
                ? ` ${usage.data.count} in den letzten ${usage.data.windowHours} Stunden.`
                : ""}
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/chat" search={{}}>
              Neue Idee
            </Link>
          </Button>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">Was ist das?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Das Cockpit sammelt deine Ideen zur One L1fe App und macht daraus klare Aufgaben.
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">Was passiert gerade?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Jeder Eintrag zeigt seinen Stand: gesammelt, wird geprüft, bereit oder live bestätigt.
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">Was ist pausiert?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nichts wird automatisch ausgespielt. Don bleibt die letzte Kontrolle.
            </p>
          </div>
        </section>

        <details className="mt-4 rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">Status kurz erklärt</summary>
          <div className="mt-3 space-y-3 text-xs text-muted-foreground">
            <p>Deine Ideen erscheinen hier zuerst. Neue Einträge stehen oben.</p>
            <p>
              Ein Klick auf eine Idee öffnet die Detailansicht mit Beschreibung, aktuellem Stand und
              dem nächsten sicheren Schritt. Dadurch wird nichts freigegeben oder ausgespielt.
            </p>
            <p>
              Die Begriffe sind absichtlich einfach: gesammelt, geprüft, bereit, pausiert, wartet
              auf Owner.
            </p>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">Gesammelt</span> heißt: Die Idee ist
                da, aber es wurde nichts gebaut oder ausgespielt.
              </li>
              <li>
                <span className="font-medium text-foreground">Wartet auf Owner</span> heißt: Don
                muss bewusst prüfen, starten oder freigeben.
              </li>
              <li>
                <span className="font-medium text-foreground">Live bestätigt</span> heißt: Die
                Änderung wurde auf dem Handy gesehen und geprüft.
              </li>
            </ul>
          </div>
        </details>

        <div className="mt-6 space-y-2">
          {list.isLoading && (
            <div role="status" aria-label="Ideen werden geladen">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          )}
          {list.isSuccess && list.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Noch keine Ideen gesammelt. Der Bereich bleibt leer, bis du im Chat eine Idee
              bestätigst oder im Plan eine Idee einträgst.{" "}
              <Link to="/chat" search={{}} className="underline">
                Starte mit einer ersten Idee
              </Link>
              .
            </div>
          )}
          {list.isError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
              Deine Ideen konnten nicht geladen werden.{" "}
              <button type="button" className="underline" onClick={() => list.refetch()}>
                Erneut versuchen
              </button>
              .
            </div>
          )}
          {list.data?.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => router.navigate({ to: "/idea/$id", params: { id: String(idea.id) } })}
              className="flex w-full flex-col rounded-md border border-border bg-card p-3 text-left hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${getIdeaStatusDotClass(idea.status)}`}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium">{idea.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(idea.createdAt).toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </div>
              <span className="mt-1 pl-[18px] text-xs text-muted-foreground">
                {idea.statusSummary || getIdeaStatusLabel(idea.status)}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
