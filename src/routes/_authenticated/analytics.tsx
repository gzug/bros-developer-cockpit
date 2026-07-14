import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  ChevronRight,
  FileJson,
  HelpCircle,
  History,
  Info,
  Lightbulb,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
  Zap
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzeSessionEntry } from "@/lib/analytics/analytics.server";
import { type PaxelReport, type PaxelScores } from "@/lib/analytics/paxel-engine";

// ---------------- ROUTE DEFINITION ----------------

export const Route = createFileRoute("/_authenticated/analytics")({
  component: PaxelAnalyticsDashboard,
});

// ---------------- PRELOADED MOCK TRANSCIPTS ----------------

const MOCK_SESSION_ARCHITECT = `{
  "id": "session-architect-1",
  "title": "Clean Architecture Refactoring",
  "start": "${new Date(Date.now() - 24 * 3600 * 1000).toISOString()}",
  "duration": 4200,
  "prompts": [
    { "text": "Let's plan a deep refactoring of the user profiles system. First, read the schemas and help me map out a multi-step checklist in our AGENTS.md format to preserve API compatibility." },
    { "text": "Perfect. Let's start with Step 1: Create the normalized database migrations under drizzle/. No changes to the actual components yet, let's make sure compilation works first." },
    { "text": "Wait, we have a minor type discrepancy in the user.id field (string vs number). Actually, go back and ensure we cast it consistently across the queries." },
    { "text": "Excellent. Now write a comprehensive unit test in src/lib/user.test.ts to verify the serialization and error handling before we proceed to UI files." }
  ],
  "tools": [
    { "name": "read_file", "status": "success", "params": "src/lib/db.ts" },
    { "name": "read_file", "status": "success", "params": "src/components/profile.tsx" },
    { "name": "grep", "status": "success", "params": "userId" },
    { "name": "glob", "status": "success", "params": "src/**/*.ts" },
    { "name": "write_file", "status": "success", "params": "drizzle/migrations/001_normalized_id.sql" },
    { "name": "edit", "status": "success", "params": "src/lib/user.server.ts" },
    { "name": "run_in_bash_session", "status": "success", "params": "bun run build" },
    { "name": "write_file", "status": "success", "params": "src/lib/user.test.ts" },
    { "name": "run_in_bash_session", "status": "success", "params": "bun test" }
  ],
  "commits": [
    { "hash": "a1b2c3d", "message": "feat: normalize userId database schemas and add model validation", "date": "${new Date(Date.now() - 24 * 3600 * 1000).toISOString()}" }
  ]
}`;

const MOCK_SESSION_VELOCITY = `{
  "id": "session-velocity-1",
  "title": "Rapid Feature Shipping Loop",
  "start": "${new Date(Date.now() - 3 * 3600 * 1000).toISOString()}",
  "duration": 1800,
  "prompts": [
    { "text": "add a red submit button to the footer" },
    { "text": "looks good, now add a hover transition effect to it" },
    { "text": "unbreak the spacing in the dashboard cards grid" },
    { "text": "now add an dynamic indicator to show when state is loading" },
    { "text": "ship it!" }
  ],
  "tools": [
    { "name": "edit", "status": "success" },
    { "name": "edit", "status": "success" },
    { "name": "edit", "status": "success" },
    { "name": "edit", "status": "success" }
  ],
  "commits": [
    { "hash": "f6g7h8j", "message": "fix: styling tweaks and loader", "date": "${new Date(Date.now() - 3 * 3600 * 1000).toISOString()}" }
  ]
}`;

const MOCK_SESSION_DEBUGGER = `{
  "id": "session-debugger-1",
  "title": "Emergency Crash Resolution",
  "start": "${new Date(Date.now() - 12 * 3600 * 1000).toISOString()}",
  "duration": 2400,
  "prompts": [
    { "text": "The server is throwing 'Cannot find module vinxi/http' on startup. Why is this happening? Let's check package.json and import boundaries." },
    { "text": "Ah, let's fix it by migrating our cookie imports to @tanstack/react-start/server instead. Let's replace the imports in auth.server.ts and run the dev server." },
    { "text": "We have an implicit any error on getRequestIP(). Quick, add typing or casting to fix compilation." },
    { "text": "Awesome. Let's run bun run build to verify the Nitro preset output is fully working." }
  ],
  "tools": [
    { "name": "read_file", "status": "success", "params": "package.json" },
    { "name": "grep", "status": "success", "params": "vinxi" },
    { "name": "edit", "status": "failed", "params": "src/lib/auth.server.ts" },
    { "name": "edit", "status": "success", "params": "src/lib/auth.server.ts" },
    { "name": "run_in_bash_session", "status": "failed", "params": "bun run build" },
    { "name": "edit", "status": "success", "params": "src/lib/auth.server.ts" },
    { "name": "run_in_bash_session", "status": "success", "params": "bun run build" }
  ],
  "commits": [
    { "hash": "z9y8x7w", "message": "fix: resolve Nitro server crash by switching import boundaries to react-start", "date": "${new Date(Date.now() - 12 * 3600 * 1000).toISOString()}" }
  ]
}`;

