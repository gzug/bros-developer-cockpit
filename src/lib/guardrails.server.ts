// Server-side guardrails for contribution submissions.
// Every block converts to a saved idea — the user never leaves empty-handed.

export type GuardrailResult =
  | { ok: true }
  | { ok: false; kind: "destructive" | "scope" | "reask"; message: string };

// "destructive on my data" — never let the app be described as deleting health data.
const DESTRUCTIVE_RE =
  /\b(delete|clear|reset|wipe|erase|purge|lösch|löscht|entfern|zurücksetz|reset)\w*\b[\s\S]{0,60}\b(daten|data|gesundheit|health|verlauf|history|eintr|entries|profil|profile|konto|account)\b/i;

// Out-of-scope: infra / auth / integrations — belongs to the brother, not the AI patch flow.
const SCOPE_RE =
  /\b(sync|synchron\w*|login|sign[-\s]?in|sign[-\s]?up|auth\w*|oauth|password|connect|verbind\w*|integrat\w*|api[-\s]?key|webhook|backend|infrastr\w*|hosting|deploy|server|database|datenbank|migration|firebase|supabase|node|domain|dns|apple[-\s]?id|google[-\s]?id)\b/i;

// Prompt-injection-ish patterns — re-ask as structured fields, never accuse.
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
        "Die App löscht deine Gesundheitsdaten nie. Meintest du eher verstecken oder archivieren? Formulier es gerne noch mal um — oder wir speichern's so, wie du's geschrieben hast, als Idee für deinen Bruder.",
    };
  }

  if (SCOPE_RE.test(text)) {
    return {
      ok: false,
      kind: "scope",
      message:
        "Das klingt nach etwas, das nur dein Bruder direkt anfassen kann (Login, Verbindungen, Server). Ich hab's als Idee gespeichert — er kümmert sich darum.",
    };
  }

  if (REASK_RE.test(text)) {
    return {
      ok: false,
      kind: "reask",
      message:
        "Formulier's bitte in eigenen Worten und ohne Anweisungen an eine KI — beschreib einfach, was du siehst und was du dir wünschst. Ich hab die Version so als Idee gespeichert.",
    };
  }

  return { ok: true };
}

// Escape any occurrence of a fence boundary token inside the user's raw note.
export function sanitizeForFence(text: string, boundary: string): string {
  const withoutBoundary = text.split(boundary).join("");
  // Also strip triple backticks so users can't break the surrounding Markdown fence.
  return withoutBoundary.replace(/```+/g, "``");
}
