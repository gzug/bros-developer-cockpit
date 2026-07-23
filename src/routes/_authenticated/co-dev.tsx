import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, Rocket, Send, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { DataStateMessage } from "@/components/DataStateMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { coDevChatFn, type CoDevTask } from "@/lib/chat.server";
import type { DCIdea } from "@/lib/github-issues.server";
import {
  createIdeaEntry,
  deleteIdeaEntry,
  getBdcPausedEntry,
  listDoneIdeaEntries,
  listPipelineEntries,
} from "@/lib/ideas.functions";
import {
  canCelebrateLive,
  getIdeaDisplay,
  getIdeaPhase,
  IDEA_PHASE_LABEL,
  IDEA_PHASE_TRACK,
} from "@/lib/idea-status";
import { getUiDataState } from "@/lib/ui-data-state";

export const Route = createFileRoute("/_authenticated/co-dev")({
  head: () => ({ meta: [{ title: "Co-Dev · One L1fe Cockpit" }] }),
  component: CoDevPage,
});

type ChatMessage = { role: "user" | "assistant"; content: string };

const OPENER: ChatMessage = {
  role: "assistant",
  content:
    "Hi! Tell me what you wish the app did, or what feels off. We talk it through, and when it's clear I turn it into a small task you can confirm.",
};

function isShipped(idea: DCIdea): boolean {
  return idea.status === "shipped" || idea.status === "live";
}

function DeliveryBadge({ delivery }: { delivery: DCIdea["delivery"] }) {
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

// Coarse, calm progress rail. `needsAnotherLook` sits off the rail (like blocked) and is shown as a
// separate note, never as a step reached on the way to live.
function ProgressTrack({ status }: { status: DCIdea["status"] }) {
  const phase = getIdeaPhase(status);
  if (phase === "needsAnotherLook") {
    return (
      <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
        {IDEA_PHASE_LABEL.needsAnotherLook}
      </p>
    );
  }
  const currentIndex = IDEA_PHASE_TRACK.indexOf(phase);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1"
      role="img"
      aria-label={`Progress: ${IDEA_PHASE_LABEL[phase]}`}
    >
      {IDEA_PHASE_TRACK.map((trackPhase, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <span
            key={trackPhase}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isCurrent
                ? "bg-primary text-primary-foreground"
                : reached
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {IDEA_PHASE_LABEL[trackPhase]}
          </span>
        );
      })}
    </div>
  );
}

