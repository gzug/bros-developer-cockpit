import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestLoginLink } from "@/lib/ideas.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string } => {
    const next = typeof s.next === "string" ? s.next : undefined;
    return next ? { next } : {};
  },
  component: AuthPage,
});

// Only allow same-origin relative paths so the `next` param can't be turned
// into an open-redirect vector.
function safeNext(candidate: string): string {
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "";
  return candidate;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextSafe = safeNext(next ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (nextSafe) window.location.replace(nextSafe);
        else navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate, nextSafe]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setBusy(true);
    try {
      const redirectTo = nextSafe
        ? `${window.location.origin}${nextSafe}`
        : `${window.location.origin}/dashboard`;
      await requestLoginLink({
        data: { email: normalized, redirectTo },
      });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nur eine Adresse ist freigeschaltet. Du bekommst einen Login-Link per
          Mail.
        </p>

        {sent ? (
          <div className="mt-8 rounded-md border border-border bg-card p-4 text-sm">
            <p className="font-medium">Check deine Mails.</p>
            <p className="mt-1 text-muted-foreground">
              Wir haben einen Login-Link an <span className="font-medium">{email}</span>{" "}
              geschickt. Klick den Link auf demselben Gerät.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Andere Adresse versuchen
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sende…" : "Login-Link schicken"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
