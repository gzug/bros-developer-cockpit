import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  getIdeaActivityEntry,
  getIdeaEntry,
  processContribution,
  updateIdeaStatusEntry,
} from "@/lib/ideas.functions";

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
  const activity = useQuery({
    queryKey: ["idea-activity", ideaId],
    queryFn: () => getIdeaActivityEntry({ data: { id: ideaId } }),
    refetchInterval: 15_000,
  });

  const process = useMutation({
    mutationFn: () => processContribution({ data: { id: ideaId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["idea", ideaId] });
      await queryClient.invalidateQueries({ queryKey: ["idea-activity", ideaId] });
      await queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Pipeline started.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not start.");
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: "approved" | "live" | "blocked") => updateIdeaStatusEntry({ data: { id: ideaId, status } }),
    onSuccess: async (_, status) => {
      await queryClient.invalidateQueries({ queryKey: ["idea", ideaId] });
      await queryClient.invalidateQueries({ queryKey: ["idea-activity", ideaId] });
      await queryClient.invalidateQueries({ queryKey: ["ideas"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-kpi"] });
      const message =
        status === "approved"
          ? "Marked approved to ship."
          : status === "live"
            ? "Marked confirmed live."
            : "Returned to manual review.";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update status.");
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
            <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {idea.data.statusSummary}
            </p>

            <section className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
              {(idea.data.status === "sent" || idea.data.status === "approved") && (
                <div className="flex flex-wrap gap-2">
                  {idea.data.status === "sent" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate("approved")}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending ? "Saving…" : "Approve to ship"}
                    </Button>
                  )}
                  {idea.data.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate("live")}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending ? "Saving…" : "Confirm live after ship"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus.mutate("blocked")}
                    disabled={updateStatus.isPending}
                  >
                    Return to review
                  </Button>
                </div>
              )}
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
              <div>
                <div className="text-xs uppercase text-muted-foreground">Recent activity</div>
                {activity.isLoading && <p className="mt-1 text-sm text-muted-foreground">Loading…</p>}
                {activity.data?.length ? (
                  <div className="mt-2 space-y-2">
                    {activity.data.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                        <p className="whitespace-pre-wrap">{entry.body}</p>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-muted-foreground underline"
                        >
                          {new Date(entry.createdAt).toLocaleString("en-AU")}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No comments yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
