import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ParkingCircle, Rocket, Smartphone, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PublishingTrustNotice } from "@/components/PublishingTrustNotice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import chips from "@/config/suggestion-chips.json";
import {
  createPipelineIdeaEntry,
  deleteIdeaEntry,
  listPipelineEntries,
  updateIdeaDeliveryEntry,
} from "@/lib/ideas.functions";
import type { DCIdea, IdeaDelivery } from "@/lib/github-issues.server";
import { getIdeaDisplay } from "@/lib/idea-status";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

const SHIPPED_STATUSES = new Set<DCIdea["status"]>(["shipped", "live"]);

function isShipped(idea: DCIdea): boolean {
  return SHIPPED_STATUSES.has(idea.status);
}

function chatUrl(params: Record<string, string>) {
  return `/chat?${new URLSearchParams(params).toString()}`;
}

function DeliveryBadge({ delivery }: { delivery: IdeaDelivery }) {
  return delivery === "next-apk" ? (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      <Smartphone className="mr-1 h-3 w-3" aria-hidden="true" /> Next app version
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    >
      OTA
    </Badge>
  );
}

function QueueRow({ idea }: { idea: DCIdea }) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    await queryClient.invalidateQueries({ queryKey: ["ideas"] });
  };

  const remove = useMutation({
    mutationFn: () => deleteIdeaEntry({ data: { id: idea.id } }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete task."),
  });
  const setDelivery = useMutation({
    mutationFn: (delivery: IdeaDelivery) =>
      updateIdeaDeliveryEntry({ data: { id: idea.id, delivery } }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not change category."),
  });

  const nextApk = idea.delivery === "next-apk";
  const display = getIdeaDisplay({
    status: idea.status,
    statusSummary: idea.statusSummary,
    doneCategory: idea.doneCategory,
  });

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{idea.title}</h3>
            <DeliveryBadge delivery={idea.delivery} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.description}</p>
          <p className="mt-2 text-xs font-medium">{display.label}</p>
          <p className="mt-2 text-xs text-muted-foreground">{display.summary}</p>
          {idea.status === "requested" && (
            <p className="mt-2 rounded border border-indigo-500/30 bg-indigo-500/5 p-2 text-xs text-indigo-700 dark:text-indigo-300">
              Waiting on owner means the request is recorded. It is not published and does not move
              forward until Don checks it.
            </p>
          )}
          {nextApk && (
            <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              This change needs a new app version and cannot go straight to the phone. It stays
              collected until Don approves a new version.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label={`Delete ${idea.title}`}
        >
          <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" /> Delete
        </Button>
        {!nextApk && (
          <Button size="sm" asChild>
            <a
              aria-label={`Ask owner about ${idea.title}`}
              href={chatUrl({
                ship: String(idea.id),
                idea: idea.title,
                description: idea.description,
              })}
            >
              <Rocket className="mr-1 h-3 w-3" aria-hidden="true" /> Ask owner
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a
            href={chatUrl({ idea: idea.title, description: idea.description })}
            aria-label={`Discuss ${idea.title}`}
          >
            <MessageCircle className="mr-1 h-3 w-3" aria-hidden="true" /> Discuss
          </a>
        </Button>
        <label className="ml-auto text-xs text-muted-foreground">
          Reroute
          <select
            value={idea.delivery}
            onChange={(event) => setDelivery.mutate(event.target.value as IdeaDelivery)}
            aria-label={`Reroute ${idea.title}`}
            className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="ota">OTA</option>
            <option value="next-apk">Next app version</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Clicks here only change the cockpit status: Discuss opens chat, Ask owner marks the task as
        waiting on owner, Reroute changes the category, and Delete closes the entry. None of these
        buttons publishes the app.
      </p>
    </div>
  );
}

function ShippedRow({ idea }: { idea: DCIdea }) {
  const display = getIdeaDisplay({
    status: idea.status,
    statusSummary: idea.statusSummary,
    doneCategory: idea.doneCategory,
  });

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{idea.title}</h3>
        <Badge variant="secondary">{display.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{display.summary}</p>
    </div>
  );
}

function List({
  title,
  hint,
  ideas,
  empty,
  render,
}: {
  title: string;
  hint: string;
  ideas: DCIdea[];
  empty: string;
  render: (idea: DCIdea) => ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary">{ideas.length}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 space-y-3">
        {ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          ideas.map(render)
        )}
      </div>
    </section>
  );
}

function PipelinePage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const pipeline = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => listPipelineEntries(),
  });
  const createParked = useMutation({
    mutationFn: () => createPipelineIdeaEntry({ data: { title, description } }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success("Idea added.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add idea."),
  });

  const all = [...(pipeline.data?.active ?? []), ...(pipeline.data?.parked ?? [])];
  const shipped = all.filter(isShipped);
  const open = all.filter((idea) => !isShipped(idea));
  const otaQueue = open.filter((idea) => idea.delivery === "ota");
  const nextApk = open.filter((idea) => idea.delivery === "next-apk");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here you see which ideas are only collected, which ones Don needs to check, and what has
            already been published.
          </p>
        </div>

        <details className="mt-5 rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
            How to read the plan
          </summary>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <p>
              The plan is the current list of collected tasks. It shows whether an idea can be
              prepared directly, waits for the next app version, or has already been published.
            </p>
            <p>
              <span className="font-medium text-foreground">Direct to phone:</span> can be prepared
              without a new install, but stays stopped until owner approval.
            </p>
            <p>
              <span className="font-medium text-foreground">Next app version:</span> waits for the
              next full app version and will not appear on the phone before that.
            </p>
            <p>
              <span className="font-medium text-foreground">Ask owner:</span> records the request.
              It does not publish anything. Don keeps final control.
            </p>
            <p>
              Statuses like collected, ready for owner, approved, blocked, and waiting on owner
              always show where the next deliberate step sits.
            </p>
          </div>
        </details>

        <PublishingTrustNotice className="mt-4" />

        <section className="mt-5 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Collect an idea</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            New ideas are collected and sorted. Clicking Collect idea creates an entry in the plan,
            but does not check, approve, or publish anything.
          </p>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Short title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short title"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              What should change
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="One sentence about what should change"
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </label>
          </div>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => createParked.mutate()}
            disabled={createParked.isPending || !title || !description}
          >
            <ParkingCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Collect idea
          </Button>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Suggestions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prepared ideas for the app. Tap one to turn it into clear wording in chat. It is only
            collected after that.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <a
                key={chip.id}
                href={chatUrl({ idea: chip.title, description: chip.sentence })}
                aria-label={`Discuss suggestion ${chip.title}`}
                className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {chip.title}
              </a>
            ))}
          </div>
        </section>

        {pipeline.isLoading && (
          <p className="mt-6 text-sm text-muted-foreground">Loading plan...</p>
        )}

        <List
          title="Direct to phone"
          hint="Small changes that can be prepared. Clicking Ask owner moves them to waiting on owner."
          ideas={otaQueue}
          empty="No directly preparable ideas collected."
          render={(idea) => <QueueRow key={idea.id} idea={idea} />}
        />

        <List
          title="Next app version"
          hint="Larger changes that need a new install. They stay collected and are not published directly."
          ideas={nextApk}
          empty="Nothing is waiting for the next app version."
          render={(idea) => <QueueRow key={idea.id} idea={idea} />}
        />

        <List
          title="Published"
          hint="Entries that were published or confirmed live on the phone. This list is history, not a start button."
          ideas={shipped}
          empty="Nothing published yet."
          render={(idea) => <ShippedRow key={idea.id} idea={idea} />}
        />

        <div className="mt-8 text-right">
          <Button asChild variant="ghost" size="sm">
            <Link to="/done">Done</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