// ---------------- HELPER COMPONENTS ----------------

/**
 * Highly interactive, fully custom, clean SVG Radar Chart component.
 * Plots the 5 axes (Steering, Execution, Quality, Product, Planning) inside a neat pentagon grid.
 */
function RadarChart({ scores }: { scores: PaxelScores }) {
  const axes = [
    { name: "Steering", value: scores.steering },
    { name: "Execution", value: scores.execution },
    { name: "Quality", value: scores.quality },
    { name: "Product", value: scores.product },
    { name: "Planning", value: scores.planning },
  ];

  const size = 260;
  const radius = 90;
  const center = size / 2;

  // Calculate coordinates for pentagon vertices
  const getCoordinates = (index: number, scaleValue: number) => {
    // 5 vertices: angle is 2 * PI * index / 5
    // Offset by -PI/2 to start at the exact top
    const angle = (2 * Math.PI * index) / 5 - Math.PI / 2;
    const x = center + radius * scaleValue * Math.cos(angle);
    const y = center + radius * scaleValue * Math.sin(angle);
    return { x, y };
  };

  // Generate grid circles/pentagons (levels 0.2, 0.4, 0.6, 0.8, 1.0)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPaths = gridLevels.map((level) => {
    const points = [0, 1, 2, 3, 4].map((i) => {
      const { x, y } = getCoordinates(i, level);
      return `${x},${y}`;
    });
    return points.join(" ");
  });

  // Calculate active data polygon path
  const dataPoints = axes.map((axis, i) => {
    const normalizedValue = axis.value / 100; // Map 0-100 to 0-1
    const { x, y } = getCoordinates(i, normalizedValue);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-card rounded-lg border border-border">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Pentagon Grids */}
        {gridPaths.map((path, idx) => (
          <polygon
            key={idx}
            points={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-muted/30"
          />
        ))}

        {/* Outer Level Markers */}
        {[0, 1, 2, 3, 4].map((i) => {
          const { x: x1, y: y1 } = getCoordinates(i, 1.0);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x1}
              y2={y1}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-muted/30"
            />
          );
        })}

        {/* Active Data Area */}
        <polygon
          points={dataPoints}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3b82f6"
          strokeWidth="2.5"
          className="dark:stroke-blue-400 dark:fill-blue-400/10"
        />

        {/* Axes Dots */}
        {axes.map((axis, i) => {
          const { x, y } = getCoordinates(i, axis.value / 100);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4.5"
              className="fill-blue-500 stroke-background stroke-2 dark:fill-blue-400"
            />
          );
        })}

        {/* Label Overlays */}
        {axes.map((axis, i) => {
          // Push label slightly outward
          const { x, y } = getCoordinates(i, 1.2);
          let textAnchor: "inherit" | "end" | "start" | "middle" | undefined = "middle";
          if (x < center - 10) textAnchor = "end";
          if (x > center + 10) textAnchor = "start";

          return (
            <text
              key={i}
              x={x}
              y={y + 4}
              fontSize="10"
              fontWeight="600"
              textAnchor={textAnchor}
              className="fill-foreground text-[10px] select-none"
            >
              {axis.name} ({axis.value})
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------- PRIMARY MAIN COMPONENT ----------------

function PaxelAnalyticsDashboard() {
  const [sessionsList, setSessionsList] = useState<PaxelReport[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "tips" | "history" | "uploader">("overview");

  // Load saved session reports from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("paxel_reports");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PaxelReport[];
        if (parsed.length > 0) {
          setSessionsList(parsed);
          setSelectedSessionId(parsed[0].id);
        }
      } catch (err) {
        console.error("Failed to load local storage paxel reports", err);
      }
    }
  }, []);

  // Save reports back to localStorage whenever list changes
  const saveReportsList = (updated: PaxelReport[]) => {
    setSessionsList(updated);
    localStorage.setItem("paxel_reports", JSON.stringify(updated));
    if (updated.length > 0 && !selectedSessionId) {
      setSelectedSessionId(updated[0].id);
    }
  };

  // Clear all sessions
  const clearAllSessions = () => {
    if (confirm("Are you sure you want to wipe all session metrics history?")) {
      setSessionsList([]);
      setSelectedSessionId("");
      localStorage.removeItem("paxel_reports");
      toast.success("History successfully cleared.");
    }
  };

  // Server Fn Mutation to analyze uploaded file content
  const mutation = useMutation({
    mutationFn: (variables: { rawContent: string; fileName?: string }) =>
      analyzeSessionEntry({ data: variables }),
    onSuccess: (report) => {
      toast.success(`Session "${report.stats.totalPrompts > 0 ? (report.stats.totalPrompts + ' prompts') : 'uploaded'}" analyzed successfully!`);

      // Prevent duplicates of identical sessions by updating or pushing
      const nextList = [report, ...sessionsList.filter((s) => s.id !== report.id)];
      saveReportsList(nextList);
      setSelectedSessionId(report.id);
      setActiveTab("overview");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to analyze session log.");
    },
  });

  // Handle local file drop or selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      mutation.mutate({ rawContent: content, fileName: file.name });
    };
    reader.readAsText(file);
  };

  // Load a preset template transcript instantly
  const loadPresetTemplate = (rawContent: string, title: string) => {
    mutation.mutate({ rawContent, fileName: `${title}.json` });
  };

  // Find the currently active session report
  const currentReport = sessionsList.find((s) => s.id === selectedSessionId) || sessionsList[0];

  // Aggregated Core Profile (averages over all historical sessions)
  const computeAggregateScores = (): PaxelScores => {
    if (sessionsList.length === 0) {
      return { steering: 0, execution: 0, quality: 0, product: 0, planning: 0 };
    }
    const sum = sessionsList.reduce(
      (acc, s) => {
        acc.steering += s.scores.steering;
        acc.execution += s.scores.execution;
        acc.quality += s.scores.quality;
        acc.product += s.scores.product;
        acc.planning += s.scores.planning;
        return acc;
      },
      { steering: 0, execution: 0, quality: 0, product: 0, planning: 0 }
    );
    const count = sessionsList.length;
    return {
      steering: Math.round(sum.steering / count),
      execution: Math.round(sum.execution / count),
      quality: Math.round(sum.quality / count),
      product: Math.round(sum.product / count),
      planning: Math.round(sum.planning / count),
    };
  };

  const aggregateScores = computeAggregateScores();

  // Helper color for metric highlights
  const getProgressColor = (val: number) => {
    if (val >= 80) return "bg-emerald-500";
    if (val >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-blue-500" /> Paxel Analytics
              </h1>
              <Badge variant="outline" className="text-xs border-blue-500/30 bg-blue-500/5 text-blue-500 dark:text-blue-400">
                Builder Profile v1
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Reverse-engineered Y Combinator Paxel session analyzer. Optimize steering, speed, and engineering leverage.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sessionsList.length > 0 && (
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {sessionsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stats.commitsCount > 0 ? "📦" : "💻"} {s.title || "Session"} (
                    {new Date(s.timestamp).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                    )
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" onClick={() => setActiveTab("uploader")} className="gap-1 text-xs">
              <Upload className="h-3.5 w-3.5" /> Upload Log
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border mb-6 overflow-x-auto text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-500 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard Overview
          </button>
          <button
            onClick={() => setActiveTab("tips")}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === "tips"
                ? "border-blue-500 text-blue-500 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Growth Focus Areas
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === "history"
                ? "border-blue-500 text-blue-500 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            History & Trends ({sessionsList.length})
          </button>
          <button
            onClick={() => setActiveTab("uploader")}
            className={`px-4 py-2 border-b-2 font-medium ${
              activeTab === "uploader"
                ? "border-blue-500 text-blue-500 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Ingestion Center
          </button>
        </div>

        {/* EMPTY STATE */}
        {sessionsList.length === 0 && activeTab !== "uploader" && (
          <div className="rounded-lg border border-dashed border-border py-16 text-center max-w-2xl mx-auto">
            <Sparkles className="h-12 w-12 text-blue-500/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No analyzed session profiles yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto px-4">
              Upload a raw Claude Code `.jsonl` transcript, Cursor chat-history, or use one of our preloaded template logs to unlock your Builder profile insights.
            </p>
            <Button onClick={() => setActiveTab("uploader")} className="mt-6 gap-2">
              Go to Ingestion Center <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* TAB CONTENT: OVERVIEW */}
        {sessionsList.length > 0 && activeTab === "overview" && currentReport && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* COLUMN 1: ARCHE_TYPE BADGE & RADAR */}
            <div className="space-y-6 lg:col-span-1">
              {/* Profile Badge */}
              <Card className="overflow-hidden border-blue-500/20 shadow-sm">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
                      <Award className="h-5 w-5 text-blue-500" /> Primary Archetype
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs text-blue-500 dark:text-blue-400">
                      {currentReport.archetype.confidence}% Confidence
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg border border-border">
                    <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                      {currentReport.archetype.primary}
                    </span>
                    {currentReport.archetype.secondary && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Secondary sub-traits: <span className="font-semibold text-foreground">{currentReport.archetype.secondary}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentReport.archetype.description}
                  </p>
                </CardContent>
              </Card>

              {/* Radar Grid */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Performance Axis</CardTitle>
                  <CardDescription className="text-xs">Visualizing steering vs planning balance</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center p-4">
                  <RadarChart scores={currentReport.scores} />
                </CardContent>
              </Card>
            </div>

            {/* COLUMN 2 & 3: STATS GRID & DETAILS */}
            <div className="space-y-6 lg:col-span-2">

              {/* Detailed Scores List */}
              <Card>
                <CardHeader className="border-b border-border/60 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">5-Axis Score Breakdown</CardTitle>
                      <CardDescription className="text-xs">Calculated from prompt lengths, tool calls, errors, and commits</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      Avg Score: {Math.round((currentReport.scores.steering + currentReport.scores.execution + currentReport.scores.quality + currentReport.scores.product + currentReport.scores.planning) / 5)}/100
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {/* Steering */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-amber-500" /> Steering (Directing the AI)</span>
                      <span className="font-bold">{currentReport.scores.steering}/100</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${getProgressColor(currentReport.scores.steering)}`} style={{ width: `${currentReport.scores.steering}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Steering keywords, custom instructions density, prompt lengths, and course corrections.
                    </p>
                  </div>

                  {/* Execution */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Execution Leverage</span>
                      <span className="font-bold">{currentReport.scores.execution}/100</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${getProgressColor(currentReport.scores.execution)}`} style={{ width: `${currentReport.scores.execution}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Density of edit/write operations per session hour, balanced with exploratory reads.
                    </p>
                  </div>

                  {/* Quality */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1"><Award className="h-3.5 w-3.5 text-emerald-500" /> Engineering Quality</span>
                      <span className="font-bold">{currentReport.scores.quality}/100</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${getProgressColor(currentReport.scores.quality)}`} style={{ width: `${currentReport.scores.quality}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Low tool/command failure rate, active unit tests execution, and frequent micro-commits.
                    </p>
                  </div>

                  {/* Product Thinking */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1"><Info className="h-3.5 w-3.5 text-indigo-500" /> Product Thinking</span>
                      <span className="font-bold">{currentReport.scores.product}/100</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${getProgressColor(currentReport.scores.product)}`} style={{ width: `${currentReport.scores.product}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Use of user experience keywords, component design specifics, and feature bounds scoping.
                    </p>
                  </div>

                  {/* Planning */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5 text-violet-500" /> Pre-Flight Planning</span>
                      <span className="font-bold">{currentReport.scores.planning}/100</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${getProgressColor(currentReport.scores.planning)}`} style={{ width: `${currentReport.scores.planning}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Grep/Glob exploratory analysis ratio vs code writes, and planning verbs triggers.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Session Statistics Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Prompts</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg font-bold">{currentReport.stats.totalPrompts}</div>
                    <div className="text-[10px] text-muted-foreground">Avg: {currentReport.stats.avgPromptLength} Chars</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Tool calls</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg font-bold">{currentReport.stats.totalTools}</div>
                    <div className="text-[10px] text-muted-foreground">{currentReport.stats.toolDiversity} Unique tools</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Planning ratio</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg font-bold text-blue-500">{currentReport.stats.planningRatio}x</div>
                    <div className="text-[10px] text-muted-foreground">Read vs Edit tools</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Failures / Errors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className={`text-lg font-bold ${currentReport.stats.errorCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {currentReport.stats.errorCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Tool exits</div>
                  </CardContent>
                </Card>
              </div>

              {/* Weakest Prompts / Critique Highlights */}
              <Card className="border-rose-500/15">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
                  <div>
                    <CardTitle className="text-sm font-semibold text-rose-500 dark:text-rose-400">Playful Attention Needed: Weakest Prompts</CardTitle>
                    <CardDescription className="text-xs">Critical feedback on vaguest or shortest prompts sent during this session</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60">
                    {currentReport.weakestPrompts.map((wp, i) => (
                      <div key={i} className="p-4 flex flex-col md:flex-row gap-3 text-xs">
                        <div className="md:w-1/2 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 rounded p-3 font-mono">
                          "{wp.prompt}"
                        </div>
                        <div className="md:w-1/2 flex items-start gap-2 pt-1">
                          <span className="text-rose-500 font-bold shrink-0">Critique:</span>
                          <p className="text-muted-foreground leading-relaxed">
                            {wp.critique}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        )}

        {/* TAB CONTENT: RECOMMENDATIONS */}
        {sessionsList.length > 0 && activeTab === "tips" && currentReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentReport.growthRecommendations.map((rec, i) => (
                <Card key={i} className="relative overflow-hidden border-blue-500/10 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          Metric: {rec.metric}
                        </Badge>
                        <Badge variant={rec.impact === "High" ? "default" : "secondary"} className="text-[9px]">
                          {rec.impact} Impact
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-semibold leading-snug">
                        {rec.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground leading-relaxed pt-2">
                      {rec.description}
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>

            {/* Playful tip reminder */}
            <Card className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-blue-500/10">
              <CardContent className="p-6 flex gap-4 items-start">
                <Lightbulb className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Vision: Continuous Practice & Tracking</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By importing more session logs over time, Paxel Analytics aggregates these tips into personalized **Focus Topics** to enhance your daily developer flow. Try applying one rule in your next Claude Code or Cursor session!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB CONTENT: HISTORY & TRENDS */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Aggregate Core profile card */}
            <Card className="bg-gradient-to-r from-muted/50 to-muted/20 border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-base font-semibold">Your Aggregate Core Profile ({sessionsList.length} Sessions)</CardTitle>
                </div>
                <CardDescription className="text-xs">Combined average performance across all loaded sessions</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-background rounded border border-border">
                    <div className="text-xs font-semibold text-muted-foreground">Steering</div>
                    <div className="text-xl font-extrabold mt-1 text-blue-500">{aggregateScores.steering}</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded border border-border">
                    <div className="text-xs font-semibold text-muted-foreground">Execution</div>
                    <div className="text-xl font-extrabold mt-1 text-blue-500">{aggregateScores.execution}</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded border border-border">
                    <div className="text-xs font-semibold text-muted-foreground">Quality</div>
                    <div className="text-xl font-extrabold mt-1 text-blue-500">{aggregateScores.quality}</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded border border-border">
                    <div className="text-xs font-semibold text-muted-foreground">Product</div>
                    <div className="text-xl font-extrabold mt-1 text-blue-500">{aggregateScores.product}</div>
                  </div>
                  <div className="text-center p-3 bg-background rounded border border-border">
                    <div className="text-xs font-semibold text-muted-foreground">Planning</div>
                    <div className="text-xl font-extrabold mt-1 text-blue-500">{aggregateScores.planning}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* List Table */}
            <Card>
              <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">All Saved Sessions</CardTitle>
                  <CardDescription className="text-xs">History of all imported and evaluated transcripts</CardDescription>
                </div>
                {sessionsList.length > 0 && (
                  <Button variant="ghost" size="xs" onClick={clearAllSessions} className="text-xs text-rose-500 hover:bg-rose-500/10">
                    Clear History
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {sessionsList.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No sessions in history yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Archetype</TableHead>
                        <TableHead className="text-xs">Axes Avg</TableHead>
                        <TableHead className="text-xs text-right">Prompts</TableHead>
                        <TableHead className="text-xs text-right">Tools</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsList.map((s) => {
                        const avg = Math.round((s.scores.steering + s.scores.execution + s.scores.quality + s.scores.product + s.scores.planning) / 5);
                        return (
                          <TableRow key={s.id} className="hover:bg-muted/10">
                            <TableCell className="text-xs font-medium">{s.title}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {new Date(s.timestamp).toLocaleDateString("en-AU")}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="border-blue-500/20 text-blue-500">
                                {s.archetype.primary}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-bold">{avg}/100</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.stats.totalPrompts}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.stats.totalTools}</TableCell>
                            <TableCell className="text-right py-1.5">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSessionId(s.id);
                                  setActiveTab("overview");
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB CONTENT: INGESTION CENTER */}
        {activeTab === "uploader" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* drag and drop file upload */}
            <Card className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Upload Session Logs</CardTitle>
                  <CardDescription className="text-xs">
                    Upload a raw Claude Code `.jsonl` transcript, Cursor workspace storage JSON, or general session JSON.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Fake drag & drop */}
                  <div className="border-2 border-dashed border-border/80 rounded-lg p-10 text-center hover:border-blue-500/50 bg-muted/20 transition-colors relative">
                    <input
                      type="file"
                      accept=".json,.jsonl,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <span className="block text-sm font-semibold">Click or drag files here to upload</span>
                    <span className="block text-xs text-muted-foreground mt-1">Supports JSON, JSONL and Plaintext transcripts</span>
                  </div>

                  {mutation.isPending && (
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 flex items-center justify-center gap-3">
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                      <div className="text-xs">
                        <span className="font-semibold block text-blue-500">Analyzing session transcript...</span>
                        <span className="text-muted-foreground mt-0.5">Calculating steering index & product focus scores</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-6 border-t border-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  Your logs are processed safely. Base scores are computed 100% in your browser. Qualitative advice is enriched via OpenRouter APIs.
                </p>
              </div>
            </Card>

            {/* instant preloaded template logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Preloaded Quick Presets</CardTitle>
                <CardDescription className="text-xs">
                  Don't have a log handy? Instantly load one of these rich mock sessions to test-drive the full dashboard metrics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* template 1: architect */}
                <div className="p-4 rounded-lg border border-border/80 hover:border-blue-500/30 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-foreground text-sm block">Systemic Refactoring Session</span>
                    <span className="text-muted-foreground mt-1 block">A planning-focused profile with high research tools density.</span>
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[9px]">Steering</Badge>
                      <Badge variant="outline" className="text-[9px]">Planning</Badge>
                      <Badge variant="outline" className="text-[9px]">Architect</Badge>
                    </div>
                  </div>
                  <Button
                    size="xs"
                    onClick={() => loadPresetTemplate(MOCK_SESSION_ARCHITECT, "Refactoring Task")}
                    disabled={mutation.isPending}
                    className="shrink-0"
                  >
                    Load preset
                  </Button>
                </div>

                {/* template 2: velocity */}
                <div className="p-4 rounded-lg border border-border/80 hover:border-blue-500/30 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-foreground text-sm block">Rapid CSS Shipping Session</span>
                    <span className="text-muted-foreground mt-1 block">Highly active velocity machine shipping fast iterations.</span>
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[9px]">Execution</Badge>
                      <Badge variant="outline" className="text-[9px]">Velocity</Badge>
                    </div>
                  </div>
                  <Button
                    size="xs"
                    onClick={() => loadPresetTemplate(MOCK_SESSION_VELOCITY, "Frontend Tweak")}
                    disabled={mutation.isPending}
                    className="shrink-0"
                  >
                    Load preset
                  </Button>
                </div>

                {/* template 3: debugger */}
                <div className="p-4 rounded-lg border border-border/80 hover:border-blue-500/30 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-foreground text-sm block">Server Crash Fixing Session</span>
                    <span className="text-muted-foreground mt-1 block">Targeted imports debugging and Nitro presets error recovery.</span>
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[9px]">Quality</Badge>
                      <Badge variant="outline" className="text-[9px]">Debugger</Badge>
                    </div>
                  </div>
                  <Button
                    size="xs"
                    onClick={() => loadPresetTemplate(MOCK_SESSION_DEBUGGER, "Devops fix")}
                    disabled={mutation.isPending}
                    className="shrink-0"
                  >
                    Load preset
                  </Button>
                </div>

              </CardContent>
            </Card>

          </div>
        )}

      </main>
    </div>
  );
}
