import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope, hasCapability } from '../../common/auth/scope';
import { assertVersion, conflictWithReason, forbidden, notFound } from '../../common/errors';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type {
  CreateMaintenanceItemDto,
  ItemConditionDto,
  ItemDocumentsDto,
  ItemReasonDto,
  ListMaintenanceItemsQueryDto,
  UpdateMaintenanceItemDto,
} from './dto/maintenance-item.dto';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import {
  itemDetailOf,
  repairStatsOf,
  statsOf,
  toListRow,
  type ItemDetailView,
  type ItemListRowView,
} from './maintenance-item-reads';
import {
  assertUniqueCode,
  DUPLICATE_CODE,
  validateCode,
  validateItemFields,
  validateReason,
} from './maintenance-item-rules';
import { toItemView, type MaintenanceItemView } from './maintenance-item-view';

const NOT_FOUND = 'Không tìm thấy thiết bị.';
const MANAGE_DENIED = 'Chỉ BQL được quản lý thiết bị.';
const CONDITION_DENIED = 'Vai trò của bạn không cập nhật được tình trạng thiết bị.';
const INACTIVE_ITEM = 'Thiết bị đã ngừng dùng, không thể sửa.';
const ITEM_DOCUMENT = 'ITEM_DOCUMENT';
const UNIQUE_VIOLATION = '23505';
/** Audit trail shown on the item page ("Lịch sử thay đổi"). */
const AUDIT_LIMIT = 100;

export interface ItemDetailWithAudit extends ItemDetailView {
  audit: AuditEventView[];
}

/** Folds Vietnamese marks so "bom tang ap" finds "Bơm tăng áp". */
const fold = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

const isInLocationScope = (actor: AuthenticatedUser, item: MaintenanceItem): boolean =>
  actor.locationIds.length === 0 || actor.locationIds.includes(item.locationId);

