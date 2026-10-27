import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { badRequestWithReason, forbidden, forbiddenWithReason, notFound } from '../../common/errors';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { SUBJECT_TYPE, type SubjectType } from '../audit/entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { MaintenanceItem } from '../maintenance/entities/maintenance-item.entity';
import { RepairRecord } from '../records/entities/repair-record.entity';
import {
  ADVANCE_FOLLOW_UP_STATUSES,
  PROPOSAL_EDIT_STATUSES,
  SETTLEMENT_REQUEST_STATUSES,
} from '../records/record-actions';
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

/** The equipment document purpose (MT-S1 BR-MT-05), the only purpose of a MAINTENANCE_ITEM subject. */
const ITEM_DOCUMENT = 'ITEM_DOCUMENT';

const isManagerAt = (actor: AuthenticatedUser, record: RepairRecord, statuses: readonly string[]): boolean =>
  record.managerUserId === actor.id && hasCapability(actor, 'RECORD_EDIT') && statuses.includes(record.status);

/** Statuses where the manager reports construction or repair work (T11, T12, T15, T16; v1 BR-12). */
const EXECUTION_STATUSES: readonly string[] = ['IN_CONSTRUCTION', 'NEEDS_REPAIR'];
/** T11 also runs while an emergency is in progress (B06-S1), so construction files may be added then. */
const CONSTRUCTION_FILE_STATUSES: readonly string[] = [...EXECUTION_STATUSES, 'EMERGENCY_IN_PROGRESS'];

const isPaymentManager = (actor: AuthenticatedUser, record: RepairRecord, statuses: readonly string[]): boolean =>
  record.managerUserId === actor.id && hasCapability(actor, 'PAYMENT_RECORD') && statuses.includes(record.status);

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
  // B06-S1 BR-E-08: the BOARD holder's cost decision when closing a record not accepted at post-review.
  BOARD_DECISION: (actor, record) =>
    record.status === 'POST_REVIEW_REJECTED' && stepHolderOf(record, 'BOARD') === actor.id,
  CONSTRUCTION: (actor, record) => isManagerAt(actor, record, CONSTRUCTION_FILE_STATUSES),
  PAYMENT_REQUEST: (actor, record) => isPaymentManager(actor, record, ADVANCE_FOLLOW_UP_STATUSES),
  INVOICE: (actor, record) => isPaymentManager(actor, record, SETTLEMENT_REQUEST_STATUSES),
  // ADR-0001 R4: any PAYMENT_CONFIRM holder in scope, while an instalment can wait for its transfer.
  PAYMENT_PROOF: (actor, record) =>
    hasCapability(actor, 'PAYMENT_CONFIRM') &&
    [...ADVANCE_FOLLOW_UP_STATUSES, 'PENDING_PAYMENT'].includes(record.status),
  ACCEPTANCE: (actor, record) =>
    isManagerAt(actor, record, EXECUTION_STATUSES) ||
    (record.status === 'PENDING_ACCEPTANCE' && acceptanceStepsHeldBy(record, actor.id).length > 0),
};
const RECORD_PURPOSES = Object.keys(PURPOSE_RULES);

export const PURPOSE_LABEL: Readonly<Record<string, string>> = {
  SITE_PHOTO: 'Ảnh hiện trường',
  QUOTATION: 'Báo giá nhà thầu',
  INCIDENT_MINUTES: 'Biên bản ghi nhận sự việc',
  BOARD_MINUTES: 'Biên bản họp BQT',
  BOARD_DECISION: 'Quyết định xử lý chi phí của BQT',
  CONSTRUCTION: 'Thi công',
  ACCEPTANCE: 'Nghiệm thu',
  PAYMENT_REQUEST: 'Đề nghị thanh toán',
  INVOICE: 'Hóa đơn GTGT',
  PAYMENT_PROOF: 'Chứng từ chuyển khoản',
  ITEM_DOCUMENT: 'Tài liệu thiết bị',
};

/** The subject a file is stored against: its id, building (scope) and version (audit). */
interface UploadSubject {
  subjectType: SubjectType;
  id: string;
  buildingId: string;
  version: number;
}

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
        const subject =
          dto.subjectType === SUBJECT_TYPE.MAINTENANCE_ITEM
            ? await this.itemSubject(manager, actor, dto.subjectId)
            : await this.recordSubject(manager, actor, dto.subjectId, dto.purpose);

        const attachmentRepo = manager.getRepository(Attachment);
        await this.storage.save(key, content);
        const saved = await attachmentRepo.save(
          attachmentRepo.create({
            subjectType: subject.subjectType,
            subjectId: subject.id,
            buildingId: subject.buildingId,
            purpose: dto.purpose,
            fileName: (file?.originalname ?? '').slice(0, MAX_FILE_NAME_LENGTH) || 'tep',
            mimeType: file?.mimetype ?? '',
            sizeBytes: file?.size ?? 0,
            contentRef: key,
            uploadedBy: actor.id,
          }),
        );
        await this.audit.record(manager, {
          subjectType: subject.subjectType,
          subjectId: subject.id,
          buildingId: subject.buildingId,
          action: 'uploadAttachment',
          actorId: actor.id,
          entityVersion: subject.version,
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

  /** Repair records take the record purposes, equipment only ITEM_DOCUMENT; anything else answers a stable reason. */
  private assertSupported(dto: UploadAttachmentDto): void {
    const supported =
      (dto.subjectType === SUBJECT_TYPE.REPAIR_RECORD && RECORD_PURPOSES.includes(dto.purpose)) ||
      (dto.subjectType === SUBJECT_TYPE.MAINTENANCE_ITEM && dto.purpose === ITEM_DOCUMENT);
    if (!supported) {
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

  /** A repair record in scope whose current step lets the caller add this purpose. */
  private async recordSubject(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    purpose: string,
  ): Promise<UploadSubject> {
    const record = await manager
      .getRepository(RepairRecord)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_read' } });
    if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
    this.assertCanUpload(actor, record, purpose);
    return {
      subjectType: SUBJECT_TYPE.REPAIR_RECORD,
      id: record.id,
      buildingId: record.buildingId,
      version: record.version,
    };
  }

  /** BR-MT-05: a BQL with MAINTENANCE_MANAGE, in the item's building and location scope, while the item is in use. */
  private async itemSubject(manager: EntityManager, actor: AuthenticatedUser, id: string): Promise<UploadSubject> {
    const item = await manager
      .getRepository(MaintenanceItem)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_read' } });
    if (!item || !actor.buildingIds.includes(item.buildingId)) throw notFound('Không tìm thấy thiết bị.');
    if (actor.locationIds.length > 0 && !actor.locationIds.includes(item.locationId)) throw forbidden(OUT_OF_LOCATION);
    if (!hasCapability(actor, 'MAINTENANCE_MANAGE') || !item.active) {
      throw forbiddenWithReason('attachment_step_denied', STEP_DENIED);
    }
    return {
      subjectType: SUBJECT_TYPE.MAINTENANCE_ITEM,
      id: item.id,
      buildingId: item.buildingId,
      version: item.version,
    };
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
