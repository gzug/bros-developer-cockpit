import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitIdeaFn } from "@/lib/ideas.functions";

type SubmissionType = "idea" | "change";

export const Route = createFileRoute("/_authenticated/submit")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { context?: string; type?: SubmissionType } => {
    const context = typeof search.context === "string" ? search.context.slice(0, 80) : undefined;
    const type = search.type === "change" || search.type === "idea" ? search.type : undefined;
    return { context, type };
  },
  component: SubmitPage,
});

function SubmitPage() {
  const search = Route.useSearch();
  const [type, setType] = useState<SubmissionType>(search.type ?? "idea");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screen, setScreen] = useState(search.context ?? "");
  const [submitted, setSubmitted] = useState<{ issueNumber: number; issueUrl: string } | null>(
    null,
  );

  const submit = useMutation({
    mutationFn: () =>
      submitIdeaFn({
        data: {
          type,
          title,
          description,
          screen,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubmitted({ issueNumber: result.issueNumber, issueUrl: result.issueUrl });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit.mutate();
  }

  const submitLabel = "Send wish";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Send a wish</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write what should change in One L1fe. Short and plain is enough.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-5">
            <h2 className="text-lg font-semibold">Your wish reached Don.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can follow its status with your other wishes.
            </p>
            <Button asChild className="mt-4">
              <a href="/dashboard">View my wishes</a>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-md border border-border bg-card p-5"
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Type</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="idea"
                    checked={type === "idea"}
                    onChange={() => setType("idea")}
                  />
                  <span>Something new</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="change"
                    checked={type === "change"}
                    onChange={() => setType("change")}
                  />
                  <span>Change something</span>
                </label>
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 80))}
                maxLength={80}
                required
              />
              <p className="text-xs text-muted-foreground">{title.length}/80</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">What should happen?</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 600))}
                maxLength={600}
                required
                rows={7}
              />
              <p className="text-xs text-muted-foreground">{description.length}/600</p>
              <p className="text-xs text-muted-foreground">Please don't include health data.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screen">Screen</Label>
              <Input
                id="screen"
                value={screen}
                onChange={(event) => setScreen(event.target.value.slice(0, 80))}
                placeholder="Optional"
                maxLength={80}
              />
            </div>

            <Button
              type="submit"
              disabled={submit.isPending}
              className="w-full"
            >
              {submit.isPending ? "Submitting..." : submitLabel}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
