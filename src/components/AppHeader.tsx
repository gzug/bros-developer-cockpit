import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Lock, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/lib/auth.server";
import { useEffect, useState } from "react";

// Owner-only nav entries render for BOTH roles: active links for the owner, and greyed-out
// locked labels for the co-dev — so the brother can see what more experience will unlock.
// Access is enforced server-side (requireOwner); this is UI affordance only.
const OWNER_LINKS = [
  { to: "/runs", label: "Runs" },
  { to: "/dc", label: "DC" },
  { to: "/skills", label: "Skills" },
  { to: "/owner-kpi", label: "Stats" },
] as const;

export function AppHeader({ owner = false }: { owner?: boolean }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    router.invalidate();
    navigate({ to: "/", replace: true });
  }

  function toggleTheme() {
    const nextDark = !isDark;
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
    setIsDark(nextDark);
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3 sm:max-w-2xl sm:px-4">
        <Link to="/dashboard" className="shrink-0 text-sm font-semibold">
          {owner ? "OL1 · Owner" : "One L1fe · Wishes"}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Link
            to="/dashboard"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Mine
          </Link>
          <Link
            to="/chat"
            search={{}}
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            New
          </Link>
          <Link
            to="/pipeline"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Pipeline
          </Link>
          <Link
            to="/done"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Done
          </Link>
          {OWNER_LINKS.map((item) =>
            owner ? (
              <Link
                key={item.to}
                to={item.to}
                className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.to}
                className="flex cursor-not-allowed items-center gap-1 rounded px-2 py-1 text-muted-foreground/40"
                title="Owner area — unlocks with more experience"
                aria-disabled="true"
              >
                <Lock className="h-3 w-3" />
                {item.label}
              </span>
            ),
          )}
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
