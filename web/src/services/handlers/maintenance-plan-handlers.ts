import { FREQUENCY_MONTHS, LIMITS } from '@/domain/constants';
import type { Frequency } from '@/domain/constants';
import { assertNoFieldErrors, forbidden, validationError } from '@/domain/errors';
import type { FieldErrors } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { ChecklistTemplateItem, MaintenancePlan } from '@/domain/types';
import { FieldErrorCollector, asOptionalString, asRecord, asString } from '@/domain/validation';
import { addDays, toVnDate } from '@/utils/date';
import type { CommandHandler } from '../command-engine';
import { assertBuildingScope, assertLocationScope, nextCode } from '../command-context';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import { buildOccurrence, generateForBuildings, generateForPlan, resumeAfterPause } from './maintenance-generation';
import { commitOccurrence, commitSimple, loadPlanFor } from './maintenance-helpers';
import { isActiveUserInRole } from './repair-helpers';

const isFrequency = (value: unknown): value is Frequency => typeof value === 'string' && Object.hasOwn(FREQUENCY_MONTHS, value);

const parseChecklist = (value: unknown, errors: FieldErrorCollector): ChecklistTemplateItem[] => {
  const rows = Array.isArray(value) ? value.map(asRecord) : [];
  const items = rows.map((row) => ({
    id: asString(row.id) || newId('chk'),
    label: asString(row.label),
    required: row.required === true,
  }));
  errors.when(!items.some((item) => item.required), 'checklistTemplate', 'Checklist cần ít nhất 1 mục bắt buộc.');
  items.forEach((item, index) => {
    errors.text(`checklistTemplate.${index}.label`, `Nhãn mục ${index + 1}`, item.label, LIMITS.CHECKLIST_LABEL_MIN, LIMITS.CHECKLIST_LABEL_MAX);
  });
  errors.when(new Set(items.map((item) => item.id)).size !== items.length, 'checklistTemplate', 'Mã mục checklist bị trùng.');
  return items;
};

const validateAssignees = async (ctx: CommandContext, plan: MaintenancePlan, errors: FieldErrorCollector): Promise<void> => {
  const item = await ctx.db.maintenanceItems.get(plan.itemId);
  errors.when(!isActiveUserInRole(ctx, plan.confirmationUserId, 'TECH_CONFIRMER', plan.buildingId, item?.locationId), 'confirmationUserId', 'Người xác nhận phải đúng vai trò, đúng khu vực và còn hoạt động.');
  errors.when(plan.confirmationUserId === plan.managerUserId, 'confirmationUserId', 'Người xác nhận phải khác người quản lý.');
  errors.when((plan.contractorName ?? '').length > LIMITS.CONTRACTOR_NAME_MAX, 'contractorName', `Tên nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.`);
};

