-- Repair record list (Đợt 2 T4): server-side pagination, search and filters.
-- Idempotent; never edit after it has been applied. Index names are also declared
-- on src/modules/records/entities/repair-record.entity.ts.

CREATE INDEX IF NOT EXISTS "IDX_repair_records_scope_updated"
  ON repair_records (building_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS "IDX_repair_records_status"
  ON repair_records (status);
