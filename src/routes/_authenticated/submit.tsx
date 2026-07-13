import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/submit")({
  beforeLoad: () => {
    throw redirect({ to: "/chat" });
  },
});
