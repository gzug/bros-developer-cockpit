import { CheckCircle2, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIdeaTimeline, getIdeaNextStep, type IdeaStatus } from "@/lib/idea-status";

type IdeaStatusTimelineProps = {
  status: IdeaStatus;
};

export function IdeaStatusTimeline({ status }: IdeaStatusTimelineProps) {
  const steps = getIdeaTimeline(status);
  const nextStep = getIdeaNextStep(status);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Timeline</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow your wish from request to phone.
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
          Next step
        </span>
      </div>

      <p className="mt-3 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        {nextStep}
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => {
          const Icon =
            step.state === "complete" ? CheckCircle2 : step.state === "current" ? Dot : Circle;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex w-5 flex-col items-center">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    step.state === "complete" && "text-emerald-500",
                    step.state === "current" && "text-foreground",
                    step.state === "upcoming" && "text-muted-foreground/50",
                  )}
                  aria-hidden
                />
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mt-1 h-full min-h-5 w-px",
                      step.state === "complete" ? "bg-emerald-500/50" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.state === "current" && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
