import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { loginWithPin } from "@/lib/auth.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { safeNext } from "@/lib/safe-next";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = typeof s.next === "string" ? s.next : undefined;
    return next ? { next } : {};
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextSafe = safeNext(next ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(secret.trim())) {
      toast.error("Please enter exactly four digits.");
      return;
    }
    setBusy(true);
    try {
      const result = await loginWithPin({ data: { secret: secret.trim() } });
      if (nextSafe) window.location.replace(nextSafe);
      else navigate({ to: result.role === "owner" ? "/dc" : "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Log in</CardTitle>
          <CardDescription>Enter your 4 digit code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              aria-label="4 digit code"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              maxLength={4}
              value={secret}
              onChange={(e) => setSecret(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              autoFocus
              className="text-center text-2xl tracking-[0.45em]"
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Checking…" : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
