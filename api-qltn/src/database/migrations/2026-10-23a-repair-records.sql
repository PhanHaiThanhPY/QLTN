-- Repair records (Đợt 2 T1): create + draft + detail.
-- Idempotent; never edit after it has been applied. Constraint/index names are
-- also declared on src/modules/records/entities/repair-record.entity.ts.

CREATE TABLE IF NOT EXISTS repair_records (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                             varchar(20)  NOT NULL,
  building_id                      uuid         NOT NULL,
  location_id                      uuid,
  no_maintenance_item              boolean      NOT NULL DEFAULT false,
  title                            varchar(120) NOT NULL DEFAULT '',
  description                      text         NOT NULL DEFAULT '',
  priority                         varchar(20)  NOT NULL DEFAULT 'NORMAL',
  status                           varchar(40)  NOT NULL DEFAULT 'DRAFT',
  manager_user_id                  uuid         NOT NULL,
  confirmation_user_id             uuid,
  consultant_user_id               uuid,
  board_user_id                    uuid,
  -- Snapshot of the building configuration when the record was created.
  approval_step_keys               text[]       NOT NULL DEFAULT '{}',
  workflow_approval_steps          jsonb        NOT NULL DEFAULT '[]',
  workflow_stage_approval_step_keys jsonb       NOT NULL DEFAULT '{}',
  approval_assignee_user_ids       jsonb        NOT NULL DEFAULT '{}',
  task_due_days                    jsonb        NOT NULL DEFAULT '{}',
  created_by                       uuid         NOT NULL,
  version                          integer      NOT NULL DEFAULT 1,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_at                       timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_repair_records_code" ON repair_records (code);
CREATE INDEX IF NOT EXISTS "IDX_repair_records_building_created" ON repair_records (building_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_building') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_location') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_location"
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_manager') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_manager"
      FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_confirmation') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_confirmation"
      FOREIGN KEY (confirmation_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_consultant') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_consultant"
      FOREIGN KEY (consultant_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_board') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_board"
      FOREIGN KEY (board_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_created_by') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_created_by"
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_repair_records_priority') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "CHK_repair_records_priority"
      CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
  END IF;
END $$;
