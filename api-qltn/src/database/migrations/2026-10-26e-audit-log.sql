-- AD-S1 (docs/product/features/AD-nhat-ky-thao-tac/SPEC.md BR-04): role and department changes get their own subject
-- types instead of ACCOUNT. Rows written before this migration are moved by the id they point to; a second run finds
-- nothing left to move. Plus an index for the operation log, which lists newest first across subjects.
-- Idempotent; never edit after it has been applied.

UPDATE audit_events e
SET subject_type = 'ROLE'
WHERE e.subject_type = 'ACCOUNT'
  AND EXISTS (SELECT 1 FROM role_definitions r WHERE r.id = e.subject_id);

UPDATE audit_events e
SET subject_type = 'DEPARTMENT'
WHERE e.subject_type = 'ACCOUNT'
  AND EXISTS (SELECT 1 FROM departments d WHERE d.id = e.subject_id);

CREATE INDEX IF NOT EXISTS "IDX_audit_events_created" ON audit_events (created_at DESC, id DESC);
