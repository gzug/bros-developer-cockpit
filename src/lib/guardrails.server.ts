// Server-side guardrails for contribution submissions.
// Every block converts to a saved idea, the user never leaves empty-handed.

export type GuardrailResult =
  | { ok: true }
  | { ok: false; kind: "destructive" | "scope" | "reask"; message: string };

// "destructive on my data", never let the app be described as deleting health data.
const DESTRUCTIVE_RE =
  /\b(delete|clear|reset|wipe|erase|purge|lösch|löscht|entfern|zurücksetz|reset)\w*\b[\s\S]{0,60}\b(daten|data|gesundheit|health|verlauf|history|eintr|entries|profil|profile|konto|account)\b/i;

// Out-of-scope: infra / auth / integrations, belongs to the brother, not the AI patch flow.
const SCOPE_RE =
  /\b(sync|synchron\w*|login|sign[-\s]?in|sign[-\s]?up|auth\w*|oauth|password|connect|verbind\w*|integrat\w*|api[-\s]?key|webhook|backend|infrastr\w*|hosting|deploy|server|database|datenbank|migration|firebase|supabase|node|domain|dns|apple[-\s]?id|google[-\s]?id)\b/i;

// Prompt-injection-ish patterns, re-ask as structured fields, never accuse.
const REASK_RE =
  /\b(ignore|forget|disregard|system prompt|jailbreak|as an? (ai|assistant|language model)|you are|act as|pretend|roleplay|vergiss|ignoriere|systemprompt|anweisung|assistent|du bist|tu so)\b/i;

function combined(input: {
  title?: string;
  screen?: string;
  wrong?: string;
  should?: string;
  body?: string;
}): string {
  return [input.title, input.screen, input.wrong, input.should, input.body]
    .filter(Boolean)
    .join("\n");
}

export function checkGuardrails(input: {
  title?: string;
  screen?: string;
  wrong?: string;
  should?: string;
  body?: string;
}): GuardrailResult {
  const text = combined(input);

  if (DESTRUCTIVE_RE.test(text)) {
    return {
      ok: false,
      kind: "destructive",
      message:
        "The app never deletes your health data. Did you mean hide or archive?",
    };
  }

  if (SCOPE_RE.test(text)) {
    return {
      ok: false,
      kind: "scope",
      message:
        "That sounds like something only your brother can handle directly.",
    };
  }

  if (REASK_RE.test(text)) {
    return {
      ok: false,
      kind: "reask",
      message:
        "Please phrase it in your own words without instructions to an AI.",
    };
  }

  return { ok: true };
}

// Escape any occurrence of a fence boundary token inside the user's raw note.
// Removal is idempotent: a single split/join can let nested payloads like
// "<<TA<<TASKS>>SKS>>" reconstruct the exact boundary once the inner copy is
// deleted, so we repeat until no boundary survives. (Empty boundary is a no-op —
// guarded to avoid an infinite loop, since "".includes("") is always true.)
export function sanitizeForFence(text: string, boundary: string): string {
  let withoutBoundary = text;
  if (boundary) {
    while (withoutBoundary.includes(boundary)) {
      withoutBoundary = withoutBoundary.split(boundary).join("");
    }
  }
  // Also strip triple backticks so users can't break the surrounding Markdown fence.
  return withoutBoundary.replace(/```+/g, "``");
}
