import { createServerFn } from "@tanstack/react-start";
import changelogText from "../../docs/prompts/CHANGELOG.md?raw";
import {
  parsePromptChangelog,
  promptTitle,
  promptVersionFromFilename,
  type PromptVersionDashboard,
} from "./prompt-versions";

const promptVersionFiles = import.meta.glob("../../docs/prompts/pl-prompt-v*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

export async function readPromptVersionDashboard(): Promise<PromptVersionDashboard> {
  const files = Object.entries(promptVersionFiles)
    .map(([path, content]) => {
      const filename = path.split("/").at(-1) ?? path;
      return {
        version: promptVersionFromFilename(filename),
        filename: `docs/prompts/${filename}`,
        title: promptTitle(content, filename),
        content,
        stale: /\bSTALE\b|SUPERSEDED|supersedes/i.test(content),
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  const currentFilename = files.at(-1)?.filename;

  return {
    changelog: parsePromptChangelog(changelogText),
    files: files.map((file) => ({
      ...file,
      stale: file.filename !== currentFilename && file.stale,
    })),
    changelogSource: "docs/prompts/CHANGELOG.md",
  };
}

export const getPromptVersionDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOwner } = await import("./auth-session.server");
  requireOwner();
  return readPromptVersionDashboard();
});
