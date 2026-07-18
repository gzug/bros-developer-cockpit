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
            <h1 className="text-2xl font-semibold tracking-tight">Prompt versions</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Versioned Projektleiter prompt files and their changelog from the repo.
            </p>
          </div>
          {data && <Badge variant="outline">{data.files.length} files</Badge>}
        </div>

        {promptVersions.isLoading && (
          <div className="grid gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {promptVersions.isError && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
            Prompt versions could not be loaded.
          </div>
        )}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Changelog</CardTitle>
                <CardDescription>{data.changelogSource}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Version</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Changed</th>
                      <th className="py-2 pr-3 font-medium">Why</th>
                      <th className="py-2 font-medium">Expected effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.changelog.map((row) => (
                      <tr key={`${row.version}-${row.date}`} className="border-b border-border/60 align-top">
                        <td className="py-3 pr-3 font-medium">{row.version}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{row.date}</td>
                        <td className="py-3 pr-3">{row.whatChanged}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{row.why}</td>
                        <td className="py-3 text-muted-foreground">{row.expectedEffect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                        <CardDescription>{file.filename}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{file.version}</Badge>
                        {file.stale && <Badge variant="outline">stale/superseded</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
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
