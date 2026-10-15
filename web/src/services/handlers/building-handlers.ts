import { ASSIGNMENT_ROLES, CONFIG_DUE_KINDS, CONFIG_LIMITS, approvalStepKeysOf, assignmentRulesOf, defaultConfigValues, diffConfig, templateValues } from '@/domain/building-config';
import type { ConfigValues } from '@/domain/building-config';
import { APPROVAL_STEPS, BUSINESS_WORKFLOW_STEPS, DEFAULT_APPROVAL_STEP_KEYS } from '@/domain/constants';
import type { ApprovalStepKey, BusinessWorkflowStepKey, TaskKind } from '@/domain/constants';
import { assertNoFieldErrors, conflict, forbidden, notFound, validationError } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { AssignmentRule, Building, BuildingConfig, Location, WorkflowStageConfig, WorkflowStageKey, WorkflowStepBinding } from '@/domain/types';
import { FieldErrorCollector, asNumber, asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import type { Command, CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { writeAudit } from '../command-context';
import { newId } from '../runtime';

/** Stored configuration of a building, or the shared defaults when none was saved yet. */
export const loadBuildingConfig = async (ctx: CommandContext, buildingId: string): Promise<BuildingConfig> => {
  const stored = await ctx.db.buildingConfigs.get(buildingId);
  return stored
    ? { ...stored, approvalStepKeys: approvalStepKeysOf(stored.approvalStepKeys), assignmentRules: assignmentRulesOf(stored.assignmentRules) }
    : { buildingId, ...defaultConfigValues(), assignmentRules: [], version: 0, updatedAt: ctx.now, updatedBy: ctx.actor.id };
};
const requireBuilding = async (ctx: CommandContext, buildingId: string, capability: 'BUILDING_CONFIG' | 'ACCOUNT_MANAGE'): Promise<Building> => {
  const building = await ctx.db.buildings.get(buildingId);
  if (!building || !ctx.actor.buildingIds.includes(buildingId)) throw notFound('Không tìm thấy tòa nhà trong phạm vi của bạn.');
  if (!hasCapability(ctx.actor, capability)) throw forbidden('Vai trò của bạn không cấu hình được tòa nhà.');
  return building;
};
const audit = (ctx: CommandContext, buildingId: string, action: string, version: number, reason?: string) =>
  writeAudit(ctx, { subjectType: 'BUILDING', subjectId: buildingId, buildingId, action, entityVersion: version, reason });

const intIn = (errors: FieldErrorCollector, field: string, value: unknown, min: number, max: number, label: string): number => {
  const number = asNumber(value);
  errors.when(number === undefined || !Number.isInteger(number) || number < min || number > max, field, `${label} là số nguyên từ ${min} đến ${max}.`);
  return number ?? min;
};

const parseApprovalStepKeys = (errors: FieldErrorCollector, value: unknown): ApprovalStepKey[] => {
  if (value === undefined) return [...DEFAULT_APPROVAL_STEP_KEYS];
  const keys = asStringArray(value);
  const allowed = new Set(APPROVAL_STEPS.map((step) => step.key));
  const isStepKey = (key: string): key is ApprovalStepKey => allowed.has(key as ApprovalStepKey);
  const valid = keys.length > 0 && keys.length <= APPROVAL_STEPS.length && keys.every(isStepKey) && new Set(keys).size === keys.length;
  errors.when(!valid, 'approvalStepKeys', 'Chuỗi phê duyệt cần ít nhất một bước, không trùng bước và chỉ dùng vai trò đã cấu hình.');
  return valid ? keys.filter(isStepKey) : [...DEFAULT_APPROVAL_STEP_KEYS];
};

const parseWorkflowStages = (errors: FieldErrorCollector, value: unknown): WorkflowStageConfig[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.add('workflowStages', 'Cấu hình các giai đoạn workflow không hợp lệ.');
    return undefined;
  }
  const allowed = new Set<WorkflowStageKey>(['INTAKE', 'PROPOSAL', 'ACCEPTANCE', 'PAYMENT']);
  const steps = new Set(APPROVAL_STEPS.map((step) => step.key));
  const parsed = value.map((entry, index) => {
    const row = asRecord(entry);
    const key = asString(row.key) as WorkflowStageKey;
    const approvalStepKeys = asStringArray(row.approvalStepKeys).filter((step): step is ApprovalStepKey => steps.has(step as ApprovalStepKey));
    const businessSteps = new Set(BUSINESS_WORKFLOW_STEPS.map((step) => step.key));
    const businessStepKeys = asStringArray(row.businessStepKeys).filter((step): step is BusinessWorkflowStepKey => businessSteps.has(step as BusinessWorkflowStepKey));
    const rawBindings = Array.isArray(row.stepBindings)
      ? row.stepBindings
      : businessStepKeys.map((businessStepKey) => ({
        businessStepKey,
        approvalStepKey: BUSINESS_WORKFLOW_STEPS.find((step) => step.key === businessStepKey)?.defaultApprovalStepKey,
      }));
    const stepBindings = rawBindings.map((value) => {
      const binding = asRecord(value);
      const businessStepKey = asString(binding.businessStepKey) as BusinessWorkflowStepKey;
      const approvalStepKey = asOptionalString(binding.approvalStepKey) as ApprovalStepKey | undefined;
      return { businessStepKey, ...(approvalStepKey ? { approvalStepKey } : {}) };
    }).filter((binding): binding is WorkflowStepBinding => businessSteps.has(binding.businessStepKey as BusinessWorkflowStepKey));
    errors.when(!allowed.has(key), `workflowStages.${index}.key`, 'Giai đoạn workflow không hợp lệ.');
    errors.when(approvalStepKeys.length === 0 || new Set(approvalStepKeys).size !== approvalStepKeys.length, `workflowStages.${index}.approvalStepKeys`, 'Mỗi giai đoạn cần ít nhất một bước duyệt và không được trùng bước.');
    errors.when(new Set(businessStepKeys).size !== businessStepKeys.length, `workflowStages.${index}.businessStepKeys`, 'Các bước nghiệp vụ trong một giai đoạn không được trùng nhau.');
    errors.when(new Set(stepBindings.map((binding) => binding.businessStepKey)).size !== stepBindings.length, `workflowStages.${index}.stepBindings`, 'Mỗi bước nghiệp vụ chỉ được gắn một lần trong giai đoạn.');
    errors.when(stepBindings.some((binding) => binding.approvalStepKey !== undefined && !approvalStepKeys.includes(binding.approvalStepKey)), `workflowStages.${index}.stepBindings`, 'Bước nghiệp vụ chỉ được gắn với bước phê duyệt đang có trong giai đoạn.');
    return {
      key,
      label: asString(row.label),
      description: asString(row.description),
      approvalStepKeys,
      businessStepKeys,
      stepBindings,
      enabled: row.enabled !== false,
    };
  });
  const keys = parsed.map((stage) => stage.key);
  errors.when(new Set(keys).size !== keys.length, 'workflowStages', 'Các giai đoạn workflow không được trùng nhau.');
  return parsed;
};

/** Validates configuration values sent by the form or taken from a template/another building. */
const parseValues = (payload: Record<string, unknown>): ConfigValues => {
  const errors = new FieldErrorCollector();
  const rawDays = asRecord(payload.taskDueDays);
  const taskDueDays: Partial<Record<TaskKind, number>> = {};
  const approvalStepKeys = parseApprovalStepKeys(errors, payload.approvalStepKeys);
  const workflowStages = parseWorkflowStages(errors, payload.workflowStages);
  for (const { kind, label } of CONFIG_DUE_KINDS) {
    taskDueDays[kind] = intIn(errors, `taskDueDays.${kind}`, rawDays[kind], 1, CONFIG_LIMITS.DUE_DAYS_MAX, label);
  }
  errors.amount('emergencyLimitVnd', payload.emergencyLimitVnd, 'Hạn mức khẩn cấp');
  const hours = intIn(errors, 'emergencyDocHours', payload.emergencyDocHours, CONFIG_LIMITS.EMERGENCY_HOURS_MIN, CONFIG_LIMITS.EMERGENCY_HOURS_MAX, 'Số giờ bổ sung hồ sơ');
  const recent = intIn(errors, 'recentRepairDays', payload.recentRepairDays, 7, CONFIG_LIMITS.RECENT_DAYS_MAX, 'Số ngày tính tái hỏng');
  const repeat = intIn(errors, 'repeatMinRecords', payload.repeatMinRecords, CONFIG_LIMITS.REPEAT_MIN, CONFIG_LIMITS.REPEAT_MAX, 'Số lần hỏng lặp lại');
  const ratio = asNumber(payload.priceRatio);
  errors.when(
    ratio === undefined || ratio < CONFIG_LIMITS.PRICE_RATIO_MIN || ratio > CONFIG_LIMITS.PRICE_RATIO_MAX,
    'priceRatio',
    `Hệ số giá bất thường từ ${CONFIG_LIMITS.PRICE_RATIO_MIN} đến ${CONFIG_LIMITS.PRICE_RATIO_MAX}.`,
  );
  const rawRules = payload.assignmentRules;
  let assignmentRules: AssignmentRule[] | undefined;
  if (rawRules !== undefined) {
    errors.when(!Array.isArray(rawRules), 'assignmentRules', 'Quy tắc phân công không hợp lệ.');
    if (Array.isArray(rawRules)) {
      assignmentRules = rawRules.map((value, index) => {
        const row = asRecord(value);
        const role = asString(row.role);
        const locationIds = asStringArray(row.locationIds);
        const priority = asNumber(row.priority);
        errors.when(!asString(row.departmentId), `assignmentRules.${index}.departmentId`, 'Cần chọn bộ phận.');
        errors.when(!ASSIGNMENT_ROLES.includes(role as (typeof ASSIGNMENT_ROLES)[number]), `assignmentRules.${index}.role`, 'Vai trò phân công không hợp lệ.');
        errors.when(priority === undefined || !Number.isInteger(priority) || priority < 1, `assignmentRules.${index}.priority`, 'Thứ tự ưu tiên phải là số nguyên dương.');
        return {
          departmentId: asString(row.departmentId),
          role: role as AssignmentRule['role'],
          locationIds: locationIds.length > 0 ? locationIds : undefined,
          priority: priority ?? index + 1,
        };
      });
      const uniqueKeys = new Set(assignmentRules.map((rule) => `${rule.departmentId}|${rule.role}|${(rule.locationIds ?? []).join(',')}`));
      errors.when(uniqueKeys.size !== assignmentRules.length, 'assignmentRules', 'Không được tạo quy tắc phân công trùng nhau.');
    }
  }
  assertNoFieldErrors(errors.errors);
  return {
    templateKey: asOptionalString(payload.templateKey),
    ...(payload.workflowName !== undefined ? { workflowName: asOptionalString(payload.workflowName) } : {}),
    ...(payload.workflowDescription !== undefined ? { workflowDescription: asOptionalString(payload.workflowDescription) } : {}),
    ...(workflowStages !== undefined ? { workflowStages } : {}),
    taskDueDays,
    approvalStepKeys,
    emergencyLimitVnd: asNumber(payload.emergencyLimitVnd) as number,
    emergencyDocHours: hours,
    recentRepairDays: recent,
    repeatMinRecords: repeat,
    priceRatio: ratio as number,
    ...(assignmentRules === undefined ? {} : { assignmentRules }),
  };
};

const validateAssignmentRules = async (ctx: CommandContext, buildingId: string, rules: readonly AssignmentRule[] | undefined): Promise<void> => {
  if (!rules) return;
  const departments = await ctx.db.departments.bulkGet([...new Set(rules.map((rule) => rule.departmentId))]);
  const departmentById = new Map(departments.filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => [row.id, row]));
  const locations = await ctx.db.locations.where('buildingId').equals(buildingId).toArray();
  const locationIds = new Set(locations.map((location) => location.id));
  const errors = new FieldErrorCollector();
  rules.forEach((rule, index) => {
    const department = departmentById.get(rule.departmentId);
    errors.when(!department, `assignmentRules.${index}.departmentId`, 'Bộ phận không tồn tại.');
    errors.when(Boolean(department) && !department?.buildingIds.includes(buildingId), `assignmentRules.${index}.departmentId`, 'Bộ phận chưa được gán vào tòa nhà này.');
    errors.when((rule.locationIds ?? []).some((id) => !locationIds.has(id)), `assignmentRules.${index}.locationIds`, 'Vị trí phải thuộc tòa nhà đang cấu hình.');
  });
  assertNoFieldErrors(errors.errors);
};

