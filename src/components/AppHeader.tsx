import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkAuth, logout } from "@/lib/auth.server";
import { getCockpitRoleLabel } from "@/lib/dc-display";
import { RoleSwitch } from "@/components/RoleSwitch";
import { useEffect, useState } from "react";

const navLinkClass =
  "rounded px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AppHeader() {
  // The header resolves the role itself (signed cookie via checkAuth) so the brand label always
  // shows the right role suffix, regardless of which page renders it.
  const auth = useQuery({ queryKey: ["auth-role"], queryFn: () => checkAuth(), staleTime: 60_000 });
  const role = auth.data?.role ?? null;
  const roleLabel = role ? getCockpitRoleLabel(role) : null;
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Light is the default; dark applies only when the user has explicitly
    // chosen it (persisted in localStorage). The OS preference is not used.
    const nextDark = window.localStorage.getItem("theme") === "dark";
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
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-3 py-3 sm:max-w-5xl sm:px-4">
        <Link
          to="/home"
          className="shrink-0 rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {roleLabel ? `One L1fe · ${roleLabel}` : "One L1fe"}
        </Link>
        <nav
          aria-label="Account and appearance"
          className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs sm:gap-2 sm:text-sm"
        >
          <RoleSwitch />
          <a
            href="https://claude.ai/code/artifact/be95efc4-96b4-4a22-9134-8e910546b0ea"
            target="_blank"
            rel="noreferrer"
            className={navLinkClass}
            aria-label="About this project (opens in a new tab)"
          >
            About
          </a>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light appearance" : "Switch to dark appearance"}
            aria-pressed={isDark}
            title={isDark ? "Switch to light appearance" : "Switch to dark appearance"}
          >
            {isDark ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Log out of cockpit">
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
