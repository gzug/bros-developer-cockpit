import {
  PAXEL_METRICS,
  type Archetype,
  type Confidence,
  type LocalRecommendation,
  type MetricId,
  type MetricScores,
  type NormalizedSession,
  type PaxelSnapshot,
  type SessionReport,
} from "./types";

export const PAXEL_RUNNER_VERSION = "1.0.0";
export const ACTIVE_GAP_LIMIT_SECONDS = 30 * 60;

const LABELS: Record<MetricId, string> = {
  steering: "Steering",
  execution: "Execution",
  quality: "Quality",
  product: "Product",
  planning: "Planning",
};

const CORRECTION_WORDS = [
  "actually",
  "instead",
  "wrong",
  "incorrect",
  "try again",
  "revert",
  "stop",
  "not that",
  "different approach",
];
const PRODUCT_WORDS = [
  "user",
  "brother",
  "feature",
  "screen",
  "flow",
  "design",
  "experience",
  "ux",
  "accessibility",
  "simplify",
];
const PLAN_WORDS = [
  "plan",
  "design",
  "explore",
  "research",
  "verify first",
  "checklist",
  "requirements",
  "before editing",
];
const READ_WORDS = ["read", "grep", "glob", "list", "view", "find", "search", "cat"];
const ACTION_WORDS = [
  "write",
  "edit",
  "replace",
  "delete",
  "patch",
  "modify",
  "bash",
  "exec",
  "command",
  "apply_patch",
];

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lower(text: string): string {
  return text.toLocaleLowerCase();
}

function countMatching(texts: string[], words: string[]): number {
  return texts.filter((text) => words.some((word) => lower(text).includes(word))).length;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isReadTool(name: string): boolean {
  return READ_WORDS.some((word) => lower(name).includes(word));
}

function isActionTool(name: string): boolean {
  return ACTION_WORDS.some((word) => lower(name).includes(word));
}

function ratioScore(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, value / target);
}

/** Scrubs values before they can become part of a report or recommendation. */
export function scrubText(text: string): string {
  let scrubbed = text;
  scrubbed = scrubbed.replace(/\/(Users|home)\/[^\s/]+/gi, "~/[USER_HOME]");
  scrubbed = scrubbed.replace(/(?:[A-Za-z0-9_.-]+\/){2,}[A-Za-z0-9_.-]+/g, "[PATH]");
  scrubbed = scrubbed.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP_ADDRESS]");
  scrubbed = scrubbed.replace(
    /(bearer\s+|(?:api[_-]?key|secret|token|password|passwd|authorization)\s*[:=]\s*)([A-Za-z0-9_./+\-=]{8,})/gi,
    "$1[REDACTED_SECRET]",
  );
  scrubbed = scrubbed.replace(/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_]{12,}\b/g, "[REDACTED_SECRET]");
  return scrubbed;
}

export function activeSecondsFromTimestamps(timestamps: string[]): number {
  const ordered = timestamps
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  let active = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = Math.max(0, Math.round((ordered[index] - ordered[index - 1]) / 1000));
    if (gap <= ACTIVE_GAP_LIMIT_SECONDS) active += gap;
  }
  return active;
}

export function confidenceFor(sessionCount: number, promptCount: number): Confidence {
  if (sessionCount < 3 || promptCount < 10) return "low";
  if (sessionCount < 8 || promptCount < 30) return "medium";
  return "high";
}

function scoreSteering(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;
  const texts = session.prompts.map((prompt) => prompt.text);
  const averageLength = average(texts.map((text) => text.length));
  const specificity = Math.min(40, (averageLength / 400) * 40);
  const corrections = ratioScore(countMatching(texts, CORRECTION_WORDS), Math.max(1, texts.length * 0.25)) * 30;
  const bounded = texts.filter((text) => /[/.]|constraint|acceptance|must|only|never/i.test(text)).length;
  const bounds = ratioScore(bounded, Math.max(1, texts.length * 0.4)) * 30;
  return clamp(specificity + corrections + bounds);
}

