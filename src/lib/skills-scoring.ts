import measurementConfig from "./skills.config.json";

export const SKILL_DIMENSIONS = [
  "Prompting",
  "Debugging",
  "Architecture",
  "Testing",
  "Reviewing",
  "Shipping",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];
export type ProviderName = "Claude" | "ChatGPT" | "Google/Gemini" | "Unknown";

export type SkillScores = Record<SkillDimension, number>;

export type SkillMessage = {
  role: "user" | "assistant" | "system" | "other";
  text: string;
  createdAt?: string;
};

export type SkillConversation = {
  provider: ProviderName;
  sourceFile: string;
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  messages: SkillMessage[];
};

export type PngEvidence = {
  filename: string;
  sizeBytes: number;
  lastModified?: string;
  note?: string;
};

export type ExportProvenance = {
  provider: ProviderName;
  filename: string;
  exportDate?: string;
  conversationCount: number;
  messageCount: number;
  userPromptCount: number;
};

export type CountedInput = {
  key: string;
  label: string;
  value: number | string;
};

export type DimensionDetail = {
  score: number;
  formula: string;
  inputs: CountedInput[];
};

export type SkillSnapshot = {
  schemaVersion: 1;
  createdAt: string;
  exportDate?: string;
  scores: SkillScores;
  dimensionDetails: Record<SkillDimension, DimensionDetail>;
  provenance: {
    providers: ProviderName[];
    exports: ExportProvenance[];
    pngEvidence: PngEvidence[];
    conversationCount: number;
    messageCount: number;
    userPromptCount: number;
  };
  smallData: boolean;
};

export type SkillChartRow = {
  skill: SkillDimension;
  start: number;
  now: number;
};

export type MeasurementGuide = typeof measurementConfig;

export const SAMPLE_SKILL_DATA: SkillChartRow[] = [
  { skill: "Prompting", start: 50, now: 82 },
  { skill: "Debugging", start: 40, now: 74 },
  { skill: "Architecture", start: 35, now: 68 },
  { skill: "Testing", start: 30, now: 62 },
  { skill: "Reviewing", start: 45, now: 78 },
  { skill: "Shipping", start: 55, now: 88 },
];

const KEYWORDS: Record<Exclude<SkillDimension, "Prompting">, string[]> = {
  Debugging: [
    "bug",
    "debug",
    "error",
    "exception",
    "stack trace",
    "failing",
    "failure",
    "regression",
    "fix",
    "broken",
  ],
  Architecture: [
    "architecture",
    "design",
    "module",
    "boundary",
    "service",
    "schema",
    "pattern",
    "interface",
    "abstraction",
    "dependency",
  ],
  Testing: [
    "test",
    "tests",
    "coverage",
    "fixture",
    "mock",
    "assert",
    "validate",
    "typecheck",
    "build",
    "regression",
  ],
  Reviewing: [
    "review",
    "risk",
    "diff",
    "pr",
    "pull request",
    "comment",
    "feedback",
    "nit",
    "approve",
    "changes requested",
  ],
  Shipping: [
    "ship",
    "shipping",
    "deploy",
    "release",
    "merge",
    "publish",
    "production",
    "handoff",
    "pr",
    "validation",
  ],
};

