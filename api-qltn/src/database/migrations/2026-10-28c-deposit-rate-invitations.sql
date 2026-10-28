-- T-S1 (SPEC docs/product/features/T-chao-lai-chon-ngan-hang/SPEC.md): the maintenance fund of every building, the
-- bank catalogue, rate invitations (MC-), the banks' offers and the selected bank (KQ-TG, BB-TG) approved by BQT.

-- BR-T1-02: every building has exactly one maintenance fund next to its exploitation fund (never summed, BR-F3-01).
INSERT INTO funds (building_id, kind) SELECT id, 'BAO_TRI' FROM buildings ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION funds_for_new_building() RETURNS trigger AS $$
BEGIN
  INSERT INTO funds (building_id, kind) VALUES (NEW.id, 'KHAI_THAC'), (NEW.id, 'BAO_TRI') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BR-T1-01: one catalogue for every building; a name and branch in use only once.
CREATE TABLE IF NOT EXISTS deposit_banks (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 varchar(20)   NOT NULL,
  name                 varchar(200)  NOT NULL,
  short_name           varchar(20),
  branch               varchar(200),
  contact_name         varchar(120),
  phone                varchar(20),
  email                varchar(200),
  active               boolean       NOT NULL DEFAULT true,
  deactivated_at       timestamptz,
  deactivation_reason  text,
  created_by           uuid          NOT NULL,
  version              integer       NOT NULL DEFAULT 1,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deposit_banks_code" ON deposit_banks (code);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deposit_banks_name_branch_active"
  ON deposit_banks (lower(name), lower(coalesce(branch, ''))) WHERE active;

-- BR-T1-03, BR-T1-04: a rate invitation on one maintenance fund; amount and term are fixed once sent.
CREATE TABLE IF NOT EXISTS deposit_invitations (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  varchar(20)   NOT NULL,
  fund_id               uuid          NOT NULL REFERENCES funds (id),
  building_id           uuid          NOT NULL,
  amount_vnd            bigint        NOT NULL,
  term_days             integer       NOT NULL,
  deadline_at           timestamptz,
  expected_deposit_on   date,
  conditions            text,
  letter_attachment_id  uuid,
  invitee_ids           jsonb         NOT NULL DEFAULT '[]',
  status                varchar(20)   NOT NULL DEFAULT 'DRAFT',
  sent_on               date,
  closed_at             timestamptz,
  close_kind            varchar(10),
  status_reason         text,
  created_by            uuid          NOT NULL,
  version               integer       NOT NULL DEFAULT 1,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_deposit_invitations_status"
    CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'SELECTED', 'NO_RESULT', 'CANCELLED')),
  CONSTRAINT "CHK_deposit_invitations_amount" CHECK (amount_vnd > 0),
  CONSTRAINT "CHK_deposit_invitations_term" CHECK (term_days BETWEEN 7 AND 3650),
  CONSTRAINT "CHK_deposit_invitations_close_kind" CHECK (close_kind IS NULL OR close_kind IN ('DEADLINE', 'EARLY'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deposit_invitations_code" ON deposit_invitations (code);
CREATE INDEX IF NOT EXISTS "IDX_deposit_invitations_building" ON deposit_invitations (building_id, status);
CREATE INDEX IF NOT EXISTS "IDX_deposit_invitations_open_deadline" ON deposit_invitations (deadline_at) WHERE status = 'OPEN';

-- BR-T1-06, BR-T1-07: one offer per bank and invitation; the rate in thousandths of a percent (5,875% → 5875).
CREATE TABLE IF NOT EXISTS deposit_offers (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id   uuid          NOT NULL REFERENCES deposit_invitations (id),
  bank_id         uuid          NOT NULL REFERENCES deposit_banks (id),
  building_id     uuid          NOT NULL,
  received_at     timestamptz   NOT NULL,
  rate_milli      integer       NOT NULL,
  day_basis       integer       NOT NULL,
  payment_kind    varchar(10)   NOT NULL,
  payment_every   integer,
  payment_unit    varchar(10),
  conditions      text,
  attachment_id   uuid          NOT NULL,
  completeness    varchar(12)   NOT NULL,
  missing_note    text,
  is_late         boolean       NOT NULL DEFAULT false,
  outside         boolean       NOT NULL DEFAULT false,
  outside_reason  text,
  created_by      uuid          NOT NULL,
  version         integer       NOT NULL DEFAULT 1,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_deposit_offers_rate" CHECK (rate_milli > 0 AND rate_milli <= 30000),
  CONSTRAINT "CHK_deposit_offers_basis" CHECK (day_basis IN (360, 365)),
  CONSTRAINT "CHK_deposit_offers_payment" CHECK (
    (payment_kind = 'END' AND payment_every IS NULL AND payment_unit IS NULL)
    OR (payment_kind = 'PERIODIC' AND payment_every > 0 AND payment_unit IN ('MONTH', 'DAY'))
  ),
  CONSTRAINT "CHK_deposit_offers_completeness" CHECK (
    completeness = 'COMPLETE' OR (completeness = 'INCOMPLETE' AND missing_note IS NOT NULL)
  ),
  CONSTRAINT "CHK_deposit_offers_outside" CHECK (NOT outside OR outside_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deposit_offers_bank" ON deposit_offers (invitation_id, bank_id);

-- BR-T1-09..11: the selected bank (or none) with its minutes, basis and the comparison as sent for approval.
CREATE TABLE IF NOT EXISTS deposit_selections (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   varchar(20)   NOT NULL,
  minutes_code           varchar(20)   NOT NULL,
  invitation_id          uuid          NOT NULL REFERENCES deposit_invitations (id),
  building_id            uuid          NOT NULL,
  kind                   varchar(10)   NOT NULL,
  offer_id               uuid          REFERENCES deposit_offers (id),
  bank_id                uuid          REFERENCES deposit_banks (id),
  minutes_attachment_id  uuid          NOT NULL,
  basis                  text          NOT NULL,
  not_highest_reason     text,
  late_reason            text,
  comparison             jsonb         NOT NULL DEFAULT '[]',
  status                 varchar(20)   NOT NULL DEFAULT 'PENDING',
  replaces_id            uuid          REFERENCES deposit_selections (id),
  change_reason          text,
  decisions              jsonb         NOT NULL DEFAULT '[]',
  submitted_at           timestamptz   NOT NULL,
  created_by             uuid          NOT NULL,
  version                integer       NOT NULL DEFAULT 1,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_deposit_selections_kind" CHECK (
    (kind = 'BANK' AND offer_id IS NOT NULL AND bank_id IS NOT NULL)
    OR (kind = 'NONE' AND offer_id IS NULL AND bank_id IS NULL)
  ),
  CONSTRAINT "CHK_deposit_selections_status"
    CHECK (status IN ('PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUPERSEDED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deposit_selections_code" ON deposit_selections (code);
CREATE INDEX IF NOT EXISTS "IDX_deposit_selections_invitation" ON deposit_selections (invitation_id, created_at);
