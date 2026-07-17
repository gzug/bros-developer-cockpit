import { createHash } from "node:crypto";
import { activeSecondsFromTimestamps, scrubText } from "./engine";
import type { NormalizedSession, PaxelSource, ToolEvent } from "./types";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join("\n");
  const object = record(value);
  for (const key of ["text", "content", "message", "output", "result", "command"]) {
    if (object[key] != null) return textFrom(object[key]);
  }
  return "";
}

function timestamp(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = typeof value === "number" ? new Date(value > 10_000_000_000 ? value : value * 1000) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function timestampFrom(object: JsonRecord, payload: JsonRecord): string | undefined {
  return timestamp(object.timestamp ?? object.created_at ?? object.createdAt ?? object.time ?? payload.timestamp ?? payload.created_at);
}

function stableId(raw: string, source: PaxelSource): string {
  return `${source}-${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

function commandText(object: JsonRecord): string {
  return textFrom(object.command ?? object.input ?? object.arguments ?? object.params ?? object.message);
}

function toolName(object: JsonRecord, payload: JsonRecord): string | undefined {
  const value = object.name ?? object.tool_name ?? object.tool ?? object.command_name ?? payload.name ?? payload.tool_name ?? payload.tool;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toolStatus(object: JsonRecord, payload: JsonRecord): ToolEvent["status"] {
  const failed = object.is_error === true || payload.is_error === true || object.error != null || payload.error != null || object.exit_code != null && Number(object.exit_code) !== 0 || payload.exit_code != null && Number(payload.exit_code) !== 0;
  return failed ? "failed" : "success";
}

function commitCountFrom(name: string | undefined, command: string): number {
  return /git\s+commit\b/i.test(`${name ?? ""} ${command}`) ? 1 : 0;
}

function finishSession(input: {
  raw: string;
  source: PaxelSource;
  prompts: NormalizedSession["prompts"];
  tools: NormalizedSession["tools"];
  commitCount: number;
  malformedLines: number;
  timestamps: string[];
}): NormalizedSession {
  const ordered = [...input.timestamps].sort();
  const startedAt = ordered[0];
  const endedAt = ordered.at(-1);
  const wallSeconds = startedAt && endedAt ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) : 0;
  return {
    id: stableId(input.raw, input.source),
    source: input.source,
    startedAt,
    endedAt,
    prompts: input.prompts,
    tools: input.tools,
    commitCount: input.commitCount,
    malformedLines: input.malformedLines,
    eventTimestamps: input.timestamps,
    wallSeconds,
    activeSeconds: activeSecondsFromTimestamps(input.timestamps),
  };
}

function addPrompt(prompts: NormalizedSession["prompts"], value: unknown, at?: string): void {
  const text = scrubText(textFrom(value)).trim();
  if (text) prompts.push({ text, timestamp: at });
}

function addTool(tools: NormalizedSession["tools"], name: string | undefined, status: ToolEvent["status"], at?: string): void {
  if (name) tools.push({ name: scrubText(name).slice(0, 120), status, timestamp: at });
}

function contentItems(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(record);
}

export function parseClaudeCodeJsonl(raw: string): NormalizedSession {
  const prompts: NormalizedSession["prompts"] = [];
  const tools: NormalizedSession["tools"] = [];
  const timestamps: string[] = [];
  let commitCount = 0;
  let malformedLines = 0;

  for (const line of raw.split(/\r?\n/).filter((entry) => entry.trim())) {
    let parsed: JsonRecord;
    try {
      parsed = record(JSON.parse(line));
    } catch {
      malformedLines += 1;
      continue;
    }
    const message = record(parsed.message);
    const at = timestampFrom(parsed, message);
    if (at) timestamps.push(at);
    const type = String(parsed.type ?? message.role ?? "").toLowerCase();
    const items = contentItems(message.content ?? parsed.content);
    if (type === "user" || message.role === "user") {
      const textItems = items.filter((item) => String(item.type ?? "text") === "text");
      addPrompt(prompts, textItems.length > 0 ? textItems.map((item) => item.text ?? item.content) : message.content ?? parsed.content ?? parsed.text, at);
    }
    for (const item of items) {
      const itemType = String(item.type ?? "").toLowerCase();
      if (itemType === "tool_use" || itemType === "tool_call") {
        const name = typeof item.name === "string" ? item.name : "tool";
        addTool(tools, name, "success", at);
        commitCount += commitCountFrom(name, commandText(item));
      }
      if (itemType === "tool_result" || itemType === "tool_error") {
        addTool(tools, typeof item.name === "string" ? item.name : "tool_result", toolStatus(item, {}), at);
      }
    }
    const name = toolName(parsed, message);
    if (type.includes("tool") || type.includes("assistant_tool")) {
      const command = commandText(parsed) || commandText(message);
      addTool(tools, name ?? type, toolStatus(parsed, message), at);
      commitCount += commitCountFrom(name ?? type, command);
    }
  }

  return finishSession({ raw, source: "claude-code", prompts, tools, commitCount, malformedLines, timestamps });
}

export function parseCodexJsonl(raw: string): NormalizedSession {
  const prompts: NormalizedSession["prompts"] = [];
  const tools: NormalizedSession["tools"] = [];
  const timestamps: string[] = [];
  let commitCount = 0;
  let malformedLines = 0;

  for (const line of raw.split(/\r?\n/).filter((entry) => entry.trim())) {
    let parsed: JsonRecord;
    try {
      parsed = record(JSON.parse(line));
    } catch {
      malformedLines += 1;
      continue;
    }
    const payload = record(parsed.payload);
    const at = timestampFrom(parsed, payload);
    if (at) timestamps.push(at);
    const type = String(parsed.type ?? "").toLowerCase();
    const payloadType = String(payload.type ?? "").toLowerCase();
    const role = String(parsed.role ?? payload.role ?? "").toLowerCase();
    if (role === "user" || type === "user_message" || type === "user" || payloadType === "user_message" || payloadType === "user") {
      addPrompt(prompts, payload.message ?? payload.text ?? parsed.message ?? parsed.text ?? payload.content, at);
    }
    const name = toolName(parsed, payload);
    const command = commandText(payload) || commandText(parsed);
    const isTool = type.includes("tool") || type.includes("function") || type.includes("exec") || type.includes("command") || payloadType.includes("tool") || payloadType.includes("function") || payloadType.includes("exec") || payloadType.includes("command") || name != null;
    if (isTool) {
      addTool(tools, name ?? payloadType ?? type, toolStatus(parsed, payload), at);
      commitCount += commitCountFrom(name ?? payloadType ?? type, command);
    }
  }

  return finishSession({ raw, source: "codex-cli", prompts, tools, commitCount, malformedLines, timestamps });
}

export function parseLocalSession(raw: string, source: PaxelSource): NormalizedSession {
  return source === "claude-code" ? parseClaudeCodeJsonl(raw) : parseCodexJsonl(raw);
}
