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

- Public catalog at `/games` with capability filters: mods, multiplayer, host-spectates, has-quests, plus a "live now" toggle, free-text search, and a host-capability tag filter (mirrored to `?tag=` query param). Detail page at `/games/:slug` lists currently-live hosts with join links; `?tag=` on the detail narrows live hosts to those whose capability tags contain the value (case-insensitive).
- Catalog table: `lib/db/src/schema/games.ts`. 1 demo game is seeded on API server boot via `artifacts/api-server/src/lib/seedGames.ts` (idempotent by slug).
- API: `GET /api/games` and `GET /api/games/:slug` (see `lib/api-spec/openapi.yaml` and `artifacts/api-server/src/routes/games.ts`).
- v1 link between sessions and games is by case-insensitive title match on `sessions.appName` (no FK yet) — host agent still sends free-text app names. Adding `sessions.gameId` is a planned follow-up.

### Host binding

- A host can bind either a native Windows `.exe` (`hostsTable.boundAppPath`) or a browser-game URL (`hostsTable.boundUrl`). When `boundUrl` is set, the agent opens it via Electron `shell.openExternal` instead of spawning a child process; `killApp` is a no-op for the URL case.
- Hosts can attach free-form **capability tags** (`hostsTable.tags` jsonb string array, ≤20 entries × ≤40 chars). Examples: "прокачанный аккаунт", "лицензия Adobe". Tags appear as badges on `/games/:slug` and as a server-side filter on `/games?tag=` (case-insensitive containment). The host PATCH endpoint normalizes tags (trim, dedupe, length cap) and validates `boundUrl` (http(s) only, ≤2048 chars).

### Host agent download

- The Electron host agent (`artifacts/host-agent`) is exposed to hosts as a portable ZIP via `GET /api/downloads/host-agent.zip` (`artifacts/api-server/src/routes/downloads.ts`). The endpoint streams the agent's `dist/`, `src/`, build configs, plus a generated `start.bat` and `INSTALL.txt`. Hosts extract, run `start.bat`, and the agent installs deps and launches.
- A signed Windows installer (`.exe` via electron-builder NSIS) requires Windows or Wine and isn't built in this Linux env — that build is best run from CI.
- The Host Dashboard exposes the download via a "Download Host Agent" button + an instructions card.
