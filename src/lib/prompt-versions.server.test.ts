import { expect, test } from "bun:test";
import { parsePromptChangelog } from "./prompt-versions";

test("parsePromptChangelog reads version rows from the markdown table", () => {
  const rows = parsePromptChangelog(`
# Project Lead Prompt Versions

| Version | Date | What changed | Why | Expected effect |
|---|---|---|---|---|
| v1 | 2026-07-16 | Snapshotted prompt. | Baseline. | Compare later. |
| v2 | 2026-07-17 | Better handoff. | Avoid drift. | Current prompt is visible. |
`);

  expect(rows).toEqual([
    {
      version: "v1",
      date: "2026-07-16",
      whatChanged: "Snapshotted prompt.",
      why: "Baseline.",
      expectedEffect: "Compare later.",
    },
    {
      version: "v2",
      date: "2026-07-17",
      whatChanged: "Better handoff.",
      why: "Avoid drift.",
      expectedEffect: "Current prompt is visible.",
    },
  ]);
});