const CORRECTION_KEYWORDS = [
  "actually",
  "instead",
  "wrong",
  "incorrect",
  "try again",
  "revert",
  "stop",
  "not that",
  "fix this",
  "change that",
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratioScore(numerator: number, denominator: number, targetRatio: number): number {
  if (denominator <= 0 || targetRatio <= 0) return 0;
  return Math.min(1, numerator / denominator / targetRatio);
}

function avgLengthScore(avgUserPromptChars: number): number {
  return Math.min(1, avgUserPromptChars / 500);
}

function followUpScore(followUpDepth: number): number {
  return Math.min(1, followUpDepth / 5);
}

function countCodeBlocks(text: string): number {
  const fenced = text.match(/```/g)?.length ?? 0;
  const inline = text.match(/`[^`\n]{4,}`/g)?.length ?? 0;
  return Math.floor(fenced / 2) + inline;
}

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function detailFor(
  dimension: SkillDimension,
  score: number,
  inputs: CountedInput[],
): DimensionDetail {
  const definition = measurementConfig.dimensions.find((entry) => entry.key === dimension);
  return {
    score,
    formula: definition?.formula ?? "No formula documented.",
    inputs,
  };
}

export function getMeasurementGuide(): MeasurementGuide {
  return measurementConfig;
}

export function computeSkillSnapshot(input: {
  conversations: SkillConversation[];
  exports: ExportProvenance[];
  pngEvidence?: PngEvidence[];
  createdAt?: string;
}): SkillSnapshot {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const messages = input.conversations.flatMap((conversation) => conversation.messages);
  const userMessages = messages.filter((message) => message.role === "user");
  const userPromptCount = userMessages.length;
  const userPromptChars = userMessages.reduce((sum, message) => sum + message.text.length, 0);
  const avgUserPromptChars = userPromptCount > 0 ? Math.round(userPromptChars / userPromptCount) : 0;
  const messageCount = messages.length;
  const conversationCount = input.conversations.length;
  const codeBlockCount = messages.reduce((sum, message) => sum + countCodeBlocks(message.text), 0);
  const correctionMarkerCount = userMessages.filter((message) => includesAny(message.text, CORRECTION_KEYWORDS)).length;

  const dimensionMarkerCounts = {
    Debugging: userMessages.filter((message) => includesAny(message.text, KEYWORDS.Debugging)).length,
    Architecture: userMessages.filter((message) => includesAny(message.text, KEYWORDS.Architecture)).length,
    Testing: userMessages.filter((message) => includesAny(message.text, KEYWORDS.Testing)).length,
    Reviewing: userMessages.filter((message) => includesAny(message.text, KEYWORDS.Reviewing)).length,
    Shipping: userMessages.filter((message) => includesAny(message.text, KEYWORDS.Shipping)).length,
  } satisfies Record<Exclude<SkillDimension, "Prompting">, number>;

  const followUpDepth = input.conversations.reduce((max, conversation) => {
    const userCount = conversation.messages.filter((message) => message.role === "user").length;
    return Math.max(max, Math.max(0, userCount - 1));
  }, 0);

  const promptLength = avgLengthScore(avgUserPromptChars);
  const followUps = followUpScore(followUpDepth);
  const codeContext = ratioScore(codeBlockCount, Math.max(1, userPromptCount), 0.35);
  const correction = ratioScore(correctionMarkerCount, Math.max(1, userPromptCount), 0.3);
  const markerScore = (count: number, targetRatio = 0.3) => ratioScore(count, Math.max(1, userPromptCount), targetRatio);

  const scores: SkillScores = {
    Prompting: clampScore(35 * promptLength + 20 * followUps + 20 * codeContext + 25 * correction),
    Debugging: clampScore(50 * markerScore(dimensionMarkerCounts.Debugging) + 25 * correction + 25 * codeContext),
    Architecture: clampScore(60 * markerScore(dimensionMarkerCounts.Architecture) + 25 * promptLength + 15 * followUps),
    Testing: clampScore(70 * markerScore(dimensionMarkerCounts.Testing) + 20 * codeContext + 10 * correction),
    Reviewing: clampScore(65 * markerScore(dimensionMarkerCounts.Reviewing) + 20 * correction + 15 * followUps),
    Shipping: clampScore(65 * markerScore(dimensionMarkerCounts.Shipping) + 20 * markerScore(dimensionMarkerCounts.Testing) + 15 * followUps),
  };

  const baseInputs: CountedInput[] = [
    { key: "conversationCount", label: "Conversations", value: conversationCount },
    { key: "messageCount", label: "Messages", value: messageCount },
    { key: "userPromptCount", label: "User prompts", value: userPromptCount },
    { key: "avgUserPromptChars", label: "Average user prompt characters", value: avgUserPromptChars },
    { key: "codeBlockCount", label: "Code blocks", value: codeBlockCount },
    { key: "followUpDepth", label: "Follow-up depth", value: followUpDepth },
    { key: "correctionMarkerCount", label: "Correction markers", value: correctionMarkerCount },
  ];

  const dimensionDetails: Record<SkillDimension, DimensionDetail> = {
    Prompting: detailFor("Prompting", scores.Prompting, baseInputs),
    Debugging: detailFor("Debugging", scores.Debugging, [
      ...baseInputs,
      { key: "debugMarkerCount", label: "Debugging markers", value: dimensionMarkerCounts.Debugging },
    ]),
    Architecture: detailFor("Architecture", scores.Architecture, [
      ...baseInputs,
      { key: "architectureMarkerCount", label: "Architecture markers", value: dimensionMarkerCounts.Architecture },
    ]),
    Testing: detailFor("Testing", scores.Testing, [
      ...baseInputs,
      { key: "testingMarkerCount", label: "Testing markers", value: dimensionMarkerCounts.Testing },
    ]),
    Reviewing: detailFor("Reviewing", scores.Reviewing, [
      ...baseInputs,
      { key: "reviewingMarkerCount", label: "Reviewing markers", value: dimensionMarkerCounts.Reviewing },
    ]),
    Shipping: detailFor("Shipping", scores.Shipping, [
      ...baseInputs,
      { key: "shippingMarkerCount", label: "Shipping markers", value: dimensionMarkerCounts.Shipping },
      { key: "testingMarkerCount", label: "Testing markers", value: dimensionMarkerCounts.Testing },
    ]),
  };

  const providers = Array.from(new Set(input.exports.map((entry) => entry.provider)));
  const exportDates = input.exports.map((entry) => entry.exportDate).filter((date): date is string => Boolean(date));

  return {
    schemaVersion: 1,
    createdAt,
    exportDate: exportDates.sort().at(-1),
    scores,
    dimensionDetails,
    provenance: {
      providers,
      exports: input.exports,
      pngEvidence: input.pngEvidence ?? [],
      conversationCount,
      messageCount,
      userPromptCount,
    },
    smallData: conversationCount < 3 || userPromptCount < 10,
  };
}

export function chartDataFromSnapshots(snapshots: SkillSnapshot[]): SkillChartRow[] {
  if (snapshots.length === 0) return SAMPLE_SKILL_DATA;
  const sorted = [...snapshots].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const start = sorted[0];
  const now = sorted[sorted.length - 1];
  return SKILL_DIMENSIONS.map((skill) => ({
    skill,
    start: start.scores[skill],
    now: now.scores[skill],
  }));
}

export function snapshotHasRawText(snapshot: SkillSnapshot, phrases: string[]): boolean {
  const serialized = JSON.stringify(snapshot).toLowerCase();
  return phrases.some((phrase) => serialized.includes(phrase.toLowerCase()));
}
