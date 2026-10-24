-- Attachments (Đợt 2 T2): site photos of a repair record.
-- Idempotent; never edit after it has been applied. Names are also declared on
-- src/modules/attachments/entities/attachment.entity.ts and on RepairRecord.

CREATE TABLE IF NOT EXISTS attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  varchar(40)  NOT NULL,
  subject_id    uuid         NOT NULL,
  building_id   uuid         NOT NULL,
  purpose       varchar(40)  NOT NULL,
  file_name     varchar(200) NOT NULL,
  mime_type     varchar(100) NOT NULL,
  size_bytes    integer      NOT NULL,
  -- Key inside STORAGE_DIR; the stored name is a random id, not the uploaded name.
  content_ref   varchar(200) NOT NULL,
  uploaded_by   uuid         NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_attachments_subject" ON attachments (subject_type, subject_id, created_at);
CREATE INDEX IF NOT EXISTS "IDX_attachments_building" ON attachments (building_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_attachments_building') THEN
    ALTER TABLE attachments ADD CONSTRAINT "FK_attachments_building"
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_attachments_uploaded_by') THEN
    ALTER TABLE attachments ADD CONSTRAINT "FK_attachments_uploaded_by"
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Ordered file ids of a repair record. An id removed from the list is detached from the
-- record, while its attachment row and stored content are kept.
ALTER TABLE repair_records ADD COLUMN IF NOT EXISTS attachment_ids uuid[] NOT NULL DEFAULT '{}';
