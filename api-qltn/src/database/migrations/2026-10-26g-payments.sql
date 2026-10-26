-- Payments in instalments (SPEC B03–B09 v2 slice S4, D5-TDN): advances (TAM_UNG) and the settlement (QUYET_TOAN).
-- One row per instalment; each submission bumps its revision and snapshots the PAYMENT chain. Decisions are
-- append-only; a transfer is confirmed once (BR-S4-06). Money columns are integer VND (bigint).
-- Idempotent; never edit after it has been applied. Names are also declared on the entities.

-- Settlement work in progress (T17).
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS payment_draft jsonb;

CREATE TABLE IF NOT EXISTS repair_payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id               uuid          NOT NULL,
  kind                    varchar(20)   NOT NULL,
  seq_no                  integer       NOT NULL,
  status                  varchar(30)   NOT NULL,
  revision_no             integer       NOT NULL DEFAULT 1,
  -- Settlement only: the settled total; the instalment pays it minus the transferred advances (BR-S4-02).
  settlement_amount_vnd   bigint,
  amount_vnd              bigint        NOT NULL,
  payee_name              varchar(200)  NOT NULL,
  account_no              varchar(20)   NOT NULL,
  bank_name               varchar(200)  NOT NULL,
  transfer_content        varchar(210)  NOT NULL,
  request_attachment_ids  uuid[]        NOT NULL DEFAULT '{}',
  invoice_attachment_ids  uuid[]        NOT NULL DEFAULT '{}',
  chain_step_keys         text[]        NOT NULL,
  current_step_key        varchar(60),
  submitted_by            uuid          NOT NULL,
  submitted_at            timestamptz   NOT NULL,
  transfer_date           date,
  transfer_reference      varchar(100),
  proof_attachment_ids    uuid[]        NOT NULL DEFAULT '{}',
  confirmed_by            uuid,
  confirmed_at            timestamptz,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_payments_seq" ON repair_payments (record_id, seq_no);

CREATE TABLE IF NOT EXISTS repair_payment_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid          NOT NULL,
  record_id    uuid          NOT NULL,
  revision_no  integer       NOT NULL,
  step_key     varchar(60)   NOT NULL,
  actor_id     uuid          NOT NULL,
  outcome      varchar(20)   NOT NULL,
  reason       varchar(1000),
  created_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_repair_payment_decisions_payment" ON repair_payment_decisions (payment_id, created_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_signatures_document_type'
             AND pg_get_constraintdef(oid) NOT LIKE '%PAYMENT_REQUEST%') THEN
    ALTER TABLE repair_signatures DROP CONSTRAINT "CHK_repair_signatures_document_type";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_signatures_document_type') THEN
    ALTER TABLE repair_signatures ADD CONSTRAINT "CHK_repair_signatures_document_type"
      CHECK (document_type IN ('PROPOSAL', 'BOARD_DECISION', 'ACCEPTANCE_DECISION', 'PAYMENT_REQUEST'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_payments_kind') THEN
    ALTER TABLE repair_payments ADD CONSTRAINT "CHK_repair_payments_kind" CHECK (kind IN ('TAM_UNG', 'QUYET_TOAN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_payments_status') THEN
    ALTER TABLE repair_payments ADD CONSTRAINT "CHK_repair_payments_status"
      CHECK (status IN ('PENDING_APPROVAL', 'NEEDS_UPDATE', 'PENDING_TRANSFER', 'TRANSFERRED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_payments_amount') THEN
    ALTER TABLE repair_payments ADD CONSTRAINT "CHK_repair_payments_amount" CHECK (amount_vnd > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_payment_decisions_outcome') THEN
    ALTER TABLE repair_payment_decisions ADD CONSTRAINT "CHK_repair_payment_decisions_outcome"
      CHECK (outcome IN ('APPROVED', 'NEEDS_UPDATE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_payments_record') THEN
    ALTER TABLE repair_payments ADD CONSTRAINT "FK_repair_payments_record"
      FOREIGN KEY (record_id) REFERENCES repair_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_payments_confirmed_by') THEN
    ALTER TABLE repair_payments ADD CONSTRAINT "FK_repair_payments_confirmed_by"
      FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_payment_decisions_payment') THEN
    ALTER TABLE repair_payment_decisions ADD CONSTRAINT "FK_repair_payment_decisions_payment"
      FOREIGN KEY (payment_id) REFERENCES repair_payments(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_payment_decisions_actor') THEN
    ALTER TABLE repair_payment_decisions ADD CONSTRAINT "FK_repair_payment_decisions_actor"
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