/** Saves a new configuration version; open records keep the due days they were created with. */
const saveConfig = async (ctx: CommandContext, command: Command, values: ConfigValues, action: string) => {
  const current = await loadBuildingConfig(ctx, command.subjectId ?? '');
  if (command.expectedVersion === undefined) throw conflict('Thiếu phiên bản dữ liệu (expectedVersion). Vui lòng tải lại.');
  if (command.expectedVersion !== current.version) throw conflict();
  await validateAssignmentRules(ctx, current.buildingId, values.assignmentRules);
  const next: BuildingConfig = {
    ...current,
    ...values,
    // Identity always comes from the target row, never from the values (they may be copied from another building).
    buildingId: current.buildingId,
    assignmentRules: values.assignmentRules ?? current.assignmentRules,
    version: current.version + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.actor.id,
  };
  const changes = diffConfig(current, next);
  await ctx.db.buildingConfigs.put(next);
  const reason = changes.length === 0 ? 'Không có thay đổi giá trị.' : changes.map((row) => `${row.label}: ${row.from} → ${row.to}`).join('\n');
  await audit(ctx, next.buildingId, action, next.version, reason);
  return { ok: true as const, subjectId: next.buildingId, data: { changes: changes.length } };
};

const updateBuildingConfig: CommandHandler = async (ctx, command) => {
  await requireBuilding(ctx, command.subjectId ?? '', 'BUILDING_CONFIG');
  return saveConfig(ctx, command, parseValues(asRecord(command.payload)), 'updateBuildingConfig');
};

