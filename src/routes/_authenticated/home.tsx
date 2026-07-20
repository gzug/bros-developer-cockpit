import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAuth } from "@/lib/auth.server";
import { NAV_DOCK, type NavEntry, type NavRole } from "@/lib/nav-model";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

// Same wording the app has always used for a locked, owner-only area. Keep it in one place.
const OWNER_LOCKED_TITLE = "Owner area. Don checks and approves here.";

function isAllowed(access: "all" | "owner", role: NavRole | null) {
  return access === "all" || role === "owner";
}

function LockedSectionCard({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;
  return (
    <Card className="opacity-80" aria-disabled="true" title={OWNER_LOCKED_TITLE}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          {entry.label}
          <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{entry.description}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            Owner only
          </Badge>
          {OWNER_LOCKED_TITLE}
        </p>
      </CardContent>
    </Card>
  );
}

function SectionCard({ entry }: { entry: Extract<NavEntry, { kind: "link" }> }) {
  const Icon = entry.icon;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          {entry.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{entry.description}</p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to={entry.to}>Open {entry.label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MenuSectionCard({ entry }: { entry: Extract<NavEntry, { kind: "menu" }> }) {
  const Icon = entry.icon;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          {entry.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{entry.description}</p>
        <div className="mt-3 flex flex-col gap-2">
          {entry.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              search={item.search}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <span className="font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HomePage() {
  // Same query key as AppHeader — shared cache, no duplicate fetch.
  const auth = useQuery({ queryKey: ["auth-role"], queryFn: () => checkAuth(), staleTime: 60_000 });
  const role = auth.data?.role ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">One L1fe Cockpit</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          This cockpit collects ideas for the One L1fe app, plans and tracks the work, and shows
          what has already shipped. Pick a section below.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {NAV_DOCK.map((entry) => {
            if (!isAllowed(entry.access, role)) {
              return <LockedSectionCard key={entry.id} entry={entry} />;
            }
            if (entry.kind === "menu") {
              return <MenuSectionCard key={entry.id} entry={entry} />;
            }
            return <SectionCard key={entry.id} entry={entry} />;
          })}
        </div>

        <div className="mt-10">
          {/* Owner's future video embed slot. Later PR can swap the placeholder for e.g.:
              <iframe
                src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
                title="One L1fe walkthrough"
                className="h-full w-full"
                allowFullScreen
              /> */}
          <AspectRatio
            ratio={16 / 9}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Video coming soon
            </div>
          </AspectRatio>
        </div>
      </main>
    </div>
  );
}
