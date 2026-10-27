-- Running maintenance occurrences (SPEC MT-S3 §2): the work in progress on the occurrence, one immutable row per
-- submission with its review decision, reminders already sent, and the occurrence item a repair record comes from.
-- Idempotent; never edit after it has been applied. Names are also declared on the entities.

-- Work in progress (BR-MT3-03), saved many times before a submission:
-- { entries: [{ itemId, result, value, note, attachmentIds }], summary, actualWorker, attachmentIds }.
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS work jsonb NOT NULL
  DEFAULT '{"entries": [], "summary": null, "actualWorker": null, "attachmentIds": []}';
-- Number of the latest submission (0 before the first).
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 0;
-- Items the reviewer sent back on the latest rework: { itemId: reason } (BR-MT3-06).
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS rework jsonb NOT NULL DEFAULT '{}';
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
-- Submission time + the building's REVIEW_MAINTENANCE days (MD-01).
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS review_due_at timestamptz;
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE maintenance_occurrences ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE INDEX IF NOT EXISTS "IDX_maintenance_occurrences_performer" ON maintenance_occurrences (performer_user_id, status);
CREATE INDEX IF NOT EXISTS "IDX_maintenance_occurrences_reviewer" ON maintenance_occurrences (reviewer_user_id, status);

-- BR-MT3-05: a submission is never edited; its review decision is written once.
CREATE TABLE IF NOT EXISTS maintenance_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id   uuid          NOT NULL,
  round           integer       NOT NULL,
  entries         jsonb         NOT NULL,
  summary         text          NOT NULL,
  contractor_name varchar(200),
  actual_worker   varchar(120),
  attachment_ids  jsonb         NOT NULL DEFAULT '[]',
  submitted_by    uuid          NOT NULL,
  submitted_at    timestamptz   NOT NULL,
  review_due_at   timestamptz   NOT NULL,
  -- REWORK or CONFIRMED, once decided.
  decision        varchar(10),
  decision_reason text,
  -- { itemId: reason } of the items sent back.
  rework_items    jsonb         NOT NULL DEFAULT '{}',
  -- { itemId: "hướng xử lý" } written by the reviewer for failed items (BR-MT3-09 b).
  resolutions     jsonb         NOT NULL DEFAULT '{}',
  condition_after varchar(20),
  condition_note  text,
  decided_by      uuid,
  decided_at      timestamptz,
  CONSTRAINT "CHK_maintenance_submissions_decision" CHECK (decision IS NULL OR decision IN ('REWORK', 'CONFIRMED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_submissions_round" ON maintenance_submissions (occurrence_id, round);

-- BR-MT3-10 / D-MT3-7: each reminder kind once per occurrence.
CREATE TABLE IF NOT EXISTS maintenance_reminders (
  occurrence_id uuid         NOT NULL,
  -- DUE_TODAY, OVERDUE, REVIEW_OVERDUE.
  kind          varchar(20)  NOT NULL,
  sent_at       timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (occurrence_id, kind)
);

-- BR-MT3-08: a repair record made from one failed occurrence item.
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS source_occurrence_id uuid;
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS source_checklist_item_id varchar(40);
-- D-MT3-5: at most one record still in force per item; a withdrawn or no-repair record frees the item.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_records_source_item" ON repair_records (source_occurrence_id, source_checklist_item_id)
  WHERE source_occurrence_id IS NOT NULL AND status NOT IN ('CLOSED_WITHDRAWN', 'CLOSED_NO_REPAIR');
CREATE INDEX IF NOT EXISTS "IDX_repair_records_source_occurrence" ON repair_records (source_occurrence_id) WHERE source_occurrence_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_submissions_occurrence') THEN
    ALTER TABLE maintenance_submissions ADD CONSTRAINT "FK_maintenance_submissions_occurrence"
      FOREIGN KEY (occurrence_id) REFERENCES maintenance_occurrences(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_reminders_occurrence') THEN
    ALTER TABLE maintenance_reminders ADD CONSTRAINT "FK_maintenance_reminders_occurrence"
      FOREIGN KEY (occurrence_id) REFERENCES maintenance_occurrences(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_source_occurrence') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_source_occurrence"
      FOREIGN KEY (source_occurrence_id) REFERENCES maintenance_occurrences(id) ON DELETE RESTRICT;
  END IF;
END $$;
