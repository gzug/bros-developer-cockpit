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
  submitted: "Collected",
  requested: "Waiting on owner",
  processing: "Checking",
  sent: "Ready",
  approved: "Checked",
  shipped: "Published",
  live: "Live confirmed",
  blocked: "Paused",
  closed: "Done",
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
    title: "Ready",
    detail: "A prepared state is waiting for Don. Owner approval is still required.",
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
      return "Collected. Nothing has been published yet. Don can start the next step.";
    case "requested":
      return "Waiting on owner. Don has to deliberately start the check and preparation.";
    case "processing":
      return "Checking. This is preparation only; nothing has been published.";
    case "sent":
      return "Ready. Don has to check the prepared state and approve it or request changes before publication.";
    case "approved":
      return "Checked. Final owner control still stands before anything is published.";
    case "shipped":
      return "Published. Fully close One L1fe, open it twice, and check the change on the phone.";
    case "live":
      return "Live confirmed. Nothing else is needed here unless a new idea appears.";
    case "blocked":
      return "Paused. Don has to inspect the blocker and decide the next safe step.";
    case "closed":
      return "Done. The entry stays visible as history.";
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
