---
name: X-User-Token header auth
description: How user/host/player tokens move from URLs to headers across API and clients
---
# X-User-Token header pattern

Rule: clients should never put wallet/host/player tokens in URL paths or query params. They send `X-User-Token` and use the literal `@me` path placeholder; the API substitutes the header token into the first `/@me` segment via app-level middleware before routing, so route handlers stay unchanged. Legacy token-in-URL still works for backward compat.

**Why:** tokens in URLs leak via browser history and server logs; `@me` was chosen (not `me`) because literal `/hosts/me/*` routes already exist and take tokens via query.

**How to apply:**
- New API routes must accept the header (helper in api-server `lib/requestToken.ts`) and may keep query/path variants only for compat.
- The generated web client rewrites token URLs automatically via `setUserTokensGetter` (registered in web `main.tsx`, tokens live in localStorage `streamline.hostToken` / `streamline.playerWalletToken`). Raw `fetch` calls must use `@me` + header manually.
- Admin routes additionally require `X-Admin-Secret` matching env `ADMIN_SECRET` (503 if env unset, 403 if wrong) on top of the isAdmin host check; the admin UI stores the secret in localStorage `streamline.adminSecret`.
- WebSocket signaling URLs still use query tokens intentionally (browsers can't set WS headers).
