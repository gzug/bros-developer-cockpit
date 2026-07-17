export const PAXEL_METRICS = [
  "steering",
  "execution",
  "quality",
  "product",
  "planning",
] as const;

export type MetricId = (typeof PAXEL_METRICS)[number];
export type PaxelSource = "claude-code" | "codex-cli";
export type Confidence = "low" | "medium" | "high";
export type MetricScores = Record<MetricId, number>;

export type PromptEvent = { text: string; timestamp?: string };
export type ToolEvent = { name: string; status: "success" | "failed"; timestamp?: string };

export type NormalizedSession = {
  id: string;
  source: PaxelSource;
  startedAt?: string;
  endedAt?: string;
  prompts: PromptEvent[];
  tools: ToolEvent[];
  commitCount: number;
  malformedLines: number;
  eventTimestamps: string[];
  wallSeconds: number;
  activeSeconds: number;
};

export type Archetype = {
  primary: string;
  secondary: string;
  confidence: number;
};

export type LocalRecommendation = {
  metric: MetricId;
  title: string;
  description: string;
};

export type SessionReport = {
  id: string;
  recordedAt: string;
  source: PaxelSource;
  scores: MetricScores;
  stats: {
    promptCount: number;
    toolCount: number;
    errorCount: number;
    commitCount: number;
    activeSeconds: number;
    wallSeconds: number;
  };
  archetype: Archetype;
  recommendations: LocalRecommendation[];
  weakestPrompts: Array<{ prompt: string; critique: string }>;
};

export type PaxelMetric = {
  id: MetricId;
  label: string;
  value: number;
  previousValue?: number;
  unit: "score";
  confidence: Confidence;
};

export type PaxelSnapshot = {
  schemaVersion: 1;
  subjectId: "owner";
  recordedAt: string;
  window: { since?: string; until: string };
  metrics: PaxelMetric[];
  archetype: Archetype;
  stats: {
    sessionCount: number;
    dayCount: number;
    promptCount: number;
    toolCount: number;
    errorCount: number;
    commitCount: number;
    activeSeconds: number;
    wallSeconds: number;
  };
  sessions: Array<{
    id: string;
    recordedAt: string;
    source: PaxelSource;
    scores: MetricScores;
  }>;
  days: Array<{
    day: string;
    sessionCount: number;
    scores: MetricScores;
  }>;
  recommendations: LocalRecommendation[];
  provenance: {
    runnerVersion: string;
    sources: PaxelSource[];
  };
};
