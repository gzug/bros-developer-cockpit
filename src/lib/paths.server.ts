// Path validator, the security boundary for what the engine may edit in the
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
// of non-slash chars). Anchored to the full path. CASE-INSENSITIVE, the forbid
// rules must not be evadable by changing the case of a path segment.
export function globMatch(path: string, pattern: string): boolean {
  const p = normalize(path);
  const re = globToRegExp(pattern);
  return re.test(p);
}

function normalize(path: string): string {
  return path.replace(/^\/+/, "");
}

// A path with any "." / ".." / empty segment is a traversal attempt and is
// never valid, reject outright rather than trusting the glob rules to catch it.
function hasUnsafeSegment(p: string): boolean {
  return p.split("/").some((s) => s === "" || s === "." || s === "..");
}

function hasUnsafePresentationShape(p: string): boolean {
  const segments = p.toLowerCase().split("/");
  const basename = segments.at(-1) ?? "";
  if (
    segments.some(
      (segment) => segment.startsWith(".") || segment === "node_modules" || segment === "__tests__",
    )
  ) {
    return true;
  }
  if (!/\.(?:tsx?|css)$/.test(basename)) return true;
  return (
    /(?:^|\.)(?:test|spec|config)\./.test(basename) ||
    basename.endsWith(".d.ts") ||
    /^(?:babel|metro|webpack|vite|jest|eslint|prettier)(?:\.|$)/.test(basename)
  );
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
  // 'i' flag: forbid/allow globs match regardless of path-segment case.
  return new RegExp("^" + re + "$", "i");
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

  // 0. Traversal / malformed segments are never valid.
  if (!p || hasUnsafeSegment(p) || hasUnsafePresentationShape(p)) return false;

  const eq = (a: string, b: string) => a.toLowerCase() === normalize(b).toLowerCase();

  // 1. Exact-literal allow wins over everything.
  if (allowed.some((g) => !isGlob(g) && eq(p, g))) return true;

  // 2. Any forbidden match => reject.
  if (forbidden.some((g) => globMatch(p, g))) return false;

  // 3. Allowed only if an allow entry matches.
  return allowed.some((g) => (isGlob(g) ? globMatch(p, g) : eq(p, g)));
}
