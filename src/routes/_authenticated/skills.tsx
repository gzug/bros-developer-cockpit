import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getBuilderProfileData } from "@/lib/paxel/functions";

export const Route = createFileRoute("/_authenticated/skills")({ component: BuilderProfile });

const chartConfig = {
  now: { label: "Now", color: "var(--chart-1)" },
  start: { label: "Start", color: "var(--chart-2)" },
} satisfies ChartConfig;

function BuilderProfile() {
  const profile = useQuery({ queryKey: ["builder-profile"], queryFn: () => getBuilderProfileData() });
  const data = profile.data;
  const owner = data?.role === "owner";
  const chartData = data?.chartData ?? [];
  const latest = data?.latest;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader owner={owner} />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Builder Profile</h1>
          <Badge variant="outline">{data?.active ? "Main-Dev" : "Inactive"}</Badge>
        </div>

        {!data && profile.isLoading && <p className="text-sm text-muted-foreground">Loading profile...</p>}

        {data && !data.active && (
          <Card>
            <CardHeader>
              <CardTitle>Builder Profile is inactive here</CardTitle>
              <CardDescription>Main-Dev only</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This space analyzes the Main-Dev's working patterns with coding tools. It activates only with the Main-Dev PIN.
            </CardContent>
          </Card>
        )}

        {data?.active && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              A private, local-first reflection of how you work with Claude Code and Codex CLI. Scores compare your own sessions over time.
            </p>

            {chartData.length > 0 ? (
              <Card>
                <CardHeader className="items-center pb-2">
                  <CardTitle>Five-axis profile</CardTitle>
                  <CardDescription>Start to Now, based on derived local snapshots</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[340px]">
                    <RadarChart data={chartData}>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <PolarGrid className="stroke-border" />
                      <PolarAngleAxis dataKey="label" className="text-xs" />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="start" fill="var(--color-start)" fillOpacity={0.08} stroke="var(--color-start)" strokeWidth={2} />
                      <Radar dataKey="now" fill="var(--color-now)" fillOpacity={0.5} stroke="var(--color-now)" strokeWidth={2} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </RadarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No snapshot yet</CardTitle>
                  <CardDescription>Run the local scanner on your Mac first.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  From a BDC checkout, run <code className="rounded bg-muted px-1">bun run paxel:scan</code>. Raw session logs stay on the Mac.
                </CardContent>
              </Card>
            )}

            {latest && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Current reflection</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-medium">Archetype:</span> {latest.archetype.primary} with {latest.archetype.secondary}</p>
                    <p className="text-muted-foreground">Confidence: {latest.metrics[0]?.confidence ?? "low"}</p>
                    <p className="text-muted-foreground">Sessions: {latest.stats.sessionCount}. Active time: {Math.round(latest.stats.activeSeconds / 60)} minutes.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Recommendations</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {latest.recommendations.map((recommendation) => (
                      <div key={recommendation.metric}>
                        <p className="font-medium">{recommendation.title}</p>
                        <p className="text-xs text-muted-foreground">{recommendation.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="mt-4 space-y-1">
                {chartData.map((row) => (
                  <div key={row.metric} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">{row.start} to {row.now} <span className={row.now >= row.start ? "text-emerald-600" : "text-rose-600"}>({row.now >= row.start ? "+" : ""}{row.now - row.start})</span></span>
                  </div>
                ))}
              </div>
            )}

            {latest && (
              <>
                <Card className="mt-6">
                  <CardHeader><CardTitle>Daily history</CardTitle><CardDescription>Calm trend view across local runs</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {latest.days.map((day) => (
                      <div key={day.day} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex justify-between"><span className="font-medium">{day.day}</span><span className="text-muted-foreground">{day.sessionCount} sessions</span></div>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-5">
                          {Object.entries(day.scores).map(([metric, value]) => <span key={metric}>{metric}: {value}</span>)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="mt-6">
                  <CardHeader><CardTitle>Session history</CardTitle><CardDescription>Each row is a derived snapshot, with no transcript</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {latest.sessions.slice().reverse().map((session) => (
                      <div key={session.id} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex justify-between"><span>{session.recordedAt}</span><span className="text-muted-foreground">{session.source}</span></div>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-5">
                          {Object.entries(session.scores).map(([metric, value]) => <span key={metric}>{metric}: {value}</span>)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            {data.githubError && <p className="mt-4 text-xs text-amber-700">Snapshots are unavailable: {data.githubError}</p>}
          </>
        )}
      </main>
    </div>
  );
}
