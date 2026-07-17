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
  submitted: "Submitted",
  processing: "Processing",
  sent: "PR waiting",
  approved: "Approved to ship",
  live: "Confirmed live",
  blocked: "Needs manual review",
  closed: "Closed",
} as const;

const STATUS_CLASS = {
  submitted: "bg-amber-500",
  processing: "bg-sky-500",
  sent: "bg-amber-500",
  approved: "bg-sky-500",
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
            <p className="mt-1 text-xs text-muted-foreground">
              {usage.data?.count ?? 0} wishes in the last {usage.data?.windowHours ?? 5} hours.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/chat" search={{}}>New</Link>
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
              Nothing here yet. <Link to="/chat" search={{}} className="underline">Write your first wish</Link>!
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
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_CLASS[idea.status]}`} aria-hidden />
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
