import type { LucideIcon } from "lucide-react";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  LineChart,
  ListChecks,
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
  search?: Record<string, never>;
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
    id: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    access: "all",
    description: "Browse submitted ideas, or submit a new one.",
    kind: "menu",
    items: [
      {
        label: "Browse ideas",
        to: "/dashboard",
        access: "all",
        description: "See every idea and its current status.",
      },
      {
        label: "Submit a new idea",
        to: "/chat",
        search: {},
        access: "all",
        description: "Report wording, appearance, or something broken.",
      },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    icon: ListChecks,
    access: "all",
    description: "See the build plan for ideas in progress, and a log of recent runs.",
    kind: "menu",
    items: [
      {
        label: "View plan",
        to: "/pipeline",
        access: "all",
        description: "Ideas queued, in review, or already published.",
      },
      {
        label: "Prep log",
        to: "/runs",
        access: "all",
        description: "Recent runs. Read-only for the co-dev.",
      },
    ],
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    access: "all",
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
