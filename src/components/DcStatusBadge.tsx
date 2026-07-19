import { CheckCircle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getIdeaStatusBadgeClass, getIdeaStatusLabel, type IdeaStatus } from "@/lib/idea-status";

const IDEA_STATUSES = new Set<IdeaStatus>([
  "submitted",
  "requested",
  "processing",
  "sent",
  "approved",
  "shipped",
  "live",
  "blocked",
  "closed",
]);

function isIdeaStatus(status: string): status is IdeaStatus {
  return IDEA_STATUSES.has(status as IdeaStatus);
}

export function DcStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (isIdeaStatus(normalized)) {
    const label = getIdeaStatusLabel(normalized);
    return (
      <Badge
        variant="outline"
        className={`${normalized === "blocked" ? "gap-1 " : ""}${getIdeaStatusBadgeClass(normalized)}`}
      >
        {normalized === "blocked" && <ShieldAlert className="h-3 w-3" aria-hidden="true" />}
        {label}
      </Badge>
    );
  }
  if (normalized === "failed") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-rose-500/30 text-rose-700 dark:text-rose-300"
      >
        <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Failed
      </Badge>
    );
  }
  if (normalized === "completed") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle className="h-3 w-3" aria-hidden="true" /> Done
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}
