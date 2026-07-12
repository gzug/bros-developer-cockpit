import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getIdeaEntry, processContribution } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/idea/$id")({
  component: IdeaPage,
});

function IdeaPage() {
  const { id } = Route.useParams();
  const ideaId = Number(id);
  const queryClient = useQueryClient();

  const idea = useQuery({
    queryKey: ["idea", ideaId],
    queryFn: () => getIdeaEntry({ data: { id: ideaId } }),
    refetchInterval: 15_000,
  });

  const process = useMutation({
    mutationFn: () => processContribution({ data: { id: ideaId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["idea", ideaId] });
      await queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Ablauf gestartet.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Konnte nicht starten.");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← zurück
        </Link>

        {idea.isLoading && <p className="mt-4 text-sm text-muted-foreground">Lade…</p>}
        {idea.data && (
          <>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{idea.data.title}</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: {idea.data.status}
                </p>
              </div>
              {idea.data.status === "submitted" && (
                <Button size="sm" onClick={() => process.mutate()} disabled={process.isPending}>
                  {process.isPending ? "Starte…" : "Jetzt losschicken"}
                </Button>
              )}
            </div>

            <section className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Beschreibung</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{idea.data.description}</p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Kategorie</div>
                  <p className="mt-1">{idea.data.intent}</p>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Issue</div>
                  <a href={idea.data.issueUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
                    #{idea.data.id} auf GitHub
                  </a>
                </div>
              </div>
              {idea.data.prUrl && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Pull Request</div>
                  <a href={idea.data.prUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
                    PR #{idea.data.prNumber}
                  </a>
                </div>
              )}
              {idea.data.blockReason && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  {idea.data.blockReason}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
