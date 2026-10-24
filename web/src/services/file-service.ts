import { IS_API_MODE } from '@/config/data-source';
import { ATTACHMENT_PURPOSE, ATTACHMENT_PURPOSE_LABEL, LIMITS, OCCURRENCE_FINAL_STATUSES, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { AttachmentPurpose, SubjectType } from '@/domain/constants';
import { forbidden, notFound, validationError } from '@/domain/errors';
import { canAccessBuilding, canAccessLocation, hasCapability } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type { Attachment, AuditEvent, User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { broadcastChange } from './change-channel';
import { apiRequest, apiRequestBlob } from './http/client';
import { mapAttachment, type ApiAttachment } from './http/mappers';
import { getSessionUserId, newId, nowIso } from './runtime';

export interface UploadInput {
  subjectType: SubjectType;
  subjectId: string;
  purpose: AttachmentPurpose;
  file: Blob;
  fileName: string;
}

const isPurpose = (value: string): value is AttachmentPurpose => Object.hasOwn(ATTACHMENT_PURPOSE, value);

type AllowedMimeType = (typeof LIMITS.ALLOWED_MIME_TYPES)[number];

const isAllowedMimeType = (value: string): value is AllowedMimeType => (LIMITS.ALLOWED_MIME_TYPES as readonly string[]).includes(value);

/** Leading bytes of each accepted format; `null` matches any byte (WebP: "RIFF" + size + "WEBP"). */
const MAGIC_BYTES: Record<AllowedMimeType, readonly (number | null)[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/webp': [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
};
const MAGIC_LENGTH = 12;

/** The declared type comes from the file name; the content must really be that format. */
const matchesMagicBytes = async (file: Blob, mimeType: AllowedMimeType): Promise<boolean> => {
  const head = new Uint8Array(await file.slice(0, MAGIC_LENGTH).arrayBuffer());
  const signature = MAGIC_BYTES[mimeType];
  return head.length >= signature.length && signature.every((byte, index) => byte === null || head[index] === byte);
};

type UploadRule = Partial<Record<AttachmentPurpose, readonly string[]>>;

/** Which file purpose the managing BQL may upload in which repair status (one step = one kind of document). */
const REPAIR_MANAGER_UPLOADS: UploadRule = {
  SITE_PHOTO: ['DRAFT', 'NEEDS_RECORD_UPDATE'],
  PROPOSAL: ['PENDING_PROPOSAL', 'NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE', 'EMERGENCY_IN_PROGRESS'],
  CONSTRUCTION: ['IN_CONSTRUCTION', 'NEEDS_REPAIR', 'EMERGENCY_IN_PROGRESS'],
  ACCEPTANCE: ['IN_CONSTRUCTION', 'NEEDS_REPAIR'],
  PAYMENT_REQUEST: ['PENDING_PAYMENT_REQUEST', 'NEEDS_PAYMENT_UPDATE'],
  PAYMENT_PROOF: ['PENDING_PAYMENT'],
};
/** KT and TVKT only attach the acceptance report while deciding. */
const REPAIR_REVIEWER_UPLOADS: UploadRule = { ACCEPTANCE: ['PENDING_ACCEPTANCE'] };
/** Maintenance results while the work is open (also used as photos for a linked repair). */
const OCCURRENCE_MANAGER_UPLOADS: UploadRule = { MAINTENANCE_RESULT: ['IN_PROGRESS', 'REWORK', 'PENDING_REVIEW'] };

const REPAIR_MANAGER_CAPABILITIES: Partial<Record<AttachmentPurpose, Capability>> = {
  SITE_PHOTO: 'RECORD_EDIT',
  PROPOSAL: 'RECORD_EDIT',
  CONSTRUCTION: 'CONSTRUCTION',
  ACCEPTANCE: 'CONSTRUCTION',
  PAYMENT_REQUEST: 'PAYMENT_RECORD',
  PAYMENT_PROOF: 'PAYMENT_RECORD',
};

const isAllowed = (rule: UploadRule, purpose: AttachmentPurpose, status: string): boolean =>
  rule[purpose]?.includes(status) ?? false;

const STEP_DENIED = 'Bước hiện tại không cho bạn tải loại tệp này.';

const OUT_OF_LOCATION = 'Ngoài phạm vi khu vực của bạn.';

/**
 * Assigned users may attach only the document kind of their current step; closed subjects are read-only.
 * Out-of-building subjects look like not found; out-of-location subjects are forbidden (same as commands).
 */
const assertCanUpload = async (user: User, input: UploadInput): Promise<string> => {
  const db = getDb();
  if (input.subjectType === 'REPAIR_RECORD') {
    const record = await db.records.get(input.subjectId);
    if (!record || !canAccessBuilding(user, record.buildingId)) throw notFound();
    if (!canAccessLocation(user, record.buildingId, record.locationId || undefined)) throw forbidden(OUT_OF_LOCATION);
    if (REPAIR_FINAL_STATUSES.includes(record.status)) throw forbidden('Hồ sơ đã kết thúc, chỉ được xem.');
    const managerCapability = REPAIR_MANAGER_CAPABILITIES[input.purpose];
    const canManager =
      record.managerUserId === user.id &&
      managerCapability !== undefined &&
      hasCapability(user, managerCapability) &&
      isAllowed(REPAIR_MANAGER_UPLOADS, input.purpose, record.status);
    const isAssignedAcceptanceReviewer = record.confirmationUserId === user.id || record.consultantUserId === user.id;
    const canReviewer =
      isAssignedAcceptanceReviewer &&
      hasCapability(user, 'ACCEPTANCE_DECIDE') &&
      isAllowed(REPAIR_REVIEWER_UPLOADS, input.purpose, record.status);
    if (!canManager && !canReviewer) throw forbidden(STEP_DENIED);
    return record.buildingId;
  }
  if (input.subjectType === 'MAINTENANCE_OCCURRENCE') {
    const occurrence = await db.occurrences.get(input.subjectId);
    if (!occurrence || !canAccessBuilding(user, occurrence.buildingId)) throw notFound();
    const item = await db.maintenanceItems.get(occurrence.itemId);
    if (!canAccessLocation(user, occurrence.buildingId, item?.locationId)) throw forbidden(OUT_OF_LOCATION);
    if (OCCURRENCE_FINAL_STATUSES.includes(occurrence.status)) throw forbidden('Lượt đã kết thúc, chỉ được xem.');
    const canManager =
      occurrence.managerUserId === user.id &&
      hasCapability(user, 'MAINTENANCE_MANAGE') &&
      isAllowed(OCCURRENCE_MANAGER_UPLOADS, input.purpose, occurrence.status);
    if (!canManager) throw forbidden(STEP_DENIED);
    return occurrence.buildingId;
  }
  if (input.subjectType === 'MAINTENANCE_ITEM') {
    const item = await db.maintenanceItems.get(input.subjectId);
    if (!item || !canAccessBuilding(user, item.buildingId)) throw notFound();
    if (!canAccessLocation(user, item.buildingId, item.locationId)) throw forbidden(OUT_OF_LOCATION);
    if (!item.active) throw forbidden('Hạng mục đã vô hiệu hóa, chỉ được xem.');
    if (!hasCapability(user, 'MAINTENANCE_MANAGE') || input.purpose !== 'ITEM_DOCUMENT') throw forbidden(STEP_DENIED);
    return item.buildingId;
  }
  throw forbidden('Đối tượng này chưa hỗ trợ tệp đính kèm.');
};

/**
 * Stores a file Blob and its Attachment row in one IndexedDB transaction.
 * The permission/state check runs inside the same transaction as the writes, so a concurrent
 * command cannot change the step between the check and the upload.
 */
/** API mode: the server owns the limits, permission and storage; its Vietnamese message reaches the screen. */
const uploadAttachmentToApi = async (input: UploadInput): Promise<Attachment> => {
  const form = new FormData();
  form.append('subjectType', input.subjectType);
  form.append('subjectId', input.subjectId);
  form.append('purpose', input.purpose);
  form.append('file', input.file, input.fileName);
  const uploaded = await apiRequest<ApiAttachment>('POST', '/attachments', { form });
  broadcastChange();
  return mapAttachment(uploaded);
};

export const uploadAttachment = async (input: UploadInput): Promise<Attachment> => {
  if (IS_API_MODE) return uploadAttachmentToApi(input);
  const db = getDb();
  const errors: Record<string, string> = {};
  const mimeType = input.file.type;
  const allowedType = isAllowedMimeType(mimeType) ? mimeType : undefined;
  if (!allowedType) errors.file = 'Chỉ hỗ trợ ảnh JPEG/PNG/WebP hoặc PDF.';
  if (input.file.size > LIMITS.MAX_FILE_BYTES) errors.file = 'Tệp vượt quá 10 MB.';
  if (input.file.size === 0) errors.file = 'Tệp rỗng.';
  if (!isPurpose(input.purpose)) errors.purpose = 'Mục đích tệp không hợp lệ.';
  if (Object.keys(errors).length > 0) throw validationError(errors, Object.values(errors)[0]);
  // Read the header before the transaction: a non-IndexedDB await inside it would commit it early.
  if (!allowedType || !(await matchesMagicBytes(input.file, allowedType))) {
    throw validationError({ file: 'Nội dung tệp không đúng định dạng JPEG/PNG/WebP/PDF đã khai báo.' });
  }

  const tables = [db.users, db.records, db.occurrences, db.maintenanceItems, db.files, db.attachments, db.auditEvents];
  const attachment = await db.transaction('rw', tables, async () => {
    const user = await db.users.get(getSessionUserId() ?? '');
    if (!user || !hasCapability(user, 'VIEW')) throw forbidden('Phiên demo không hợp lệ.');
    const buildingId = await assertCanUpload(user, input);
    const fileId = newId('fil');
    const row: Attachment = {
      id: newId('att'),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      buildingId,
      purpose: input.purpose,
      fileName: input.fileName.slice(0, 200),
      mimeType,
      sizeBytes: input.file.size,
      contentRef: fileId,
      uploadedBy: user.id,
      createdAt: nowIso(),
    };
    await db.files.add({ id: fileId, blob: input.file });
    await db.attachments.add(row);
    const audit: AuditEvent = {
      id: newId('aud'),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      buildingId,
      commandId: `upload:${row.id}`,
      actorId: user.id,
      action: 'uploadAttachment',
      entityVersion: 1,
      reason: ATTACHMENT_PURPOSE_LABEL[input.purpose],
      createdAt: row.createdAt,
    };
    await db.auditEvents.add(audit);
    return row;
  });
  broadcastChange();
  return attachment;
};

/**
 * Returns the Blob of an attachment after checking the viewer's building scope (never by id alone).
 * In API mode the backend checks the same scope and answers 404 outside it; metadata is not needed here.
 */
export const readAttachmentBlob = async (attachmentId: string): Promise<{ attachment?: Attachment; blob: Blob }> => {
  if (IS_API_MODE) {
    return { blob: await apiRequestBlob(`/attachments/${encodeURIComponent(attachmentId)}/content`) };
  }
  const db = getDb();
  const user = await db.users.get(getSessionUserId() ?? '');
  const attachment = await db.attachments.get(attachmentId);
  if (!user || !attachment || !canAccessBuilding(user, attachment.buildingId)) throw notFound('Không tìm thấy tệp hoặc tệp ngoài phạm vi.');
  const file = await db.files.get(attachment.contentRef);
  if (!file) throw notFound('Nội dung tệp không còn trong trình duyệt.');
  return { attachment, blob: file.blob };
};
