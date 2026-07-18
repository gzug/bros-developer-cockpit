import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type PublishingTrustNoticeProps = {
  compact?: boolean;
  className?: string;
};

export function PublishingTrustNotice({ compact = false, className }: PublishingTrustNoticeProps) {
  return (
    <section
      className={cn(
        "rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100",
        compact ? "p-3" : "p-4",
        className,
      )}
      aria-label="Publishing safety status"
    >
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <h2 className="text-sm font-semibold">Publishing is paused</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The cockpit may collect, check, and prepare ideas. Nothing is published from these
            screens by accident; owner approval is the visible final control before publication.
          </p>
          {!compact && (
            <p className="mt-2 text-xs text-muted-foreground">
              Collected, checked, ready, paused, and waiting on owner are working states. Published
              appears only after the owner-controlled path has run, and live still needs a phone
              check.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
