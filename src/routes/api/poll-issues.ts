import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/poll-issues")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { requireAuth } = await import("@/lib/auth-session.server");
          requireAuth();
          const { pollNewBdcIssues } = await import("@/lib/issue-poller.server");
          return Response.json(await pollNewBdcIssues());
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
      },
    },
  },
});
