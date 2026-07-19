import { Button } from "@/components/ui/button";
import type { UiDataState } from "@/lib/ui-data-state";

type DataStateMessageProps = {
  state: UiDataState;
  loading: string;
  error: string;
  empty?: string;
  sample?: string;
  stale?: string;
  onRetry?: () => void;
};

export function DataStateMessage({
  state,
  loading,
  error,
  empty = "Nothing here yet.",
  sample = "This is sample data, not a real measurement.",
  stale = "Refreshing the latest data...",
  onRetry,
}: DataStateMessageProps) {
  if (state === "success") return null;
  if (state === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {loading}
      </p>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
        <p>{error}</p>
        {onRetry && (
          <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  if (state === "sample") {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
        {sample}
      </div>
    );
  }
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {stale}
    </p>
  );
}
