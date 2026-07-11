import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="text-sm font-semibold">
          One L1fe · Wünsche
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/dashboard"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Meine
          </Link>
          <Link
            to="/submit"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Neu
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
