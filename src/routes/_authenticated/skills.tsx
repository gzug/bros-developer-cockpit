import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { UploadCloud } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getSkillDashboardData, uploadSkillExports } from "@/lib/skills.functions";

export const Route = createFileRoute("/_authenticated/skills")({
  beforeLoad: async () => {
    const { checkAuth } = await import("@/lib/auth.server");
    const auth = await checkAuth();
    if (auth.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: Skills,
});

const chartConfig = {
  now: { label: "Now", color: "var(--chart-1)" },
  start: { label: "Start", color: "var(--chart-2)" },
} satisfies ChartConfig;

function Skills() {
  const queryClient = useQueryClient();
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const dashboard = useQuery({
    queryKey: ["skill-dashboard"],
    queryFn: () => getSkillDashboardData(),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadSkillExports({ data: formData }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        void queryClient.invalidateQueries({ queryKey: ["skill-dashboard"] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    },
  });

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFileCount === 0) {
      toast.error("Choose a Claude, ChatGPT, Google/Gemini, or PNG file first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    uploadMutation.mutate(formData);
  }

  const data = dashboard.data;
  const skillData = data?.chartData ?? [];
  const latest = data?.latest ?? null;
  const hasSnapshots = data?.hasSnapshots ?? false;
  const measurement = data?.measurement;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-3xl">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Fähigkeiten</h1>
            <Badge variant="outline">{hasSnapshots ? "Echte Messung" : "Beispieldaten"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Der Radar zeigt, wie sich Arbeitsmuster entwickeln. Ohne Upload zeigt er nur ein
            Beispiel.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Diese Seite ist ein Owner-Werkzeug: Sie bewertet nur Metadaten aus KI-Sitzungen und
            spielt nichts in One L1fe aus.
          </p>
        </div>

        <Card>
          <CardHeader className="items-center pb-2">
            <CardTitle>Fähigkeiten-Radar</CardTitle>
            <CardDescription>
              {hasSnapshots
                ? `Start ist die erste Messung. Jetzt ist die neueste von ${data?.snapshotCount ?? 0}.`
                : "Beispieldaten, bis die erste echte Messung gespeichert ist."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[340px]">
              <RadarChart data={skillData}>
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
          <p className="pb-1 text-xs text-muted-foreground">
            Jede Zeile zeigt denselben Wert wie der Radar als Text: Start ist der erste bekannte
            Stand, Jetzt der neueste Stand, die Zahl rechts ist die Veränderung.
          </p>
          {skillData.map((row) => {
            const delta = row.now - row.start;
            return (
              <div
                key={row.skill}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{row.skill}</span>
                <span className="text-muted-foreground tabular-nums">
                  {row.start} zu {row.now}
                  <span className={delta >= 0 ? "ml-2 text-emerald-600" : "ml-2 text-rose-600"}>
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {!hasSnapshots && (
          <p className="mt-4 text-xs text-muted-foreground">
            Das sind Beispielwerte. Sie bleiben als Beispieldaten markiert, bis GitHub mindestens
            einen echten skill-snapshot enthält. Beispielwerte sind Orientierung, keine echte
            Bewertung.
          </p>
        )}

        {data?.githubError && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
            GitHub-Messungen sind gerade nicht verfügbar: {data.githubError}
          </div>
        )}

        {latest?.smallData && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
            Kleine Datenbasis. Die neueste Messung enthält {latest.provenance.conversationCount}{" "}
            Gespräche und {latest.provenance.userPromptCount} Nutzer-Nachrichten. Die Werte zeigen
            deshalb nur die Richtung.
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>KI-Sitzungen hochladen</CardTitle>
            <CardDescription>
              Rohtext wird nur auf dem Server gelesen und danach verworfen. Gespeichert werden
              Scores, Zählwerte, Anbieter, Daten und PNG-Metadaten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Ein Klick auf Upload verarbeiten erstellt eine neue Messung. Der Radar springt danach
              von Beispieldaten auf echte Messung, wenn die Daten ausreichen.
            </p>
            <form className="grid gap-3" onSubmit={submitUpload}>
              <label className="grid gap-1 text-sm font-medium">
                Export-Dateien
                <input
                  name="files"
                  type="file"
                  multiple
                  accept=".zip,.json,.html,.htm,.png,application/zip,application/json,text/html,image/png"
                  onChange={(event) => setSelectedFileCount(event.currentTarget.files?.length ?? 0)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedFileCount > 0
                    ? `${selectedFileCount} Datei${selectedFileCount === 1 ? "" : "en"} ausgewählt`
                    : "Wähle zuerst einen unterstützten Export oder ein PNG."}
                </span>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Optionale PNG-Notiz
                <Textarea
                  name="note"
                  placeholder="Kurzer Kontext für einen Screenshot. Screenshots werden nicht als Dateien gespeichert."
                  className="min-h-20"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending || selectedFileCount === 0}
                >
                  <UploadCloud className="h-4 w-4" />
                  {uploadMutation.isPending ? "Wird verarbeitet" : "Upload verarbeiten"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Unterstützt Claude ZIP, ChatGPT ZIP, Google/Gemini JSON oder HTML und
                  PNG-Metadaten.
                </span>
              </div>
              {uploadMutation.data?.warnings.length ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                  {uploadMutation.data.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Wie gemessen wird</CardTitle>
            <CardDescription>
              Jeder Score basiert auf zählbaren Metadaten aus normalisierten Gesprächen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <p className="text-xs text-muted-foreground">
              Die aufklappbaren Formeln erklären, welche Signale in einen Score einfließen. Ein
              Klick auf eine Formel zeigt Details, ändert aber keine Messung.
            </p>
            <div>
              <h2 className="mb-2 text-sm font-semibold">Signale</h2>
              <div className="grid gap-2">
                {measurement?.signals.map((signal) => (
                  <div key={signal.key} className="rounded-md border border-border p-3">
                    <div className="font-medium">{signal.label}</div>
                    <div className="text-xs text-muted-foreground">{signal.description}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold">Formeln</h2>
              <div className="grid gap-2">
                {measurement?.dimensions.map((dimension) => (
                  <details key={dimension.key} className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer font-medium">{dimension.key}</summary>
                    <code className="mt-2 block whitespace-pre-wrap text-xs text-muted-foreground">
                      {dimension.formula}
                    </code>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Eingaben: {dimension.inputs.join(", ")}
                    </div>
                    {latest?.dimensionDetails?.[
                      dimension.key as keyof typeof latest.dimensionDetails
                    ] && (
                      <div className="mt-2 grid gap-1 text-xs">
                        {latest.dimensionDetails[
                          dimension.key as keyof typeof latest.dimensionDetails
                        ].inputs.map((input) => (
                          <div
                            key={`${dimension.key}-${input.key}`}
                            className="flex justify-between gap-3"
                          >
                            <span className="text-muted-foreground">{input.label}</span>
                            <span className="tabular-nums">{input.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
