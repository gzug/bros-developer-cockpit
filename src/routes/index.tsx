import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          Wünsche für die App
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Was findest du blöd, was fehlt, was soll anders sein? Schreib's in
          eigenen Worten — ich sortier's und schick's an deinen Bruder.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Keine Gesundheitsdaten hier. Nichts wird an Fremde weitergegeben.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="w-full">
            <Link to="/auth">Login per E-Mail-Link</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
