import { isPathAllowed } from "../paths.server";
import { nextTier, type Tier } from "../openrouter.server";

export type PlannerOutput = { files: string[] };
export type EditorOutput = { summary: string; edits: Array<{ path: string; content: string }> };
export type JsonValidation<T> = { ok: true; value: T } | { ok: false; reason: string };

export const IDEA_STATUS_VALUES = [
  "submitted",
  "requested",
  "processing",
  "sent",
  "approved",
  "shipped",
  "live",
  "blocked",
  "closed",
] as const;

export type RealIdeaStatus = (typeof IDEA_STATUS_VALUES)[number];

const PUBLICATION_CLAIM_RE =
  /\b(published|publish(?:ed|es)?|live|shipped|done|already fixed|already resolved|fixed already)\b/i;
const FORBIDDEN_PERSON_RE =
  /\b(?:Sarah|Sara|Noah|Nora|Alex|Alice|Bob|Charlie|Product Owner|designer team|support team)\b/i;
const FORBIDDEN_SCREEN_RE =
  /\b(?:admin panel|billing screen|team inbox|settings marketplace|deployment console)\b/i;

export function safeJsonParseLikeEngine<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validatePlannerOutput(text: string): JsonValidation<PlannerOutput> {
  const parsed = safeJsonParseLikeEngine<Partial<PlannerOutput>>(text);
  if (!parsed) return { ok: false, reason: "planner output is not JSON" };
  if (!isStringArray(parsed.files)) return { ok: false, reason: "planner files must be strings" };
  return { ok: true, value: { files: parsed.files } };
}

export function validateEditorOutput(text: string): JsonValidation<EditorOutput> {
  const parsed = safeJsonParseLikeEngine<Partial<EditorOutput>>(text);
  if (!parsed) return { ok: false, reason: "editor output is not JSON" };
  if (typeof parsed.summary !== "string") {
    return { ok: false, reason: "editor summary must be a string" };
  }
  if (
    !Array.isArray(parsed.edits) ||
    parsed.edits.some(
      (edit) =>
        typeof edit !== "object" ||
        edit == null ||
        typeof (edit as { path?: unknown }).path !== "string" ||
        typeof (edit as { content?: unknown }).content !== "string",
    )
  ) {
    return { ok: false, reason: "editor edits must contain path and content strings" };
  }
  return {
    ok: true,
    value: parsed as EditorOutput,
  };
}

export function blockedEditorPaths(
  editor: EditorOutput,
  fetchedPaths: string[],
  rules: { allowed: string[]; forbidden: string[] },
): string[] {
  const fetched = new Set(fetchedPaths);
  return editor.edits
    .map((edit) => edit.path)
    .filter((path) => !fetched.has(path) || !isPathAllowed(path, rules));
}

export function containsUnsupportedStatusClaim(text: string, hasRealStatusData: boolean): boolean {
  return !hasRealStatusData && PUBLICATION_CLAIM_RE.test(text);
}

export function containsInventedPersonRoleOrScreen(text: string): boolean {
  return FORBIDDEN_PERSON_RE.test(text) || FORBIDDEN_SCREEN_RE.test(text);
}

export function hasRefinedVersionLabel(text: string): boolean {
  return /\bRefined version:/i.test(text);
}

export function filterAssistantHonestyReply(
  text: string,
  options: { hasRealStatusData: boolean; allowRefinedVersionLabel: boolean },
): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (containsUnsupportedStatusClaim(trimmed, options.hasRealStatusData)) {
    return "I cannot verify that from this chat. In the cockpit, collected, ready, and waiting on owner are working states, not proof that a change reached the phone.";
  }

  if (containsInventedPersonRoleOrScreen(trimmed)) {
    return "I cannot verify that person, role, or screen in this cockpit. Don is the only named owner here, and I should stick to the real cockpit screens and statuses.";
  }

  if (!options.allowRefinedVersionLabel && hasRefinedVersionLabel(trimmed)) {
    return trimmed.replace(/\bRefined version:\s*/i, "").trim();
  }

  return trimmed;
}

export function isRealIdeaStatus(value: string): value is RealIdeaStatus {
  return (IDEA_STATUS_VALUES as readonly string[]).includes(value);
}

export function canClaimPublished(status: RealIdeaStatus, bdcPaused: boolean): boolean {
  return !bdcPaused && (status === "shipped" || status === "live");
}

export function canClaimLive(status: RealIdeaStatus, bdcPaused: boolean): boolean {
  return !bdcPaused && status === "live";
}

export function nextTierAfterValidation(
  tier: Tier,
  result: "success" | "parse_error" | "validation_error",
): Tier | null {
  return result === "success" ? tier : nextTier(tier);
}