/** Equipment of the caller's buildings (SPEC MT-S1). Reads follow building scope, writes also the location scope. */
@Injectable()
export class MaintenanceItemsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Every item in scope matching the filters, code order; the screen pages and applies its quick views (BR-MT-07). */
  async list(actor: AuthenticatedUser, query: ListMaintenanceItemsQueryDto): Promise<ItemListRowView[]> {
    if (query.buildingId && !actor.buildingIds.includes(query.buildingId)) return [];
    const buildingIds = query.buildingId ? [query.buildingId] : actor.buildingIds;
    if (buildingIds.length === 0) return [];
    const items = await this.dataSource.getRepository(MaintenanceItem).find({
      where: {
        buildingId: In(buildingIds),
        ...(query.includeInactive ? {} : { active: true }),
        ...(query.type ? { type: query.type } : {}),
      },
      order: { code: 'ASC' },
    });
    const search = query.q ? fold(query.q) : '';
    const matched = search ? items.filter((item) => fold(`${item.code} ${item.name}`).includes(search)) : items;
    const stats = await repairStatsOf(
      this.dataSource,
      matched.map((item) => item.id),
    );
    const today = vnDate(new Date());
    return matched.map((item) => toListRow(item, statsOf(stats, item.id), today));
  }

  async getDetail(actor: AuthenticatedUser, id: string): Promise<ItemDetailWithAudit> {
    const item = await this.dataSource.getRepository(MaintenanceItem).findOneBy({ id });
    if (!item || !actor.buildingIds.includes(item.buildingId)) throw notFound(NOT_FOUND);
    const [detail, audit] = await Promise.all([
      itemDetailOf(this.dataSource, item),
      this.audit.listForSubject(SUBJECT_TYPE.MAINTENANCE_ITEM, item.id, { page: 1, limit: AUDIT_LIMIT }),
    ]);
    return { ...detail, audit: audit.data };
  }

  async create(actor: AuthenticatedUser, dto: CreateMaintenanceItemDto): Promise<MaintenanceItemView> {
    assertBuildingInScope(actor, dto.buildingId);
    if (!hasCapability(actor, 'MAINTENANCE_MANAGE')) throw forbidden(MANAGE_DENIED);
    const code = dto.code.toUpperCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const errors = new FieldErrors();
        validateCode(errors, code);
        await assertUniqueCode(manager, errors, dto.buildingId, code);
        const fields = await validateItemFields(manager, actor, errors, dto.buildingId, dto);
        errors.throwIfAny();
        const repo = manager.getRepository(MaintenanceItem);
        const saved = await repo.save(
          repo.create({
            ...fields,
            buildingId: dto.buildingId,
            code,
            documentIds: [],
            condition: 'UNKNOWN',
            active: true,
            createdBy: actor.id,
            version: 1,
          }),
        );
        await this.record(manager, actor, saved, 'createMaintenanceItem');
        return toItemView(saved);
      });
    } catch (error) {
      // Two creates racing past the existence check: the unique index answers with the same field error.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw fieldError('code', DUPLICATE_CODE);
      }
      throw error;
    }
  }

  /** BR-MT-06: the code (and the building) never change; a code in the body is ignored. */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateMaintenanceItemDto): Promise<MaintenanceItemView> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.loadForWrite(manager, actor, id, dto.version, 'MAINTENANCE_MANAGE');
      if (!item.active) throw conflictWithReason('item_inactive', INACTIVE_ITEM);
      const errors = new FieldErrors();
      const fields = await validateItemFields(manager, actor, errors, item.buildingId, dto);
      errors.throwIfAny();
      Object.assign(item, fields);
      return this.saveWithAudit(manager, actor, item, 'updateMaintenanceItem');
    });
  }

  /** BR-MT-03: stops the item being chosen for new repairs; history stays. */
  async deactivate(actor: AuthenticatedUser, id: string, dto: ItemReasonDto): Promise<MaintenanceItemView> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.loadForWrite(manager, actor, id, dto.version, 'MAINTENANCE_MANAGE');
      if (!item.active) throw conflictWithReason('item_inactive', 'Thiết bị đã ngừng dùng.');
      this.assertReason('reason', 'Lý do', dto.reason);
      // MT-S2 BR-MT2-09: only once every plan of the item is a draft or ended.
      const running = await manager.getRepository(MaintenancePlan).find({
        where: { itemId: item.id, status: In(['ACTIVE', 'PAUSED']) },
        order: { code: 'ASC' },
      });
      if (running.length > 0) {
        throw conflictWithReason(
          'item_has_running_plans',
          `Kết thúc các kế hoạch bảo trì của thiết bị trước khi ngừng dùng. (${running.map((plan) => plan.code).join(', ')})`,
        );
      }
      item.active = false;
      item.deactivatedAt = new Date();
      item.deactivationReason = dto.reason;
      return this.saveWithAudit(manager, actor, item, 'deactivateMaintenanceItem', {
        fromStatus: 'ACTIVE',
        toStatus: 'INACTIVE',
        reason: dto.reason,
      });
    });
  }

  /** D-MT-5: undoes a deactivation, with a reason. */
  async reactivate(actor: AuthenticatedUser, id: string, dto: ItemReasonDto): Promise<MaintenanceItemView> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.loadForWrite(manager, actor, id, dto.version, 'MAINTENANCE_MANAGE');
      if (item.active) throw conflictWithReason('item_active', 'Thiết bị đang được dùng.');
      this.assertReason('reason', 'Lý do', dto.reason);
      item.active = true;
      item.deactivatedAt = null;
      item.deactivationReason = null;
      return this.saveWithAudit(manager, actor, item, 'reactivateMaintenanceItem', {
        fromStatus: 'INACTIVE',
        toStatus: 'ACTIVE',
        reason: dto.reason,
      });
    });
  }

  /** BR-MT-04: the audit row keeps old → new condition, the note, who and when. */
  async updateCondition(actor: AuthenticatedUser, id: string, dto: ItemConditionDto): Promise<MaintenanceItemView> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.loadForWrite(manager, actor, id, dto.version, 'ITEM_CONDITION');
      if (!item.active) throw conflictWithReason('item_inactive', 'Thiết bị đã ngừng dùng, không đổi được tình trạng.');
      this.assertReason('note', 'Ghi chú tình trạng', dto.note);
      const previous = item.condition;
      item.condition = dto.condition;
      item.conditionNote = dto.note;
      return this.saveWithAudit(manager, actor, item, 'updateItemCondition', {
        fromStatus: previous,
        toStatus: dto.condition,
        reason: dto.note,
      });
    });
  }

  /** BR-MT-05: the list may only hold ITEM_DOCUMENT files uploaded to this item; removing one unlinks it only. */
  async setDocuments(actor: AuthenticatedUser, id: string, dto: ItemDocumentsDto): Promise<MaintenanceItemView> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.loadForWrite(manager, actor, id, dto.version, 'MAINTENANCE_MANAGE');
      if (!item.active) throw conflictWithReason('item_inactive', INACTIVE_ITEM);
      const ids = [...new Set(dto.documentIds)];
      const files = ids.length ? await manager.getRepository(Attachment).findBy({ id: In(ids) }) : [];
      const valid = files.filter(
        (file) =>
          file.subjectType === SUBJECT_TYPE.MAINTENANCE_ITEM &&
          file.subjectId === item.id &&
          file.purpose === ITEM_DOCUMENT,
      );
      if (valid.length !== ids.length)
        throw fieldError('documentIds', 'Tài liệu không hợp lệ hoặc không thuộc thiết bị này.');
      item.documentIds = ids;
      return this.saveWithAudit(manager, actor, item, 'setItemDocuments');
    });
  }

  /**
   * Locks the item; out of the caller's buildings or location scope answers 404 (as repair records), then the
   * capability (403), then the version (409).
   */
  private async loadForWrite(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
    capability: 'MAINTENANCE_MANAGE' | 'ITEM_CONDITION',
  ): Promise<MaintenanceItem> {
    const item = await manager
      .getRepository(MaintenanceItem)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!item || !actor.buildingIds.includes(item.buildingId) || !isInLocationScope(actor, item)) {
      throw notFound(NOT_FOUND);
    }
    if (!hasCapability(actor, capability)) {
      throw forbidden(capability === 'MAINTENANCE_MANAGE' ? MANAGE_DENIED : CONDITION_DENIED);
    }
    assertVersion(item.version, version);
    return item;
  }

  private assertReason(field: string, label: string, value: string): void {
    const errors = new FieldErrors();
    validateReason(errors, field, label, value);
    errors.throwIfAny();
  }

  private async saveWithAudit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    item: MaintenanceItem,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<MaintenanceItemView> {
    item.version += 1;
    const saved = await manager.getRepository(MaintenanceItem).save(item);
    await this.record(manager, actor, saved, action, extra);
    return toItemView(saved);
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    item: MaintenanceItem,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.MAINTENANCE_ITEM,
      subjectId: item.id,
      buildingId: item.buildingId,
      action,
      actorId: actor.id,
      entityVersion: item.version,
      ...extra,
    });
  }
}
