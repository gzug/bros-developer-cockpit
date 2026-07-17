import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle, MessageCircle, ParkingCircle, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import chips from "@/config/suggestion-chips.json";
import {
  completeIdeaEntry,
  createParkedIdeaEntry,
  deleteIdeaEntry,
  getUndoLastChangeEntry,
  listPipelineEntries,
  updateIdeaContextEntry,
  updateIdeaPipelineEntry,
  updateIdeaWeightEntry,
} from "@/lib/ideas.functions";
import type { DCIdea, DoneCategorySlug, IdeaWeight } from "@/lib/github-issues.server";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

const CATEGORIES: Array<{ slug: DoneCategorySlug; label: string }> = [
  { slug: "home", label: "Home" },
  { slug: "sleep", label: "Sleep" },
  { slug: "nutrition", label: "Nutrition" },
  { slug: "activity", label: "Activity" },
  { slug: "statistics", label: "Statistics" },
  { slug: "general", label: "General" },
];

function weightClass(weight: IdeaWeight) {
  return weight === "heavy"
    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function chatUrl(title: string, description: string) {
  const params = new URLSearchParams({ idea: title, description });
  return `/chat?${params.toString()}`;
}

function IdeaRow({ idea, archived = false }: { idea: DCIdea; archived?: boolean }) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    await queryClient.invalidateQueries({ queryKey: ["ideas"] });
    await queryClient.invalidateQueries({ queryKey: ["done-ideas"] });
  };

  const move = useMutation({
    mutationFn: (state: "active" | "parked" | "archived") => updateIdeaPipelineEntry({ data: { id: idea.id, state } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not move idea."),
  });
  const weight = useMutation({
    mutationFn: (nextWeight: IdeaWeight) => updateIdeaWeightEntry({ data: { id: idea.id, weight: nextWeight } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not change weight."),
  });
  const context = useMutation({
    mutationFn: (nextContext: string) => updateIdeaContextEntry({ data: { id: idea.id, context: nextContext } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save context."),
  });
  const complete = useMutation({
    mutationFn: (category: DoneCategorySlug) => completeIdeaEntry({ data: { id: idea.id, category } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not complete idea."),
  });
  const remove = useMutation({
    mutationFn: () => deleteIdeaEntry({ data: { id: idea.id } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete idea."),
  });

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{idea.title}</h3>
            <Badge variant="outline" className={weightClass(idea.weight)}>
              {idea.weight === "heavy" ? "Heavy, needs Don" : "Light"}
            </Badge>
          </div>
          {idea.context && (
            <p className="mt-2 rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              Why not built yet: {idea.context}
            </p>
          )}
          {idea.parkedAt && <p className="mt-2 text-xs text-muted-foreground">Parked on {idea.parkedAt}</p>}
        </div>
        <a href={chatUrl(idea.title, idea.description)} className="inline-flex items-center gap-1 text-xs underline">
          <MessageCircle className="h-3 w-3" /> Open chat
        </a>
      </div>

      {!archived && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Weight
            <select
              value={idea.weight}
              onChange={(event) => weight.mutate(event.target.value as IdeaWeight)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="light">Light</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Done category
            <select
              defaultValue="general"
              onChange={(event) => complete.mutate(event.target.value as DoneCategorySlug)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="general" disabled>Complete as...</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>{category.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!archived && (
        <div className="mt-3 flex flex-wrap gap-2">
          {idea.pipelineState === "parked" ? (
            <Button size="sm" variant="outline" onClick={() => move.mutate("active")} disabled={move.isPending}>
              Move to active
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => move.mutate("parked")} disabled={move.isPending}>
              Park
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = window.prompt("Why is this not built yet?", idea.context ?? "");
              if (next != null) context.mutate(next);
            }}
            disabled={context.isPending}
          >
            Edit context
          </Button>
          <Button size="sm" variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}

function PipelinePage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [weight, setWeight] = useState<IdeaWeight>("light");

  const pipeline = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => listPipelineEntries(),
  });
  const undo = useQuery({
    queryKey: ["undo-last-change"],
    queryFn: () => getUndoLastChangeEntry(),
  });
  const createParked = useMutation({
    mutationFn: () => createParkedIdeaEntry({ data: { title, description, context, weight } }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setContext("");
      setWeight("light");
      await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success("Idea parked.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not park idea."),
  });

  const active = pipeline.data?.active ?? [];
  const parked = pipeline.data?.parked ?? [];
  const archived = pipeline.data?.archived ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Idea Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">Active ideas, parked ideas, and finished work stay separate.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/done">Done retro</Link>
          </Button>
        </div>

        <section className="mt-5 rounded-md border border-border bg-muted/20 p-4">
          <h2 className="text-sm font-semibold">AI and approval boundary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The AI may draft, prepare, and explain ideas. Anything that changes the app needs Don's approval first. Heavy ideas always need Don before work starts.
          </p>
        </section>

        <section className="mt-4 rounded-md border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Undo2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold">Undo last change</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {undo.data?.explanation ?? "Checking undo availability."}
              </p>
            </div>
            <Button size="sm" variant="outline" disabled>
              Undo last change
            </Button>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Don's suggestion chips</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <a
                key={chip.id}
                href={chatUrl(chip.title, chip.sentence)}
                className={`rounded-full border px-3 py-2 text-xs font-medium ${weightClass(chip.weight as IdeaWeight)}`}
              >
                {chip.title}
              </a>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Create directly in Parkplatz</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Idea title"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <select
              value={weight}
              onChange={(event) => setWeight(event.target.value as IdeaWeight)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="light">Light</option>
              <option value="heavy">Heavy, needs Don</option>
            </select>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="One sentence idea"
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Why not built yet, optional"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2"
            />
          </div>
          <Button className="mt-3" size="sm" onClick={() => createParked.mutate()} disabled={createParked.isPending || !title || !description}>
            <ParkingCircle className="mr-2 h-4 w-4" /> Park idea
          </Button>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Active list</h2>
              <Badge variant="secondary">{active.length}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {pipeline.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!pipeline.isLoading && active.length === 0 && <p className="text-sm text-muted-foreground">No active ideas.</p>}
              {active.map((idea) => <IdeaRow key={idea.id} idea={idea} />)}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Ideen-Parkplatz</h2>
              <Badge variant="secondary">{parked.length}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {pipeline.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!pipeline.isLoading && parked.length === 0 && <p className="text-sm text-muted-foreground">No parked ideas.</p>}
              {parked.map((idea) => <IdeaRow key={idea.id} idea={idea} />)}
            </div>
          </section>
        </div>

        <details className="mt-6 rounded-md border border-border bg-card p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <Archive className="h-4 w-4" /> Archive ({archived.length})
          </summary>
          <div className="mt-3 space-y-3">
            {archived.length === 0 && <p className="text-sm text-muted-foreground">No archived ideas.</p>}
            {archived.map((idea) => <IdeaRow key={idea.id} idea={idea} archived />)}
          </div>
        </details>
      </main>
    </div>
  );
}