function scoreExecution(session: NormalizedSession): number {
  if (session.tools.length === 0) return 50;
  const actionCount = session.tools.filter((tool) => isActionTool(tool.name)).length;
  const readCount = session.tools.filter((tool) => isReadTool(tool.name)).length;
  const activeHours = Math.max(0.1, session.activeSeconds / 3600);
  const velocity = Math.min(50, (actionCount / activeHours / 20) * 50);
  const ratio = readCount / Math.max(1, actionCount);
  const balance = ratio >= 1 && ratio <= 3 ? 50 : Math.max(10, 50 - Math.abs(ratio - 2) * 15);
  return clamp(velocity + balance);
}

function scoreQuality(session: NormalizedSession): number {
  if (session.tools.length === 0) return 50;
  const errors = session.tools.filter((tool) => tool.status === "failed").length;
  const errorScore = Math.max(0, 50 - (errors / session.tools.length) * 100);
  const tests = session.tools.filter((tool) => /test|typecheck|lint|build/i.test(tool.name)).length;
  const testScore = Math.min(30, (tests / Math.max(1, session.tools.length * 0.2)) * 30);
  const commitScore = Math.min(20, session.commitCount * 10);
  return clamp(errorScore + testScore + commitScore);
}

function scoreProduct(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;
  const texts = session.prompts.map((prompt) => prompt.text);
  const userFocus = ratioScore(countMatching(texts, PRODUCT_WORDS), Math.max(1, texts.length * 0.35)) * 50;
  const targetFocus = ratioScore(
    texts.filter((text) => /[/.]|feature|screen|route|component|module/i.test(text)).length,
    Math.max(1, texts.length * 0.4),
  ) * 50;
  return clamp(userFocus + targetFocus);
}

function scorePlanning(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;
  const texts = session.prompts.map((prompt) => prompt.text);
  const explicit = ratioScore(countMatching(texts, PLAN_WORDS), Math.max(1, texts.length * 0.25)) * 50;
  const reads = session.tools.filter((tool) => isReadTool(tool.name)).length;
  const actions = session.tools.filter((tool) => isActionTool(tool.name)).length;
  const ratio = reads / Math.max(1, actions);
  const balance = Math.min(50, (ratio / 1.5) * 50);
  return clamp(explicit + balance);
}

export function calculateScores(session: NormalizedSession): MetricScores {
  return {
    steering: scoreSteering(session),
    execution: scoreExecution(session),
    quality: scoreQuality(session),
    product: scoreProduct(session),
    planning: scorePlanning(session),
  };
}

export function determineArchetype(scores: MetricScores): Archetype {
  const ranked = [...PAXEL_METRICS].sort((a, b) => scores[b] - scores[a]);
  const primary = ranked[0];
  const secondary = ranked[1];
  const names: Record<MetricId, string> = {
    steering: "The Director",
    execution: "The Finisher",
    quality: "The Quality Guardian",
    product: "The Product Builder",
    planning: "The Architect",
  };
  return {
    primary: names[primary],
    secondary: names[secondary],
    confidence: Math.max(50, Math.min(95, Math.round(50 + (scores[primary] - scores[secondary]) * 0.8))),
  };
}

export function recommendationsFor(scores: MetricScores): LocalRecommendation[] {
  const copy: Record<MetricId, LocalRecommendation> = {
    steering: { metric: "steering", title: "Make the next prompt more specific", description: "State the target, constraints, and acceptance check in one short prompt." },
    execution: { metric: "execution", title: "Keep reading and editing in balance", description: "After exploration, name the smallest safe change and run it." },
    quality: { metric: "quality", title: "Review and test before moving on", description: "Add a focused test or validation step before the next large edit." },
    product: { metric: "product", title: "Anchor the change in the user's outcome", description: "Say who benefits and what should feel simpler when the work is done." },
    planning: { metric: "planning", title: "Write a short plan before editing", description: "List the files, risks, and proof you need before changing code." },
  };
  return [...PAXEL_METRICS]
    .sort((a, b) => scores[a] - scores[b])
    .slice(0, 3)
    .map((metric) => copy[metric]);
}

