-- Bank statements of a fund's account and their reconciliation with the fund ledger (SPEC F-S4 §2). Kind-neutral:
-- keyed by the fund (one fund, one account: DF-26), so group T reuses it for the maintenance fund's account.
-- Idempotent; never edit after it has been applied. Names are also declared on the entities of src/modules/fund/.

-- BR-F4-08: lines recorded from the statement itself — bank fees (out) and demand-deposit interest (in).
ALTER TABLE fund_ledger_entries DROP CONSTRAINT IF EXISTS "CHK_fund_ledger_entries_category";
ALTER TABLE fund_ledger_entries ADD CONSTRAINT "CHK_fund_ledger_entries_category"
  CHECK (category IN ('CONTRACT_RECEIPT', 'DEPOSIT', 'TAX', 'SERVICE', 'TRANSFER', 'OTHER', 'BANK_FEE', 'INTEREST'));

-- BR-F4-01: one import of a statement (file or typed in), which must close: opening + Σ lines = closing.
CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id              uuid          NOT NULL,
  building_id          uuid          NOT NULL,
  period_from          date          NOT NULL,
  period_to            date          NOT NULL,
  opening_balance_vnd  bigint        NOT NULL,
  closing_balance_vnd  bigint        NOT NULL,
  -- FILE (the template, CSV or XLSX) or MANUAL.
  source               varchar(10)   NOT NULL,
  attachment_id        uuid,
  new_count            integer       NOT NULL,
  duplicate_count      integer       NOT NULL,
  -- BR-F4-04: an import with no matched line can be deleted (its lines go), with a reason; the row stays as history.
  deleted_at           timestamptz,
  deleted_by           uuid,
  delete_reason        text,
  created_by           uuid          NOT NULL,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_bank_statement_imports_period" CHECK (period_from <= period_to),
  CONSTRAINT "CHK_bank_statement_imports_source" CHECK (source IN ('FILE', 'MANUAL'))
);
CREATE INDEX IF NOT EXISTS "IDX_bank_statement_imports_fund" ON bank_statement_imports (fund_id, period_from);

-- BR-F4-04: one transaction of the bank (GD-NNN per account); never edited.
CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id           uuid          NOT NULL,
  fund_id             uuid          NOT NULL,
  building_id         uuid          NOT NULL,
  code                varchar(20)   NOT NULL,
  txn_date            date          NOT NULL,
  direction           varchar(3)    NOT NULL,
  amount_vnd          bigint        NOT NULL,
  description         text          NOT NULL,
  reference           varchar(100),
  -- BR-F4-03: date | signed amount | reference, or the normalised description when there is no reference.
  dedupe_key          text          NOT NULL,
  -- BR-F4-03: two lines of one file with the same key ("Có thể trùng").
  possible_duplicate  boolean       NOT NULL DEFAULT false,
  -- UNMATCHED, MATCHED, RECORDED ("Đã ghi nhận từ sao kê").
  status              varchar(10)   NOT NULL DEFAULT 'UNMATCHED',
  created_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_bank_statement_lines_direction" CHECK (direction IN ('IN', 'OUT')),
  CONSTRAINT "CHK_bank_statement_lines_amount" CHECK (amount_vnd > 0),
  CONSTRAINT "CHK_bank_statement_lines_status" CHECK (status IN ('UNMATCHED', 'MATCHED', 'RECORDED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bank_statement_lines_code" ON bank_statement_lines (fund_id, code);
CREATE INDEX IF NOT EXISTS "IDX_bank_statement_lines_fund_date" ON bank_statement_lines (fund_id, txn_date);
CREATE INDEX IF NOT EXISTS "IDX_bank_statement_lines_key" ON bank_statement_lines (fund_id, dedupe_key);

-- BR-F4-05, BR-F4-07: a statement line paired with one ledger line; unmatching keeps the row as history. The two
-- partial unique indexes make a line and a ledger line part of at most one live pair, whatever runs concurrently.
CREATE TABLE IF NOT EXISTS bank_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         uuid          NOT NULL,
  line_id         uuid          NOT NULL,
  entry_id        uuid          NOT NULL,
  -- MATCH (paired with an existing document) or RECORDED (the ledger line was created from the statement).
  kind            varchar(10)   NOT NULL,
  -- D-F4-3: why a pair more than 5 days apart belongs together.
  reason          text,
  matched_by      uuid          NOT NULL,
  matched_at      timestamptz   NOT NULL DEFAULT now(),
  unmatched_at    timestamptz,
  unmatched_by    uuid,
  unmatch_reason  text,
  CONSTRAINT "CHK_bank_matches_kind" CHECK (kind IN ('MATCH', 'RECORDED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bank_matches_line_live" ON bank_matches (line_id) WHERE unmatched_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bank_matches_entry_live" ON bank_matches (entry_id) WHERE unmatched_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bank_statement_imports_fund') THEN
    ALTER TABLE bank_statement_imports ADD CONSTRAINT "FK_bank_statement_imports_fund"
      FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bank_statement_lines_import') THEN
    ALTER TABLE bank_statement_lines ADD CONSTRAINT "FK_bank_statement_lines_import"
      FOREIGN KEY (import_id) REFERENCES bank_statement_imports(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bank_matches_line') THEN
    ALTER TABLE bank_matches ADD CONSTRAINT "FK_bank_matches_line"
      FOREIGN KEY (line_id) REFERENCES bank_statement_lines(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bank_matches_entry') THEN
    ALTER TABLE bank_matches ADD CONSTRAINT "FK_bank_matches_entry"
      FOREIGN KEY (entry_id) REFERENCES fund_ledger_entries(id) ON DELETE RESTRICT;
  END IF;
END $$;
