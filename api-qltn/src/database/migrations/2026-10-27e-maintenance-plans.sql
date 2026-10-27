-- Maintenance plans, their schedule versions, occurrences and periods skipped while paused (SPEC MT-S2 §2).
-- Idempotent; never edit after it has been applied. Names are also declared on the entities of
-- src/modules/maintenance/entities/.

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             varchar(20)   NOT NULL,
  item_id          uuid          NOT NULL,
  building_id      uuid          NOT NULL,
  name             varchar(120)  NOT NULL,
  -- DRAFT, ACTIVE, PAUSED, ENDED (BR-MT2-04).
  status           varchar(20)   NOT NULL DEFAULT 'DRAFT',
  manager_user_id  uuid          NOT NULL,
  performer_user_id uuid         NOT NULL,
  reviewer_user_id uuid          NOT NULL,
  contractor_name  varchar(200),
  -- Checklist template (BR-MT2-03): [{ id, label, required, kind, unit, min, max, photoRequired }].
  checklist        jsonb         NOT NULL DEFAULT '[]',
  -- First day the generator may use: the activation or resume day (no occurrence before it).
  active_since     date,
  paused_on        date,
  status_reason    text,
  created_by       uuid          NOT NULL,
  version          integer       NOT NULL DEFAULT 1,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_maintenance_plans_status" CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_plans_code" ON maintenance_plans (code);
CREATE INDEX IF NOT EXISTS "IDX_maintenance_plans_item" ON maintenance_plans (item_id);
CREATE INDEX IF NOT EXISTS "IDX_maintenance_plans_building_status" ON maintenance_plans (building_id, status);

-- One row per schedule (BR-MT2-05). The schedule of a day is the non-superseded row with the latest effective_from
-- on or before it; a change from X supersedes every row effective from X onwards.
CREATE TABLE IF NOT EXISTS maintenance_schedule_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid          NOT NULL,
  unit           varchar(10)   NOT NULL,
  every          integer       NOT NULL,
  effective_from date          NOT NULL,
  anchor_date    date          NOT NULL,
  reason         text,
  superseded_by  uuid,
  superseded_at  timestamptz,
  created_by     uuid          NOT NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_maintenance_schedule_versions_unit" CHECK (
    (unit = 'WEEK' AND every BETWEEN 1 AND 8) OR (unit = 'MONTH' AND every BETWEEN 1 AND 24)
  ),
  CONSTRAINT "CHK_maintenance_schedule_versions_anchor" CHECK (anchor_date >= effective_from)
);
CREATE INDEX IF NOT EXISTS "IDX_maintenance_schedule_versions_plan" ON maintenance_schedule_versions (plan_id, effective_from);

CREATE TABLE IF NOT EXISTS maintenance_occurrences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              varchar(20)   NOT NULL,
  plan_id           uuid          NOT NULL,
  item_id           uuid          NOT NULL,
  building_id       uuid          NOT NULL,
  scheduled_date    date          NOT NULL,
  -- The period's own date ("ngày gốc"); null for a make-up occurrence.
  period_date       date,
  -- Dedupe key of the period: equal to period_date while the occurrence holds its period, released (null) when a
  -- pause, an end or the cancel of a "Lịch đã đổi" occurrence frees the period for a new one (BR-MT2-05, BR-MT2-06).
  period_key        date,
  -- SCHEDULED, CANCELLED here; MT-S3 adds the execution statuses.
  status            varchar(30)   NOT NULL DEFAULT 'SCHEDULED',
  is_makeup         boolean       NOT NULL DEFAULT false,
  schedule_changed  boolean       NOT NULL DEFAULT false,
  cancel_reason     text,
  performer_user_id uuid          NOT NULL,
  reviewer_user_id  uuid          NOT NULL,
  contractor_name   varchar(200),
  checklist         jsonb         NOT NULL DEFAULT '[]',
  version           integer       NOT NULL DEFAULT 1,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_occurrences_code" ON maintenance_occurrences (code);
-- BR-MT2-06: at most one occurrence per period of a plan, checked by the database (repeated or parallel runs).
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_occurrences_period" ON maintenance_occurrences (plan_id, period_key)
  WHERE period_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_maintenance_occurrences_plan_date" ON maintenance_occurrences (plan_id, scheduled_date);
CREATE INDEX IF NOT EXISTS "IDX_maintenance_occurrences_building_date" ON maintenance_occurrences (building_id, scheduled_date);

-- Periods that fell while the plan was paused ("Bỏ qua do tạm dừng", BR-MT2-04).
CREATE TABLE IF NOT EXISTS maintenance_skipped_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid         NOT NULL,
  period_date date         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_skipped_periods" ON maintenance_skipped_periods (plan_id, period_date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_plans_item') THEN
    ALTER TABLE maintenance_plans ADD CONSTRAINT "FK_maintenance_plans_item"
      FOREIGN KEY (item_id) REFERENCES maintenance_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_schedule_versions_plan') THEN
    ALTER TABLE maintenance_schedule_versions ADD CONSTRAINT "FK_maintenance_schedule_versions_plan"
      FOREIGN KEY (plan_id) REFERENCES maintenance_plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_occurrences_plan') THEN
    ALTER TABLE maintenance_occurrences ADD CONSTRAINT "FK_maintenance_occurrences_plan"
      FOREIGN KEY (plan_id) REFERENCES maintenance_plans(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_skipped_periods_plan') THEN
    ALTER TABLE maintenance_skipped_periods ADD CONSTRAINT "FK_maintenance_skipped_periods_plan"
      FOREIGN KEY (plan_id) REFERENCES maintenance_plans(id) ON DELETE CASCADE;
  END IF;
END $$;
