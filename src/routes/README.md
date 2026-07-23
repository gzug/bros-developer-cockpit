# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx`: those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dynamic, bare `$`, no curly braces) |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment) |
| `files/$.tsx` | `/files/*` (splat, read via `_splat` param, never `*`) |
| `_layout.tsx` | layout route (renders children via `<Outlet />`) |
| `__root.tsx` | app shell, wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## Maintained route / role / access matrix

All rows below are behind the `/_authenticated` session guard. Owner-only rows (except `/runs`)
also have a server-side `requireOwner()` check and redirect non-owners to `/dashboard`; hidden or
locked header labels are only a UX aid.

Two columns below describe two different things. **Server access** = whether the route's
`requireAuth()`/`requireOwner()` lets the role in (reachable by URL). **Brother nav** = whether the
brother sees the route surfaced in the `/home` nav (`src/lib/nav-model.ts` access). Since the Co-Dev
consolidation, the brother's surfaced nav is a single `/co-dev` leaf; the older idea/plan/done
screens keep brother-level server access (reachable by URL, unchanged) but are surfaced only in the
owner's nav.

| URL | Header label | Brother server access | Brother nav | Owner | Server authority |
| --- | --- | --- | --- | --- | --- |
| `/co-dev` | Co-Dev | yes | yes | yes | `requireAuth()` on chat/tracker fns |
| `/home` | Home | yes | yes | yes | `requireAuth()` via layout guard |
| `/dashboard` | Browse ideas | yes | no (owner-surfaced) | yes | `requireAuth()` |
| `/chat` | Submit a new idea | yes | no (owner-surfaced) | yes | `requireAuth()` on refine/submit |
| `/pipeline` | View plan | yes | no (owner-surfaced) | yes | `requireAuth()` |
| `/done` | Done | yes | no (owner-surfaced) | yes | `requireAuth()` |
| `/runs` | Prep log | read-only | no (owner-surfaced) | yes | `requireAuth()` read / `requireOwner()` mutations |
| `/dc` | Control | no | no | yes | route guard + `requireOwner()` |
| `/skills` | Skills | no | no | yes | route guard + `requireOwner()` |
| `/prompts` | Instructions | no | no | yes | route guard + `requireOwner()` |
| `/owner-kpi` | Status | no | no | yes | route guard + `requireOwner()` |

`/co-dev` is the brother's consolidated home (chat that turns a wish into confirmable task cards +
a live tracker of his ideas). It replaces the scattered `/chat`, `/dashboard`, `/pipeline`, `/runs`,
and `/done` entries in the brother's nav, but none of those route files were removed and their
server-side access is unchanged. `/submit` remains a direct route used by the shared idea form.
`/auth` is public and accepts one four-digit PIN field; the server resolves the role, and the
index route lands the brother on `/co-dev` and the owner on `/home`. Keep this matrix aligned with
`src/lib/nav-model.ts` (the section list rendered on `/home`) and each route's `beforeLoad`.
