import type { LucideIcon } from "lucide-react";
import { Award, House, Lightbulb, ListChecks } from "lucide-react";

// Single source of truth for the icon dock + header nav. Keep this local — do NOT import roles
// or types from *.server modules; that would pull server code into client bundles.
export type NavRole = "brother" | "owner";
export type NavAccess = "all" | "owner"; // "owner" renders lock-badged for the brother

export type NavLeaf = {
  label: string;
  to: string;
  search?: Record<string, never>;
  access: NavAccess;
};
export type NavEntry = { id: string; label: string; icon: LucideIcon; access: NavAccess } & (
  { kind: "link"; to: string } | { kind: "menu"; items: NavLeaf[] }
);

export const NAV_DOCK: NavEntry[] = [
  {
    id: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    access: "all",
    kind: "menu",
    items: [
      { label: "Ideas", to: "/dashboard", access: "all" },
      { label: "New idea", to: "/chat", search: {}, access: "all" },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    icon: ListChecks,
    access: "all",
    kind: "menu",
    items: [
      { label: "Plan", to: "/pipeline", access: "all" },
      // Prep log stays owner-locked in PR-A; a later PR relaxes it.
      { label: "Prep log", to: "/runs", access: "owner" },
    ],
  },
  { id: "skills", label: "Skills", icon: Award, access: "owner", kind: "link", to: "/skills" },
  {
    id: "home",
    label: "Home",
    icon: House,
    access: "all",
    kind: "menu",
    items: [
      { label: "Done", to: "/done", access: "all" },
      { label: "Instructions", to: "/prompts", access: "owner" },
      { label: "Status", to: "/owner-kpi", access: "owner" },
      { label: "Control", to: "/dc", access: "owner" },
    ],
  },
];
