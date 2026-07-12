import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { refineIdea } from "@/lib/chat.server";
import { createIdeaEntry } from "@/lib/ideas.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

type Intent = "wording" | "look" | "wrong" | "idea";
type ChatMessage = { role: "user" | "assistant"; content: string };

const INTENTS: Array<{ id: Intent; title: string; hint: string; emoji: string; opener: string }> = [
  { id: "wording", title: "Wording ändern", hint: "Ein Wort oder Satz passt nicht.", emoji: "✍️", opener: "Was möchtest du anders formuliert haben?" },
  { id: "look", title: "Aussehen ändern", hint: "Farbe, Größe oder Platzierung.", emoji: "🎨", opener: "Was soll optisch anders werden?" },
  { id: "wrong", title: "Etwas ist kaputt", hint: "Etwas funktioniert nicht richtig.", emoji: "🐞", opener: "Was läuft gerade schief?" },
  { id: "idea", title: "Neue Idee", hint: "Etwas fehlt komplett.", emoji: "💡", opener: "Welche neue Idee hast du?" },
];

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function splitSuggestion(text: string): { reply: string; suggestion: string | null } {
  const marker = "[VORSCHLAG]";
  const index = text.indexOf(marker);
  if (index < 0) return { reply: text, suggestion: null };
  return {
    reply: text.slice(0, index).trim(),
    suggestion: text.slice(index + marker.length).trim(),
  };
}

function buildTitle(intent: Intent, text: string): string {
  const prefix = INTENTS.find((entry) => entry.id === intent)?.title ?? "Idee";
  return `${prefix}: ${text.replace(/\s+/g, " ").trim()}`.slice(0, 80);
}

function ChatPage() {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [submittedIdeaId, setSubmittedIdeaId] = useState<number | null>(null);

  const refine = useMutation({
    mutationFn: (nextMessages: ChatMessage[]) =>
      refineIdea({
        data: {
          intent: intent!,
          messages: nextMessages,
        },
      }),
    onSuccess: (result) => {
      const { reply, suggestion: nextSuggestion } = splitSuggestion(result.message);
      setMessages((current) => [
        ...current,
        ...(reply ? [{ role: "assistant" as const, content: reply }] : []),
      ]);
      setSuggestion(nextSuggestion);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Konnte nicht antworten.");
    },
  });

  const createIdeaMutation = useMutation({
    mutationFn: (description: string) =>
      createIdeaEntry({
        data: {
          intent: intent!,
          title: buildTitle(intent!, description),
          description,
        },
      }),
    onSuccess: (idea) => {
      setSubmittedIdeaId(idea.id);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Konnte nicht einreichen.");
    },
  });

  const selectedIntent = useMemo(
    () => INTENTS.find((entry) => entry.id === intent) ?? null,
    [intent],
  );

  function pickIntent(nextIntent: Intent) {
    const opener = INTENTS.find((entry) => entry.id === nextIntent)?.opener ?? "";
    setIntent(nextIntent);
    setMessages([{ role: "assistant", content: opener }]);
    setSuggestion(null);
    setSubmittedIdeaId(null);
  }

  async function sendMessage() {
    if (!intent || !input.trim()) return;
    const nextMessages = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setSuggestion(null);
    await refine.mutateAsync(nextMessages);
  }

  function submitFinal(description: string) {
    createIdeaMutation.mutate(description);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-2xl flex-col px-4 py-4">
        {!intent && (
          <div className="grid gap-2">
            <h1 className="text-xl font-semibold">Was für ein Wunsch?</h1>
            <p className="text-sm text-muted-foreground">Wähl die Richtung, dann reden wir kurz darüber.</p>
            {INTENTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => pickIntent(entry.id)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{entry.emoji}</span>
                  <div>
                    <div className="font-medium">{entry.title}</div>
                    <div className="text-sm text-muted-foreground">{entry.hint}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {intent && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">{selectedIntent?.title}</h1>
                <p className="text-sm text-muted-foreground">{selectedIntent?.hint}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIntent(null)}>
                Wechseln
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pb-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {refine.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {suggestion && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs uppercase text-muted-foreground">Vorschlag</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{suggestion}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => submitFinal(suggestion)} disabled={createIdeaMutation.isPending}>
                      Vorschlag übernehmen
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const fallback = messages.filter((message) => message.role === "user").at(-1)?.content ?? suggestion;
                        submitFinal(fallback);
                      }}
                      disabled={createIdeaMutation.isPending}
                    >
                      Bei meinem Text bleiben
                    </Button>
                  </div>
                </div>
              )}

              {submittedIdeaId && createIdeaMutation.isSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                  Dein Wunsch wurde eingereicht! 🎉{" "}
                  <Link to="/dashboard" className="underline">Zum Dashboard</Link>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-border bg-background py-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Beschreib deinen Wunsch in eigenen Worten…"
                  className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none"
                  rows={2}
                />
                <Button onClick={sendMessage} disabled={refine.isPending || !input.trim()}>
                  Senden
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
