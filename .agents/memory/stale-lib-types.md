---
name: Stale lib type declarations after task merges
description: Why phantom TS errors appear in api-server/web after merging task-agent work, and how to fix
---

**Rule:** When typecheck fails with "property X does not exist" for fields that ARE present in `lib/db/src/schema/*.ts`, the cause is stale composite-build declarations in `lib/db/dist/*.d.ts` — not the source. Fix with `npx tsc -b lib/db` (or `pnpm -w run typecheck:libs`).

**Why:** Task-agent merges bring schema/route changes but the merged environment keeps old `dist/` declarations + `tsconfig.tsbuildinfo`; TS project references resolve types from dist, so routes see the old shape (seen with `isGuest`, `pingMs`, `minUploadMbps`).

**How to apply:** After any merge or when reviewing "type-broken" reports: rebuild libs first before touching route code. If web pages reference fields missing from the generated API client, the field is missing from `lib/api-spec/openapi.yaml` — add it there and run `pnpm --filter @workspace/api-spec run codegen` (never edit generated client files directly).
