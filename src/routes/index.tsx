import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { checkAuth } from "@/lib/auth.server";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const result = await checkAuth();
    // The brother's single home is the consolidated Co-Dev page; the owner lands on the full
    // /home nav. `redirect` performs a history-replace so neither role gets stuck on "/".
    if (result.authenticated) {
      throw redirect({ to: result.role === "owner" ? "/home" : "/co-dev" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Ideas for the app</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          What is missing, what feels off, what should be different? Write it in your own words and
          I turn it into a clear update for Don.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Please leave out health data. Your note goes straight to Don to review.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="w-full">
            <Link to="/auth">Log in with code</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
