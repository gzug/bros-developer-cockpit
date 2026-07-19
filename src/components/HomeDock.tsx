import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NAV_DOCK, type NavEntry, type NavLeaf, type NavRole } from "@/lib/nav-model";

const OWNER_LOCKED_TITLE = "Owner area. Don checks and approves here.";

const iconButtonClass =
  "group relative flex h-16 w-16 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const iconClass =
  "h-12 w-12 transition-transform duration-150 ease-out group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transition-none motion-reduce:group-hover:scale-100";

function isAllowed(access: "all" | "owner", role: NavRole | null) {
  return access === "all" || role === "owner";
}

function LockedIconButton({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;
  return (
    <span
      className={`${iconButtonClass} cursor-not-allowed text-muted-foreground opacity-80`}
      title={OWNER_LOCKED_TITLE}
      aria-disabled="true"
      aria-label={`${entry.label}, owner-only area`}
    >
      <span className="relative">
        <Icon className={iconClass} aria-hidden />
        <Lock className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" aria-hidden />
      </span>
    </span>
  );
}

function LinkIconButton({ entry }: { entry: Extract<NavEntry, { kind: "link" }> }) {
  const Icon = entry.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={entry.to} className={iconButtonClass} aria-label={entry.label}>
          <Icon className={iconClass} aria-hidden />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top">{entry.label}</TooltipContent>
    </Tooltip>
  );
}

function MenuRow({ item, onClose }: { item: NavLeaf; onClose: () => void }) {
  if (item.access === "owner") {
    return (
      <span
        className="flex w-full cursor-not-allowed items-center gap-1.5 rounded px-2 py-1.5 text-sm text-muted-foreground opacity-80"
        title={OWNER_LOCKED_TITLE}
        aria-disabled="true"
        aria-label={`${item.label}, owner-only area`}
      >
        <Lock className="h-3 w-3" aria-hidden />
        {item.label}
      </span>
    );
  }
  return (
    <Link
      to={item.to}
      search={item.search}
      className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent"
      onClick={onClose}
    >
      {item.label}
    </Link>
  );
}

function MenuIconButton({
  entry,
  open,
  onOpenChange,
}: {
  entry: Extract<NavEntry, { kind: "menu" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = entry.icon;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" className={iconButtonClass} aria-label={entry.label}>
              <Icon className={iconClass} aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{entry.label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" className="w-48 p-1">
        {entry.items.map((item) => (
          <MenuRow key={item.to} item={item} onClose={() => onOpenChange(false)} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function HomeDock({ role }: { role: NavRole | null }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Main sections"
        className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
      >
        {NAV_DOCK.map((entry) => {
          if (entry.kind === "link") {
            if (!isAllowed(entry.access, role)) {
              return <LockedIconButton key={entry.id} entry={entry} />;
            }
            return <LinkIconButton key={entry.id} entry={entry} />;
          }
          return (
            <MenuIconButton
              key={entry.id}
              entry={entry}
              open={openId === entry.id}
              onOpenChange={(open) => setOpenId(open ? entry.id : null)}
            />
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
