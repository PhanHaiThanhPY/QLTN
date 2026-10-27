-- FX-S2 BR-FX2-05: a settlement instalment may be 0 đồng (the transferred advances already cover the settled total).
-- Advances stay > 0. Replaces the check added by 2026-10-26g (not edited). Idempotent; never edit after applied.
ALTER TABLE repair_payments DROP CONSTRAINT IF EXISTS "CHK_repair_payments_amount";
ALTER TABLE repair_payments ADD CONSTRAINT "CHK_repair_payments_amount"
  CHECK (amount_vnd > 0 OR (kind = 'QUYET_TOAN' AND amount_vnd = 0));
