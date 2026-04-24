# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Cloud Gaming Platform

P2P cloud gaming where Windows hosts stream games to players via WebRTC. The web app is the host dashboard + player client; the API server handles signaling, sessions, the wallet, and the games catalog. Hosts run a native Windows agent (`artifacts/host-agent`).

### Games Library

- Public catalog at `/games` with capability filters: mods, multiplayer, host-spectates, has-quests, plus a "live now" toggle and free-text search. Detail page at `/games/:slug` lists currently-live hosts with join links.
- Catalog table: `lib/db/src/schema/games.ts`. 8 games are seeded on API server boot via `artifacts/api-server/src/lib/seedGames.ts` (idempotent by slug).
- API: `GET /api/games` and `GET /api/games/:slug` (see `lib/api-spec/openapi.yaml` and `artifacts/api-server/src/routes/games.ts`).
- v1 link between sessions and games is by case-insensitive title match on `sessions.appName` (no FK yet) — host agent still sends free-text app names. Adding `sessions.gameId` is a planned follow-up.
