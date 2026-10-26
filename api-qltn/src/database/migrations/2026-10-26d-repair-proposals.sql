-- Proposals and their approval chain (SPEC B03–B09 v2, slice S2). A submission is immutable (BR-S2-02):
-- it keeps the whole proposal, quotation table, totals and files of that attempt. Decisions and signatures
-- are append-only. Money columns are integer VND (bigint), never floating point.
-- Idempotent; never edit after it has been applied. Names are also declared on the entities in
-- src/modules/records/entities/.

ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS proposal_draft jsonb;
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS current_approval_step_key varchar(60);
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS current_submission_id uuid;
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS approved_submission_id uuid;
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS approved_amount_vnd bigint;
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS executing_contractor_name varchar(200);

CREATE TABLE IF NOT EXISTS repair_proposal_submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id            uuid        NOT NULL,
  attempt_no           integer     NOT NULL,
  -- Proposal fields, quotation table, contractor totals and the proposed contractor (§4.1, §4.2).
  content              jsonb       NOT NULL,
  proposed_amount_vnd  bigint      NOT NULL,
  -- Files frozen with this attempt (quotations, incident minutes).
  attachment_ids       uuid[]      NOT NULL DEFAULT '{}',
  submitted_by         uuid        NOT NULL,
  submitted_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_proposal_submissions_attempt"
  ON repair_proposal_submissions (record_id, attempt_no);

CREATE TABLE IF NOT EXISTS repair_proposal_decisions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id              uuid          NOT NULL,
  record_id                  uuid          NOT NULL,
  step_key                   varchar(60)   NOT NULL,
  actor_id                   uuid          NOT NULL,
  outcome                    varchar(20)   NOT NULL,
  reason                     varchar(1000),
  -- Last step only: the contractor chosen when it differs from the proposed one (BR-S2-06).
  selected_contractor_index  integer,
  -- Board meeting minutes attached to a BQT decision (BR-S2-05).
  attachment_ids             uuid[]        NOT NULL DEFAULT '{}',
  created_at                 timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_repair_proposal_decisions_submission"
  ON repair_proposal_decisions (submission_id, created_at);

CREATE TABLE IF NOT EXISTS repair_signatures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id      uuid        NOT NULL,
  -- PROPOSAL (submission id) or BOARD_DECISION (decision id); S3/S4 add their own kinds.
  document_type  varchar(30) NOT NULL,
  document_id    uuid        NOT NULL,
  signer_id      uuid        NOT NULL,
  mime_type      varchar(20) NOT NULL,
  content        bytea       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_repair_signatures_document" ON repair_signatures (document_type, document_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_proposal_decisions_outcome') THEN
    ALTER TABLE repair_proposal_decisions ADD CONSTRAINT "CHK_repair_proposal_decisions_outcome"
      CHECK (outcome IN ('APPROVED', 'NEEDS_UPDATE', 'REJECTED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_signatures_document_type') THEN
    ALTER TABLE repair_signatures ADD CONSTRAINT "CHK_repair_signatures_document_type"
      CHECK (document_type IN ('PROPOSAL', 'BOARD_DECISION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_proposal_submissions_record') THEN
    ALTER TABLE repair_proposal_submissions ADD CONSTRAINT "FK_repair_proposal_submissions_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_proposal_submissions_submitter') THEN
    ALTER TABLE repair_proposal_submissions ADD CONSTRAINT "FK_repair_proposal_submissions_submitter"
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_proposal_decisions_submission') THEN
    ALTER TABLE repair_proposal_decisions ADD CONSTRAINT "FK_repair_proposal_decisions_submission"
      FOREIGN KEY (submission_id) REFERENCES repair_proposal_submissions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_proposal_decisions_actor') THEN
    ALTER TABLE repair_proposal_decisions ADD CONSTRAINT "FK_repair_proposal_decisions_actor"
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_signatures_record') THEN
    ALTER TABLE repair_signatures ADD CONSTRAINT "FK_repair_signatures_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_signatures_signer') THEN
    ALTER TABLE repair_signatures ADD CONSTRAINT "FK_repair_signatures_signer"
      FOREIGN KEY (signer_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
