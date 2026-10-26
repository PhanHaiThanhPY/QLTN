-- Construction, acceptance minutes and plan notifications (SPEC B03–B09 v2, slice S3; BR-S3-01a).
-- An acceptance round is one set of minutes (D5-NT): its members are the ACCEPTANCE steps of the record snapshot,
-- they decide in parallel, one decision per step, each signed. Rounds and decisions are append-only.
-- Idempotent; never edit after it has been applied. Names are also declared on the entities.

ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS current_acceptance_id uuid;
-- Work in progress of T15 (note, attachment ids) reused by T16.
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS repair_draft jsonb;

CREATE TABLE IF NOT EXISTS repair_constructions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id         uuid          NOT NULL,
  start_date        date          NOT NULL,
  planned_end_date  date          NOT NULL,
  plan_note         varchar(1000) NOT NULL,
  progress_percent  integer       NOT NULL DEFAULT 0,
  completed_date    date,
  started_by        uuid          NOT NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_constructions_record" ON repair_constructions (record_id);

CREATE TABLE IF NOT EXISTS repair_construction_updates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id         uuid          NOT NULL,
  progress_percent  integer       NOT NULL,
  note              varchar(1000) NOT NULL,
  attachment_ids    uuid[]        NOT NULL DEFAULT '{}',
  actor_id          uuid          NOT NULL,
  created_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_repair_construction_updates_record" ON repair_construction_updates (record_id, created_at);

CREATE TABLE IF NOT EXISTS repair_acceptances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id             uuid          NOT NULL,
  round_no              integer       NOT NULL,
  completed_date        date          NOT NULL,
  inspected_at          timestamptz   NOT NULL,
  inspection_location   varchar(200)  NOT NULL,
  content               varchar(2000) NOT NULL,
  other_members         varchar(1000),
  photo_attachment_ids  uuid[]        NOT NULL DEFAULT '{}',
  -- Members: the ACCEPTANCE steps of the snapshot when the round was created.
  member_step_keys      text[]        NOT NULL,
  outcome               varchar(20)   NOT NULL DEFAULT 'PENDING',
  submitted_by          uuid          NOT NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  closed_at             timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_acceptances_round" ON repair_acceptances (record_id, round_no);

CREATE TABLE IF NOT EXISTS repair_acceptance_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id   uuid          NOT NULL,
  record_id       uuid          NOT NULL,
  step_key        varchar(60)   NOT NULL,
  actor_id        uuid          NOT NULL,
  outcome         varchar(20)   NOT NULL,
  note            varchar(1000),
  attachment_ids  uuid[]        NOT NULL DEFAULT '{}',
  created_at      timestamptz   NOT NULL DEFAULT now()
);
-- One decision per member step and round (`step_already_decided`).
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_acceptance_decisions_step" ON repair_acceptance_decisions (acceptance_id, step_key);

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid          NOT NULL,
  kind          varchar(40)   NOT NULL,
  title         varchar(200)  NOT NULL,
  body          varchar(2000) NOT NULL,
  subject_type  varchar(40)   NOT NULL,
  subject_id    uuid          NOT NULL,
  building_id   uuid,
  read_at       timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient" ON notifications (recipient_id, created_at DESC);

DO $$
BEGIN
  -- Signatures now also bind to acceptance decisions (BR-S3-03).
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_signatures_document_type'
             AND pg_get_constraintdef(oid) NOT LIKE '%ACCEPTANCE_DECISION%') THEN
    ALTER TABLE repair_signatures DROP CONSTRAINT "CHK_repair_signatures_document_type";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_signatures_document_type') THEN
    ALTER TABLE repair_signatures ADD CONSTRAINT "CHK_repair_signatures_document_type"
      CHECK (document_type IN ('PROPOSAL', 'BOARD_DECISION', 'ACCEPTANCE_DECISION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_constructions_progress') THEN
    ALTER TABLE repair_constructions ADD CONSTRAINT "CHK_repair_constructions_progress"
      CHECK (progress_percent BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_acceptances_outcome') THEN
    ALTER TABLE repair_acceptances ADD CONSTRAINT "CHK_repair_acceptances_outcome"
      CHECK (outcome IN ('PENDING', 'PASSED', 'FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_acceptance_decisions_outcome') THEN
    ALTER TABLE repair_acceptance_decisions ADD CONSTRAINT "CHK_repair_acceptance_decisions_outcome"
      CHECK (outcome IN ('PASSED', 'FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_constructions_record') THEN
    ALTER TABLE repair_constructions ADD CONSTRAINT "FK_repair_constructions_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_construction_updates_record') THEN
    ALTER TABLE repair_construction_updates ADD CONSTRAINT "FK_repair_construction_updates_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_acceptances_record') THEN
    ALTER TABLE repair_acceptances ADD CONSTRAINT "FK_repair_acceptances_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_acceptance_decisions_acceptance') THEN
    ALTER TABLE repair_acceptance_decisions ADD CONSTRAINT "FK_repair_acceptance_decisions_acceptance"
      FOREIGN KEY (acceptance_id) REFERENCES repair_acceptances(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_acceptance_decisions_actor') THEN
    ALTER TABLE repair_acceptance_decisions ADD CONSTRAINT "FK_repair_acceptance_decisions_actor"
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_notifications_recipient') THEN
    ALTER TABLE notifications ADD CONSTRAINT "FK_notifications_recipient"
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
