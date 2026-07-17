# Paxel self-reflection v1 spec

## Locked decisions

- The local runner is started manually with `bun run paxel:scan` from a BDC checkout.
- The first release records both per-session snapshots and a daily aggregate. The UI keeps the
  per-session history readable and uses the daily aggregate for trend context.
- The owner-facing area is named **Builder Profile**. It is the five-axis Paxel profile inside
  `/skills`, not a separate upload product.
- Execution uses active-time windowing. Gaps longer than 30 minutes are excluded from active seconds;
  wall-clock span remains visible as context.

## Local-only data flow

1. The runner scans `~/.claude/projects/**/*.jsonl` and `~/.codex/sessions/**/*.jsonl` on the
   owner's Mac. It accepts an optional `--since YYYY-MM-DD` and reads no other source by default.
2. Adapters normalize Claude Code and Codex CLI envelopes into prompts, tool events, timestamps,
   errors, and commit markers. The adapters tolerate malformed lines and continue with a warning.
3. Text is scrubbed before any report is constructed. Absolute paths, home-directory names, IP
   addresses, and secret-like values never enter the derived payload.
4. The deterministic five-axis engine computes 0-100 scores, confidence, archetype, stats, and
   local recommendations. Weak-prompt text stays local and is never sent to GitHub.
5. The runner sends only the derived snapshot to a `skill-snapshot` GitHub issue. No transcript,
   prompt, tool arguments, file name, raw path, or source log is uploaded.

## Derived snapshot contract

The issue body contains one JSON object under `<!-- paxel-snapshot-json ... -->`:

```ts
{
  schemaVersion: 1,
  subjectId: "owner",
  recordedAt: string,
  window: { since?: string, until: string },
  metrics: Array<{
    id: "steering" | "execution" | "quality" | "product" | "planning",
    label: string,
    value: number,
    previousValue?: number,
    unit: "score",
    confidence: "low" | "medium" | "high"
  }>,
  archetype: { primary: string, secondary: string, confidence: number },
  stats: {
    sessionCount: number,
    dayCount: number,
    promptCount: number,
    toolCount: number,
    errorCount: number,
    commitCount: number,
    activeSeconds: number,
    wallSeconds: number
  },
  sessions: Array<{ id: string, recordedAt: string, scores: Record<MetricId, number> }>,
  days: Array<{ day: string, sessionCount: number, scores: Record<MetricId, number> }>,
  recommendations: Array<{ metric: MetricId, title: string, description: string }>,
  provenance: { runnerVersion: string, sources: Array<"claude-code" | "codex-cli"> }
}
```

`previousValue` is the immediately prior snapshot value for the same metric when available.
Confidence is low when fewer than 3 sessions or fewer than 10 prompts are in the run, medium when
one of those thresholds is met, and high otherwise. The report is self-comparison only; it is not
an external benchmark.

## UI and access

- Main-Dev (owner PIN) sees the radar, current values, Start versus Now, archetype, per-session and
  daily history, confidence, provenance, and deterministic recommendations.
- Co-Dev (brother PIN) sees the same route only as an inactive explanation: this space analyzes the
  Main-Dev's working patterns and activates only with the Main-Dev PIN. No data or runner controls
  are shown.
- The old six-axis export upload UI is removed from the active Builder Profile surface. The parser
  remains a hardened compatibility module while the local runner is the only v1 input path.

## Acceptance and validation

- Unit tests cover both log adapters, malformed-line tolerance, scrubbing, 30-minute active-time
  gaps, five-axis bounds, snapshot redaction, previous-value mapping, and role-specific UI data.
- The local gate is `bun run build:dev` first, followed by `bun run typecheck`, `bun test`, and
  `NITRO_PRESET=node-server bun run build`.
- The runner has a dry-run mode for local verification. A normal run requires `GITHUB_TOKEN` and
  fails closed before any network call when no derived sessions were found.
