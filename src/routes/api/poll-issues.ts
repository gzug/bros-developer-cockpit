import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/poll-issues")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { requireOwner } = await import("@/lib/auth-session.server");
          requireOwner();
          const { pollNewBdcIssues } = await import("@/lib/issue-poller.server");
          return Response.json(await pollNewBdcIssues());
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json(
            { ok: false, error: message },
            {
              status:
                message === "Not logged in."
                  ? 401
                  : message === "Owner access required."
                    ? 403
                    : 500,
            },
          );
        }
      },
    },
  },
});
