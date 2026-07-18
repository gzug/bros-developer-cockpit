import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ParkingCircle, Rocket, Smartphone, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
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
      <Smartphone className="mr-1 h-3 w-3" /> Nächste App-Version
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

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{idea.title}</h3>
            <DeliveryBadge delivery={idea.delivery} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {idea.statusSummary || "Gesammelt, aber noch nicht ausgespielt."}
          </p>
          {nextApk && (
            <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              Diese Änderung braucht eine neue App-Version und kann nicht direkt aufs Handy. Sie
              bleibt gesammelt, bis Don eine neue Version freigibt.
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
        >
          <Trash2 className="mr-1 h-3 w-3" /> Löschen
        </Button>
        {!nextApk && (
          <Button size="sm" asChild>
            <a
              href={chatUrl({
                ship: String(idea.id),
                idea: idea.title,
                description: idea.description,
              })}
            >
              <Rocket className="mr-1 h-3 w-3" /> Owner bitten
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={chatUrl({ idea: idea.title, description: idea.description })}>
            <MessageCircle className="mr-1 h-3 w-3" /> Besprechen
          </a>
        </Button>
        <label className="ml-auto text-xs text-muted-foreground">
          Weg
          <select
            value={idea.delivery}
            onChange={(event) => setDelivery.mutate(event.target.value as IdeaDelivery)}
            className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="ota">OTA</option>
            <option value="next-apk">Nächste App-Version</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ShippedRow({ idea }: { idea: DCIdea }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{idea.title}</h3>
        <Badge variant="secondary">
          {idea.status === "live" ? "Live bestätigt" : "Ausgespielt"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{idea.statusSummary}</p>
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
            Hier siehst du, welche Ideen nur gesammelt sind, welche Don prüfen muss und was schon
            ausgespielt wurde.
          </p>
        </div>

        <details className="mt-5 rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">So liest du den Plan</summary>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Direkt aufs Handy:</span> kann ohne neue
              Installation vorbereitet werden, bleibt aber bis zur Owner-Freigabe gestoppt.
            </p>
            <p>
              <span className="font-medium text-foreground">Nächste App-Version:</span> wartet auf
              die nächste komplette App-Version und erscheint vorher nicht auf dem Handy.
            </p>
            <p>
              <span className="font-medium text-foreground">Owner bitten:</span> sammelt den Wunsch.
              Es spielt nichts aus. Don bleibt die letzte Kontrolle.
            </p>
          </div>
        </details>

        <section className="mt-5 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Idee sammeln</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Neue Ideen werden gesammelt und einsortiert. Du kannst den Weg später ändern.
          </p>
          <div className="mt-3 grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kurzer Titel"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ein Satz, was anders sein soll"
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => createParked.mutate()}
            disabled={createParked.isPending || !title || !description}
          >
            <ParkingCircle className="mr-2 h-4 w-4" /> Idee sammeln
          </Button>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Vorschläge</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Vorbereitete Ideen für die App. Tippe eine an, um sie im Chat verständlich
            auszuformulieren. Erst danach wird sie gesammelt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <a
                key={chip.id}
                href={chatUrl({ idea: chip.title, description: chip.sentence })}
                className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {chip.title}
              </a>
            ))}
          </div>
        </section>

        {pipeline.isLoading && (
          <p className="mt-6 text-sm text-muted-foreground">Plan wird geladen...</p>
        )}

        <List
          title="Direkt aufs Handy"
          hint="Kleine Änderungen, die vorbereitet werden können. Sie bleiben gesammelt, bis Don sie freigibt."
          ideas={otaQueue}
          empty="Keine direkt vorbereitbaren Ideen gesammelt."
          render={(idea) => <QueueRow key={idea.id} idea={idea} />}
        />

        <List
          title="Nächste App-Version"
          hint="Größere Änderungen, die eine neue Installation brauchen. Sie werden hier nur gesammelt."
          ideas={nextApk}
          empty="Nichts wartet auf die nächste App-Version."
          render={(idea) => <QueueRow key={idea.id} idea={idea} />}
        />

        <List
          title="Ausgespielt"
          hint="Einträge, die veröffentlicht oder auf dem Handy bestätigt wurden."
          ideas={shipped}
          empty="Noch nichts ausgespielt."
          render={(idea) => <ShippedRow key={idea.id} idea={idea} />}
        />

        <div className="mt-8 text-right">
          <Button asChild variant="ghost" size="sm">
            <Link to="/done">Erledigt</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
