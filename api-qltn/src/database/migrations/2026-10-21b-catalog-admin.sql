-- Catalog & administration: role definitions, locations, building configuration,
-- audit trail and code counters. Idempotent; never edit after it has been applied.

CREATE TABLE IF NOT EXISTS role_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(20) NOT NULL,
  name            varchar(80) NOT NULL,
  base_role       varchar(30) NOT NULL,
  capabilities    text[]      NOT NULL DEFAULT '{}',
  is_system       boolean     NOT NULL DEFAULT false,
  source_role_id  uuid,
  version         integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_definitions_code" ON role_definitions (code);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_definitions_name" ON role_definitions (lower(name));

-- Effective capabilities are derived from the role definition; the per-user copy is dropped.
ALTER TABLE users DROP COLUMN IF EXISTS capabilities;

CREATE TABLE IF NOT EXISTS locations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid         NOT NULL,
  floor        varchar(20)  NOT NULL,
  zone         varchar(60),
  name         varchar(120) NOT NULL,
  is_active    boolean      NOT NULL DEFAULT true,
  version      integer      NOT NULL DEFAULT 1,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_locations_building_floor_name" ON locations (building_id, floor, lower(name));

CREATE TABLE IF NOT EXISTS user_locations (
  user_id      uuid NOT NULL,
  location_id  uuid NOT NULL,
  PRIMARY KEY (user_id, location_id)
);
CREATE INDEX IF NOT EXISTS "IDX_user_locations_location" ON user_locations (location_id);

CREATE TABLE IF NOT EXISTS building_configs (
  building_id              uuid PRIMARY KEY,
  template_key             varchar(30),
  workflow_name            varchar(120),
  workflow_description     varchar(500),
  task_due_days            jsonb        NOT NULL,
  approval_step_keys       text[]       NOT NULL,
  workflow_approval_steps  jsonb        NOT NULL,
  workflow_stages          jsonb        NOT NULL,
  assignment_rules         jsonb        NOT NULL DEFAULT '[]',
  emergency_limit_vnd      bigint       NOT NULL,
  emergency_doc_hours      integer      NOT NULL,
  recent_repair_days       integer      NOT NULL,
  repeat_min_records       integer      NOT NULL,
  price_ratio              numeric(4,2) NOT NULL,
  version                  integer      NOT NULL DEFAULT 1,
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               uuid
);

CREATE TABLE IF NOT EXISTS audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type    varchar(40)  NOT NULL,
  subject_id      uuid         NOT NULL,
  -- NULL for account-level (global) changes.
  building_id     uuid,
  action          varchar(60)  NOT NULL,
  -- NULL when the system acted (scheduled jobs).
  actor_id        uuid,
  entity_version  integer,
  from_status     varchar(40),
  to_status       varchar(40),
  reason          text,
  correlation_id  varchar(100),
  created_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_audit_events_subject" ON audit_events (subject_type, subject_id, created_at);
CREATE INDEX IF NOT EXISTS "IDX_audit_events_building" ON audit_events (building_id, created_at);

CREATE TABLE IF NOT EXISTS code_counters (
  key    varchar(40) PRIMARY KEY,
  value  integer     NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_role_definitions_base_role') THEN
    ALTER TABLE role_definitions ADD CONSTRAINT "CHK_role_definitions_base_role"
      CHECK (base_role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_definitions_source') THEN
    ALTER TABLE role_definitions ADD CONSTRAINT "FK_role_definitions_source"
      FOREIGN KEY (source_role_id) REFERENCES role_definitions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_role_def') THEN
    ALTER TABLE users ADD CONSTRAINT "FK_users_role_def"
      FOREIGN KEY (role_def_id) REFERENCES role_definitions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_locations_building') THEN
    ALTER TABLE locations ADD CONSTRAINT "FK_locations_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_locations_user') THEN
    ALTER TABLE user_locations ADD CONSTRAINT "FK_user_locations_user"
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_locations_location') THEN
    ALTER TABLE user_locations ADD CONSTRAINT "FK_user_locations_location"
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_building_configs_building') THEN
    ALTER TABLE building_configs ADD CONSTRAINT "FK_building_configs_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_building_configs_updated_by') THEN
    ALTER TABLE building_configs ADD CONSTRAINT "FK_building_configs_updated_by"
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_building_configs_emergency_limit') THEN
    ALTER TABLE building_configs ADD CONSTRAINT "CHK_building_configs_emergency_limit" CHECK (emergency_limit_vnd > 0);
  END IF;
END $$;
