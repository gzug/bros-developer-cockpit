import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
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
              <p className="mt-1 text-xs text-muted-foreground">Checking recent activity…</p>
            )}
            {usage.isError && (
              <p className="mt-1 text-xs text-rose-600">Recent activity is unavailable.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Tap an idea to see where it is.
              {usage.data ? ` ${usage.data.count} in the last ${usage.data.windowHours} hours.` : ""}
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/chat" search={{}}>New</Link>
          </Button>
        </div>

        <details className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">How this works</summary>
          <div className="mt-3 space-y-3 text-xs text-muted-foreground">
            <p>You pitch an idea here. It becomes a task, gets built, and is deployed to the phone.</p>
            <p>Your ideas appear newest first.</p>
            <p>
              Steps: received, shipping requested, being prepared, Don review, published, then
              checked on the phone.
            </p>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">Request shipping</span> asks Don to
                start. It is not published yet.
              </li>
              <li>
                <span className="font-medium text-foreground">Shipped</span> means published. Fully
                close One L1fe and open it twice to check the phone.
              </li>
              <li>
                <span className="font-medium text-foreground">Live</span> means someone confirmed the
                change on the phone.
              </li>
            </ul>
          </div>
        </details>

        <div className="mt-6 space-y-2">
          {list.isLoading && (
            <>
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </>
          )}
          {list.isSuccess && list.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing here yet. <Link to="/chat" search={{}} className="underline">Pitch your first idea</Link>!
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
