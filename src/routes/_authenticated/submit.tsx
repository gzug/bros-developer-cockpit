import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitContribution } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/submit")({
  component: Submit,
});

type Intent = "wording" | "look" | "wrong" | "idea";

const INTENTS: Array<{
  id: Intent;
  title: string;
  hint: string;
  emoji: string;
}> = [
  { id: "wording", title: "Wording ändern", hint: "Ein Wort oder Satz passt nicht.", emoji: "✍️" },
  { id: "look", title: "Aussehen ändern", hint: "Farbe, Größe, wo etwas steht.", emoji: "🎨" },
  { id: "wrong", title: "Etwas ist kaputt", hint: "Was funktioniert nicht?", emoji: "🐞" },
  { id: "idea", title: "Neue Idee", hint: "Was fehlt komplett?", emoji: "💡" },
];

type Step = "intent" | "form" | "confirm" | "blocked" | "done";

function Submit() {
  const navigate = useNavigate();
  const submit = useServerFn(submitContribution);
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [screen, setScreen] = useState("");
  const [wrong, setWrong] = useState("");
  const [should, setShould] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockReason, setBlockReason] = useState<string>("");
  const [blockedId, setBlockedId] = useState<string | null>(null);

  function pickIntent(i: Intent) {
    setIntent(i);
    setStep("form");
  }

  function goConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) return;
    if (screen.trim().length < 1 || wrong.trim().length < 3 || should.trim().length < 3) {
      toast.error("Ein Satz reicht bei jedem Feld.");
      return;
    }
    setStep("confirm");
  }

  async function doSend(force = false) {
    if (!intent) return;
    setBusy(true);
    try {
      const res = await submit({
        data: {
          intent,
          screen: screen.trim(),
          wrong: wrong.trim(),
          should: should.trim(),
          body: extra.trim(),
          force,
        },
      });
      if (res.blocked) {
        setBlockReason(res.message);
        setBlockedId(res.id);
        setStep("blocked");
      } else {
        toast.success("Abgeschickt.");
        navigate({ to: "/idea/$id", params: { id: res.id } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht abschicken.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6">
        {step === "intent" && (
          <>
            <h1 className="text-xl font-semibold">Was für ein Wunsch?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Wähl das, was am besten passt.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {INTENTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => pickIntent(opt.id)}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left hover:bg-accent"
                >
                  <span className="text-2xl" aria-hidden>{opt.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{opt.title}</div>
                    <div className="text-xs text-muted-foreground">{opt.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "form" && intent && (
          <form onSubmit={goConfirm} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("intent")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Kategorie ändern
            </button>
            <h1 className="text-xl font-semibold">
              {INTENTS.find((i) => i.id === intent)?.title}
            </h1>

            <div className="space-y-1">
              <Label htmlFor="screen">Wo in der App?</Label>
              <Input
                id="screen"
                placeholder="z. B. Startseite, oben rechts"
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="wrong">Was passt nicht?</Label>
              <Textarea
                id="wrong"
                placeholder="Beschreib in einem Satz, was dich stört."
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                rows={3}
                maxLength={1000}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="should">Was soll stattdessen sein?</Label>
              <Textarea
                id="should"
                placeholder="Was wär's, was du dir wünschst?"
                value={should}
                onChange={(e) => setShould(e.target.value)}
                rows={3}
                maxLength={1000}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="extra">Noch was? (optional)</Label>
              <Textarea
                id="extra"
                placeholder="Freitext — kann leer bleiben."
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={2}
                maxLength={2000}
              />
            </div>

            <Button type="submit" className="w-full">
              Weiter
            </Button>
          </form>
        )}

        {step === "confirm" && intent && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">Passt so?</h1>
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Wo</span>
                <div>{screen}</div>
              </div>
              <div className="mt-2">
                <span className="text-xs uppercase text-muted-foreground">Passt nicht</span>
                <div className="whitespace-pre-wrap">{wrong}</div>
              </div>
              <div className="mt-2">
                <span className="text-xs uppercase text-muted-foreground">Soll sein</span>
                <div className="whitespace-pre-wrap">{should}</div>
              </div>
              {extra && (
                <div className="mt-2">
                  <span className="text-xs uppercase text-muted-foreground">Zusatz</span>
                  <div className="whitespace-pre-wrap">{extra}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                className="flex-1"
                disabled={busy}
              >
                Zurück
              </Button>
              <Button
                onClick={() => doSend(false)}
                className="flex-1"
                disabled={busy}
              >
                {busy ? "Sende…" : "Abschicken"}
              </Button>
            </div>
          </div>
        )}

        {step === "blocked" && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">Kurzer Zwischenstopp</h1>
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
              {blockReason}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setStep("form")} className="w-full">
                Umformulieren
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => doSend(true)}
                disabled={busy}
              >
                {busy ? "Sende…" : "So lassen und als Idee speichern"}
              </Button>
              {blockedId && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() =>
                    navigate({ to: "/idea/$id", params: { id: blockedId } })
                  }
                >
                  Zur gespeicherten Idee
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
