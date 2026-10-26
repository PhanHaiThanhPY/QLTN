-- Repair confirmations (B03-B09 SPEC, slice S1): the technical confirmer's conclusion on a
-- record waiting for confirmation. One row per decision; rows are never updated, so a record
-- sent back for supplements keeps every earlier conclusion.
-- Idempotent; never edit after it has been applied. Names are also declared on
-- src/modules/records/entities/repair-confirmation.entity.ts.

CREATE TABLE IF NOT EXISTS repair_confirmations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid          NOT NULL,
  actor_id    uuid          NOT NULL,
  outcome     varchar(20)   NOT NULL,
  note        varchar(1000) NOT NULL,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_repair_confirmations_record" ON repair_confirmations (record_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_confirmations_outcome') THEN
    ALTER TABLE repair_confirmations ADD CONSTRAINT "CHK_repair_confirmations_outcome"
      CHECK (outcome IN ('CONFIRMED', 'NEEDS_UPDATE', 'NO_REPAIR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_confirmations_record') THEN
    ALTER TABLE repair_confirmations ADD CONSTRAINT "FK_repair_confirmations_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_confirmations_actor') THEN
    ALTER TABLE repair_confirmations ADD CONSTRAINT "FK_repair_confirmations_actor"
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
