import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { loginWithPin } from "@/lib/auth.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin.trim())) {
      toast.error("Bitte vier Ziffern eingeben.");
      return;
    }
    setBusy(true);
    try {
      await loginWithPin({ data: { pin: pin.trim() } });
      if (nextSafe) window.location.replace(nextSafe);
      else navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falscher Code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Einloggen</CardTitle>
          <CardDescription>Gib den vierstelligen Code ein.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="1234"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              autoFocus
              className="text-center text-2xl tracking-[0.45em]"
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Prüfe…" : "Einloggen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
