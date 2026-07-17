import { createServerFn } from "@tanstack/react-start";
import { listPaxelSnapshots } from "./snapshots.server";
import { PAXEL_METRICS, type MetricId, type PaxelSnapshot } from "./types";

export type BuilderProfileRow = { metric: MetricId; label: string; start: number; now: number };

export type BuilderProfileData = {
  role: "owner" | "brother";
  active: boolean;
  snapshots: Array<PaxelSnapshot & { issueNumber: number; issueUrl: string }>;
  latest: (PaxelSnapshot & { issueNumber: number; issueUrl: string }) | null;
  chartData: BuilderProfileRow[];
  githubError: string | null;
};

const LABELS: Record<MetricId, string> = {
  steering: "Steering",
  execution: "Execution",
  quality: "Quality",
  product: "Product",
  planning: "Planning",
};

function emptyData(role: "owner" | "brother"): BuilderProfileData {
  return {
    role,
    active: role === "owner",
    snapshots: [],
    latest: null,
    chartData: [],
    githubError: null,
  };
}

function chartDataFromSnapshots(snapshots: BuilderProfileData["snapshots"]): BuilderProfileRow[] {
  if (snapshots.length === 0) return [];
  const start = snapshots[0];
  const now = snapshots.at(-1) ?? start;
  return PAXEL_METRICS.map((metric) => ({
    metric,
    label: LABELS[metric],
    start: start.metrics.find((entry) => entry.id === metric)?.value ?? 0,
    now: now.metrics.find((entry) => entry.id === metric)?.value ?? 0,
  }));
}

export const getBuilderProfileData = createServerFn({ method: "GET" }).handler(async (): Promise<BuilderProfileData> => {
  const { requireAuth } = await import("../auth-session.server");
  const role = requireAuth();
  if (role === "brother") return emptyData(role);
  try {
    const snapshots = await listPaxelSnapshots();
    return {
      role,
      active: true,
      snapshots,
      latest: snapshots.at(-1) ?? null,
      chartData: chartDataFromSnapshots(snapshots),
      githubError: null,
    };
  } catch (error) {
    return { ...emptyData(role), githubError: error instanceof Error ? error.message : String(error) };
  }
});
