export type LearningRecord = {
  date: string;
  area: string;
  lesson: string;
  evidence: string;
  rule_change: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLearningsJsonl(text: string): LearningRecord[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new Error(`Invalid learning JSON on line ${lineNumber}.`);
      }

      if (!isObject(value)) {
        throw new Error(`Learning on line ${lineNumber} must be a JSON object.`);
      }

      const fields = ["date", "area", "lesson", "evidence", "rule_change"] as const;
      if (fields.some((field) => typeof value[field] !== "string" || value[field].trim().length === 0)) {
        throw new Error(`Learning on line ${lineNumber} must contain non-empty string fields.`);
      }

      return {
        date: value.date as string,
        area: value.area as string,
        lesson: value.lesson as string,
        evidence: value.evidence as string,
        rule_change: value.rule_change as string,
      } satisfies LearningRecord;
    });
}
