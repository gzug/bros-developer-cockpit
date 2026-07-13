// @lovable.dev/vite-tanstack-config already includes: TanStack devtools (dev-only),
// tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, VITE_* env injection,
// @ path alias, React/TanStack dedupe, error logger, sandbox detection.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
