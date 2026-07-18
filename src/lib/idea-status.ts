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

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  submitted: "Received",
  requested: "Shipping requested",
  processing: "Being prepared",
  sent: "Ready for Don to review",
  approved: "Approved, safety checks are running",
  shipped: "Update published, check your phone",
  live: "Checked on the phone",
  blocked: "Needs Don's help",
  closed: "Closed",
};

export const IDEA_STATUS_DOT_CLASS: Record<IdeaStatus, string> = {
  submitted: "bg-amber-500",
  requested: "bg-indigo-500",
  processing: "bg-sky-500",
  sent: "bg-amber-500",
  approved: "bg-sky-500",
  shipped: "bg-violet-500",
  live: "bg-emerald-500",
  blocked: "bg-rose-500",
  closed: "bg-zinc-500",
};

export type IdeaTimelineVisualState = "complete" | "current" | "upcoming";

export type IdeaTimelineStep = {
  key: "submitted" | "requested" | "processing" | "review" | "shipped" | "live";
  title: string;
  detail: string;
  state: IdeaTimelineVisualState;
};

const IDEA_TIMELINE_TEMPLATE: Array<Omit<IdeaTimelineStep, "state">> = [
  {
    key: "submitted",
    title: "Received",
    detail: "Your wish exists in the cockpit.",
  },
  {
    key: "requested",
    title: "Shipping requested",
    detail: "You asked Don to start the path.",
  },
  {
    key: "processing",
    title: "Being prepared",
    detail: "The change is being prepared safely.",
  },
  {
    key: "review",
    title: "Don review and checks",
    detail: "A held change exists or approval checks are running.",
  },
  {
    key: "shipped",
    title: "Published",
    detail: "The update was published for the phone app.",
  },
  {
    key: "live",
    title: "Checked on phone",
    detail: "Someone confirmed it on the phone.",
  },
];

const IDEA_STATUS_PROGRESS: Record<IdeaStatus, number | null> = {
  submitted: 0,
  requested: 1,
  processing: 2,
  sent: 3,
  approved: 3,
  shipped: 4,
  live: 5,
  blocked: null,
  closed: null,
};

export function getIdeaStatusLabel(status: IdeaStatus): string {
  return IDEA_STATUS_LABELS[status];
}

export function getIdeaStatusDotClass(status: IdeaStatus): string {
  return IDEA_STATUS_DOT_CLASS[status];
}

export function getIdeaNextStep(status: IdeaStatus): string {
  switch (status) {
    case "submitted":
      return "Nothing is published yet. Don can start whenever he is ready.";
    case "requested":
      return "Don still has to start the checks and preparation.";
    case "processing":
      return "Wait for the prepared change to appear for review.";
    case "sent":
      return "Don needs to review the held change and decide whether it should ship.";
    case "approved":
      return "The approval is in. Automatic checks and publication are the next step.";
    case "shipped":
      return "Close One L1fe fully, open it twice, then check the change on the phone.";
    case "live":
      return "No action is needed here unless a follow-up wish appears.";
    case "blocked":
      return "Don has to inspect the blocker and decide the next fix.";
    case "closed":
      return "This record is finished and stays here for history.";
  }
}

export function getIdeaTimeline(status: IdeaStatus): IdeaTimelineStep[] {
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
