import { createFileRoute } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { AppHeader } from "@/components/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export const Route = createFileRoute("/_authenticated/skills")({
  component: Skills,
});

// Prototype data. Replace with real values once the upload / session-metadata
// source is wired (see docs/planning/bdc-idea-pipeline-v2-roadmap.md, pt 10).
type SkillRow = { skill: string; start: number; now: number };

const SKILL_DATA: SkillRow[] = [
  { skill: "Prompting", start: 50, now: 82 },
  { skill: "Debugging", start: 40, now: 74 },
  { skill: "Architecture", start: 35, now: 68 },
  { skill: "Testing", start: 30, now: 62 },
  { skill: "Reviewing", start: 45, now: 78 },
  { skill: "Shipping", start: 55, now: 88 },
];

const chartConfig = {
  now: { label: "Now", color: "var(--chart-1)" },
  start: { label: "Start", color: "var(--chart-2)" },
} satisfies ChartConfig;

function Skills() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Skill tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How your development skills have grown, at a glance.
          </p>
        </div>

        <Card>
          <CardHeader className="items-center pb-2">
            <CardTitle>Skill radar</CardTitle>
            <CardDescription>Start vs. now, across six areas</CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[340px]">
              <RadarChart data={SKILL_DATA}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <PolarGrid className="stroke-border" />
                <PolarAngleAxis dataKey="skill" className="text-xs" />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="start"
                  fill="var(--color-start)"
                  fillOpacity={0.08}
                  stroke="var(--color-start)"
                  strokeWidth={2}
                />
                <Radar
                  dataKey="now"
                  fill="var(--color-now)"
                  fillOpacity={0.5}
                  stroke="var(--color-now)"
                  strokeWidth={2}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Text/table view so values are never color-only (accessibility). */}
        <div className="mt-4 space-y-1">
          {SKILL_DATA.map((row) => {
            const delta = row.now - row.start;
            return (
              <div
                key={row.skill}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{row.skill}</span>
                <span className="text-muted-foreground tabular-nums">
                  {row.start} to {row.now}
                  <span className="ml-2 text-emerald-600">+{delta}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Sample values for now. The real numbers arrive once session uploads are connected.
        </p>
      </main>
    </div>
  );
}
