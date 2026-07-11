// Server-only allowlist check. This is the security boundary — every server
// function that reads or writes contribution data MUST call assertAllowedEmail.
// The client-side email check on the login form is UX only, not security.

export function getAllowedEmail(): string {
  const v = process.env.ALLOWED_EMAIL;
  if (!v) throw new Error("ALLOWED_EMAIL is not configured");
  return v.trim().toLowerCase();
}

export function assertAllowedEmail(claims: { email?: string | null } | null | undefined): void {
  const email = (claims?.email ?? "").trim().toLowerCase();
  if (!email || email !== getAllowedEmail()) {
    throw new Error("Nicht freigeschaltet.");
  }
}
