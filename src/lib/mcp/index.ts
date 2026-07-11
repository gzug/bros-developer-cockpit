import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContributionsTool from "./tools/list-contributions";
import getContributionTool from "./tools/get-contribution";
import submitContributionTool from "./tools/submit-contribution";

// Issuer must be the DIRECT Supabase host; the publish-time `.lovable.cloud`
// proxy is rejected by mcp-js (RFC 8414 issuer mismatch). Vite inlines
// `import.meta.env.VITE_SUPABASE_PROJECT_ID` at build time.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "one-l1fe-contrib-mcp",
  title: "One-L1fe Contribution Mask",
  version: "0.1.0",
  instructions:
    "Tools to file and track scoped change requests for the One-L1fe companion app. Use `list_contributions` and `get_contribution` to review status; use `submit_contribution` to open a new request that mentions @codex on GitHub. Never send health data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listContributionsTool, getContributionTool, submitContributionTool],
});
