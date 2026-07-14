export interface PromptMeta {
  text: string;
  timestamp?: string;
  tokens?: number;
}

export interface ToolEvent {
  name: string;
  timestamp?: string;
  status?: string; // "success" or "failed"
  params?: string;
}

export interface CommitMeta {
  hash: string;
  message: string;
  date: string;
}

export interface NormalizedSession {
  id: string;
  title?: string;
  start: string;
  duration: number; // in seconds
  prompts: PromptMeta[];
  tools: ToolEvent[];
  commits?: CommitMeta[];
}

export interface PaxelScores {
  steering: number;
  execution: number;
  quality: number;
  product: number;
  planning: number;
}

export interface ArchetypeResult {
  primary: string;
  secondary: string;
  confidence: number;
  description: string;
}

export interface GrowthTip {
  title: string;
  description: string;
  metric: keyof PaxelScores;
  impact: "High" | "Medium";
}

export interface PaxelReport {
  id: string;
  title?: string;
  timestamp: string;
  duration: number;
  scores: PaxelScores;
  archetype: ArchetypeResult;
  stats: {
    totalPrompts: number;
    avgPromptLength: number;
    totalTools: number;
    planningRatio: number;
    toolDiversity: number;
    errorCount: number;
    commitsCount: number;
  };
  weakestPrompts: { prompt: string; critique: string }[];
  growthRecommendations: GrowthTip[];
}

/**
 * Normalizes input string content (JSON or JSONL) into a NormalizedSession object.
 */
export function normalizeSessionData(rawContent: string, fileName?: string): NormalizedSession {
  const cleanContent = rawContent.trim();
  if (!cleanContent) {
    throw new Error("Session log content is empty.");
  }

  // Attempt 1: Parse as full single JSON object
  try {
    const parsed = JSON.parse(cleanContent);
    if (parsed && typeof parsed === "object") {
      // Check if it matches NormalizedSession directly
      if (Array.isArray(parsed.prompts) && Array.isArray(parsed.tools)) {
        return {
          id: parsed.id || `session-${Date.now()}`,
          title: parsed.title || fileName || "Uploaded Session",
          start: parsed.start || new Date().toISOString(),
          duration: typeof parsed.duration === "number" ? parsed.duration : 1800,
          prompts: parsed.prompts.map((p: any) => ({
            text: typeof p === "string" ? p : (p.text || ""),
            timestamp: p.timestamp,
            tokens: p.tokens,
          })),
          tools: parsed.tools.map((t: any) => ({
            name: typeof t === "string" ? t : (t.name || ""),
            timestamp: t.timestamp,
            status: t.status,
            params: t.params,
          })),
          commits: Array.isArray(parsed.commits) ? parsed.commits : [],
        };
      }

      // Check if it's a Claude or Cursor session log export
      if (Array.isArray(parsed.messages || parsed.interactions)) {
        const list = parsed.messages || parsed.interactions;
        const prompts: PromptMeta[] = [];
        const tools: ToolEvent[] = [];

        list.forEach((item: any) => {
          if (item.role === "user" || item.type === "user") {
            prompts.push({ text: item.content || item.text || "" });
          }
          if (item.type === "tool" || item.toolCalls) {
            tools.push({
              name: item.name || "tool_use",
              status: item.status || "success",
            });
          }
        });

        return {
          id: `session-${Date.now()}`,
          title: fileName || "Converted Session",
          start: new Date().toISOString(),
          duration: 1800,
          prompts,
          tools,
          commits: [],
        };
      }
    }
  } catch (e) {
    // Fallback to JSONL or Line-by-line parsing
  }

  // Attempt 2: Parse as JSONL (line-by-line JSON)
  try {
    const lines = cleanContent.split("\n").map(l => l.trim()).filter(Boolean);
    const prompts: PromptMeta[] = [];
    const tools: ToolEvent[] = [];
    let startTimestamp = new Date().toISOString();
    let endTimestamp = new Date().toISOString();

    lines.forEach((line, index) => {
      try {
        const item = JSON.parse(line);
        const timestamp = item.timestamp || item.created_at || item.time;
        if (index === 0 && timestamp) startTimestamp = timestamp;
        if (index === lines.length - 1 && timestamp) endTimestamp = timestamp;

        // Extract prompts
        if (item.role === "user" || item.type === "user" || (item.content && item.role === "user")) {
          prompts.push({
            text: item.content || item.text || item.prompt || "",
            timestamp,
          });
        }

        // Extract tool events
        if (item.type === "tool" || item.tool_use || item.tool || item.command) {
          tools.push({
            name: item.name || item.tool || item.command || "tool_use",
            status: item.status || (item.error ? "failed" : "success"),
            timestamp,
          });
        }
      } catch (err) {
        // Line-by-line parsing error, check if it contains plain text hints
        if (line.toLowerCase().startsWith("user:") || line.toLowerCase().startsWith("prompt:")) {
          prompts.push({ text: line.replace(/^(user|prompt):/i, "").trim() });
        }
      }
    });

    if (prompts.length > 0) {
      const duration = Math.max(
        60,
        Math.round((new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime()) / 1000)
      );
      return {
        id: `session-${Date.now()}`,
        title: fileName || "Normalized Session Log",
        start: startTimestamp,
        duration: isNaN(duration) ? 1800 : duration,
        prompts,
        tools,
        commits: [],
      };
    }
  } catch (e) {
    // Failed JSONL
  }

  // Attempt 3: Plaintext transcript line parsing fallback
  const lines = cleanContent.split("\n");
  const prompts: PromptMeta[] = [];
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length > 10 && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      if (trimmed.toLowerCase().includes("user:") || trimmed.toLowerCase().includes("assistant:") || trimmed.toLowerCase().includes("system:")) {
        if (trimmed.toLowerCase().startsWith("user:") || trimmed.toLowerCase().startsWith("prompt:")) {
          prompts.push({ text: trimmed.replace(/^(user|prompt):/i, "").trim() });
        }
      } else if (prompts.length === 0 || trimmed.length > 40) {
        // Just treat long-ish lines as potential user prompt sequences if nothing else
        if (prompts.length < 20) {
          prompts.push({ text: trimmed });
        }
      }
    }
  });

  if (prompts.length > 0) {
    return {
      id: `session-${Date.now()}`,
      title: fileName || "Parsed Text Transcript",
      start: new Date().toISOString(),
      duration: prompts.length * 120, // Estimate 2 mins per prompt
      prompts,
      tools: [],
      commits: [],
    };
  }

  throw new Error("Could not parse session data. Please ensure it is a JSON or JSONL format of a coding session.");
}

