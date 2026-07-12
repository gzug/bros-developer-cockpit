import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getContribution,
  refreshContributionStatus,
  processContribution,
} from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/idea/$id")({
  component: IdeaPage,
});

const STEPS = [
  { key: "sent", label: "Abgeschickt" },
  { key: "reviewing", label: "Wird angeguckt" },
  { key: "live", label: "In der App drin" },
] as const;

function currentStepIndex(status: string): number {
  if (status === "live") return 2;
  if (status === "reviewing") return 1;
  if (status === "sent") return 0;
  if (status === "reverted") return 2;
  return -1;
}

function IdeaPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["contribution", id],
    queryFn: () => getContribution({ data: { id } }),
    refetchInterval: 15_000,
  });

  // When the idea is still 'generating', kick the engine exactly once. The
  // engine call is long-running; on completion we refetch to show the result.
  const engineStarted = useRef(false);
  const process = useMutation({
    mutationFn: () => processContribution({ data: { id } }),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["contribution", id] });
      await qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Engine-Fehler."),
  });
  useEffect(() => {
    if (
      q.data?.status === "generating" &&
      !engineStarted.current &&
      !process.isPending
    ) {
      engineStarted.current = true;
      process.mutate();
    }
  }, [q.data?.status, process]);

  const refresh = useMutation({
    mutationFn: () => refreshContributionStatus({ data: { id } }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["contribution", id] });
      await qc.invalidateQueries({ queryKey: ["contributions"] });
      if (r.changed) toast.success("Neuer Stand.");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Konnte nicht auffrischen."),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link
          to="/dashboard"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← zurück
        </Link>

        {q.isLoading && <p className="mt-4 text-sm">Lade…</p>}
        {q.isError && (
          <p className="mt-4 text-sm text-destructive">
            {String((q.error as Error)?.message ?? q.error)}
          </p>
        )}

        {q.data && (
          <>
            <h1 className="mt-3 text-xl font-semibold">{q.data.title}</h1>

            {/* Timeline for sent items */}
            {["sent", "reviewing", "live", "reverted"].includes(q.data.status) && (
              <div className="mt-6">
                <ol className="flex items-center gap-2">
                  {STEPS.map((step, idx) => {
                    const done = idx <= currentStepIndex(q.data.status);
                    const isReverted =
                      q.data.status === "reverted" && idx === 2;
                    return (
                      <li key={step.key} className="flex flex-1 items-center gap-2">
                        <span
                          className={
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium " +
                            (isReverted
                              ? "bg-muted text-muted-foreground"
                              : done
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground")
                          }
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={
                            "text-xs " +
                            (done && !isReverted
                              ? "text-foreground"
                              : "text-muted-foreground")
                          }
                        >
                          {isReverted ? "Wieder zurückgenommen" : step.label}
                        </span>
                        {idx < STEPS.length - 1 && (
                          <span className="h-px flex-1 bg-border" />
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refresh.mutate()}
                    disabled={refresh.isPending}
                  >
                    {refresh.isPending ? "Prüfe…" : "Stand auffrischen"}
                  </Button>
                </div>
              </div>
            )}

            {/* Generating — engine is building the change */}
            {q.data.status === "generating" && (
              <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <p className="font-medium">Ich baue das gerade…</p>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Das dauert einen Moment. Die Seite aktualisiert sich von selbst,
                  sobald es fertig ist.
                </p>
              </div>
            )}

            {/* Saved / blocked */}
            {(q.data.status === "saved" || q.data.status === "blocked") && (
              <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
                <p className="font-medium">Für deinen Bruder gespeichert.</p>
                {q.data.block_reason && (
                  <p className="mt-2 text-muted-foreground">
                    {q.data.block_reason}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Er kriegt eine Info und meldet sich, sobald er drüber geguckt hat.
                </p>
              </div>
            )}

            {q.data.status === "failed" && q.data.error_message && (
              <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                Konnte nicht abgeschickt werden: {q.data.error_message}
              </div>
            )}

            <section className="mt-8 space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Wo</div>
                <div>{q.data.screen}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Passt nicht
                </div>
                <div className="whitespace-pre-wrap">{q.data.wrong}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Soll sein
                </div>
                <div className="whitespace-pre-wrap">{q.data.should}</div>
              </div>
              {q.data.body && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Zusatz
                  </div>
                  <div className="whitespace-pre-wrap">{q.data.body}</div>
                </div>
              )}
              {q.data.req_id && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Kennung: {q.data.req_id}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
