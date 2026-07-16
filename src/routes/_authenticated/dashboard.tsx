import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listIdeaEntries, recentIdeaUsage } from "@/lib/ideas.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const STATUS_TEXT = {
  submitted: "Received",
  processing: "Being prepared",
  sent: "Ready for Don to review",
  approved: "Approved, safety checks are running",
  shipped: "Update published, check your phone",
  live: "Checked on the phone",
  blocked: "Needs Don's help",
  closed: "Closed",
} as const;

const STATUS_CLASS = {
  submitted: "bg-amber-500",
  processing: "bg-sky-500",
  sent: "bg-amber-500",
  approved: "bg-sky-500",
  shipped: "bg-violet-500",
  live: "bg-emerald-500",
  blocked: "bg-rose-500",
  closed: "bg-zinc-500",
} as const;

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
            <h1 className="text-2xl font-semibold tracking-tight">Your wishes</h1>
            {usage.isLoading && (
              <p className="mt-1 text-xs text-muted-foreground">Checking recent activity…</p>
            )}
            {usage.isError && (
              <p className="mt-1 text-xs text-rose-600">Recent activity is unavailable.</p>
            )}
            {usage.data && (
              <p className="mt-1 text-xs text-muted-foreground">
                {usage.data.count} wishes in the last {usage.data.windowHours} hours.
              </p>
            )}
          </div>
          <Button asChild size="sm">
            <Link to="/chat">New</Link>
          </Button>
        </div>

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
              Nothing here yet.{" "}
              <Link to="/chat" className="underline">
                Write your first wish
              </Link>
              !
            </div>
          )}
          {list.isError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
              Your wishes could not be loaded.{" "}
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
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_CLASS[idea.status]}`}
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
                {STATUS_TEXT[idea.status]}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
