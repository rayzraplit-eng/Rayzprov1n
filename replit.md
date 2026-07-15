# RAYZPRO — Deriv Companion

A Deriv trading companion. Connect a Deriv account via API token or OAuth, import & manage Deriv DBot XML strategies, run trading calculators (martingale / risk / compound), and journal trades. Real Deriv WebSocket auth on connect; Postgres for persistent storage.

## Run & Operate

- `pnpm --filter @workspace/tradehub run dev` — run the frontend (preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, prefix `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (managed by Replit), `VITE_DERIV_APP_ID`, `DERIV_APP_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, wouter routing, TanStack Query, PWA (vite-plugin-pwa)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild
- WebSockets: connects live to Deriv's `wss://ws.binaryws.com` for market ticks and OAuth auth

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (accounts, bots, trades)
- `artifacts/tradehub/src/` — React frontend
- `artifacts/api-server/src/routes/` — Express route handlers (accounts, bots, trades, dashboard, tools, oauth, health)

## Architecture decisions

- Dark terminal aesthetic with green/red accents; RAYZPRO logo in header
- App is a 5-tab horizontal-swipe layout (TabbedApp.tsx) — Dashboard, Master Bot, Analisis, Trading, Journal — NOT route-based
- Sub-pages (accounts, bots detail, tools) use SimpleShell in AppShell.tsx with their own routing
- Deriv OAuth opens in a new tab (`window.open _blank`), signals back via `localStorage` storage event + `postMessage`; `noopener` intentionally omitted so postMessage works
- WebSocket uses numeric `VITE_DERIV_WS_APP_ID` (falls back to 36544); OAuth uses alphanumeric `VITE_DERIV_APP_ID`
- Bot `xmlContent` stored as text in Postgres; bots table tracks strategy, market, tags, favorite, status
- Trades table: `tradedAt` is the sort column (not `createdAt`)
- Accounts table: `connectedAt` is the sort column; `isActive` flags the primary account

## Gotchas

- `@import url(...)` for Google Fonts must come **first** in `index.css` — PostCSS enforces this
- Port conflicts (EADDRINUSE) on workflow restart: run `fuser -k <port>/tcp` then restart — the workflow tool alone won't clear stale PIDs
- Cross-symbol stop conditions in bots (e.g. max-profit) must use a shared `ref`, not React state, to avoid render-lag entry bugs
- After any OpenAPI spec change: run codegen before touching backend routes or generated types

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
