import { createServerFn } from "@tanstack/react-start";
import { chartDataFromSnapshots, getMeasurementGuide } from "./skills-scoring";
import { parseSkillUploadBatch, SUPPORTED_SKILL_EXPORT_FORMATS } from "./skill-export-parser.server";
import {
  createSkillEvidenceIssue,
  createSkillSnapshotIssue,
  listSkillSnapshots,
} from "./skill-snapshots.server";

export const getSkillDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOwner } = await import("./auth-session.server");
  requireOwner();

  try {
    const snapshots = await listSkillSnapshots();
    const latest = snapshots.at(-1) ?? null;
    return {
      chartData: chartDataFromSnapshots(snapshots),
      hasSnapshots: snapshots.length > 0,
      snapshotCount: snapshots.length,
      latest,
      measurement: getMeasurementGuide(),
      githubError: null as string | null,
    };
  } catch (error) {
    return {
      chartData: chartDataFromSnapshots([]),
      hasSnapshots: false,
      snapshotCount: 0,
      latest: null,
      measurement: getMeasurementGuide(),
      githubError: error instanceof Error ? error.message : String(error),
    };
  }
});

export const uploadSkillExports = createServerFn({ method: "POST" })
  .validator((input: FormData) => input)
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth-session.server");
    requireOwner();

    const note = typeof data.get("note") === "string" ? String(data.get("note")) : undefined;
    const files = data
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) {
      return {
        ok: false as const,
        message: `Choose a supported file first. Supported formats: ${SUPPORTED_SKILL_EXPORT_FORMATS}.`,
        warnings: [] as string[],
      };
    }

    const parsed = await parseSkillUploadBatch(files, note);
    if (!parsed.ok) return parsed;

    if (parsed.snapshot) {
      const issue = await createSkillSnapshotIssue(parsed.snapshot);
      return {
        ok: true as const,
        message: `${parsed.message} Snapshot saved to issue #${issue.number}.`,
        warnings: parsed.warnings,
        issue,
      };
    }

    if (parsed.pngEvidence.length > 0) {
      const issue = await createSkillEvidenceIssue({ evidence: parsed.pngEvidence, note });
      return {
        ok: true as const,
        message: `${parsed.message} Evidence metadata saved to issue #${issue.number}.`,
        warnings: parsed.warnings,
        issue,
      };
    }

    return parsed;
  });
