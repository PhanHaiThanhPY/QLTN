-- Fund report and contract termination (SPEC F-S5 §2): terminations with handovers, deposit offsets (two internal
-- ledger lines), write-offs approved by BQT, deposit refunds as payment vouchers, the closing of a contract and its
-- package, and the daily "expired, not terminated" flag.
-- Idempotent; never edit after it has been applied. Names are also declared on the entities of
-- src/modules/exploitation/entities/ and src/modules/fund/entities/.

-- BR-F5-06, BR-F5-13: "Đang thanh lý" (TERMINATING) and "Đã thanh lý" (TERMINATED).
ALTER TABLE exploitation_contracts DROP CONSTRAINT IF EXISTS "CHK_exploitation_contracts_status";
ALTER TABLE exploitation_contracts ADD CONSTRAINT "CHK_exploitation_contracts_status"
  CHECK (status IN ('DRAFT', 'SIGNED', 'ACTIVE', 'TERMINATING', 'TERMINATED', 'CANCELLED'));
-- BR-F5-14: set by the daily run on an active contract past its end date; the status never changes by itself.
ALTER TABLE exploitation_contracts ADD COLUMN IF NOT EXISTS expired_unterminated boolean NOT NULL DEFAULT false;

-- BR-F5-13: the package of a closed contract is "Đã đóng" (FINISHED).
ALTER TABLE exploitation_packages DROP CONSTRAINT IF EXISTS "CHK_exploitation_packages_status";
ALTER TABLE exploitation_packages ADD CONSTRAINT "CHK_exploitation_packages_status"
  CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'SELECTED', 'NO_RESULT', 'FINISHED', 'CANCELLED'));

-- BR-F5-07, BR-F5-11: periods cancelled by an early termination, and the part written off (approved by BQT).
ALTER TABLE exploitation_receivables ALTER COLUMN status TYPE varchar(20);
ALTER TABLE exploitation_receivables ADD COLUMN IF NOT EXISTS written_off_vnd bigint NOT NULL DEFAULT 0;
ALTER TABLE exploitation_receivables DROP CONSTRAINT IF EXISTS "CHK_exploitation_receivables_paid";
ALTER TABLE exploitation_receivables ADD CONSTRAINT "CHK_exploitation_receivables_paid"
  CHECK (paid_vnd >= 0 AND written_off_vnd >= 0 AND paid_vnd + written_off_vnd <= amount_vnd);
ALTER TABLE exploitation_receivables DROP CONSTRAINT IF EXISTS "CHK_exploitation_receivables_status";
ALTER TABLE exploitation_receivables ADD CONSTRAINT "CHK_exploitation_receivables_status"
  CHECK (status IN ('NOT_DUE', 'PARTIAL', 'DUE', 'OVERDUE', 'PAID', 'WRITTEN_OFF', 'TERMINATED'));

-- BR-F5-10: deposit offsets are two internal lines (deposit out, contract receipt in) — no money moves.
ALTER TABLE fund_ledger_entries ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;
ALTER TABLE fund_ledger_entries DROP CONSTRAINT IF EXISTS "CHK_fund_ledger_entries_category";
ALTER TABLE fund_ledger_entries ADD CONSTRAINT "CHK_fund_ledger_entries_category"
  CHECK (category IN ('CONTRACT_RECEIPT', 'DEPOSIT', 'TAX', 'SERVICE', 'TRANSFER', 'OTHER', 'BANK_FEE', 'INTEREST', 'DEPOSIT_REFUND'));

-- BR-F5-12: a deposit refund is a payment voucher of its own category, naming its contract.
ALTER TABLE fund_vouchers ALTER COLUMN category TYPE varchar(20);
ALTER TABLE fund_vouchers ADD COLUMN IF NOT EXISTS contract_id uuid;
ALTER TABLE fund_vouchers DROP CONSTRAINT IF EXISTS "CHK_fund_vouchers_category";
ALTER TABLE fund_vouchers ADD CONSTRAINT "CHK_fund_vouchers_category"
  CHECK (category IN ('SERVICE', 'TRANSFER', 'OTHER', 'DEPOSIT_REFUND'));
ALTER TABLE fund_vouchers DROP CONSTRAINT IF EXISTS "CHK_fund_vouchers_refund";
ALTER TABLE fund_vouchers ADD CONSTRAINT "CHK_fund_vouchers_refund" CHECK ((category = 'DEPOSIT_REFUND') = (contract_id IS NOT NULL));

