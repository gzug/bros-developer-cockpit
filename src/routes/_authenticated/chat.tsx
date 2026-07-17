import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Rocket, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createIdeaEntry, requestShipEntry } from "@/lib/ideas.functions";
import { refineIdea } from "@/lib/chat.server";
import { getPromptEffectSummary } from "@/lib/prompt-effect.server";
import {
  curatedModels,
  shippedPresets,
  type ModelParams,
  type PresetConfig,
} from "@/lib/model-presets";

type Intent = "wording" | "look" | "wrong" | "idea";
type ChatMessage = { role: "user" | "assistant"; content: string };
type EditablePreset = PresetConfig & { source: "shipped" | "local" };

const LOCAL_PRESETS_KEY = "bdc.chat.presets.v1";

const INTENTS: Array<{ id: Intent; title: string; hint: string; emoji: string; opener: string }> = [
  {
    id: "wording",
    title: "Change wording",
    hint: "A word or sentence doesn't fit.",
    emoji: "✍️",
    opener: "What would you like rephrased?",
  },
  {
    id: "look",
    title: "Change appearance",
    hint: "Color, size, or placement.",
    emoji: "🎨",
    opener: "What should look different?",
  },
  {
    id: "wrong",
    title: "Something is broken",
    hint: "Something isn't working right.",
    emoji: "🐞",
    opener: "What's going wrong?",
  },
  {
    id: "idea",
    title: "New idea",
    hint: "Something is completely missing.",
    emoji: "💡",
    opener: "What new idea do you have?",
  },
];

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { idea?: string; description?: string; ship?: number } => {
    const shipId = Number(search.ship);
    return {
      idea: typeof search.idea === "string" ? search.idea : undefined,
      description: typeof search.description === "string" ? search.description : undefined,
      ship: Number.isInteger(shipId) && shipId > 0 ? shipId : undefined,
    };
  },
  component: ChatPage,
});

function splitSuggestion(text: string): { reply: string; suggestion: string | null } {
  const marker = "Refined version:";
  const index = text.indexOf(marker);
  if (index < 0) return { reply: text, suggestion: null };
  return {
    reply: text.slice(0, index).trim(),
    suggestion: text.slice(index + marker.length).trim(),
  };
}

// Task descriptions arrive with issue-body scaffolding (## headings, meta lines, the
// "Submitted via BDC" stamp). Strip it so the chat opener reads like a sentence, not raw data.
function cleanPreloadText(text: string): string {
  return text
    .replace(/_Submitted via BDC[^_]*_/g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        trimmed !== "---" &&
        !/^##\s/.test(trimmed) &&
        !/^(Screen|Type)\s*:/i.test(trimmed)
      );
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitle(intent: Intent, text: string): string {
  const prefix = INTENTS.find((entry) => entry.id === intent)?.title ?? "Idea";
  return `${prefix}: ${text.replace(/\s+/g, " ").trim()}`.slice(0, 80);
}

function loadLocalPresets(): PresetConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PresetConfig =>
      typeof entry?.id === "string" &&
      typeof entry?.name === "string" &&
      typeof entry?.model === "string" &&
      typeof entry?.systemPrompt === "string" &&
      typeof entry?.params?.temperature === "number" &&
      typeof entry?.params?.maxTokens === "number",
    );
  } catch {
    return [];
  }
}

