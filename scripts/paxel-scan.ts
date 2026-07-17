import { homedir } from "node:os";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildSessionReport, buildSnapshot } from "../src/lib/paxel/engine";
import { createPaxelSnapshotIssue, listPaxelSnapshots } from "../src/lib/paxel/snapshots.server";
import { parseLocalSession } from "../src/lib/paxel/runner";
import type { PaxelSource } from "../src/lib/paxel/types";

type SourceRoot = { source: PaxelSource; path: string };

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function jsonlFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) output.push(path);
    }
  }
  await visit(root);
  return output;
}

function sinceDate(): number | undefined {
  const value = argument("--since");
  if (!value) return undefined;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error("--since must use YYYY-MM-DD.");
  return parsed;
}

async function scanRoots(roots: SourceRoot[], since?: number) {
  const reports = [];
  let fileCount = 0;
  for (const root of roots) {
    const files = await jsonlFiles(root.path);
    fileCount += files.length;
    for (const path of files) {
      let raw: string;
      try {
        raw = await readFile(path, "utf8");
      } catch {
        continue;
      }
      const session = parseLocalSession(raw, root.source);
      if (since !== undefined && session.startedAt && Date.parse(session.startedAt) < since) continue;
      if (session.prompts.length === 0 && session.tools.length === 0 && session.commitCount === 0) continue;
      reports.push(buildSessionReport(session));
    }
  }
  return { reports, fileCount };
}

async function main(): Promise<void> {
  const roots: SourceRoot[] = [
    { source: "claude-code", path: join(homedir(), ".claude", "projects") },
    { source: "codex-cli", path: join(homedir(), ".codex", "sessions") },
  ];
  const result = await scanRoots(roots, sinceDate());
  if (result.reports.length === 0) {
    throw new Error("No usable Claude Code or Codex CLI sessions found. Nothing was sent.");
  }

  const previous = hasFlag("--dry-run") ? null : (await listPaxelSnapshots()).at(-1) ?? null;
  const snapshot = buildSnapshot(result.reports, previous);
  const summary = {
    dryRun: hasFlag("--dry-run"),
    filesScanned: result.fileCount,
    sessions: snapshot.stats.sessionCount,
    days: snapshot.stats.dayCount,
    sources: snapshot.provenance.sources,
    metrics: snapshot.metrics.map(({ id, value, confidence }) => ({ id, value, confidence })),
  };

  if (hasFlag("--dry-run")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is missing. Use --dry-run for local-only verification.");
  const issue = await createPaxelSnapshotIssue(snapshot);
  console.log(JSON.stringify({ ...summary, issue }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
