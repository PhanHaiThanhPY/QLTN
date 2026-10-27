import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { conflictWithReason, forbidden } from '../../common/errors';
import { FieldErrors } from '../../common/validation/field-errors';
import { effectiveResult } from '../../domain/maintenance-execution';
import { Attachment } from '../attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { RepairRecord } from '../records/entities/repair-record.entity';
import { RecordsService } from '../records/records.service';
import type { RepairFromItemDto } from './dto/maintenance-execution.dto';
import { INACTIVE_RECORD_STATUSES, MaintenanceExecutionService } from './maintenance-execution.service';
import { lockOccurrenceFor } from './occurrence-access';

const DESCRIPTION_MAX = 2000;

export interface RepairFromItemResult {
  recordId: string;
  code: string;
}

/**
 * MT-S3 BR-MT3-08: a draft repair record from one failed item, made by the plan's manager through the records'
 * own createDraft; at most one record in force per item (D-MT3-5), so a repeated request makes no second one.
 */
@Injectable()
export class RepairFromItemService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly records: RecordsService,
    private readonly execution: MaintenanceExecutionService,
  ) {}

  async create(actor: AuthenticatedUser, occurrenceId: string, dto: RepairFromItemDto): Promise<RepairFromItemResult> {
    return this.dataSource.transaction(async (manager) => {
      const { occurrence, item } = await lockOccurrenceFor(manager, actor, occurrenceId, dto.version, 'MANAGER', [
        'IN_PROGRESS',
        'PENDING_REVIEW',
        'REWORK',
      ]);
      if (!hasCapability(actor, 'RECORD_EDIT')) throw forbidden('Bạn không có quyền tạo hồ sơ sửa chữa.');
      const rule = occurrence.checklist.find((row) => row.id === dto.itemId);
      const entry = occurrence.work.entries.find((row) => row.itemId === dto.itemId);
      const errors = new FieldErrors();
      errors.when(
        !rule || !entry || effectiveResult(rule, entry) !== 'FAIL',
        'itemId',
        'Chỉ tạo hồ sơ sửa chữa từ một mục đang có kết quả Lỗi.',
      );
      errors.throwIfAny();
      const existing = await manager.getRepository(RepairRecord).findOne({
        where: {
          sourceOccurrenceId: occurrence.id,
          sourceChecklistItemId: dto.itemId,
          status: Not(In([...INACTIVE_RECORD_STATUSES])),
        },
      });
      if (existing) {
        throw conflictWithReason('item_has_record', `Mục này đã có hồ sơ sửa chữa ${existing.code} còn hiệu lực.`);
      }
      const label = rule?.label ?? dto.itemId;
      const photos = entry?.attachmentIds.length
        ? await manager.getRepository(Attachment).findBy({ id: In(entry.attachmentIds) })
        : [];
      const images = photos.filter((file) => file.mimeType.startsWith('image/'));
      const saved = await this.records.createDraft(
        manager,
        actor,
        {
          buildingId: occurrence.buildingId,
          locationId: dto.locationId ?? item.locationId,
          maintenanceItemId: item.id,
          noMaintenanceItem: false,
          title: (dto.title ?? `${item.code}: ${label}`).slice(0, 120),
          description: (dto.description ?? entry?.note ?? '').slice(0, DESCRIPTION_MAX),
          priority: dto.priority ?? 'NORMAL',
        },
        {
          sourceOccurrenceId: occurrence.id,
          sourceChecklistItemId: dto.itemId,
          auditReason: `Từ lượt bảo trì ${occurrence.code} · mục ${label}`,
          // The item's photos become the record's site photos; the stored files are shared, never copied.
          sitePhotos: async (tx, record) => {
            const repo = tx.getRepository(Attachment);
            const copies = await repo.save(
              images.map((file) =>
                repo.create({
                  subjectType: SUBJECT_TYPE.REPAIR_RECORD,
                  subjectId: record.id,
                  buildingId: record.buildingId,
                  purpose: 'SITE_PHOTO',
                  fileName: file.fileName,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                  contentRef: file.contentRef,
                  uploadedBy: actor.id,
                }),
              ),
            );
            return copies.map((copy) => copy.id);
          },
        },
      );
      await this.execution.save(manager, actor, occurrence, 'createRepairFromMaintenance', {
        reason: `${saved.code} · mục ${label}`,
      });
      return { recordId: saved.id, code: saved.code };
    });
  }
}
