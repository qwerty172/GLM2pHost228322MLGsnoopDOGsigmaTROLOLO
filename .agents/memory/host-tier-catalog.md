---
name: Host strength tier in the public catalog
description: How host "strength tier" gates and orders the public host catalog/search.
---

Hosts carry a general strength tier (`below_min` | `meets_min` | `above_rec`) computed from reported `pcSpecs` vs a site-wide baseline (see api-server `lib/hostTier.ts`).

Catalog rules (public `/hosts` and `/public/games/:slug/hosts`):
- `below_min` hosts are filtered OUT of the discoverable catalog/search entirely. They can still register and run — they just aren't listed. **Why:** product decision to reduce noise; underpowered boxes shouldn't surface to players.
- `above_rec` hosts always sort FIRST, ahead of any latency/price/status ordering, and get a highlighted row + "Рекомендуемый+" badge. Latency/price is only a secondary sort within a tier.

Null-specs guard (important): `generalHostTier(null)` returns `meets_min`, NOT `above_rec`.
**Why:** a host that never reported hardware must not be falsely promoted to top tier, but also must not be punished/hidden (don't block on missing telemetry). Neutral middle tier keeps it listed but un-highlighted.
**How to apply:** any new tier-based UI/filter must treat unknown-spec hosts as neutral, and must not assume `above_rec` implies genuinely-measured strength.