/** Updates the same workflow payload for several buildings atomically. */
const updateWorkflowConfig: CommandHandler = async (ctx, command) => {
  const payload = asRecord(command.payload);
  const targets = Array.isArray(payload.targets) ? payload.targets : [];
  if (targets.length === 0) throw validationError({ targets: 'Cần có ít nhất một tòa nhà để áp dụng workflow.' });
  const seen = new Set<string>();
  const results = [];
  for (const entry of targets) {
    const target = asRecord(entry);
    const buildingId = asString(target.buildingId);
    const expectedVersion = asNumber(target.expectedVersion);
    if (!buildingId || expectedVersion === undefined || seen.has(buildingId)) {
      throw validationError({ targets: 'Danh sách tòa nhà áp dụng workflow không hợp lệ.' });
    }
    seen.add(buildingId);
    await requireBuilding(ctx, buildingId, 'BUILDING_CONFIG');
    const values = parseValues(asRecord(target.values));
    results.push(await saveConfig(ctx, { ...command, subjectId: buildingId, expectedVersion }, values, 'updateWorkflowConfig'));
  }
  return { ok: true as const, subjectId: command.subjectId, data: { updated: results.length } };
};

/** Copies a shared template or another building's configuration (only buildings in the actor's scope). */
const applyConfigTemplate: CommandHandler = async (ctx, command) => {
  await requireBuilding(ctx, command.subjectId ?? '', 'BUILDING_CONFIG');
  const payload = asRecord(command.payload);
  const sourceBuildingId = asOptionalString(payload.sourceBuildingId);
  if (sourceBuildingId) {
    if (!ctx.actor.buildingIds.includes(sourceBuildingId)) throw validationError({ sourceBuildingId: 'Chỉ sao chép từ tòa trong phạm vi của bạn.' });
    const { buildingId: _buildingId, version: _version, updatedAt: _updatedAt, updatedBy: _updatedBy, ...sourceValues } = await loadBuildingConfig(ctx, sourceBuildingId);
    const values: ConfigValues = { ...sourceValues, approvalStepKeys: approvalStepKeysOf(sourceValues.approvalStepKeys) };
    return saveConfig(ctx, command, values, 'applyConfigTemplate');
  }
  const values = templateValues(asString(payload.templateKey));
  if (!values) throw validationError({ templateKey: 'Cần chọn cấu hình mẫu.' });
  return saveConfig(ctx, command, values, 'applyConfigTemplate');
};

