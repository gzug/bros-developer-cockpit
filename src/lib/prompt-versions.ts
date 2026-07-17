export type PromptVersionRow = {
  version: string;
  date: string;
  whatChanged: string;
  why: string;
  expectedEffect: string;
};

export type PromptVersionFile = {
  version: string;
  filename: string;
  title: string;
  content: string;
  stale: boolean;
};

export type PromptVersionDashboard = {
  changelog: PromptVersionRow[];
  files: PromptVersionFile[];
  changelogSource: string;
};

function stripInlineCode(value: string): string {
  return value.trim().replace(/^`|`$/g, "");
}

export function parsePromptChangelog(markdown: string): PromptVersionRow[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .filter((line) => !/^\|\s*-+\s*\|/.test(line))
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5)
    .map(([version, date, whatChanged, why, expectedEffect]) => ({
      version: stripInlineCode(version),
      date,
      whatChanged,
      why,
      expectedEffect,
    }));
}

export function promptTitle(content: string, filename: string): string {
  const heading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  return heading?.replace(/^#\s+/, "").trim() || filename;
}

export function promptVersionFromFilename(filename: string): string {
  return filename.match(/pl-prompt-(v\d+)\.md$/)?.[1] ?? filename.replace(/\.md$/, "");
}
