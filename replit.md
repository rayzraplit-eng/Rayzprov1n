# RAYZPRO

A trading bot management platform for Deriv accounts — manage bots, track trades, and view live market data.

## Run & Operate

- `pnpm --filter @workspace/rayzpro run dev` — run the frontend (port 24881, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, wouter routing, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- WebSockets: connects live to Deriv's `wss://ws.binaryws.com` for market ticks

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (accounts, bots, trades)
- `artifacts/rayzpro/src/` — React frontend
- `artifacts/api-server/src/routes/` — Express route handlers

## Architecture decisions

- Dark terminal aesthetic: `JetBrains Mono` for code/numbers, `Inter` for prose, near-black background (`#09090B`), primary green (`#21C45D`)
- All API routes are prefixed `/api` (served by the api-server artifact)
- Frontend served at `/` (rayzpro artifact)
- Live Deriv tick data via WebSocket in `useDerivTicks` hook — no auth required (uses public app_id 1089)
- Bot `markets` field stored as JSON-serialized string array in Postgres

## Product

- **Dashboard**: live R_100 quote feed + stats (profit, win rate, trades, running bots)
- **Bots**: create/manage trading bots with start/stop controls
- **Accounts**: connect/disconnect Deriv accounts by login ID + token
- **Journal**: full trade log with filtering
- **Master Bot / Analysis / Trading**: scaffolded routes (placeholder pages, ready to build out)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `@import url(...)` for Google Fonts must come **first** in `index.css` before all other statements — PostCSS enforces this
- Bot `markets` array: the DB stores it as `text` (JSON string); the API layer must parse/serialize it
- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching backend routes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
