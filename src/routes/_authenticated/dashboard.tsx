import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { PublishingTrustNotice } from "@/components/PublishingTrustNotice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getIdeaStatusDotClass, getIdeaStatusLabel } from "@/lib/idea-status";
import { listIdeaEntries, recentIdeaUsage } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const list = useQuery({
    queryKey: ["ideas"],
    queryFn: () => listIdeaEntries(),
  });
  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: () => recentIdeaUsage(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your ideas</h1>
            {usage.isLoading && (
              <p className="mt-1 text-xs text-muted-foreground">Checking activity...</p>
            )}
            {usage.isError && (
              <p className="mt-1 text-xs text-rose-600">Activity is unavailable right now.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Tap an idea to see its status and next step.
              {usage.data
                ? ` ${usage.data.count} in the last ${usage.data.windowHours} hours.`
                : ""}
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/chat" search={{}}>
              New idea
            </Link>
          </Button>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">What is this?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The cockpit collects your ideas for the One L1fe app and turns them into clear tasks.
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">What is happening?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each entry shows its status: collected, being checked, ready, or live confirmed.
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">What is paused?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing is published automatically. Don keeps final control.
            </p>
          </div>
        </section>

        <details className="mt-4 rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Status, briefly explained
          </summary>
          <div className="mt-3 space-y-3 text-xs text-muted-foreground">
            <p>Your ideas appear here first. New entries stay at the top.</p>
            <p>
              Tapping an idea opens the detail view with description, current status, and the next
              safe step. It does not approve or publish anything.
            </p>
            <p>
              The terms are intentionally simple: collected, checked, ready, paused, waiting on
              owner.
            </p>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">Collected</span> means the idea is
                here, but nothing has been built or published.
              </li>
              <li>
                <span className="font-medium text-foreground">Waiting on owner</span> means Don must
                deliberately check, start, or approve it.
              </li>
              <li>
                <span className="font-medium text-foreground">Live confirmed</span> means the change
                was seen and checked on the phone.
              </li>
            </ul>
          </div>
        </details>

        <PublishingTrustNotice compact className="mt-4" />

        <div className="mt-6 space-y-2">
          {list.isLoading && (
            <div role="status" aria-label="Ideas are loading">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          )}
          {list.isSuccess && list.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No ideas collected yet. This area stays empty until you confirm an idea in chat or add
              one in the plan.{" "}
              <Link to="/chat" search={{}} className="underline">
                Start with a first idea
              </Link>
              .
            </div>
          )}
          {list.isError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
              Your ideas could not be loaded.{" "}
              <button type="button" className="underline" onClick={() => list.refetch()}>
                Try again
              </button>
              .
            </div>
          )}
          {list.data?.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => router.navigate({ to: "/idea/$id", params: { id: String(idea.id) } })}
              className="flex w-full flex-col rounded-md border border-border bg-card p-3 text-left hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${getIdeaStatusDotClass(idea.status)}`}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium">{idea.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(idea.createdAt).toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </div>
              <span className="mt-1 pl-[18px] text-xs text-muted-foreground">
                {idea.statusSummary || getIdeaStatusLabel(idea.status)}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
