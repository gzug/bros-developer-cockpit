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