const createMaintenancePlan: CommandHandler = async (ctx, command) => {
  const payload = asRecord(command.payload);
  const item = await ctx.db.maintenanceItems.get(asString(payload.itemId));
  if (!item) throw validationError({ itemId: 'Cần chọn hạng mục bảo trì.' });
  assertBuildingScope(ctx, item.buildingId);
  assertLocationScope(ctx, item.buildingId, item.locationId);
  if (!hasCapability(ctx.actor, 'MAINTENANCE_MANAGE')) throw forbidden('Chỉ BQL được lập kế hoạch bảo trì.');

  const errors = new FieldErrorCollector().title('title', 'Tên kế hoạch', payload.title).date('anchorDate', payload.anchorDate, 'Ngày gốc');
  errors.when(!item.active, 'itemId', 'Hạng mục đã vô hiệu hóa.');
  errors.when(!isFrequency(payload.frequency), 'frequency', 'Chu kỳ không hợp lệ.');
  errors.when(errors.isEmpty && asString(payload.anchorDate) < ctx.today, 'anchorDate', 'Ngày gốc không được trước hôm nay.');
  const checklistTemplate = parseChecklist(payload.checklistTemplate, errors);
  const frequency = payload.frequency as Frequency;
  const anchorDate = asString(payload.anchorDate);
  const plan: MaintenancePlan = {
    id: newId('pln'),
    code: await nextCode(ctx, 'KH', 2),
    itemId: item.id,
    buildingId: item.buildingId,
    title: asString(payload.title),
    status: 'DRAFT',
    scheduleVersions: [{ revision: 1, effectiveFrom: anchorDate, anchorDate, frequency, intervalMonths: FREQUENCY_MONTHS[frequency] }],
    skippedPeriods: [],
    checklistTemplate,
    managerUserId: ctx.actor.id,
    confirmationUserId: asString(payload.confirmationUserId),
    contractorName: asOptionalString(payload.contractorName),
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await validateAssignees(ctx, plan, errors);
  assertNoFieldErrors(errors.errors);
  await commitSimple(ctx, 'MAINTENANCE_PLAN', null, plan, 'createMaintenancePlan');
  return { ok: true, subjectId: plan.id, data: { code: plan.code } };
};

const updateMaintenancePlan: CommandHandler = async (ctx, command) => {
  const plan = await loadPlanFor(ctx, command, 'updateMaintenancePlan');
  const payload = asRecord(command.payload);
  const errors = new FieldErrorCollector();
  const next: MaintenancePlan = { ...plan };
  if ('title' in payload) {
    errors.title('title', 'Tên kế hoạch', payload.title);
    next.title = asString(payload.title);
  }
  if ('checklistTemplate' in payload) next.checklistTemplate = parseChecklist(payload.checklistTemplate, errors);
  if ('confirmationUserId' in payload) next.confirmationUserId = asString(payload.confirmationUserId);
  if ('contractorName' in payload) next.contractorName = asOptionalString(payload.contractorName);
  if ('itemId' in payload && asString(payload.itemId) !== plan.itemId) {
    const item = await ctx.db.maintenanceItems.get(asString(payload.itemId));
    errors.when(plan.status !== 'DRAFT', 'itemId', 'Chỉ đổi hạng mục khi kế hoạch còn là nháp.');
    errors.when(!item || item.buildingId !== plan.buildingId || !item.active, 'itemId', 'Hạng mục phải đang hoạt động và cùng tòa nhà.');
    next.itemId = asString(payload.itemId);
  }
  const changesSchedule = 'frequency' in payload || 'anchorDate' in payload;
  if (changesSchedule && plan.status !== 'DRAFT') {
    errors.add('frequency', 'Kế hoạch đã kích hoạt: dùng “Đổi chu kỳ” để lập phiên bản lịch mới.');
  }
  if (changesSchedule && plan.status === 'DRAFT') {
    errors.date('anchorDate', payload.anchorDate, 'Ngày gốc').when(!isFrequency(payload.frequency), 'frequency', 'Chu kỳ không hợp lệ.');
    errors.when(errors.isEmpty && asString(payload.anchorDate) < ctx.today, 'anchorDate', 'Ngày gốc không được trước hôm nay.');
    if (errors.isEmpty) {
      const frequency = payload.frequency as Frequency;
      const anchorDate = asString(payload.anchorDate);
      next.scheduleVersions = [{ revision: 1, effectiveFrom: anchorDate, anchorDate, frequency, intervalMonths: FREQUENCY_MONTHS[frequency] }];
    }
  }
  await validateAssignees(ctx, next, errors);
  assertNoFieldErrors(errors.errors);
  await commitSimple(ctx, 'MAINTENANCE_PLAN', plan, next, 'updateMaintenancePlan');
  return { ok: true, subjectId: plan.id };
};

const activateMaintenancePlan: CommandHandler = async (ctx, command) => {
  const plan = await loadPlanFor(ctx, command, 'activateMaintenancePlan');
  const item = await ctx.db.maintenanceItems.get(plan.itemId);
  const errors = new FieldErrorCollector().when(!item?.active, 'itemId', 'Hạng mục đã vô hiệu hóa.');
  await validateAssignees(ctx, plan, errors);
  errors.when(!isActiveUserInRole(ctx, plan.managerUserId, 'BQL', plan.buildingId, item?.locationId), 'managerUserId', 'BQL quản lý đã ngừng hoạt động hoặc không đúng khu vực.');
  assertNoFieldErrors(errors.errors);
  let saved = await commitSimple(ctx, 'MAINTENANCE_PLAN', plan, { ...plan, status: 'ACTIVE', pausedAt: undefined }, 'activateMaintenancePlan');
  if (plan.status === 'PAUSED' && plan.pausedAt) saved = await resumeAfterPause(ctx, saved, toVnDate(plan.pausedAt));
  const { outcome } = await generateForPlan(ctx, saved, LIMITS.GENERATION_LIMIT);
  return { ok: true, subjectId: plan.id, data: { created: outcome.created, hasMore: outcome.hasMore } };
};

const pauseMaintenancePlan: CommandHandler = async (ctx, command) => {
  const plan = await loadPlanFor(ctx, command, 'pauseMaintenancePlan');
  const reason = asString(asRecord(command.payload).reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  await commitSimple(ctx, 'MAINTENANCE_PLAN', plan, { ...plan, status: 'PAUSED', pausedAt: ctx.now }, 'pauseMaintenancePlan', reason);
  return { ok: true, subjectId: plan.id };
};

const changeMaintenanceSchedule: CommandHandler = async (ctx, command) => {
  const plan = await loadPlanFor(ctx, command, 'changeMaintenanceSchedule');
  const payload = asRecord(command.payload);
  const effectiveFrom = asString(payload.effectiveFrom);
  const anchorDate = asString(payload.anchorDate);
  const reason = asString(payload.reason);
  const errors = new FieldErrorCollector()
    .date('effectiveFrom', effectiveFrom, 'Ngày hiệu lực')
    .date('anchorDate', anchorDate, 'Ngày gốc mới')
    .reason('reason', reason)
    .when(!isFrequency(payload.frequency), 'frequency', 'Chu kỳ không hợp lệ.');
  errors.when(!errors.errors.effectiveFrom && effectiveFrom < ctx.today, 'effectiveFrom', 'Ngày hiệu lực không được trước hôm nay.');
  errors.when(!errors.errors.anchorDate && !errors.errors.effectiveFrom && anchorDate < effectiveFrom, 'anchorDate', 'Ngày gốc mới không được trước ngày hiệu lực.');
  assertNoFieldErrors(errors.errors);
  const frequency = payload.frequency as Frequency;
  const revision = Math.max(...plan.scheduleVersions.map((version) => version.revision)) + 1;
  const dayBefore = addDays(effectiveFrom, -1);
  const next: MaintenancePlan = {
    ...plan,
    scheduleVersions: [...plan.scheduleVersions, { revision, effectiveFrom, anchorDate, frequency, intervalMonths: FREQUENCY_MONTHS[frequency] }],
    // Allow the new version to generate from effectiveFrom; existing keys still prevent duplicates.
    generatedThrough: plan.generatedThrough && plan.generatedThrough > dayBefore ? dayBefore : plan.generatedThrough,
  };
  const saved = await commitSimple(ctx, 'MAINTENANCE_PLAN', plan, next, 'changeMaintenanceSchedule', reason);
  const stale = await ctx.db.occurrences
    .where('planId')
    .equals(plan.id)
    .filter((row) => row.status === 'SCHEDULED' && row.occurrenceKind === 'SCHEDULED' && row.scheduledDate >= effectiveFrom)
    .toArray();
  for (const occurrence of stale) {
    await commitOccurrence(ctx, occurrence, { ...occurrence, reviewFlag: 'SCHEDULE_CHANGED' }, 'flagScheduleChanged', { reason });
  }
  if (saved.status === 'ACTIVE') await generateForPlan(ctx, saved, LIMITS.GENERATION_LIMIT);
  return { ok: true, subjectId: plan.id, data: { flagged: stale.length } };
};

const createManualOccurrence: CommandHandler = async (ctx, command) => {
  const plan = await loadPlanFor(ctx, command, 'createManualOccurrence');
  const payload = asRecord(command.payload);
  const scheduledDate = asString(payload.scheduledDate);
  const reason = asString(payload.reason);
  const errors = new FieldErrorCollector().date('scheduledDate', scheduledDate, 'Ngày thực hiện').reason('reason', reason);
  errors.when(!errors.errors.scheduledDate && scheduledDate < ctx.today, 'scheduledDate', 'Ngày thực hiện không được trước hôm nay.');
  assertNoFieldErrors(errors.errors);
  const occurrence = await buildOccurrence(ctx, plan, scheduledDate, 'MANUAL');
  await commitOccurrence(ctx, null, occurrence, 'createManualOccurrence', { reason });
  return { ok: true, subjectId: occurrence.id, data: { code: occurrence.code } };
};

/** BQL button “Cập nhật lịch”: same generation as the automatic run, for the user's buildings. */
const refreshSchedule: CommandHandler = async (ctx) => {
  if (!hasCapability(ctx.actor, 'MAINTENANCE_MANAGE')) throw forbidden('Chỉ BQL được cập nhật lịch thủ công.');
  const outcome = await generateForBuildings(ctx, ctx.actor.buildingIds);
  return { ok: true, data: { created: outcome.created, hasMore: outcome.hasMore } };
};

/** SYSTEM run triggered by any viewer opening a maintenance screen. */
const generateOccurrences: CommandHandler = async (ctx, command) => {
  const buildingIds = Array.isArray(asRecord(command.payload).buildingIds)
    ? (asRecord(command.payload).buildingIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  const fieldErrors: FieldErrors = {};
  if (!ctx.isSystem) fieldErrors.actor = 'Thao tác chỉ chạy dưới danh nghĩa hệ thống.';
  assertNoFieldErrors(fieldErrors);
  const outcome = await generateForBuildings(ctx, buildingIds);
  return { ok: true, data: { created: outcome.created, hasMore: outcome.hasMore } };
};

export const maintenancePlanHandlers: Record<string, CommandHandler> = {
  createMaintenancePlan,
  updateMaintenancePlan,
  activateMaintenancePlan,
  pauseMaintenancePlan,
  changeMaintenanceSchedule,
  createManualOccurrence,
  refreshSchedule,
  generateOccurrences,
};
