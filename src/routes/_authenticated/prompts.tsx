import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPromptVersionDashboard } from "@/lib/prompt-versions.server";

export const Route = createFileRoute("/_authenticated/prompts")({
  beforeLoad: async () => {
    const { checkAuth } = await import("@/lib/auth.server");
    const auth = await checkAuth();
    if (auth.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: PromptsPage,
});

function PromptsPage() {
  const promptVersions = useQuery({
    queryKey: ["prompt-versions"],
    queryFn: () => getPromptVersionDashboard(),
  });
  const data = promptVersions.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Anweisungen</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Hier steht, welche Anweisungen das Cockpit benutzt und warum sie geändert wurden.
            </p>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
              Diese Seite ist nur zum Nachlesen. Sie zeigt, was sich an der KI-Anweisung geändert
              hat, wann es passiert ist und welche Wirkung erwartet wird.
            </p>
          </div>
          {data && <Badge variant="outline">{data.files.length} Dateien</Badge>}
        </div>

        {promptVersions.isLoading && (
          <div className="grid gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {promptVersions.isError && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
            Die Anweisungen konnten nicht geladen werden.
          </div>
        )}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Änderungsverlauf</CardTitle>
                <CardDescription>
                  Was geändert wurde, warum es geändert wurde und welche Wirkung erwartet wird. Jede
                  Zeile ist ein nachvollziehbarer Stand, kein Schalter.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.changelog.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Noch kein Änderungsverlauf gefunden. Sobald eine Version dokumentiert ist,
                    erscheinen hier Datum, Änderung, Grund und erwartete Wirkung.
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-border text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Version</th>
                        <th className="py-2 pr-3 font-medium">Wann</th>
                        <th className="py-2 pr-3 font-medium">Was sieht man?</th>
                        <th className="py-2 pr-3 font-medium">Warum geändert?</th>
                        <th className="py-2 font-medium">Erwartete Wirkung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.changelog.map((row) => (
                        <tr
                          key={`${row.version}-${row.date}`}
                          className="border-b border-border/60 align-top"
                        >
                          <td className="py-3 pr-3 font-medium">{row.version}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{row.date}</td>
                          <td className="py-3 pr-3">{row.whatChanged}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{row.why}</td>
                          <td className="py-3 text-muted-foreground">{row.expectedEffect}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 grid gap-4">
              {data.files.map((file) => (
                <Card key={file.filename}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {file.title}
                        </CardTitle>
                        <CardDescription>
                          {file.filename}. Der Block darunter zeigt den aktuellen Text zum Lesen und
                          Prüfen.
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{file.version}</Badge>
                        {file.stale && <Badge variant="outline">ersetzt</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Scrollen zeigt nur den Inhalt dieser Version. Hier wird keine Anweisung
                      aktiviert, gespeichert oder ausgespielt.
                    </p>
                    <pre className="max-h-[34rem] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                      {file.content}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