function saveLocalPresets(presets: PresetConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

function makeLocalPresetId(): string {
  return `local-${Date.now().toString(36)}`;
}

function ChatPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [shipResult, setShipResult] = useState<{ ok: boolean; message: string } | null>(null);
  const shipMutation = useMutation({
    mutationFn: (id: number) => requestShipEntry({ data: { id } }),
    onSuccess: (result) =>
      setShipResult({
        ok: result.ok,
        message: result.ok
          ? "Sent to ship. It runs the safety checks and publishes once shipping is armed."
          : result.reason,
      }),
    onError: (error) =>
      setShipResult({ ok: false, message: error instanceof Error ? error.message : "Could not ship." }),
  });
  const [intent, setIntent] = useState<Intent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [submittedIdeaId, setSubmittedIdeaId] = useState<number | null>(null);
  const [localPresets, setLocalPresets] = useState<PresetConfig[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState(shippedPresets[0]?.id ?? "");
  const [presetName, setPresetName] = useState(shippedPresets[0]?.name ?? "");
  const [selectedModel, setSelectedModel] = useState(shippedPresets[0]?.model ?? curatedModels[0]?.id ?? "");
  const [systemPrompt, setSystemPrompt] = useState(shippedPresets[0]?.systemPrompt ?? "");
  const [params, setParams] = useState<ModelParams>(shippedPresets[0]?.params ?? { temperature: 0.4, maxTokens: 300 });

  useEffect(() => {
    setLocalPresets(loadLocalPresets());
  }, []);

  const presets: EditablePreset[] = useMemo(
    () => [
      ...shippedPresets.map((preset) => ({ ...preset, source: "shipped" as const })),
      ...localPresets.map((preset) => ({ ...preset, source: "local" as const })),
    ],
    [localPresets],
  );

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null,
    [presets, selectedPresetId],
  );

  const selectedModelMeta = useMemo(
    () => curatedModels.find((model) => model.id === selectedModel) ?? null,
    [selectedModel],
  );

  const promptEffect = useQuery({
    queryKey: ["prompt-effect"],
    queryFn: () => getPromptEffectSummary(),
    retry: false,
  });

  useEffect(() => {
    if (!selectedPreset) return;
    setPresetName(selectedPreset.name);
    setSelectedModel(selectedPreset.model);
    setSystemPrompt(selectedPreset.systemPrompt);
    setParams(selectedPreset.params);
  }, [selectedPreset]);

  const [preloaded, setPreloaded] = useState(false);

  const refine = useMutation({
    mutationFn: (nextMessages: ChatMessage[]) =>
      refineIdea({
        data: {
          intent: intent!,
          messages: nextMessages,
          model: selectedModel,
          systemPrompt,
          params,
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
      toast.error(error instanceof Error ? error.message : "Could not respond.");
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
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    },
  });

  const selectedIntent = useMemo(
    () => INTENTS.find((entry) => entry.id === intent) ?? null,
    [intent],
  );

  useEffect(() => {
    // When arriving to confirm a ship (?ship=...), do NOT seed a new-idea draft — the ship card
    // is the whole purpose; seeding would let the co-dev accidentally create a duplicate idea.
    if (preloaded || search.ship != null || !search.idea) return;
    const description = cleanPreloadText(search.description?.trim() || search.idea);
    setIntent("idea");
    setMessages([
      {
        role: "assistant",
        content: `Let's talk about this idea: "${description}" — tell me what you'd like, or what should change about it, and I'll turn it into a clear proposal with you.`,
      },
    ]);
    setInput(description);
    setSuggestion(null);
    setSubmittedIdeaId(null);
    setPreloaded(true);
  }, [preloaded, search.description, search.idea]);

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

  function savePreset() {
    const name = presetName.trim();
    const prompt = systemPrompt.trim();
    if (!name || prompt.length < 20) {
      toast.error("Preset needs a name and a system prompt.");
      return;
    }
    const preset: PresetConfig = {
      id: selectedPreset?.source === "local" ? selectedPreset.id : makeLocalPresetId(),
      name,
      model: selectedModel,
      systemPrompt: prompt,
      params,
    };
    const next = localPresets.filter((entry) => entry.id !== preset.id).concat(preset);
    setLocalPresets(next);
    saveLocalPresets(next);
    setSelectedPresetId(preset.id);
    toast.success("Preset saved.");
  }

  function deletePreset() {
    if (selectedPreset?.source !== "local") {
      toast.error("Shipped presets cannot be deleted.");
      return;
    }
    const next = localPresets.filter((entry) => entry.id !== selectedPreset.id);
    setLocalPresets(next);
    saveLocalPresets(next);
    setSelectedPresetId(shippedPresets[0]?.id ?? "");
    toast.success("Preset deleted.");
  }

  function updateTemperature(value: string) {
    const temperature = Number(value);
    if (!Number.isFinite(temperature)) return;
    setParams((current) => ({ ...current, temperature }));
  }

  function updateMaxTokens(value: string) {
    const maxTokens = Number(value);
    if (!Number.isFinite(maxTokens)) return;
    setParams((current) => ({ ...current, maxTokens }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col px-4 py-4">
        {search.ship != null && (
          <section className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
            {shipResult ? (
              <div className="space-y-3">
                <p className={`text-sm ${shipResult.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {shipResult.message}
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/pipeline" })}>
                  Back to pipeline
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Ship this task now?</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ship {search.idea ? <span className="font-medium text-foreground">&ldquo;{search.idea}&rdquo;</span> : "this task"}?
                  It goes through the safety checks first, and the owner&rsquo;s release gates still apply.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => shipMutation.mutate(search.ship!)}
                    disabled={shipMutation.isPending}
                  >
                    <Rocket className="mr-1 h-3 w-3" /> Yes, ship it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/pipeline" })}>
                    No, go back
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
        <section className="mb-4 rounded-md border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="preset">Preset</Label>
              <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                <SelectTrigger id="preset">
                  <SelectValue placeholder="Choose preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Choose model" />
                </SelectTrigger>
                <SelectContent>
                  {curatedModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModelMeta && (
                <p className="text-xs text-muted-foreground">
                  {selectedModelMeta.provider}. {selectedModelMeta.strength} Cost: {selectedModelMeta.costClass}.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value.slice(0, 60))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={params.temperature}
                onChange={(event) => updateTemperature(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min={64}
                max={4096}
                step={1}
                value={params.maxTokens}
                onChange={(event) => updateMaxTokens(event.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" size="icon" variant="outline" onClick={savePreset} title="Save preset">
                <Save className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="outline" onClick={deletePreset} title="Delete preset">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Label htmlFor="system-prompt">System prompt</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value.slice(0, 4000))}
              rows={4}
            />
          </div>
        </section>

        {!intent && (
          <div className="grid gap-2">
            <h1 className="text-xl font-semibold">What kind of wish?</h1>
            <p className="text-sm text-muted-foreground">
              Pick a direction, then we'll chat about it.
            </p>
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
                Switch
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
                <div
                  className="flex justify-start"
                  role="status"
                  aria-label="Preparing a suggestion"
                >
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
                  <div className="text-xs uppercase text-muted-foreground">Suggestion</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{suggestion}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => submitFinal(suggestion)}
                      disabled={createIdeaMutation.isPending || submittedIdeaId !== null}
                    >
                      Accept suggestion
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const fallback =
                          messages.filter((message) => message.role === "user").at(-1)?.content ??
                          suggestion;
                        submitFinal(fallback);
                      }}
                      disabled={createIdeaMutation.isPending || submittedIdeaId !== null}
                    >
                      Keep my text
                    </Button>
                  </div>
                </div>
              )}

              {submittedIdeaId && createIdeaMutation.isSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                  Your wish has been submitted!{" "}
                  <Link to="/dashboard" className="underline">
                    Go to dashboard
                  </Link>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-border bg-background py-3">
              <div className="flex gap-2">
                <textarea
                  aria-label="Describe your wish"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Describe your wish in your own words..."
                  className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none"
                  rows={2}
                />
                <Button onClick={sendMessage} disabled={refine.isPending || !input.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </>
        )}

        <section className="mt-5 rounded-md border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Prompt effect</h2>
              <p className="mt-1 text-xs text-muted-foreground">Experimental, small sample</p>
            </div>
            <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
              GitHub Issues
            </span>
          </div>

          {promptEffect.data ? (
            <div className="mt-4 space-y-3">
              {promptEffect.data.versions.map((version) => (
                <div key={version.version} className="rounded-md border border-border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{version.version}</span>
                    <span className="text-xs text-muted-foreground">{version.date}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Issues: {version.issuesCreated}</span>
                    <span>PRs: {version.prsCreated}</span>
                    <span>Accepted: {version.accepted}</span>
                    <span>Reworked: {version.reworked}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{version.promptFile}</p>
                </div>
              ))}
              {promptEffect.data.skillSnapshots.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Skill snapshots:{" "}
                  {promptEffect.data.skillSnapshots.map((snapshot) => (
                    <a key={snapshot.id} href={snapshot.url} target="_blank" rel="noreferrer" className="mr-2 underline">
                      #{snapshot.id}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No skill snapshot issues found yet.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No prompt effect data available yet. This section will stay empty until GitHub Issues or PRs create a sample.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
