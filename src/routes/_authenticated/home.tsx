import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { HomeDock } from "@/components/HomeDock";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { checkAuth } from "@/lib/auth.server";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  // Same query key as AppHeader — shared cache, no duplicate fetch.
  const auth = useQuery({ queryKey: ["auth-role"], queryFn: () => checkAuth(), staleTime: 60_000 });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">One L1fe Cockpit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a section to get started.</p>
        <div className="mt-8 flex justify-center">
          <HomeDock role={auth.data?.role ?? null} />
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
