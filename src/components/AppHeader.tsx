import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Lock, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkAuth, logout } from "@/lib/auth.server";
import { RoleSwitch } from "@/components/RoleSwitch";
import { useEffect, useState } from "react";

// Owner-only nav entries render for BOTH roles: active links for the owner, and greyed-out
// locked labels for the co-dev — so the brother can see what more experience will unlock.
// Access is enforced server-side (requireOwner); this is UI affordance only.
const OWNER_LINKS = [
  { to: "/runs", label: "Prep log" },
  { to: "/dc", label: "Control" },
  { to: "/skills", label: "Skills" },
  { to: "/prompts", label: "Instructions" },
  { to: "/owner-kpi", label: "Status" },
] as const;

const navLinkClass =
  "rounded px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const navActiveClass =
  "rounded px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AppHeader() {
  // The header resolves the role itself (signed cookie via checkAuth) so every page shows the
  // right nav — pages used to pass an `owner` prop and most forgot it, hiding the owner's links.
  const auth = useQuery({ queryKey: ["auth-role"], queryFn: () => checkAuth(), staleTime: 60_000 });
  const role = auth.data?.role ?? null;
  const owner = role === "owner";
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
          to="/dashboard"
          className="shrink-0 rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {owner ? "One L1fe · Control" : "One L1fe · Ideas"}
        </Link>
        <nav
          aria-label="Cockpit sections"
          className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs sm:gap-2 sm:text-sm"
        >
          <Link
            to="/dashboard"
            className={navLinkClass}
            activeProps={{ className: navActiveClass }}
          >
            Ideas
          </Link>
          <Link
            to="/chat"
            search={{}}
            className={navLinkClass}
            activeProps={{ className: navActiveClass }}
          >
            New idea
          </Link>
          <Link to="/pipeline" className={navLinkClass} activeProps={{ className: navActiveClass }}>
            Plan
          </Link>
          <Link to="/done" className={navLinkClass} activeProps={{ className: navActiveClass }}>
            Done
          </Link>
          {role !== null &&
            OWNER_LINKS.map((item) =>
              owner ? (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  activeProps={{ className: navActiveClass }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.to}
                  className="flex cursor-not-allowed items-center gap-1 rounded px-2 py-1 text-muted-foreground/40"
                  title="Owner area. Don checks and approves here."
                  aria-disabled="true"
                  aria-label={`${item.label}, owner-only area`}
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {item.label}
                </span>
              ),
            )}
          <RoleSwitch />
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={toggleTheme}
            aria-label="Toggle appearance"
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
