-- Player gaming tier price multipliers on hosts (PLAN 2.5 / marathon W11-1).
ALTER TABLE hosts
  ADD COLUMN IF NOT EXISTS tier_bronze_multiplier_pct integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tier_silver_multiplier_pct integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tier_gold_multiplier_pct integer NOT NULL DEFAULT 100;
