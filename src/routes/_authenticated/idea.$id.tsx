import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { IdeaStatusTimeline } from "@/components/IdeaStatusTimeline";
import { getIdeaStatusLabel } from "@/lib/idea-status";
import { getIdeaEntry } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/idea/$id")({
  component: IdeaPage,
});

function IdeaPage() {
  const { id } = Route.useParams();
  const ideaId = Number(id);
  const idea = useQuery({
    queryKey: ["idea", ideaId],
    queryFn: () => getIdeaEntry({ data: { id: ideaId } }),
    refetchInterval: 15_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← back
        </Link>

        {idea.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {idea.isError && (
          <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
            This wish could not be loaded. Please try again.
          </div>
        )}
        {idea.data && (
          <>
            <div className="mt-3">
              <h1 className="text-xl font-semibold">{idea.data.title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Current status: {getIdeaStatusLabel(idea.data.status)}
              </p>
            </div>
            <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {idea.data.statusSummary}
            </p>

            <section className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Description</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{idea.data.description}</p>
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase text-muted-foreground">Category</div>
                <p className="mt-1">{idea.data.intent}</p>
              </div>
              {idea.data.needsHelp && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  This needs Don's help before it can continue.
                </div>
              )}
            </section>

            <div className="mt-6">
              <IdeaStatusTimeline status={idea.data.status} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
