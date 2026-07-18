import { useState } from "react";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithPin } from "@/lib/auth.server";

// In-app permission switch: enter a four-digit code to move between the Main Dev and Co-Dev
// setups without logging out. It reuses the exact login path (loginWithPin), so it grants no
// access a plain login wouldn't — you still need to know the code. A full page reload lets the
// route guards re-evaluate under the new role.
export function RoleSwitch() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter your 4 digit code.");
      return;
    }
    setBusy(true);
    try {
      const result = await loginWithPin({ data: { secret: pin } });
      toast.success(`Switched to ${result.role === "owner" ? "Main Dev" : "Co-Dev"} view.`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong code");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Switch between Main Dev and Co-Dev view"
        aria-label="Switch between Main Dev and Co-Dev view"
      >
        <Repeat className="mr-1 h-3 w-3" aria-hidden="true" /> Switch view
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <Input
        type="password"
        inputMode="numeric"
        aria-label="Switch code"
        placeholder="••••"
        maxLength={4}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
        className="h-8 w-16 text-center tracking-widest"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "…" : "Go"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setPin("");
        }}
        aria-label="Cancel switch"
      >
        ✕
      </Button>
    </form>
  );
}
