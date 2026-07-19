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

| URL | Header label | Brother | Owner | Server authority |
| --- | --- | --- | --- | --- |
| `/home` | Home | yes | yes | `requireAuth()` via layout guard |
| `/dashboard` | Ideas | yes | yes | `requireAuth()` |
| `/chat` | New idea | yes | yes | `requireAuth()` on refine/submit |
| `/pipeline` | Plan | yes | yes | `requireAuth()` |
| `/done` | Done | yes | yes | `requireAuth()` |
| `/runs` | Prep log | read-only | yes | `requireAuth()` read / `requireOwner()` mutations |
| `/dc` | Control | no | yes | route guard + `requireOwner()` |
| `/skills` | Skills | no | yes | route guard + `requireOwner()` |
| `/prompts` | Instructions | no | yes | route guard + `requireOwner()` |
| `/owner-kpi` | Status | no | yes | route guard + `requireOwner()` |

`/submit` remains a direct route used by the shared idea form, but the primary brother-facing
entry is `/chat` (`New idea`). `/auth` is public and accepts one four-digit PIN field; the server
resolves the role. Keep this matrix aligned with `src/lib/nav-model.ts` + `HomeDock` and each
route's `beforeLoad`.
