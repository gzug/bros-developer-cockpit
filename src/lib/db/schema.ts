import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueNumber: integer("issue_number").notNull().unique(),
  title: text("title").notNull(),
  intent: text("intent").notNull(),
  status: text("status").notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueNumber: integer("issue_number").notNull(),
  status: text("status").notNull().default("started"),
  tier: text("tier"),
  model: text("model"),
  tokensPrompt: integer("tokens_prompt"),
  tokensCompletion: integer("tokens_completion"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  githubBranchRef: text("github_branch_ref"),
  githubPrNumber: integer("github_pr_number"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

