import { expect, test } from "bun:test";
import {
  buildLocalPaxelReport,
  calculateSteering,
  calculateExecution,
  calculateQuality,
  calculateProduct,
  calculatePlanning,
  determineArchetypes,
  normalizeSessionData,
  type NormalizedSession,
} from "./paxel-engine";

test("normalizeSessionData successfully parses structured JSON transcripts", () => {
  const rawJSON = JSON.stringify({
    id: "test-session-id",
    title: "Awesome Test Session",
    start: "2026-07-13T12:00:00.000Z",
    duration: 3600,
    prompts: [
      { text: "Help me build a refactoring plan", timestamp: "2026-07-13T12:01:00.000Z" }
    ],
    tools: [
      { name: "read_file", status: "success" }
    ]
  });

  const parsed = normalizeSessionData(rawJSON);
  expect(parsed.id).toBe("test-session-id");
  expect(parsed.title).toBe("Awesome Test Session");
  expect(parsed.duration).toBe(3600);
  expect(parsed.prompts).toHaveLength(1);
  expect(parsed.prompts[0].text).toBe("Help me build a refactoring plan");
  expect(parsed.tools).toHaveLength(1);
  expect(parsed.tools[0].name).toBe("read_file");
});

test("normalizeSessionData parses JSONL line-by-line", () => {
  const line1 = JSON.stringify({ role: "user", content: "Implement a beautiful button", timestamp: "2026-07-13T12:00:00.000Z" });
  const line2 = JSON.stringify({ type: "tool", name: "edit", status: "success", timestamp: "2026-07-13T12:01:00.000Z" });
  const jsonl = `${line1}\n${line2}`;

  const parsed = normalizeSessionData(jsonl);
  expect(parsed.prompts).toHaveLength(1);
  expect(parsed.prompts[0].text).toBe("Implement a beautiful button");
  expect(parsed.tools).toHaveLength(1);
  expect(parsed.tools[0].name).toBe("edit");
});

test("scoring calculations map correct metrics", () => {
  const session: NormalizedSession = {
    id: "session-test",
    title: "Metrics Test",
    start: "2026-07-13T12:00:00.000Z",
    duration: 3600, // 1 hour
    prompts: [
      { text: "Actually, let's try a different, user-oriented design constraint in apps/mobile/components/Button.tsx" },
      { text: "Let's plan step-by-step refactoring first" }
    ],
    tools: [
      { name: "read_file", status: "success" },
      { name: "grep", status: "success" },
      { name: "edit", status: "success" },
      { name: "bun test", status: "success" }
    ]
  };

  const steering = calculateSteering(session);
  const execution = calculateExecution(session);
  const quality = calculateQuality(session);
  const product = calculateProduct(session);
  const planning = calculatePlanning(session);

  // Expect numerical scores to be reasonably calculated within boundaries (0-100)
  expect(steering).toBeGreaterThanOrEqual(0);
  expect(steering).toBeLessThanOrEqual(100);

  expect(execution).toBeGreaterThanOrEqual(0);
  expect(execution).toBeLessThanOrEqual(100);

  expect(quality).toBeGreaterThanOrEqual(0);
  expect(quality).toBeLessThanOrEqual(100);

  expect(product).toBeGreaterThanOrEqual(0);
  expect(product).toBeLessThanOrEqual(100);

  expect(planning).toBeGreaterThanOrEqual(0);
  expect(planning).toBeLessThanOrEqual(100);
});

test("determineArchetypes maps correct roles based on scores", () => {
  const session: NormalizedSession = {
    id: "session-archetype-test",
    start: "2026-07-13T12:00:00.000Z",
    duration: 1200,
    prompts: [{ text: "Write standard tests" }],
    tools: []
  };

  const scoresHighPlanning = { steering: 80, execution: 50, quality: 60, product: 60, planning: 90 };
  const archetype1 = determineArchetypes(session, scoresHighPlanning);
  expect(archetype1.primary).toBe("The Architect");

  const scoresHighQuality = { steering: 60, execution: 50, quality: 90, product: 50, planning: 50 };
  const archetype2 = determineArchetypes(session, scoresHighQuality);
  expect(archetype2.primary).toBe("Quality Guardian");

  const scoresHighVelocity = { steering: 50, execution: 90, quality: 40, product: 50, planning: 30 };
  const archetype3 = determineArchetypes(session, scoresHighVelocity);
  expect(archetype3.primary).toBe("Velocity Machine");
});

test("buildLocalPaxelReport generates fully aggregated profile report", () => {
  const session: NormalizedSession = {
    id: "session-full-test",
    title: "Awesome Session",
    start: "2026-07-13T12:00:00.000Z",
    duration: 1800,
    prompts: [
      { text: "Create user experience profile card." }
    ],
    tools: [
      { name: "read", status: "success" },
      { name: "edit", status: "success" }
    ],
    commits: [
      { hash: "abcdef1", message: "feat: profile card UI", date: "2026-07-13" }
    ]
  };

  const report = buildLocalPaxelReport(session);
  expect(report.id).toBe("session-full-test");
  expect(report.title).toBe("Awesome Session");
  expect(report.scores).toBeDefined();
  expect(report.stats.totalPrompts).toBe(1);
  expect(report.stats.totalTools).toBe(2);
  expect(report.stats.commitsCount).toBe(1);
  expect(report.weakestPrompts).toHaveLength(1);
  expect(report.growthRecommendations.length).toBeGreaterThanOrEqual(3);
});

test("scrubText strips absolute paths, home directories, IPs, and secrets", () => {
  const { scrubText } = require("./paxel-engine");

  const rawText1 = "Let's edit /home/jules/project/src/lib/auth.ts and verify connection.";
  const rawText2 = "The local database is at 192.168.1.50 with token=abc123xyz456_supersecret.";

  expect(scrubText(rawText1)).toContain("~/[USER_HOME]");
  expect(scrubText(rawText1)).toContain("/[ABSOLUTE_PATH]");
  expect(scrubText(rawText1)).not.toContain("jules");

  expect(scrubText(rawText2)).toContain("[IP_ADDRESS]");
  expect(scrubText(rawText2)).toContain("token=[REDACTED_SECRET]");
  expect(scrubText(rawText2)).not.toContain("abc123xyz456_supersecret");
});