/** Only the shared administrator adds buildings; the new building starts from a template. */
const createBuilding: CommandHandler = async (ctx, command) => {
  if (!hasCapability(ctx.actor, 'ACCOUNT_MANAGE')) throw forbidden('Chỉ quản trị viên chung được thêm tòa nhà.');
  const payload = asRecord(command.payload);
  const code = asString(payload.code).toUpperCase();
  const errors = new FieldErrorCollector()
    .text('code', 'Mã tòa', code, 1, 10)
    .title('name', 'Tên tòa nhà', payload.name)
    .text('address', 'Địa chỉ', payload.address, 5, 200);
  errors.when((await ctx.db.buildings.where('code').equals(code).count()) > 0, 'code', 'Mã tòa đã tồn tại.');
  const values = templateValues(asString(payload.templateKey) || 'STANDARD');
  errors.when(!values, 'templateKey', 'Cấu hình mẫu không hợp lệ.');
  assertNoFieldErrors(errors.errors);
  const building: Building = { id: newId('bld'), code, name: asString(payload.name), address: asString(payload.address) };
  await ctx.db.buildings.add(building);
  await ctx.db.buildingConfigs.put({ buildingId: building.id, ...(values as ConfigValues), version: 1, updatedAt: ctx.now, updatedBy: ctx.actor.id });
  // The creator gets the building in scope to assign people and locations next.
  await ctx.db.users.update(ctx.actor.id, { buildingIds: [...ctx.actor.buildingIds, building.id], version: ctx.actor.version + 1 });
  await audit(ctx, building.id, 'createBuilding', 1, `Theo mẫu ${values?.templateKey ?? ''}`);
  return { ok: true, subjectId: building.id };
};

