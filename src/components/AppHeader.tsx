import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/lib/auth.server";
import { useEffect, useState } from "react";

export function AppHeader() {
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
          One L1fe · DC
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
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            New
          </Link>
          <Link
            to="/runs"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Runs
          </Link>
          <Link
            to="/analytics"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            Analytics
          </Link>
          <Link
            to="/dc"
            className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded px-2 py-1 text-foreground" }}
          >
            DC
          </Link>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={toggleTheme} aria-label="Toggle dark mode">
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
