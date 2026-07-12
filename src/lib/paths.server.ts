// Path validator — the security boundary for what the engine may edit in the
// One L1fe repo. Rules (carried verbatim from the buildkit spec):
//
//   1. An EXACT-literal allow entry is a deliberate carve-out and WINS over a
//      broad forbidden glob. (e.g. a single editable file inside an otherwise
//      forbidden tree.)
//   2. Otherwise, any forbidden glob match => rejected.
//   3. Otherwise, allowed only if some allow glob matches.
//
// Glob allows NEVER override forbids. Only exact-literal allows do.

export function isGlob(pattern: string): boolean {
  return pattern.includes("*");
}

// Minimal, dependency-free glob: supports ** (any depth incl. /) and * (any run
// of non-slash chars). Anchored to the full path.
export function globMatch(path: string, pattern: string): boolean {
  const p = normalize(path);
  const re = globToRegExp(pattern);
  return re.test(p);
}

function normalize(path: string): string {
  return path.replace(/^\/+/, "");
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** => any chars including path separators
        re += ".*";
        i++;
        // swallow a trailing slash right after ** so "a/**/b" and "a/**" behave
        if (glob[i + 1] === "/") i++;
      } else {
        // * => any run of non-slash chars
        re += "[^/]*";
      }
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

export function setPathRules(allowed: string[], forbidden: string[]) {
  return { allowed: allowed ?? [], forbidden: forbidden ?? [] };
}

export function isPathAllowed(
  path: string,
  rules: { allowed: string[]; forbidden: string[] },
): boolean {
  const p = normalize(path);
  const { allowed, forbidden } = rules;

  // 1. Exact-literal allow wins over everything.
  if (allowed.some((g) => !isGlob(g) && p === normalize(g))) return true;

  // 2. Any forbidden match => reject.
  if (forbidden.some((g) => globMatch(p, g))) return false;

  // 3. Allowed only if an allow entry matches.
  return allowed.some((g) => (isGlob(g) ? globMatch(p, g) : p === normalize(g)));
}