export function buildSessionReport(session: NormalizedSession, recordedAt?: string): SessionReport {
  const scores = calculateScores(session);
  const prompts = session.prompts
    .filter((prompt) => prompt.text.trim())
    .sort((a, b) => a.text.length - b.text.length)
    .slice(0, 3)
    .map((prompt) => ({
      prompt: scrubText(prompt.text).slice(0, 120),
      critique: prompt.text.length < 30 ? "Add the goal and the proof you expect." : "Name the boundary or acceptance check explicitly.",
    }));
  return {
    id: session.id,
    recordedAt: recordedAt ?? session.endedAt ?? session.startedAt ?? new Date().toISOString(),
    source: session.source,
    scores,
    stats: {
      promptCount: session.prompts.length,
      toolCount: session.tools.length,
      errorCount: session.tools.filter((tool) => tool.status === "failed").length,
      commitCount: session.commitCount,
      activeSeconds: session.activeSeconds,
      wallSeconds: session.wallSeconds,
    },
    archetype: determineArchetype(scores),
    recommendations: recommendationsFor(scores),
    weakestPrompts: prompts,
  };
}

function dayFor(value: string): string {
  return value.slice(0, 10);
}

function averageScores(reports: SessionReport[]): MetricScores {
  return Object.fromEntries(
    PAXEL_METRICS.map((metric) => [metric, clamp(average(reports.map((report) => report.scores[metric])))])
  ) as MetricScores;
}

export function buildSnapshot(reports: SessionReport[], previous?: PaxelSnapshot | null): PaxelSnapshot {
  const ordered = [...reports].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const scores = averageScores(ordered);
  const days = Array.from(new Set(ordered.map((report) => dayFor(report.recordedAt)))).map((day) => {
    const dayReports = ordered.filter((report) => dayFor(report.recordedAt) === day);
    return { day, sessionCount: dayReports.length, scores: averageScores(dayReports) };
  });
  const first = ordered[0]?.recordedAt;
  const last = ordered.at(-1)?.recordedAt ?? new Date().toISOString();
  const promptCount = ordered.reduce((sum, report) => sum + report.stats.promptCount, 0);
  const confidence = confidenceFor(ordered.length, promptCount);
  const metrics = PAXEL_METRICS.map((id) => ({
    id,
    label: LABELS[id],
    value: scores[id],
    previousValue: previous?.metrics.find((metric) => metric.id === id)?.value,
    unit: "score" as const,
    confidence,
  }));
  const recommendationMap = new Map<string, LocalRecommendation>();
  ordered.forEach((report) => report.recommendations.forEach((item) => recommendationMap.set(item.metric, item)));
  return {
    schemaVersion: 1,
    subjectId: "owner",
    recordedAt: last,
    window: { since: first, until: last },
    metrics,
    archetype: determineArchetype(scores),
    stats: {
      sessionCount: ordered.length,
      dayCount: days.length,
      promptCount,
      toolCount: ordered.reduce((sum, report) => sum + report.stats.toolCount, 0),
      errorCount: ordered.reduce((sum, report) => sum + report.stats.errorCount, 0),
      commitCount: ordered.reduce((sum, report) => sum + report.stats.commitCount, 0),
      activeSeconds: ordered.reduce((sum, report) => sum + report.stats.activeSeconds, 0),
      wallSeconds: ordered.reduce((sum, report) => sum + report.stats.wallSeconds, 0),
    },
    sessions: ordered.map((report) => ({ id: report.id, recordedAt: report.recordedAt, source: report.source, scores: report.scores })),
    days,
    recommendations: [...recommendationMap.values()].slice(0, 3),
    provenance: {
      runnerVersion: PAXEL_RUNNER_VERSION,
      sources: Array.from(new Set(ordered.map((report) => report.source))),
    },
  };
}

export function snapshotContainsRawText(snapshot: PaxelSnapshot, rawPhrases: string[]): boolean {
  const serialized = JSON.stringify(snapshot).toLowerCase();
  return rawPhrases.some((phrase) => serialized.includes(phrase.toLowerCase()));
}

export function metricLabel(metric: MetricId): string {
  return LABELS[metric];
}
