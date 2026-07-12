import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { loginWithPin } from "@/lib/ideas.functions";

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

function safeNext(candidate: string): string {
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "";
  return candidate;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextSafe = safeNext(next ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (!pin.trim()) return;
    setBusy(true);
    try {
      const tokens = await loginWithPin({ data: { pin: pin.trim() } });
      await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (nextSafe) window.location.replace(nextSafe);
      else navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gib deinen Code ein.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="Code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            autoFocus
            className="text-center text-lg tracking-[0.3em]"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Prüfe…" : "Einloggen"}
          </Button>
        </form>
      </div>
    </main>
  );
}
