import { expect, test } from "bun:test";
import config from "./dc-config.json";
import { isPathAllowed, globMatch, isGlob } from "./paths.server";

const rules = {
  allowed: [
    "apps/mobile/src/**",
    // exact carve-out inside an otherwise-forbidden tree:
    "apps/mobile/src/data/reviewerContent.ts",
  ],
  forbidden: [
    "apps/mobile/src/data/**",
    "apps/mobile/android/**",
    "**/*.gradle",
    "**/AndroidManifest.xml",
    "**/*.sql",
    "**/.env*",
  ],
};

test("allow glob matches a normal UI file", () => {
  expect(isPathAllowed("apps/mobile/src/screens/Home.tsx", rules)).toBe(true);
  expect(isPathAllowed("apps/mobile/src/screens/ProfileScreenV2.tsx", rules)).toBe(true);
});

test("dc config allows normal mobile UI files and rejects malformed directory paths", () => {
  expect(isPathAllowed("apps/mobile/src/screens/ProfileScreenV2.tsx", config)).toBe(true);
  expect(isPathAllowed("apps/mobile/src/", config)).toBe(false);
});

test("exact allow WINS over a broad forbidden glob", () => {
  expect(isPathAllowed("apps/mobile/src/data/reviewerContent.ts", rules)).toBe(true);
});

test("glob allow does NOT override a forbidden glob", () => {
  // src/** allows, but src/data/** forbids, forbidden wins for non-exact paths.
  expect(isPathAllowed("apps/mobile/src/data/secrets.ts", rules)).toBe(false);
});

test("forbidden native/gradle rejected", () => {
  expect(isPathAllowed("apps/mobile/android/app/build.gradle", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile/android/app/src/main/AndroidManifest.xml", rules)).toBe(false);
});

test("forbidden sql + env rejected anywhere", () => {
  expect(isPathAllowed("apps/mobile/supabase/migrations/x.sql", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile/.env.local", rules)).toBe(false);
});

test("path outside the allow list is rejected", () => {
  expect(isPathAllowed("packages/other/x.ts", rules)).toBe(false);
  expect(isPathAllowed("README.md", rules)).toBe(false);
});

test("leading slashes are normalized", () => {
  expect(isPathAllowed("/apps/mobile/src/screens/Home.tsx", rules)).toBe(true);
});

test("case-evasion of a forbidden tree is rejected", () => {
  // capital D must not slip past apps/mobile/src/data/**
  expect(isPathAllowed("apps/mobile/src/Data/secrets.ts", rules)).toBe(false);
});

test("case-evasion of a forbidden extension is rejected", () => {
  expect(isPathAllowed("apps/mobile/src/schema.SQL", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/schema.Sql", rules)).toBe(false);
});

test("path traversal segments are rejected", () => {
  expect(isPathAllowed("apps/mobile/src/../data/x.ts", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/./x.ts", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile//src/x.ts", rules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/", rules)).toBe(false);
});

test("empty rules reject everything", () => {
  expect(isPathAllowed("apps/mobile/src/x.tsx", { allowed: [], forbidden: [] })).toBe(false);
});

test("dc config allows OL1 UI files and rejects package/config files", () => {
  expect(
    isPathAllowed("apps/mobile/src/screens/ProfileScreenV2.tsx", {
      allowed: config.allowed,
      forbidden: config.forbidden,
    }),
  ).toBe(true);
  expect(
    isPathAllowed("apps/mobile/package.json", {
      allowed: config.allowed,
      forbidden: config.forbidden,
    }),
  ).toBe(false);
  expect(
    isPathAllowed("apps/mobile/app.config.ts", {
      allowed: config.allowed,
      forbidden: config.forbidden,
    }),
  ).toBe(false);
});

test("dc config allows only presentation paths and denies sensitive mobile paths", () => {
  const dcRules = { allowed: config.allowed, forbidden: config.forbidden };
  expect(isPathAllowed("apps/mobile/src/components/Button.tsx", dcRules)).toBe(true);
  expect(isPathAllowed("apps/mobile/src/styles/theme.css", dcRules)).toBe(true);
  expect(isPathAllowed("apps/mobile/src/devHarness/ScenarioCard.tsx", dcRules)).toBe(true);
  expect(isPathAllowed("apps/mobile/src/lib/designTokens.ts", dcRules)).toBe(true);

  expect(isPathAllowed("apps/mobile/src/lib/db/client.ts", dcRules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/lib/auth.ts", dcRules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/lib/apiClient.ts", dcRules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/lib/schema.ts", dcRules)).toBe(false);
  expect(isPathAllowed("apps/mobile/src/lib/someHelper.ts", dcRules)).toBe(false);
});

test("globMatch ** spans path separators, * does not", () => {
  expect(globMatch("a/b/c.ts", "a/**")).toBe(true);
  expect(globMatch("a/b/c.ts", "a/*")).toBe(false);
  expect(globMatch("a/c.ts", "a/*")).toBe(true);
  expect(isGlob("a/**")).toBe(true);
  expect(isGlob("a/b.ts")).toBe(false);
});
