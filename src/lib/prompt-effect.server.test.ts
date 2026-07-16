import { expect, test } from "bun:test";
import type { PullState, RepoIssue } from "./github.server";
import { buildPromptEffectSummary } from "./prompt-effect.server";

function issue(input: Partial<RepoIssue> & Pick<RepoIssue, "number" | "created_at" | "labels">): RepoIssue {
  return {
    title: `Issue ${input.number}`,
    body: "",
    html_url: `https://example.com/issues/${input.number}`,
    state: "open",
    updated_at: input.created_at,
    ...input,
  };
}

test("prompt effect summary counts created, accepted, reworked, PRs, and skill snapshots honestly", () => {
  const pulls: PullState[] = [
    {
      number: 10,
      html_url: "https://example.com/pulls/10",
      state: "open",
      merged: false,
      merged_at: null,
      labels: [],
      body: "Closes #1",
      title: "Change #1",
      headRef: "bdc-hold/dc-issue-1",
    },
  ];

  const summary = buildPromptEffectSummary({
    pulls,
    issues: [
      issue({ number: 1, created_at: "2026-07-16T12:00:00Z", labels: [{ name: "bdc-submitted" }, { name: "bdc-approved" }] }),
      issue({ number: 2, created_at: "2026-07-17T12:00:00Z", labels: [{ name: "bdc-submitted" }, { name: "bdc-changes-requested" }] }),
      issue({ number: 3, created_at: "2026-07-15T12:00:00Z", labels: [{ name: "bdc-submitted" }] }),
    ],
    skillSnapshots: [
      issue({ number: 9, title: "Skill score moved", created_at: "2026-07-17T10:00:00Z", labels: [{ name: "skill-snapshot" }] }),
    ],
  });

  expect(summary.label).toBe("Experimental, small sample");
  expect(summary.versions[0]).toMatchObject({
    version: "v1",
    issuesCreated: 2,
    prsCreated: 1,
    accepted: 1,
    reworked: 1,
  });
  expect(summary.skillSnapshots).toEqual([
    {
      id: 9,
      title: "Skill score moved",
      createdAt: "2026-07-17T10:00:00Z",
      url: "https://example.com/issues/9",
    },
  ]);
});
