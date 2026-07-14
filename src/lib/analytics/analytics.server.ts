import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildLocalPaxelReport,
  normalizeSessionData,
  scrubText,
  type PaxelReport,
} from "./paxel-engine";
import { callModel, type ChatMessage } from "../openrouter.server";

const AnalyzeInput = z.object({
  rawContent: z.string(),
  fileName: z.string().optional(),
  anonymize: z.boolean().optional(),
});

/**
 * Server Function to analyze uploaded developer coding sessions.
 * Highly robust: calculates base scores locally and escalates to OpenRouter
 * if available to enrich with deep AI recommendations.
 */
export const analyzeSessionEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<PaxelReport> => {
    // 1. Ensure user is authenticated
    const { requireAuth } = await import("../auth-session.server");
    requireAuth();

    // 2. Normalize and compute core local metrics
    const normalized = normalizeSessionData(data.rawContent, data.fileName);

    // 2b. Perform anonymization scrubbing if requested
    if (data.anonymize) {
      normalized.prompts = normalized.prompts.map(p => ({
        ...p,
        text: scrubText(p.text)
      }));
      normalized.tools = normalized.tools.map(t => ({
        ...t,
        params: t.params ? scrubText(t.params) : undefined
      }));
      normalized.title = normalized.title ? scrubText(normalized.title) : undefined;
      normalized.anonymized = true;
    }

    const report = buildLocalPaxelReport(normalized);

    // 3. Attempt OpenRouter integration if key is present
    const hasKey = !!process.env.OPENROUTER_API_KEY;
    if (!hasKey) {
      console.log("[paxel-server] OPENROUTER_API_KEY not configured. Returning local metrics report.");
      return report;
    }

    try {
      const systemPrompt = `You are Paxel AI, a premier developer coach trained by Y Combinator.
Your job is to analyze developer coding transcripts and provide:
1. A playful, humorous summary of their style matching their Archetype.
2. A witty, constructive critique of their 3 weakest or vaguest prompts.
3. 3 hyper-actionable growth focus tips to dramatically increase leverage in their next session.

Format your output STRICTLY as a valid JSON object matching this schema:
{
  "archetypeDescription": "Deeply customized playful description...",
  "critiques": [
    { "prompt": "prompt text", "critique": "short witty/constructive critique" }
  ],
  "recommendations": [
    { "title": "Tip title", "description": "precise action plan description", "metric": "steering|execution|quality|product|planning", "impact": "High|Medium" }
  ]
}`;

      const userPrompt = `Please analyze this developer's coding session:
- Primary Archetype: ${report.archetype.primary} (Secondary: ${report.archetype.secondary})
- Steering Score: ${report.scores.steering}/100
- Execution Leverage: ${report.scores.execution}/100
- Engineering Quality: ${report.scores.quality}/100
- Product Thinking: ${report.scores.product}/100
- Planning Score: ${report.scores.planning}/100

Stats:
- Total Prompts: ${report.stats.totalPrompts}
- Avg Prompt Length: ${report.stats.avgPromptLength} characters
- Total Tool Use: ${report.stats.totalTools}
- Planning-to-Execution Ratio: ${report.stats.planningRatio}

Prompts sent in this session:
${report.stats.totalPrompts > 0
  ? normalized.prompts.map(p => `> ${p.text}`).join("\n")
  : "(No prompts in transcript)"
}

Provide deep insights matching the requested JSON structure. Keep all suggestions actionable, professional, yet lighthearted.`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      // Call tier0 (Gemini 2.5 Flash is highly capable, extremely fast, and cost-efficient!)
      const aiResult = await callModel({
        tier: "tier0",
        messages,
        temperature: 0.3,
        responseJson: true,
      });

      const parsedAI = JSON.parse(aiResult.content) as {
        archetypeDescription?: string;
        critiques?: { prompt: string; critique: string }[];
        recommendations?: { title: string; description: string; metric: string; impact: string }[];
      };

      if (parsedAI.archetypeDescription) {
        report.archetype.description = parsedAI.archetypeDescription;
      }
      if (Array.isArray(parsedAI.critiques) && parsedAI.critiques.length > 0) {
        report.weakestPrompts = parsedAI.critiques;
      }
      if (Array.isArray(parsedAI.recommendations) && parsedAI.recommendations.length > 0) {
        report.growthRecommendations = parsedAI.recommendations.map(r => ({
          title: r.title,
          description: r.description,
          metric: (r.metric?.toLowerCase() || "quality") as any,
          impact: (r.impact === "High" ? "High" : "Medium") as any,
        }));
      }

      console.log("[paxel-server] Rich AI report compiled successfully.");
    } catch (err) {
      console.warn("[paxel-server] OpenRouter synthesis failed or timed out. Falling back to robust local report.", err);
    }

    return report;
  });
