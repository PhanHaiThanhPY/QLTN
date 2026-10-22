-- Core identity: buildings, departments, user accounts, refresh tokens.
-- Idempotent: safe to re-run. Never edit after it has been applied; add a new file instead.

CREATE TABLE IF NOT EXISTS buildings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(20)  NOT NULL,
  name        varchar(200) NOT NULL,
  address     varchar(500),
  is_active   boolean      NOT NULL DEFAULT true,
  version     integer      NOT NULL DEFAULT 1,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_buildings_code" ON buildings (code);

CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(30)  NOT NULL,
  name        varchar(200) NOT NULL,
  description text,
  version     integer      NOT NULL DEFAULT 1,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_departments_code" ON departments (code);

CREATE TABLE IF NOT EXISTS department_buildings (
  department_id uuid NOT NULL,
  building_id   uuid NOT NULL,
  PRIMARY KEY (department_id, building_id)
);
CREATE INDEX IF NOT EXISTS "IDX_department_buildings_building" ON department_buildings (building_id);

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           varchar(30)  NOT NULL,
  username       varchar(50)  NOT NULL,
  password_hash  varchar(100),
  full_name      varchar(200) NOT NULL,
  role           varchar(30)  NOT NULL,
  department_id  uuid,
  job_title      varchar(200),
  email          varchar(200),
  phone          varchar(30),
  is_active      boolean      NOT NULL DEFAULT true,
  -- Custom role narrowing (NULL = the system role's full capability set).
  capabilities   text[],
  role_def_id    uuid,
  last_login_at  timestamptz,
  version        integer      NOT NULL DEFAULT 1,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_code" ON users (code);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_username" ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email" ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_users_department" ON users (department_id);

CREATE TABLE IF NOT EXISTS user_buildings (
  user_id     uuid NOT NULL,
  building_id uuid NOT NULL,
  PRIMARY KEY (user_id, building_id)
);
CREATE INDEX IF NOT EXISTS "IDX_user_buildings_building" ON user_buildings (building_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  token_hash   char(64)    NOT NULL,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid,
  user_agent   varchar(300),
  ip           varchar(64),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refresh_tokens_hash" ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user" ON refresh_tokens (user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_users_role') THEN
    ALTER TABLE users ADD CONSTRAINT "CHK_users_role"
      CHECK (role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_users_username_lower') THEN
    ALTER TABLE users ADD CONSTRAINT "CHK_users_username_lower" CHECK (username = lower(username));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_department') THEN
    ALTER TABLE users ADD CONSTRAINT "FK_users_department"
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_buildings_user') THEN
    ALTER TABLE user_buildings ADD CONSTRAINT "FK_user_buildings_user"
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_buildings_building') THEN
    ALTER TABLE user_buildings ADD CONSTRAINT "FK_user_buildings_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_department_buildings_department') THEN
    ALTER TABLE department_buildings ADD CONSTRAINT "FK_department_buildings_department"
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_department_buildings_building') THEN
    ALTER TABLE department_buildings ADD CONSTRAINT "FK_department_buildings_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_refresh_tokens_user') THEN
    ALTER TABLE refresh_tokens ADD CONSTRAINT "FK_refresh_tokens_user"
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
