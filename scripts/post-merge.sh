#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Bring the schema forward to the dual LZT bucket model *before* drizzle push,
# so push sees the post-migration shape and stays a no-op (otherwise it would
# want to drop the legacy `credit_balance` columns and lose data).
node scripts/migrate-lzt.mjs
pnpm --filter @workspace/db push
