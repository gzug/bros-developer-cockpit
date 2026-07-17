import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAuth } from "@/lib/auth.server";
import { HelpBubble } from "@/components/HelpBubble";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const result = await checkAuth();
    if (!result.authenticated) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
  },
  component: () => (
    <>
      <Outlet />
      <HelpBubble />
    </>
  ),
});