-- BR-F5-06: one termination file (TL-NNN) per contract.
CREATE TABLE IF NOT EXISTS exploitation_terminations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   varchar(20)   NOT NULL,
  contract_id            uuid          NOT NULL,
  building_id            uuid          NOT NULL,
  -- EXPIRED ("Hết hạn"), EARLY_AGREED ("Chấm dứt sớm theo thỏa thuận"), EARLY_BREACH ("Chấm dứt do vi phạm").
  reason                 varchar(15)   NOT NULL,
  note                   text          NOT NULL,
  termination_date       date          NOT NULL,
  -- OPEN, CANCELLED (back to "Hiệu lực"), CLOSED ("Đã thanh lý").
  status                 varchar(10)   NOT NULL DEFAULT 'OPEN',
  minutes_attachment_id  uuid,
  minutes_signed_on      date,
  -- BR-F5-08: earlier minutes stay as history: [{ attachmentId, signedOn, replacedAt, replacedBy }].
  minutes_history        jsonb         NOT NULL DEFAULT '[]',
  cancel_reason          text,
  closed_at              timestamptz,
  closed_by              uuid,
  created_by             uuid          NOT NULL,
  version                integer       NOT NULL DEFAULT 1,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_exploitation_terminations_reason" CHECK (reason IN ('EXPIRED', 'EARLY_AGREED', 'EARLY_BREACH')),
  CONSTRAINT "CHK_exploitation_terminations_status" CHECK (status IN ('OPEN', 'CANCELLED', 'CLOSED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_exploitation_terminations_code" ON exploitation_terminations (code);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_exploitation_terminations_live" ON exploitation_terminations (contract_id) WHERE status <> 'CANCELLED';

-- BR-F5-08: each handover of the area (BG-NNN); the latest one counts.
CREATE TABLE IF NOT EXISTS exploitation_handovers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(20)   NOT NULL,
  termination_id  uuid          NOT NULL,
  handed_on       date          NOT NULL,
  -- PASSED ("Đạt"), FAILED ("Không đạt").
  result          varchar(10)   NOT NULL,
  note            text,
  attachment_id   uuid          NOT NULL,
  created_by      uuid          NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_exploitation_handovers_result" CHECK (result IN ('PASSED', 'FAILED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_exploitation_handovers_code" ON exploitation_handovers (code);

-- BR-F5-10: a deposit offset (CT-NNN) allocated to the periods; two internal ledger lines.
CREATE TABLE IF NOT EXISTS exploitation_deposit_offsets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(20)   NOT NULL,
  termination_id  uuid          NOT NULL,
  contract_id     uuid          NOT NULL,
  building_id     uuid          NOT NULL,
  offset_on       date          NOT NULL,
  amount_vnd      bigint        NOT NULL,
  -- [{ receivableId, amountVnd }]
  allocations     jsonb         NOT NULL,
  note            text,
  out_entry_id    uuid          NOT NULL,
  in_entry_id     uuid          NOT NULL,
  status          varchar(10)   NOT NULL DEFAULT 'RECORDED',
  cancel_reason   text,
  cancelled_by    uuid,
  cancelled_at    timestamptz,
  created_by      uuid          NOT NULL,
  version         integer       NOT NULL DEFAULT 1,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_exploitation_deposit_offsets_amount" CHECK (amount_vnd > 0),
  CONSTRAINT "CHK_exploitation_deposit_offsets_status" CHECK (status IN ('RECORDED', 'CANCELLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_exploitation_deposit_offsets_code" ON exploitation_deposit_offsets (code);

-- BR-F5-11: a write-off proposal (KTD-NNN) for BQT; no ledger line ever.
CREATE TABLE IF NOT EXISTS exploitation_write_offs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             varchar(20)   NOT NULL,
  termination_id   uuid          NOT NULL,
  contract_id      uuid          NOT NULL,
  building_id      uuid          NOT NULL,
  amount_vnd       bigint        NOT NULL,
  allocations      jsonb         NOT NULL,
  reason           text          NOT NULL,
  attachment_id    uuid,
  -- PENDING, NEEDS_CHANGES, APPROVED, REJECTED.
  status           varchar(15)   NOT NULL DEFAULT 'PENDING',
  -- [{ decision, reason, by, at }]
  decisions        jsonb         NOT NULL DEFAULT '[]',
  approved_on      date,
  proposed_by      uuid          NOT NULL,
  version          integer       NOT NULL DEFAULT 1,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_exploitation_write_offs_amount" CHECK (amount_vnd > 0),
  CONSTRAINT "CHK_exploitation_write_offs_status" CHECK (status IN ('PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_exploitation_write_offs_code" ON exploitation_write_offs (code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_exploitation_terminations_contract') THEN
    ALTER TABLE exploitation_terminations ADD CONSTRAINT "FK_exploitation_terminations_contract"
      FOREIGN KEY (contract_id) REFERENCES exploitation_contracts(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_exploitation_handovers_termination') THEN
    ALTER TABLE exploitation_handovers ADD CONSTRAINT "FK_exploitation_handovers_termination"
      FOREIGN KEY (termination_id) REFERENCES exploitation_terminations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_exploitation_deposit_offsets_termination') THEN
    ALTER TABLE exploitation_deposit_offsets ADD CONSTRAINT "FK_exploitation_deposit_offsets_termination"
      FOREIGN KEY (termination_id) REFERENCES exploitation_terminations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_exploitation_write_offs_termination') THEN
    ALTER TABLE exploitation_write_offs ADD CONSTRAINT "FK_exploitation_write_offs_termination"
      FOREIGN KEY (termination_id) REFERENCES exploitation_terminations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fund_vouchers_contract') THEN
    ALTER TABLE fund_vouchers ADD CONSTRAINT "FK_fund_vouchers_contract"
      FOREIGN KEY (contract_id) REFERENCES exploitation_contracts(id) ON DELETE RESTRICT;
  END IF;
END $$;
