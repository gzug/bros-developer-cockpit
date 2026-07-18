export function safeNext(candidate: string): string {
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return "";
  }

  try {
    const base = new URL("https://bdc.invalid/");
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin) return "";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "";
  }
}
