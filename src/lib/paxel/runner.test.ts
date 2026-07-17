import { expect, test } from "bun:test";
import { parseClaudeCodeJsonl, parseCodexJsonl } from "./runner";

test("Claude Code adapter reads user prompts, tool uses, errors, and malformed lines", () => {
  const raw = [
    JSON.stringify({ type: "user", timestamp: "2026-07-17T10:00:00Z", message: { role: "user", content: [{ type: "text", text: "Plan the change" }] } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-07-17T10:01:00Z", message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m test" } }] } }),
    JSON.stringify({ type: "tool_result", timestamp: "2026-07-17T10:02:00Z", message: { content: [{ type: "tool_result", name: "Bash", is_error: true }] } }),
    "not json",
  ].join("\n");
  const parsed = parseClaudeCodeJsonl(raw);
  expect(parsed.source).toBe("claude-code");
  expect(parsed.prompts).toHaveLength(1);
  expect(parsed.tools.length).toBeGreaterThanOrEqual(2);
  expect(parsed.tools.some((tool) => tool.status === "failed")).toBe(true);
  expect(parsed.commitCount).toBe(1);
  expect(parsed.malformedLines).toBe(1);
});

test("Codex adapter reads nested response_item and event_msg payloads", () => {
  const raw = [
    JSON.stringify({ type: "event_msg", timestamp: "2026-07-17T11:00:00Z", payload: { type: "user_message", message: "Review this plan" } }),
    JSON.stringify({ type: "response_item", timestamp: "2026-07-17T11:01:00Z", payload: { type: "function_call", name: "exec_command", arguments: "git commit -m test" } }),
    JSON.stringify({ type: "response_item", timestamp: "2026-07-17T11:02:00Z", payload: { type: "function_call_output", name: "exec_command", exit_code: 1 } }),
  ].join("\n");
  const parsed = parseCodexJsonl(raw);
  expect(parsed.source).toBe("codex-cli");
  expect(parsed.prompts[0]?.text).toBe("Review this plan");
  expect(parsed.tools.some((tool) => tool.status === "failed")).toBe(true);
  expect(parsed.commitCount).toBe(1);
});
