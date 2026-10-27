-- Equipment of a building and its link from repair records (SPEC MT-S1 §2 items 1 and 3).
-- Idempotent; never edit after it has been applied. Constraint/index names are also declared on
-- src/modules/maintenance/entities/maintenance-item.entity.ts and repair-record.entity.ts.
-- Existing repair records keep maintenance_item_id NULL (BR-MT-10: no back-filling).

CREATE TABLE IF NOT EXISTS maintenance_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id         uuid          NOT NULL,
  location_id         uuid          NOT NULL,
  code                varchar(30)   NOT NULL,
  name                varchar(120)  NOT NULL,
  type                varchar(60)   NOT NULL,
  owner_user_id       uuid          NOT NULL,
  model               varchar(120),
  supplier            varchar(120),
  install_date        date,
  warranty_until      date,
  -- "Thông tin kỹ thuật" (BR-MT-01).
  description         text,
  -- ITEM_DOCUMENT attachments listed on the item, in order.
  document_ids        uuid[]        NOT NULL DEFAULT '{}',
  condition           varchar(20)   NOT NULL DEFAULT 'UNKNOWN',
  condition_note      text,
  active              boolean       NOT NULL DEFAULT true,
  deactivated_at      timestamptz,
  deactivation_reason text,
  created_by          uuid          NOT NULL,
  version             integer       NOT NULL DEFAULT 1,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_maintenance_items_condition" CHECK (condition IN ('UNKNOWN', 'GOOD', 'NEEDS_ATTENTION'))
);
-- BR-MT-01: the code is unique inside one building, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_maintenance_items_building_code" ON maintenance_items (building_id, code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_items_building') THEN
    ALTER TABLE maintenance_items ADD CONSTRAINT "FK_maintenance_items_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_items_location') THEN
    ALTER TABLE maintenance_items ADD CONSTRAINT "FK_maintenance_items_location"
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_maintenance_items_owner') THEN
    ALTER TABLE maintenance_items ADD CONSTRAINT "FK_maintenance_items_owner"
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS maintenance_item_id uuid;
CREATE INDEX IF NOT EXISTS "IDX_repair_records_maintenance_item" ON repair_records (maintenance_item_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_repair_records_maintenance_item') THEN
    ALTER TABLE repair_records ADD CONSTRAINT "FK_repair_records_maintenance_item"
      FOREIGN KEY (maintenance_item_id) REFERENCES maintenance_items(id) ON DELETE RESTRICT;
  END IF;
END $$;