function TrackerCard({
  idea,
  paused,
  onDelete,
  deleting,
  onChange,
}: {
  idea: DCIdea;
  paused: boolean;
  onDelete: () => void;
  deleting: boolean;
  onChange: () => void;
}) {
  const display = getIdeaDisplay({
    status: idea.status,
    statusSummary: idea.statusSummary,
    doneCategory: idea.doneCategory,
  });
  // Celebratory copy is only truthful for a real shipped/live status while the engine is not paused.
  const celebrate = canCelebrateLive(idea.status, paused);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{idea.title}</h3>
        <DeliveryBadge delivery={idea.delivery} />
      </div>
      {idea.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.description}</p>
      )}
      <ProgressTrack status={idea.status} />
      <p className="mt-2 text-xs font-medium">{display.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {celebrate ? "It's live — it's part of the app now." : display.summary}
      </p>
      {idea.delivery === "next-apk" && !isShipped(idea) && (
        <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          This one needs the next app version, so it can't go straight to your phone. It stays saved
          until a new version is prepared.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${idea.title}`}
        >
          <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" /> Delete
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onChange}
          aria-label={`Talk about changing ${idea.title}`}
        >
          <MessageCircle className="mr-1 h-3 w-3" aria-hidden="true" /> Change
        </Button>
        <Button
          size="sm"
          disabled
          title="Building and shipping are switched off right now. This unlocks later."
          aria-label={`Ship ${idea.title} (unlocks later)`}
        >
          <Rocket className="mr-1 h-3 w-3" aria-hidden="true" /> Ship
        </Button>
        <span className="text-[11px] text-muted-foreground">Ship unlocks later.</span>
      </div>
    </div>
  );
}

function TrackerSection({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function CoDevPage() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([OPENER]);
  const [input, setInput] = useState("");
  const [pendingTasks, setPendingTasks] = useState<CoDevTask[]>([]);
  const [confirmedTitles, setConfirmedTitles] = useState<Set<string>>(new Set());
  const logRef = useRef<HTMLDivElement | null>(null);

  const pausedQuery = useQuery({ queryKey: ["bdc-paused"], queryFn: () => getBdcPausedEntry() });
  // Fail SAFE for the honesty banner: if we cannot read the pause flag, assume paused (never imply
  // shipping is on). isBdcPaused itself is fail-closed server-side; this mirrors it client-side.
  const paused = pausedQuery.data?.paused ?? true;

  const pipeline = useQuery({ queryKey: ["codev-pipeline"], queryFn: () => listPipelineEntries() });
  const done = useQuery({ queryKey: ["codev-done"], queryFn: () => listDoneIdeaEntries() });

  const chat = useMutation({
    mutationFn: (nextMessages: ChatMessage[]) => coDevChatFn({ data: { messages: nextMessages } }),
    onSuccess: (result) => {
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      setPendingTasks(result.tasks);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not respond. Try again.");
    },
  });

  const invalidateTracker = async () => {
    await queryClient.invalidateQueries({ queryKey: ["codev-pipeline"] });
    await queryClient.invalidateQueries({ queryKey: ["codev-done"] });
  };

  const confirmTask = useMutation({
    mutationFn: (task: CoDevTask) =>
      createIdeaEntry({
        data: { intent: "idea", title: task.title, description: task.description },
      }),
    onSuccess: async (_idea, task) => {
      setConfirmedTitles((current) => new Set(current).add(task.title));
      await invalidateTracker();
      toast.success("Saved. It's queued in the tracker on the right.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save this task.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteIdeaEntry({ data: { id } }),
    onSuccess: async () => {
      await invalidateTracker();
      toast.success("Removed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not remove this one.");
    },
  });

  useEffect(() => {
    // Keep the newest message in view without needing ScrollArea's (non-forwarded) viewportRef.
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  function send() {
    const text = input.trim();
    if (!text || chat.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content: text.slice(0, 1500) }];
    setMessages(nextMessages);
    setInput("");
    setPendingTasks([]);
    chat.mutate(nextMessages);
  }

  function seedChange(idea: DCIdea) {
    // "Change" seeds a chat message so the brother can talk through a change to an existing idea.
    setInput(`I'd like to change "${idea.title}". `);
    logRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const active = pipeline.data?.active ?? [];
  const open = active.filter((idea) => !isShipped(idea));
  const otaQueue = open.filter((idea) => idea.delivery === "ota");
  const nextApk = open.filter((idea) => idea.delivery === "next-apk");
  const shippedLive = active.filter(isShipped);
  const doneGroups = done.data ?? [];
  const doneCount = doneGroups.reduce((sum, group) => sum + group.count, 0);

  const trackerState = getUiDataState({
    status: pipeline.status,
    hasData: pipeline.data != null,
    hasItems: active.length > 0 || shippedLive.length > 0 || doneCount > 0,
    isFetching: pipeline.isFetching,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Co-Dev</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk an idea through on the left. Watch it get built on the right.
          </p>
        </div>

        {paused && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200"
          >
            Your ideas are <span className="font-medium">saved and queued</span>. Building and
            shipping are switched off right now, so nothing goes to your phone yet.
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* LEFT — talk through your idea */}
          <section className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-semibold">Talk through your idea</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing is saved until you confirm a task.
              </p>
            </div>

            <div
              ref={logRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
              role="log"
              aria-label="Chat conversation"
              aria-live="polite"
              aria-relevant="additions text"
              aria-busy={chat.isPending}
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {chat.isPending && (
                <div className="flex justify-start" role="status" aria-label="Thinking">
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {pendingTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ready to confirm. Each one becomes a saved task.
                  </p>
                  {pendingTasks.map((task, index) => {
                    const alreadyConfirmed = confirmedTitles.has(task.title);
                    return (
                      <div
                        key={`${task.title}-${index}`}
                        className="rounded-xl border border-primary/30 bg-primary/5 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{task.title}</span>
                          <DeliveryBadge delivery={task.delivery} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                        {task.delivery === "next-apk" && (
                          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                            This likely needs the next app version.
                          </p>
                        )}
                        <div className="mt-3">
                          <Button
                            size="sm"
                            onClick={() => confirmTask.mutate(task)}
                            disabled={alreadyConfirmed || confirmTask.isPending}
                          >
                            {alreadyConfirmed ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Confirmed
                              </>
                            ) : (
                              "Confirm this task"
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <textarea
                  aria-label="Describe your idea"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Tell me what you'd like the app to do..."
                  rows={2}
                  maxLength={1500}
                  className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                <Button onClick={send} disabled={chat.isPending || !input.trim()}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </section>

          {/* RIGHT — what you're building */}
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">What you're building</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your confirmed ideas and where each one stands.
            </p>

            <div className="mt-4">
              <DataStateMessage
                state={trackerState}
                loading="Loading your ideas..."
                error="Your ideas could not be loaded. Try again."
                empty="No ideas yet. Talk one through on the left to get started."
                onRetry={() => void pipeline.refetch()}
              />
            </div>

            {(trackerState === "success" || trackerState === "stale") && (
              <>
                <TrackerSection
                  title="OTA Queue"
                  hint="Small changes that can be prepared and sent to your phone directly."
                  count={otaQueue.length}
                >
                  {otaQueue.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing in the queue yet.</p>
                  ) : (
                    otaQueue.map((idea) => (
                      <TrackerCard
                        key={idea.id}
                        idea={idea}
                        paused={paused}
                        onDelete={() => remove.mutate(idea.id)}
                        deleting={remove.isPending}
                        onChange={() => seedChange(idea)}
                      />
                    ))
                  )}
                </TrackerSection>

                <TrackerSection
                  title="Next APK"
                  hint="Bigger changes that need the next app version before they can reach your phone."
                  count={nextApk.length}
                >
                  {nextApk.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing waiting for a new version.</p>
                  ) : (
                    nextApk.map((idea) => (
                      <TrackerCard
                        key={idea.id}
                        idea={idea}
                        paused={paused}
                        onDelete={() => remove.mutate(idea.id)}
                        deleting={remove.isPending}
                        onChange={() => seedChange(idea)}
                      />
                    ))
                  )}
                </TrackerSection>

                <TrackerSection
                  title="Shipped & Done"
                  hint="Ideas that have shipped or were completed and kept as history."
                  count={shippedLive.length + doneCount}
                >
                  {shippedLive.length === 0 && doneGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing here yet.</p>
                  ) : (
                    <>
                      {shippedLive.map((idea) => {
                        const display = getIdeaDisplay({
                          status: idea.status,
                          statusSummary: idea.statusSummary,
                          doneCategory: idea.doneCategory,
                        });
                        const celebrate = canCelebrateLive(idea.status, paused);
                        return (
                          <div
                            key={idea.id}
                            className="rounded-xl border border-border bg-card p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold">{idea.title}</h3>
                              <Badge variant="secondary">{display.label}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {celebrate ? "It's live — it's part of the app now." : display.summary}
                            </p>
                          </div>
                        );
                      })}
                      {doneGroups.map((group) => (
                        <div
                          key={group.category}
                          className="rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{group.label}</h3>
                            <Badge variant="secondary">{group.count}</Badge>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {group.ideas.map((idea) => (
                              <li key={idea.id} className="text-xs text-muted-foreground">
                                {idea.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  )}
                </TrackerSection>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