/**
 * 1. Steering Score (0 - 100)
 * Evaluates how effectively the developer instructs the AI.
 * Higher scores mean:
 * - Proper prompt specificity (length & details)
 * - Constructive correction feedback (using Steering words) rather than just repeating "fix this".
 */
export function calculateSteering(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;

  // Measure prompt specificity (average prompt length in characters)
  const totalLength = session.prompts.reduce((sum, p) => sum + p.text.length, 0);
  const avgLength = totalLength / session.prompts.length;
  // Sane score curve for length: 150 chars is ideal (gives 50 pts)
  const specificityScore = Math.min(50, (avgLength / 150) * 50);

  // Measure Steering/Correction triggers
  // Let's count how many times user provides course corrections
  const steeringKeywords = [
    "actually", "wait", "no", "instead", "let's try", "stop", "go back",
    "different approach", "let's rethink", "incorrect", "wrong", "revert"
  ];
  let steeringCount = 0;
  session.prompts.forEach(p => {
    const lower = p.text.toLowerCase();
    if (steeringKeywords.some(kw => lower.includes(kw))) {
      steeringCount++;
    }
  });

  // Having 1 to 3 steering corrections in a session indicates active steering.
  // Overly high (e.g. >8) might indicate the AI is totally lost, but still shows developer effort to direct it.
  const steeringCorrectionScore = Math.min(50, steeringCount * 15);

  return Math.round(Math.max(20, specificityScore + steeringCorrectionScore));
}

/**
 * 2. Execution Leverage (0 - 100)
 * Evaluates developer productivity and execution efficiency.
 * Higher scores mean:
 * - High density of action-oriented actions relative to elapsed session hours.
 * - Sane Planning Ratio (Reading tools vs Editing tools).
 */
