export type IdeaStatus =
  | "submitted"
  | "requested"
  | "processing"
  | "sent"
  | "approved"
  | "shipped"
  | "live"
  | "blocked"
  | "closed";

export type IdeaTerminalOutcome = "open" | "completed" | "closed";

export type IdeaDisplayInput = {
  status: IdeaStatus;
  statusSummary?: string | null;
  doneCategory?: string | null;
};

export type IdeaStatusDisplay = {
  label: string;
  summary: string;
  nextStep: string;
  terminalOutcome: IdeaTerminalOutcome;
  badgeClass: string;
  dotClass: string;
};

type BaseStatusDisplay = Omit<IdeaStatusDisplay, "terminalOutcome">;

export const IDEA_STATUS_DISPLAY: Record<IdeaStatus, BaseStatusDisplay> = {
  submitted: {
    label: "Collected",
    summary: "Received. Nothing has been built or published.",
    nextStep: "Collected. Don can decide whether to prepare it.",
    badgeClass: "border-amber-500/30 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  requested: {
    label: "Waiting on owner",
    summary: "Shipping was requested. It is waiting for Don to start the checks.",
    nextStep: "Waiting on owner. Don has to deliberately start the check and preparation.",
    badgeClass: "border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
  },
  processing: {
    label: "Checking",
    summary: "The change is being prepared safely. It is not published.",
    nextStep: "Checking. This is preparation only; nothing has been published.",
    badgeClass: "border-blue-500/30 text-blue-700 dark:text-blue-300",
    dotClass: "bg-sky-500",
  },
  sent: {
    label: "Ready for owner",
    summary: "The prepared change is ready for Don to review.",
    nextStep: "Ready for owner. Don has to approve it or request changes before publication.",
    badgeClass: "border-sky-500/30 text-sky-700 dark:text-sky-300",
    dotClass: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    summary: "Don approved it. The owner-controlled path still decides what happens next.",
    nextStep:
      "Approved. Final owner-controlled shipping still has to finish before anything is live.",
    badgeClass: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-sky-500",
  },
  shipped: {
    label: "Published",
    summary: "Update published. Reopen One L1fe twice, check the change, then confirm it here.",
    nextStep: "Published. Fully close One L1fe, open it twice, and check the change on the phone.",
    badgeClass: "border-violet-500/30 text-violet-700 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  live: {
    label: "Live confirmed",
    summary: "The update was checked on the phone.",
    nextStep: "Live confirmed. Nothing else is needed here unless a new idea appears.",
    badgeClass: "border-emerald-700/30 text-emerald-800 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  blocked: {
    label: "Blocked",
    summary: "This needs Don's help before it can continue.",
    nextStep: "Blocked. Don has to inspect the blocker and decide the next safe step.",
    badgeClass: "border-rose-500/30 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
  closed: {
    label: "Closed",
    summary:
      "This idea was closed. Completed entries appear in Done; deleted entries stay as history.",
    nextStep: "Closed. This is history and does not move through the publishing path.",
    badgeClass: "border-zinc-500/30 text-zinc-700 dark:text-zinc-300",
    dotClass: "bg-zinc-500",
  },
};

export type IdeaTimelineVisualState = "complete" | "current" | "upcoming";

export type IdeaTimelineStep = {
  key:
    | "submitted"
    | "requested"
    | "processing"
    | "review"
    | "approved"
    | "shipped"
    | "live"
    | "blocked"
    | "closed";
  title: string;
  detail: string;
  state: IdeaTimelineVisualState;
};

const IDEA_TIMELINE_TEMPLATE: Array<Omit<IdeaTimelineStep, "state">> = [
  {
    key: "submitted",
    title: "Collected",
    detail: "Your idea arrived and stays visible.",
  },
  {
    key: "requested",
    title: "Waiting on owner",
    detail: "You asked for the next step. Don has to start it deliberately.",
  },
  {
    key: "processing",
    title: "Checking",
    detail: "The proposal is being prepared and checked. It is not published.",
  },
  {
    key: "review",
    title: "Ready for owner",
    detail: "A prepared state is waiting for Don. Owner approval is still required.",
  },
  {
    key: "approved",
    title: "Approved",
    detail: "Don approved it. The owner-controlled publishing path still has to finish.",
  },
  {
    key: "shipped",
    title: "Published",
    detail: "The owner-controlled path ran. The phone check is still required.",
  },
  {
    key: "live",
    title: "Live confirmed",
    detail: "Someone checked the change on the phone.",
  },
];

const IDEA_STATUS_PROGRESS: Record<IdeaStatus, number | null> = {
  submitted: 0,
  requested: 1,
  processing: 2,
  sent: 3,
  approved: 4,
  shipped: 5,
  live: 6,
  blocked: null,
  closed: null,
};

export function getIdeaDisplay(input: IdeaStatus | IdeaDisplayInput): IdeaStatusDisplay {
  const normalized = typeof input === "string" ? { status: input } : input;
  const base = IDEA_STATUS_DISPLAY[normalized.status];
  const terminalOutcome: IdeaTerminalOutcome =
    normalized.status === "closed" ? (normalized.doneCategory ? "completed" : "closed") : "open";

  if (terminalOutcome === "completed") {
    return {
      ...base,
      label: "Done",
      summary: normalized.statusSummary || "Completed and kept as Done history.",
      nextStep: "Done. This completed entry stays visible as history.",
      terminalOutcome,
    };
  }

  return {
    ...base,
    summary: normalized.statusSummary || base.summary,
    terminalOutcome,
  };
}

export function getIdeaStatusLabel(status: IdeaStatus, doneCategory?: string | null): string {
  return getIdeaDisplay({ status, doneCategory }).label;
}

export function getIdeaStatusDotClass(status: IdeaStatus): string {
  return getIdeaDisplay(status).dotClass;
}

export function getIdeaStatusBadgeClass(status: IdeaStatus): string {
  return getIdeaDisplay(status).badgeClass;
}

export function getIdeaStatusSummary(status: IdeaStatus, doneCategory?: string | null): string {
  return getIdeaDisplay({ status, doneCategory }).summary;
}

export function getIdeaNextStep(status: IdeaStatus, doneCategory?: string | null): string {
  return getIdeaDisplay({ status, doneCategory }).nextStep;
}

export function getIdeaTimeline(
  status: IdeaStatus,
  doneCategory?: string | null,
): IdeaTimelineStep[] {
  if (status === "blocked") {
    return [
      ...IDEA_TIMELINE_TEMPLATE.slice(0, 3).map((step) => ({
        ...step,
        state: "complete" as const,
      })),
      {
        key: "blocked",
        title: "Blocked",
        detail: "Don has to inspect the blocker before this can move forward.",
        state: "current" as const,
      },
    ];
  }

  if (status === "closed") {
    const display = getIdeaDisplay({ status, doneCategory });
    return [
      {
        key: "closed",
        title: display.label,
        detail:
          display.terminalOutcome === "completed"
            ? "This was completed and remains visible in Done history."
            : "This was closed without a Done category and remains visible as history.",
        state: "current",
      },
    ];
  }

  const currentIndex = IDEA_STATUS_PROGRESS[status];
  return IDEA_TIMELINE_TEMPLATE.map((step, index) => {
    let state: IdeaTimelineVisualState = "upcoming";
    if (currentIndex != null) {
      if (index < currentIndex) state = "complete";
      else if (index === currentIndex) state = "current";
    }
    if (status === "live" && index === IDEA_TIMELINE_TEMPLATE.length - 1) {
      state = "current";
    }
    return { ...step, state };
  });
}

export const IDEA_STATUS_REFERENCE_LINES = [
  "Collected = the idea arrived. Nothing has been built or published.",
  "Waiting on owner = the user asked Don to start the next step, but nothing was published.",
  "Checking = the cockpit is preparing or checking the change.",
  "Ready for owner = a prepared change waits for Don to approve it or request changes.",
  "Approved = Don approved it, but the owner-controlled shipping path still has to finish.",
  "Published = the update was published. To see it on the phone, fully close One L1fe and open it twice.",
  "Live confirmed = someone confirmed it is working on the phone.",
  "Blocked = something stopped this idea and Don has to inspect it.",
  "Done = a completed idea kept in Done history.",
  "Closed = an idea closed without a Done category; it is history, not a published change.",
] as const;
