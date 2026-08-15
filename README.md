# Mobula UI

Management console for [Mobula](../mobula), the Rust control plane for Ray
clusters — a self-hosted, FOSS replacement for the Anyscale console.

The authoritative product/UX spec is [`docs/ui-ux-spec.md`](docs/ui-ux-spec.md).

**Status: Milestone A (Foundation)** — app shell, design system, dev-mode auth,
health indicator, and read-only screens against the Phase-2 backend. Cluster
list and Registry render the typed table UI now and gracefully show
"not implemented yet" empty states until the Phase 3 management API
(spec §8) exists.

## API types are the source of truth

This app does **not** hand-write API shapes or point a codegen tool at a
running server. It depends on
[`@brandonrc/mobula-client`](../mobula/clients/typescript) — a TypeScript
client generated from mobula's committed `openapi.json` (CI drift-guards
that spec against the Rust code) and published to the GitHub Packages npm
registry on every mobula `v*` tag. `src/lib/api.ts` re-exports those types.

GitHub Packages npm requires a token even for public packages, so `.npmrc`
reads `NODE_AUTH_TOKEN`:

```sh
export NODE_AUTH_TOKEN=$(gh auth token)   # or a classic PAT w/ read:packages
npm install
```

CI supplies `secrets.GITHUB_TOKEN`. Types annotated "UI-ahead" in
`src/lib/api.ts` (identity, registry, the cluster list view model) are
screens built before the matching endpoint/shape exists in the backend;
each carries a migration note for when it lands.

## Stack

React 19 + TypeScript + Vite · TanStack Query (polling) · TanStack Table ·
react-router v7 · Tailwind CSS v4 + Radix primitives (hand-rolled shadcn-style
components in `src/components/ui`) · class-based dark mode.

## Prerequisites

- Node.js 20+
- The backend running locally: `mobula serve --dev-allow-unauthenticated`
  (serves `http://127.0.0.1:8484`; the Vite dev server proxies `/api`,
  `/healthz`, and `/docs` to it)

## Getting started

```sh
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command           | What it does                                                          |
| ----------------- | --------------------------------------------------------------------- |
| `npm run dev`     | Vite dev server with proxy to the control plane                        |
| `npm run build`   | Type-check (`tsc -b`) + production build to `dist/`                    |
| `npm test`        | Vitest unit tests                                                      |
| `npm run lint`    | ESLint (flat config)                                                   |
| `npm run gen:types` | Generate `src/lib/api-types.gen.ts` from the live OpenAPI doc (`/api/v1/openapi.json`); requires `mobula serve` running. Output is gitignored. |

## Auth (dev mode only, for now)

Web login (OIDC Authorization Code + PKCE) is not implemented backend-side
yet (spec §5.10). Until then a feature flag controls a dev-auth stub that
assumes a fake **Admin** identity:

- `VITE_MOBULA_DEV_AUTH=true|false` — defaults to **on** under `vite dev`,
  **off** in production builds.
- With the flag off and no PKCE, the shell renders an "auth not configured"
  identity chip.

## Project layout

```
src/
├── auth/auth-context.tsx      # Dev-mode auth stub (PKCE comes later)
├── components/
│   ├── ui/                    # Base components (button, card, badge, table, input, dialog)
│   ├── layout/                # App shell: sidebar, top bar, health indicator, identity chip
│   ├── cluster-state-badge.tsx# The one ClusterState badge — 9 variants (spec §6)
│   ├── data-table.tsx         # TanStack Table renderer
│   └── empty-state.tsx        # first-run / no-results / unreachable / denied variants
├── lib/
│   ├── api.ts                 # Typed fetch wrapper + MobulaApiError (status, required/granted role)
│   ├── cluster-state.ts       # ClusterState → presentation mapping (single source of truth)
│   ├── health.ts              # /healthz + /version → green/amber/red reducer
│   └── theme.tsx              # Class-based dark mode
└── routes/                    # One file per route in the IA (spec §4)
```

## Conventions worth knowing

- **State-machine fidelity**: the UI never invents cluster states. All badge
  rendering goes through `src/lib/cluster-state.ts`, which maps 1:1 to the
  backend's 9-state `ClusterState`.
- **Fail-closed errors**: API errors surface as `MobulaApiError` with
  `requiredRole`/`grantedRole` so 403s can render the denial (spec §1.4.6);
  404s from not-yet-implemented endpoints render a dedicated empty state.
- **Secrets are write-only**: the registry table shows "token set / not set",
  never a value or a reveal button.
- **No iframes anywhere** (D3/D6); the Swagger UI is linked, not embedded.