const updateBuilding: CommandHandler = async (ctx, command) => {
  const building = await requireBuilding(ctx, command.subjectId ?? '', 'ACCOUNT_MANAGE');
  const payload = asRecord(command.payload);
  assertNoFieldErrors(new FieldErrorCollector().title('name', 'Tên tòa nhà', payload.name).text('address', 'Địa chỉ', payload.address, 5, 200).errors);
  await ctx.db.buildings.put({ ...building, name: asString(payload.name), address: asString(payload.address) });
  await audit(ctx, building.id, 'updateBuilding', (await loadBuildingConfig(ctx, building.id)).version);
  return { ok: true, subjectId: building.id };
};

const validateLocation = async (ctx: CommandContext, buildingId: string, payload: Record<string, unknown>, currentId?: string) => {
  const floor = asString(payload.floor);
  const name = asString(payload.name);
  const zone = asOptionalString(payload.zone);
  const errors = new FieldErrorCollector().text('floor', 'Tầng', floor, 1, 20).title('name', 'Tên vị trí', name);
  errors.when((zone ?? '').length > 60, 'zone', 'Khu vực tối đa 60 ký tự.');
  const duplicate = await ctx.db.locations
    .where('buildingId')
    .equals(buildingId)
    .filter((row) => row.id !== currentId && row.floor === floor && row.name.toLowerCase() === name.toLowerCase())
    .count();
  errors.when(duplicate > 0, 'name', 'Tầng này đã có vị trí cùng tên.');
  assertNoFieldErrors(errors.errors);
  return { floor, name, zone };
};

const createLocation: CommandHandler = async (ctx, command) => {
  const building = await requireBuilding(ctx, command.subjectId ?? '', 'BUILDING_CONFIG');
  const fields = await validateLocation(ctx, building.id, asRecord(command.payload));
  const location: Location = { id: newId('loc'), buildingId: building.id, ...fields, active: true };
  await ctx.db.locations.add(location);
  await audit(ctx, building.id, 'createLocation', 0, `${fields.name} · tầng ${fields.floor}`);
  return { ok: true, subjectId: building.id, data: { locationId: location.id } };
};

const loadLocation = async (ctx: CommandContext, command: Command): Promise<Location> => {
  const location = await ctx.db.locations.get(asString(asRecord(command.payload).locationId));
  if (!location || location.buildingId !== command.subjectId) throw notFound('Không tìm thấy vị trí.');
  return location;
};

const updateLocation: CommandHandler = async (ctx, command) => {
  const building = await requireBuilding(ctx, command.subjectId ?? '', 'BUILDING_CONFIG');
  const location = await loadLocation(ctx, command);
  const fields = await validateLocation(ctx, building.id, asRecord(command.payload), location.id);
  await ctx.db.locations.put({ ...location, ...fields });
  await audit(ctx, building.id, 'updateLocation', 0, `${fields.name} · tầng ${fields.floor}`);
  return { ok: true, subjectId: building.id };
};

/** Inactive locations stay on existing records and items but are hidden from new selections. */
const setLocationActive: CommandHandler = async (ctx, command) => {
  const building = await requireBuilding(ctx, command.subjectId ?? '', 'BUILDING_CONFIG');
  const location = await loadLocation(ctx, command);
  const active = asRecord(command.payload).active === true;
  await ctx.db.locations.put({ ...location, active });
  await audit(ctx, building.id, active ? 'activateLocation' : 'deactivateLocation', 0, `${location.name} · tầng ${location.floor}`);
  return { ok: true, subjectId: building.id };
};

export const buildingHandlers: Record<string, CommandHandler> = {
  updateBuildingConfig,
  updateWorkflowConfig,
  applyConfigTemplate,
  createBuilding,
  updateBuilding,
  createLocation,
  updateLocation,
  setLocationActive,
};
