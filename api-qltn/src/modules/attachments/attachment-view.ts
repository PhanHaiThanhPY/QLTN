import type { Attachment } from './entities/attachment.entity';

/** Attachment metadata returned by the API; the file content is a separate GET. */
export interface AttachmentView {
  id: string;
  subjectType: string;
  subjectId: string;
  buildingId: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: Date;
}

export const toAttachmentView = (row: Attachment): AttachmentView => ({
  id: row.id,
  subjectType: row.subjectType,
  subjectId: row.subjectId,
  buildingId: row.buildingId,
  purpose: row.purpose,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  uploadedBy: row.uploadedBy,
  createdAt: row.createdAt,
});
