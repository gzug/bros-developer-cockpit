import { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const HelpBubblePanel = lazy(() =>
  import("./HelpBubblePanel").then((module) => ({ default: module.HelpBubblePanel })),
);

// The trigger stays in the authenticated shell; the model-backed panel is loaded only on open.
export function HelpBubble() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        aria-label="Open app help"
        title="Questions about this app? Ask here."
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border border-primary/30 p-0 shadow-lg"
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="fixed bottom-4 right-4 z-50 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-xl"
          role="status"
          aria-label="Loading app help"
        >
          Loading help...
        </div>
      }
    >
      <HelpBubblePanel onClose={() => setOpen(false)} />
    </Suspense>
  );
}
