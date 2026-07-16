import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { checkAuth } from "@/lib/auth.server";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const result = await checkAuth();
    if (result.authenticated)
      throw redirect({ to: result.role === "owner" ? "/dc" : "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Wishes for the app</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          What bugs you, what's missing, what should be different? Write it in your own words, and I'll
          help turn it into a clear update for Don.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Please don't include health data. Your message goes through Don's private project tools so
          it can be reviewed and turned into an update.
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
