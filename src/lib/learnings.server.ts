import { createServerFn } from "@tanstack/react-start";
import learningsText from "../../data/learnings/learnings.jsonl?raw";
import { parseLearningsJsonl, type LearningRecord } from "./learnings";

export function loadLearnings(): LearningRecord[] {
  return parseLearningsJsonl(learningsText);
}

export const getLearnings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return loadLearnings();
});
