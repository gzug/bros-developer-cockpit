import type { LucideIcon } from "lucide-react";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  LineChart,
  ListChecks,
  Sparkles,
} from "lucide-react";

// Single source of truth for the /home landing page (and any future header nav that needs the
// same list). Keep this local — do NOT import roles or types from *.server modules; that would
// pull server code into client bundles. Descriptions must stay true to what the linked route
// actually does — never invent a capability here. Cross-check against src/routes/README.md's
// route/role/access matrix, which is the canonical record of what each route does and who can
// use it.
export type NavRole = "brother" | "owner";
export type NavAccess = "all" | "owner"; // "owner" renders locked for the brother

export type NavLeaf = {
  label: string;
  to: string;
  // URL search params passed straight to <Link search={...}>. Primitive values only
  // (they serialize into the query string). Was `Record<string, never>`, which only
  // permitted `{}` and would reject any real param a future leaf might need.
  search?: Record<string, string | number | boolean>;
  access: NavAccess;
  description: string;
};

export type NavEntry = {
  id: string;
  label: string;
  icon: LucideIcon;
  access: NavAccess;
  description: string;
} & ({ kind: "link"; to: string } | { kind: "menu"; items: NavLeaf[] });

export const NAV_DOCK: NavEntry[] = [
  {
    id: "co-dev",
    label: "Co-Dev",
    icon: Sparkles,
    access: "all",
    description: "Talk an idea through, then watch it get built — chat and tracker on one page.",
    kind: "link",
    to: "/co-dev",
  },
  // The scattered idea/plan/done screens are REPLACED by Co-Dev for the brother, but stay available
  // to the owner (and reachable by URL for anyone). Marking them owner-access surfaces them only in
  // the owner's /home nav; the routes themselves keep their own `requireAuth()` and are unchanged.
  {
    id: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    access: "owner",
    description: "Browse submitted ideas, or submit a new one.",
    kind: "menu",
    items: [
      {
        label: "Browse ideas",
        to: "/dashboard",
        access: "owner",
        description: "See every idea and its current status.",
      },
      {
        label: "Submit a new idea",
        to: "/chat",
        search: {},
        access: "owner",
        description: "Report wording, appearance, or something broken.",
      },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    icon: ListChecks,
    access: "owner",
    description: "See the build plan for ideas in progress, and a log of recent runs.",
    kind: "menu",
    items: [
      {
        label: "View plan",
        to: "/pipeline",
        access: "owner",
        description: "Ideas queued, in review, or already published.",
      },
      {
        label: "Prep log",
        to: "/runs",
        access: "owner",
        description: "Recent runs.",
      },
    ],
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    access: "owner",
    description: "Ideas that have already shipped.",
    kind: "link",
    to: "/done",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Award,
    access: "owner",
    description:
      "Skill and measurement data — real numbers, or a sample until something is uploaded.",
    kind: "link",
    to: "/skills",
  },
  {
    id: "control",
    label: "Control",
    icon: ClipboardCheck,
    access: "owner",
    description: "Approve or request changes on submitted work — the review and approval panel.",
    kind: "link",
    to: "/dc",
  },
  {
    id: "instructions",
    label: "Instructions",
    icon: FileText,
    access: "owner",
    description: "The prompt and instruction versions that drive the AI, and why they changed.",
    kind: "link",
    to: "/prompts",
  },
  {
    id: "status",
    label: "Status",
    icon: LineChart,
    access: "owner",
    description: "KPIs: all ideas, closed and done counts, total cost.",
    kind: "link",
    to: "/owner-kpi",
  },
];
