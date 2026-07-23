export type CockpitRole = "owner" | "brother";

export const COCKPIT_ROLE_DISPLAY: Record<CockpitRole, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Don's owner view for review, approval, and status control.",
  },
  brother: {
    label: "Co-dev",
    description: "Co-dev view for pitching ideas and following their status.",
  },
};

export function getCockpitRoleLabel(role: CockpitRole): string {
  return COCKPIT_ROLE_DISPLAY[role].label;
}

export function formatDcCost(value: string | number | null | undefined) {
  const cost = typeof value === "number" ? value : parseFloat(value || "0");
  return `$${cost.toFixed(4)}`;
}

export type DcQueueCardState = "unavailable" | "empty" | "populated";

/**
 * Decides how the owner cockpit's idea-queue card should render.
 *
 * A failed queue load ("unavailable") must stay distinct from a genuinely
 * empty but successful load ("empty"), so a GitHub outage or missing token
 * never masquerades as the "No ideas collected yet" empty state. The
 * unavailable flag is authoritative: it wins even if rows are somehow present.
 */
export function getDcQueueCardState(input: {
  queueUnavailable: boolean;
  queueCount: number;
}): DcQueueCardState {
  if (input.queueUnavailable) return "unavailable";
  if (input.queueCount === 0) return "empty";
  return "populated";
}
