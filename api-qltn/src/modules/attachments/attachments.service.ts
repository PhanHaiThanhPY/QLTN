import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { badRequestWithReason, forbidden, forbiddenWithReason, notFound } from '../../common/errors';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { RepairRecord } from '../records/entities/repair-record.entity';
import { PROPOSAL_EDIT_STATUSES } from '../records/record-actions';
import { acceptanceStepsHeldBy, approvalStepOf, currentStepKeyOf, stepHolderOf } from '../records/record-steps';
import { toAttachmentView, type AttachmentView } from './attachment-view';
import type { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { Attachment } from './entities/attachment.entity';
import { FileStorage } from './file-storage';
import type { UploadedFileLike } from './uploaded-file';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 200;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Leading bytes of each accepted format; `null` matches any byte (WebP: "RIFF" + size + "WEBP"). */
const MAGIC_BYTES: Record<AllowedMimeType, readonly (number | null)[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/webp': [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
};
const MAGIC_LENGTH = 12;

/** Repair-record files only; the table stays general (subject type + subject id + purpose) for later modules. */
const SUPPORTED_SUBJECT_TYPES = [SUBJECT_TYPE.REPAIR_RECORD] as const;

const isManagerAt = (actor: AuthenticatedUser, record: RepairRecord, statuses: readonly string[]): boolean =>
  record.managerUserId === actor.id && hasCapability(actor, 'RECORD_EDIT') && statuses.includes(record.status);

/** Statuses where the manager reports construction or repair work (T11, T12, T15, T16; v1 BR-12). */
const EXECUTION_STATUSES: readonly string[] = ['IN_CONSTRUCTION', 'NEEDS_REPAIR'];

/** The holder of the current BQT-role step while the proposal waits on it (BR-S2-05). */
const isWaitingBoardHolder = (actor: AuthenticatedUser, record: RepairRecord): boolean => {
  const key = currentStepKeyOf(record);
  const step = key ? approvalStepOf(record, key) : undefined;
  return step?.role === 'OWNERS_BOARD' && stepHolderOf(record, step.key) === actor.id;
};

/** Who may upload each purpose, and when (v1 BR-12, v2 BR-C-02). */
const PURPOSE_RULES: Readonly<Record<string, (actor: AuthenticatedUser, record: RepairRecord) => boolean>> = {
  SITE_PHOTO: (actor, record) => isManagerAt(actor, record, ['DRAFT', 'NEEDS_RECORD_UPDATE']),
  QUOTATION: (actor, record) => isManagerAt(actor, record, PROPOSAL_EDIT_STATUSES),
  INCIDENT_MINUTES: (actor, record) => isManagerAt(actor, record, PROPOSAL_EDIT_STATUSES),
  BOARD_MINUTES: isWaitingBoardHolder,
  CONSTRUCTION: (actor, record) => isManagerAt(actor, record, EXECUTION_STATUSES),
  ACCEPTANCE: (actor, record) =>
    isManagerAt(actor, record, EXECUTION_STATUSES) ||
    (record.status === 'PENDING_ACCEPTANCE' && acceptanceStepsHeldBy(record, actor.id).length > 0),
};
const SUPPORTED_PURPOSES = Object.keys(PURPOSE_RULES);

export const PURPOSE_LABEL: Readonly<Record<string, string>> = {
  SITE_PHOTO: 'Ảnh hiện trường',
  QUOTATION: 'Báo giá nhà thầu',
  INCIDENT_MINUTES: 'Biên bản ghi nhận sự việc',
  BOARD_MINUTES: 'Biên bản họp BQT',
  CONSTRUCTION: 'Thi công',
  ACCEPTANCE: 'Nghiệm thu',
};

const STEP_DENIED = 'Bước hiện tại không cho bạn tải loại tệp này.';
const OUT_OF_LOCATION = 'Ngoài phạm vi khu vực của bạn.';
const FOREIGN_FILE = 'Tệp đính kèm không hợp lệ hoặc không thuộc hồ sơ này.';
const WRONG_FILE_PURPOSE = 'Tệp phải thuộc loại: Ảnh hiện trường.';

const isAllowedMimeType = (value: string): value is AllowedMimeType =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(value);

const matchesMagicBytes = (content: Buffer, mimeType: AllowedMimeType): boolean => {
  const signature = MAGIC_BYTES[mimeType];
  const head = content.subarray(0, Math.min(MAGIC_LENGTH, content.length));
  return head.length >= signature.length && signature.every((byte, index) => byte === null || head[index] === byte);
};

export interface AttachmentContent {
  attachment: Attachment;
  content: Buffer;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly storage: FileStorage,
  ) {}

  /** Validates the file and the step, stores content and metadata + audit in one transaction. */
  async upload(
    actor: AuthenticatedUser,
    dto: UploadAttachmentDto,
    file: UploadedFileLike | undefined,
  ): Promise<AttachmentView> {
    this.assertSupported(dto);
    const content = this.validateFile(file);

    const key = randomUUID();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(RepairRecord);
        const record = await repo.findOne({ where: { id: dto.subjectId }, lock: { mode: 'pessimistic_read' } });
        if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
        this.assertCanUpload(actor, record, dto.purpose);

        const attachmentRepo = manager.getRepository(Attachment);
        await this.storage.save(key, content);
        const saved = await attachmentRepo.save(
          attachmentRepo.create({
            subjectType: SUBJECT_TYPE.REPAIR_RECORD,
            subjectId: record.id,
            buildingId: record.buildingId,
            purpose: dto.purpose,
            fileName: (file?.originalname ?? '').slice(0, MAX_FILE_NAME_LENGTH) || 'tep',
            mimeType: file?.mimetype ?? '',
            sizeBytes: file?.size ?? 0,
            contentRef: key,
            uploadedBy: actor.id,
          }),
        );
        await this.audit.record(manager, {
          subjectType: SUBJECT_TYPE.REPAIR_RECORD,
          subjectId: record.id,
          buildingId: record.buildingId,
          action: 'uploadAttachment',
          actorId: actor.id,
          entityVersion: record.version,
          reason: PURPOSE_LABEL[dto.purpose] ?? dto.purpose,
        });
        return toAttachmentView(saved);
      });
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
  }

  /** Content for the viewer; scope is always checked on the file's building, never by id alone. */
  async readContent(actor: AuthenticatedUser, id: string): Promise<AttachmentContent> {
    const attachment = await this.dataSource.getRepository(Attachment).findOneBy({ id });
    if (!attachment || !actor.buildingIds.includes(attachment.buildingId)) {
      throw notFound('Không tìm thấy tệp hoặc tệp ngoài phạm vi.');
    }
    try {
      return { attachment, content: await this.storage.read(attachment.contentRef) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw notFound('Không tìm thấy tệp hoặc tệp ngoài phạm vi.');
      }
      throw error;
    }
  }

  /** Request targets outside T2's single supported combination answer a stable reason. */
  private assertSupported(dto: UploadAttachmentDto): void {
    const supportedSubject = (SUPPORTED_SUBJECT_TYPES as readonly string[]).includes(dto.subjectType);
    const supportedPurpose = (SUPPORTED_PURPOSES as readonly string[]).includes(dto.purpose);
    if (!supportedSubject || !supportedPurpose) {
      throw badRequestWithReason('attachment_purpose_not_supported', 'Mục đích tệp chưa được hỗ trợ.');
    }
  }

  /** Same limits as the web demo: type, size, empty file and real content (magic bytes). */
  private validateFile(file: UploadedFileLike | undefined): Buffer {
    if (!file) throw fieldError('file', 'Tệp là bắt buộc.');
    const errors = new FieldErrors();
    if (!isAllowedMimeType(file.mimetype)) errors.add('file', 'Chỉ hỗ trợ ảnh JPEG/PNG/WebP hoặc PDF.');
    if (file.size > MAX_FILE_BYTES) errors.add('file', 'Tệp vượt quá 10 MB.');
    if (file.size === 0) errors.add('file', 'Tệp rỗng.');
    errors.throwIfAny();

    const mimeType = isAllowedMimeType(file.mimetype) ? file.mimetype : undefined;
    if (!mimeType || !matchesMagicBytes(file.buffer, mimeType)) {
      throw fieldError('file', 'Nội dung tệp không đúng định dạng JPEG/PNG/WebP/PDF đã khai báo.');
    }
    return file.buffer;
  }

  /** Mirrors demo `assertCanUpload`: building → location → the purpose's step and actor rule. */
  private assertCanUpload(actor: AuthenticatedUser, record: RepairRecord, purpose: string): void {
    if (record.locationId && actor.locationIds.length > 0 && !actor.locationIds.includes(record.locationId)) {
      throw forbidden(OUT_OF_LOCATION);
    }
    if (!PURPOSE_RULES[purpose]?.(actor, record)) throw forbiddenWithReason('attachment_step_denied', STEP_DENIED);
  }
}

/** Messages re-exported for the record draft validation (same wording as the demo). */
export const ATTACHMENT_DRAFT_MESSAGES = { FOREIGN_FILE, WRONG_FILE_PURPOSE } as const;