export function calculateExecution(session: NormalizedSession): number {
  if (session.tools.length === 0) return 50;

  const durationHours = Math.max(0.1, session.duration / 3600);

  // Velocity: action tool calls (write, edit, replace, delete, etc.) per hour
  const actionTools = ["write", "edit", "replace", "delete", "write_file", "patch", "modify", "bash", "run_in_bash_session"];
  const actionCount = session.tools.filter(t =>
    actionTools.some(act => t.name.toLowerCase().includes(act))
  ).length;

  const velocity = actionCount / durationHours;
  // 15 action-related operations per hour is considered highly active (gives 50 pts)
  const velocityScore = Math.min(50, (velocity / 15) * 50);

  // Planning balance: we want a planning ratio between 1.0 and 3.0
  const readTools = ["read", "grep", "glob", "list", "view", "find", "search"];
  const readCount = session.tools.filter(t =>
    readTools.some(r => t.name.toLowerCase().includes(r))
  ).length;

  const planningRatio = readCount / Math.max(1, actionCount);
  let ratioScore = 0;
  if (planningRatio >= 1.0 && planningRatio <= 3.0) {
    ratioScore = 50; // Perfect balance
  } else if (planningRatio > 3.0) {
    // Excessive research, slow execution
    ratioScore = Math.max(10, 50 - (planningRatio - 3) * 5);
  } else {
    // Shoots from the hip, low research
    ratioScore = Math.max(10, planningRatio * 50);
  }

  return Math.round(Math.max(15, velocityScore + ratioScore));
}

/**
 * 3. Engineering Quality (0 - 100)
 * Evaluates how cleanly the developer codes and manages errors.
 * Higher scores mean:
 * - Low tool/compilation failures (high error recovery).
 * - Active test usage.
 * - Sane code modifications without high churn rates.
 */
export function calculateQuality(session: NormalizedSession): number {
  const totalTools = session.tools.length;
  if (totalTools === 0) return 50;

  // 1. Error Rate Penalty
  const failedTools = session.tools.filter(t => t.status === "failed" || t.status === "error").length;
  const errorRate = failedTools / totalTools;
  const errorScore = Math.max(0, 50 - (errorRate * 100)); // Up to 50 pts

  // 2. Testing Bonus
  const testCalls = session.tools.filter(t =>
    t.name.toLowerCase().includes("test") || (t.params && t.params.toLowerCase().includes("test"))
  ).length;
  const testingBonus = Math.min(30, testCalls * 10);

  // 3. Commit Hygiene
  const commitCount = session.commits?.length || 0;
  const commitBonus = Math.min(20, commitCount * 10);

  return Math.round(Math.max(10, errorScore + testingBonus + commitBonus));
}

/**
 * 4. Product Thinking (0 - 100)
 * Evaluates if the developer maintains product scope, queries context, and prioritizes.
 * Higher scores mean:
 * - User-centric keywords present in prompts ("user", "needs", "ui", "experience", "simplify", "clean", "design").
 * - Prompts referencing boundaries or specific target files/modules instead of vauge "fix everything".
 */
export function calculateProduct(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;

  let productKeywordsCount = 0;
  const keywords = ["user", "feature", "view", "screen", "feel", "design", "experience", "flow", "simplify", "ux", "accessibility", "clean"];

  session.prompts.forEach(p => {
    const lower = p.text.toLowerCase();
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        productKeywordsCount++;
      }
    });
  });

  const productFocusScore = Math.min(50, (productKeywordsCount / session.prompts.length) * 50);

  // Target specificity bonus: did the user refer to specific screen paths or configuration schemas?
  let targetSpecCount = 0;
  session.prompts.forEach(p => {
    if (p.text.includes("/") || p.text.includes(".") || p.text.includes("config")) {
      targetSpecCount++;
    }
  });
  const targetScore = Math.min(50, (targetSpecCount / session.prompts.length) * 50);

  return Math.round(Math.max(20, productFocusScore + targetScore));
}

/**
 * 5. Planning Score (0 - 100)
 * Evaluates how thoroughly the developer maps out work before editing.
 * Higher scores mean:
 * - High planning ratio.
 * - Explicit instructions to plan (e.g. "plan", "set_plan", "explore", "requirements").
 */
export function calculatePlanning(session: NormalizedSession): number {
  if (session.prompts.length === 0) return 50;

  // Let's check for plan-related commands/verbs
  let planTriggers = 0;
  const planKeywords = ["plan", "design", "set_plan", "map out", "step by step", "verify first", "checklist", "agents.md", "overview"];

  session.prompts.forEach(p => {
    const lower = p.text.toLowerCase();
    if (planKeywords.some(kw => lower.includes(kw))) {
      planTriggers++;
    }
  });

  const planVerbScore = Math.min(50, planTriggers * 20);

  // Look at reading tools vs writing tools again
  const readTools = ["read", "grep", "glob", "list", "view", "find", "search"];
  const readCount = session.tools.filter(t =>
    readTools.some(r => t.name.toLowerCase().includes(r))
  ).length;

  const actionTools = ["write", "edit", "replace", "delete", "write_file", "patch", "modify", "bash", "run_in_bash_session"];
  const actionCount = session.tools.filter(t =>
    actionTools.some(act => t.name.toLowerCase().includes(act))
  ).length;

  const planningLeverage = readCount / Math.max(1, actionCount);
  const ratioScore = Math.min(50, (planningLeverage / 1.5) * 50); // Peak planning leverage at 1.5+ ratio

  return Math.round(Math.max(15, planVerbScore + ratioScore));
}

