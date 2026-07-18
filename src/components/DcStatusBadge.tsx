import { CheckCircle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DcStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "submitted") {
    return (
      <Badge variant="outline" className="border-amber-500/30 text-amber-600">
        Collected
      </Badge>
    );
  }
  if (normalized === "requested") {
    return (
      <Badge variant="outline" className="border-indigo-500/30 text-indigo-600">
        Waiting on owner
      </Badge>
    );
  }
  if (normalized === "processing") {
    return (
      <Badge variant="outline" className="border-blue-500/30 text-blue-600">
        Checking
      </Badge>
    );
  }
  if (normalized === "sent") {
    return (
      <Badge variant="outline" className="border-sky-500/30 text-sky-600">
        Ready
      </Badge>
    );
  }
  if (normalized === "approved") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
        Checked
      </Badge>
    );
  }
  if (normalized === "shipped") {
    return (
      <Badge variant="outline" className="border-violet-500/30 text-violet-600">
        Published
      </Badge>
    );
  }
  if (normalized === "live") {
    return (
      <Badge variant="outline" className="border-emerald-700/30 text-emerald-700">
        Live confirmed
      </Badge>
    );
  }
  if (normalized === "blocked" || normalized === "failed") {
    return (
      <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600">
        <ShieldAlert className="h-3 w-3" /> Paused
      </Badge>
    );
  }
  if (normalized === "completed") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600">
        <CheckCircle className="h-3 w-3" /> Done
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}
