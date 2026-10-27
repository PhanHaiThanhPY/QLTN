-- Emergency repair (SPEC B06-S1 §3): the emergency data of a record, written by E-T1 and never cleared. Kept as one
-- jsonb document (money as integer VND strings) like the other per-stage drafts of repair_records. The two new
-- statuses POST_REVIEW_REJECTED and CLOSED_POST_REVIEW_REJECTED need no schema change (status is free text).
-- Idempotent; never edit after it has been applied.
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS emergency jsonb;
