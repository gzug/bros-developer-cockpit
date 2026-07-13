import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getIdeaEntry, processContribution } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/idea/$id")({
  component: IdeaPage,
});

const STATUS_TEXT = {
  submitted: "Submitted",
  sent: "PR waiting for owner approval",
  approved: "Approved to ship",
  live: "Confirmed live",
  blocked: "Needs manual review",
  closed: "Closed",
} as const;

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
      toast.success("Pipeline started.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not start.");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← back
        </Link>

        {idea.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {idea.data && (
          <>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{idea.data.title}</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current status: {STATUS_TEXT[idea.data.status]}
                </p>
              </div>
              {idea.data.status === "submitted" && (
                <Button size="sm" onClick={() => process.mutate()} disabled={process.isPending}>
                  {process.isPending ? "Starting…" : "Create PR"}
                </Button>
              )}
            </div>
            {idea.data.status === "sent" && (
              <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                A PR exists. OL1 merge and OTA still need owner approval.
              </p>
            )}
            {idea.data.status === "approved" && (
              <p className="mt-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm text-muted-foreground">
                Approved to ship. Waiting for confirmed OL1 delivery.
              </p>
            )}
            {idea.data.status === "live" && (
              <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
                Confirmed live in OL1.
              </p>
            )}

            <section className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Description</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{idea.data.description}</p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Category</div>
                  <p className="mt-1">{idea.data.intent}</p>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Issue</div>
                  <a href={idea.data.issueUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
                    #{idea.data.id} on GitHub
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