/**
 * Classifies the session into primary and secondary archetypes.
 */
export function determineArchetypes(session: NormalizedSession, scores: PaxelScores): ArchetypeResult {
  const { steering, execution, quality, product, planning } = scores;

  let primary = "Velocity Machine";
  let secondary = "The Collaborator";
  let confidence = 70;
  let description = "Fast-shipping developer focused on producing high code volume with direct action prompts.";

  // High planning & research
  if (planning >= 70 && steering >= 60) {
    primary = "The Architect";
    description = "Thorough and systemic. You map out complete architectures and instruct the AI with high-precision prompts after studying the code constraints.";

    if (quality >= 70) {
      secondary = "Quality Guardian";
      confidence = 85;
    } else {
      secondary = "Autonomous Agent";
      confidence = 75;
    }
  }
  // High quality focus
  else if (quality >= 75) {
    primary = "Quality Guardian";
    description = "Extremely clean and robust. You prioritize bug-free deploys, write unit tests, and maintain a very low tool error rate.";

    if (planning >= 60) {
      secondary = "The Architect";
      confidence = 80;
    } else {
      secondary = "The Debugger";
      confidence = 75;
    }
  }
  // Fast and active
  else if (execution >= 75) {
    primary = "Velocity Machine";
    description = "Speed demon! You maintain a blistering code velocity, shipping quick iterative edits and writing direct, action-focused prompts.";

    if (product >= 65) {
      secondary = "Autonomous Agent";
      confidence = 80;
    } else {
      secondary = "The Collaborator";
      confidence = 70;
    }
  }
  // High error-recovery or bug-focused session
  else if (quality < 50 && execution >= 60) {
    primary = "The Debugger";
    description = "Surgical error solver. You navigate back-to-back logs, stack traces, and compiler warnings, systematically resolving broken links.";

    if (steering >= 60) {
      secondary = "The Collaborator";
      confidence = 75;
    } else {
      secondary = "Velocity Machine";
      confidence = 65;
    }
  }
  // Lots of user questions/alignment
  else {
    primary = "The Collaborator";
    description = "Alignment-driven teammate. You prioritize conversational guidance, asking the AI strategic design questions before agreeing on actions.";

    if (product >= 60) {
      secondary = "The Architect";
      confidence = 75;
    } else {
      secondary = "Velocity Machine";
      confidence = 60;
    }
  }

  // Temporal/Night Owl pattern check (after 10 PM)
  try {
    const sessionDate = new Date(session.start);
    const hours = sessionDate.getHours();
    if (hours >= 22 || hours <= 4) {
      secondary = "Night Owl";
      confidence = Math.min(100, confidence + 10);
    }
  } catch (err) {}

  return { primary, secondary, confidence, description };
}

/**
 * Extracts the weakest prompts based on length or phrasing from the transcript.
 */
export function extractWeakestPrompts(session: NormalizedSession): { prompt: string; critique: string }[] {
  if (session.prompts.length === 0) {
    return [{ prompt: "No prompts found", critique: "Start a session to gather prompt critique." }];
  }

  // Find the shortest or most vague prompts
  const sorted = [...session.prompts]
    .filter(p => p.text.trim().length > 0)
    .sort((a, b) => a.text.length - b.text.length);

  const weakest: { prompt: string; critique: string }[] = [];
  const maxToTake = Math.min(3, sorted.length);

  for (let i = 0; i < maxToTake; i++) {
    const p = sorted[i].text.trim();
    let critique = "Prompt is very short. Provide more context or specific file targets to speed up execution.";

    if (p.toLowerCase().includes("fix") || p.toLowerCase().includes("error")) {
      critique = "Vague bugfix prompt. Try appending the exact stack trace or error log so the AI doesn't have to guess the root cause.";
    } else if (p.toLowerCase().includes("test")) {
      critique = "Vague test command. Specify exactly which files or components you want to run tests on to optimize execution time.";
    } else if (p.length < 15) {
      critique = "Extremely short. AI models thrive on rich context. Try using descriptive sentences explaining the *why* of the feature.";
    }

    weakest.push({ prompt: p.length > 80 ? p.slice(0, 80) + "..." : p, critique });
  }

  return weakest;
}

/**
 * Generates local growth recommendations and focus areas based on score profiles.
 */
