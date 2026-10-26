-- Role matrix v2 (ADR-0001, SPEC RM-S1): system role ACCOUNTANT (Kế toán) and the data behind
-- "Có quyền mới chưa bật" on custom roles. System role rows and their capabilities are synced from
-- the code at boot (RolesService.syncSystemRoles), so no capability data is written here.
-- Idempotent; never edit after it has been applied.

ALTER TABLE users DROP CONSTRAINT IF EXISTS "CHK_users_role";
ALTER TABLE users ADD CONSTRAINT "CHK_users_role"
  CHECK (role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD', 'ACCOUNTANT'));

ALTER TABLE role_definitions DROP CONSTRAINT IF EXISTS "CHK_role_definitions_base_role";
ALTER TABLE role_definitions ADD CONSTRAINT "CHK_role_definitions_base_role"
  CHECK (base_role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD', 'ACCOUNTANT'));

-- Capabilities of the base role when a custom role was last saved. A base capability missing from it is
-- "new" for that custom role: it is not enabled automatically (PD-07 Q5) and the permissions screen lists it.
ALTER TABLE role_definitions ADD COLUMN IF NOT EXISTS base_capabilities text[];

-- Custom roles saved before this migration were saved against matrix v1.
UPDATE role_definitions
SET base_capabilities = CASE base_role
  WHEN 'ADMIN' THEN ARRAY['VIEW', 'REPLACE_MANAGER', 'REPORT_VIEW', 'ADMIN_VIEW', 'BUILDING_CONFIG', 'ACCOUNT_MANAGE']
  WHEN 'BQL' THEN ARRAY['VIEW', 'RECORD_EDIT', 'CONSTRUCTION', 'PAYMENT_RECORD', 'MAINTENANCE_MANAGE', 'ITEM_CONDITION',
                        'REASSIGN', 'REPORT_VIEW', 'BUILDING_CONFIG', 'EMERGENCY_START']
  WHEN 'TECH_CONFIRMER' THEN ARRAY['VIEW', 'RECORD_CONFIRM', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'MAINTENANCE_REVIEW']
  WHEN 'TECH_CONSULTANT' THEN ARRAY['VIEW', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'REPORT_VIEW']
  WHEN 'OWNERS_BOARD' THEN ARRAY['VIEW', 'PROPOSAL_DECIDE', 'PAYMENT_DECIDE', 'REPORT_VIEW']
  ELSE ARRAY[]::text[]
END
WHERE is_system = false AND base_capabilities IS NULL;

-- BQL lost BUILDING_CONFIG (DF-11): drop it from custom roles based on BQL so their stored list stays a
-- subset of the base role (the effective set already excluded it).
UPDATE role_definitions
SET capabilities = array_remove(capabilities, 'BUILDING_CONFIG')
WHERE is_system = false AND base_role = 'BQL' AND 'BUILDING_CONFIG' = ANY (capabilities);
