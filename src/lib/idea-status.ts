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
  submitted: "Gesammelt",
  requested: "Wartet auf Owner",
  processing: "Wird geprüft",
  sent: "Bereit zur Owner-Prüfung",
  approved: "Geprüft, wartet auf letzte Kontrolle",
  shipped: "Ausgespielt, wartet auf Handy-Check",
  live: "Live bestätigt",
  blocked: "Pausiert: braucht Owner",
  closed: "Erledigt",
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
    title: "Gesammelt",
    detail: "Deine Idee ist angekommen und bleibt sichtbar.",
  },
  {
    key: "requested",
    title: "Wartet auf Owner",
    detail: "Du hast den nächsten Schritt angefragt. Don muss bewusst starten.",
  },
  {
    key: "processing",
    title: "Wird geprüft",
    detail: "Der Vorschlag wird vorbereitet und kontrolliert.",
  },
  {
    key: "review",
    title: "Bereit zur Owner-Prüfung",
    detail: "Ein vorbereiteter Stand wartet auf Don oder auf Checks.",
  },
  {
    key: "shipped",
    title: "Ausgespielt",
    detail: "Der Stand wurde veröffentlicht und braucht danach den Handy-Check.",
  },
  {
    key: "live",
    title: "Live bestätigt",
    detail: "Jemand hat die Änderung auf dem Handy geprüft.",
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
      return "Gesammelt. Noch nichts wurde ausgespielt. Don kann den nächsten Schritt starten.";
    case "requested":
      return "Wartet auf Owner. Don muss die Prüfung und Vorbereitung bewusst starten.";
    case "processing":
      return "Wird geprüft. Warte, bis ein vorbereiteter Stand zur Owner-Prüfung bereitsteht.";
    case "sent":
      return "Bereit. Don muss den vorbereiteten Stand prüfen und freigeben oder Änderungen anfordern.";
    case "approved":
      return "Geprüft. Die letzte Kontrolle bleibt bei Don, bevor etwas ausgespielt wird.";
    case "shipped":
      return "Ausgespielt. One L1fe komplett schließen, zweimal öffnen und die Änderung auf dem Handy prüfen.";
    case "live":
      return "Live bestätigt. Hier ist nichts mehr zu tun, außer es entsteht eine neue Idee.";
    case "blocked":
      return "Pausiert. Don muss den Blocker ansehen und den nächsten sicheren Schritt entscheiden.";
    case "closed":
      return "Erledigt. Der Eintrag bleibt als Verlauf sichtbar.";
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