export function generateLocalGrowthRecommendations(scores: PaxelScores): GrowthTip[] {
  const tips: GrowthTip[] = [];

  if (scores.steering < 65) {
    tips.push({
      title: "Boost Prompt Specificity",
      description: "Your prompts are quite compact. Try providing clear bounds, concrete constraints, and file paths (e.g. use exact paths rather than vague instructions).",
      metric: "steering",
      impact: "High",
    });
  }

  if (scores.execution < 65) {
    tips.push({
      title: "Balance Your Planning-to-Execution Ratio",
      description: "You are doing a lot of reading and exploration without many edits, or shipping too fast without reading. Aim for a balanced 1:1.5 read-to-edit tool ratio.",
      metric: "execution",
      impact: "High",
    });
  }

  if (scores.quality < 65) {
    tips.push({
      title: "Incorporate Continuous Testing",
      description: "Add a testing step to your session. Ask the AI to write unit tests for your new modules and run 'bun test' frequently to spot early regressions.",
      metric: "quality",
      impact: "High",
    });
  }

  if (scores.product < 65) {
    tips.push({
      title: "Anchor on User Constraints",
      description: "Focus more on user outcomes. Ask the AI 'How will a user interact with this?' or include explicit UX guidelines in your prompts.",
      metric: "product",
      impact: "Medium",
    });
  }

  if (scores.planning < 65) {
    tips.push({
      title: "Master Pre-Flight Planning",
      description: "Adopt a strict 'Deep Planning Mode'. Run a 5-minute pre-flight checks session to verify architecture with the AI before starting any edits.",
      metric: "planning",
      impact: "High",
    });
  }

  // Make sure we always return at least 3 tips
  if (tips.length < 3) {
    const fillerTips: GrowthTip[] = [
      {
        title: "Integrate Guardrails Verification",
        description: "Enforce safety checks on your prompt designs to prevent destructive file operations or prompt injection.",
        metric: "quality",
        impact: "Medium",
      },
      {
        title: "Structure Session Commit Messages",
        description: "Commit your code in short, logical chunks with concise commit messages instead of massive all-in-one shifts.",
        metric: "quality",
        impact: "Medium",
      },
      {
        title: "Optimize Token Spend",
        description: "Avoid reading entire massive files to the LLM. Use targeted grep searches or line-restricted reads to keep the context narrow and clear.",
        metric: "execution",
        impact: "Medium",
      }
    ];
    for (const ft of fillerTips) {
      if (tips.length >= 3) break;
      tips.push(ft);
    }
  }

  return tips.slice(0, 3);
}

/**
 * Builds a comprehensive analytical report entirely on the client or as a fallback.
 */
export function buildLocalPaxelReport(session: NormalizedSession): PaxelReport {
  const scores: PaxelScores = {
    steering: calculateSteering(session),
    execution: calculateExecution(session),
    quality: calculateQuality(session),
    product: calculateProduct(session),
    planning: calculatePlanning(session),
  };

  const archetype = determineArchetypes(session, scores);
  const weakestPrompts = extractWeakestPrompts(session);
  const growthRecommendations = generateLocalGrowthRecommendations(scores);

  const readTools = ["read", "grep", "glob", "list", "view", "find", "search"];
  const readCount = session.tools.filter(t =>
    readTools.some(r => t.name.toLowerCase().includes(r))
  ).length;

  const actionTools = ["write", "edit", "replace", "delete", "write_file", "patch", "modify", "bash", "run_in_bash_session"];
  const actionCount = session.tools.filter(t =>
    actionTools.some(act => t.name.toLowerCase().includes(act))
  ).length;

  const planningRatio = parseFloat((readCount / Math.max(1, actionCount)).toFixed(2));
  const toolNames = new Set(session.tools.map(t => t.name));

  const totalLength = session.prompts.reduce((sum, p) => sum + p.text.length, 0);
  const avgPromptLength = session.prompts.length > 0 ? Math.round(totalLength / session.prompts.length) : 0;

  const failedTools = session.tools.filter(t => t.status === "failed" || t.status === "error").length;

  return {
    id: session.id,
    title: session.title,
    timestamp: session.start,
    duration: session.duration,
    scores,
    archetype,
    stats: {
      totalPrompts: session.prompts.length,
      avgPromptLength,
      totalTools: session.tools.length,
      planningRatio,
      toolDiversity: toolNames.size,
      errorCount: failedTools,
      commitsCount: session.commits?.length || 0,
    },
    weakestPrompts,
    growthRecommendations,
  };
}
