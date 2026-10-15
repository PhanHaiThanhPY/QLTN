import { CONFIG_DUE_KINDS } from '@/domain/building-config';
import type { ConfigValues } from '@/domain/building-config';
import type { ApprovalStepKey, TaskKind } from '@/domain/constants';
import { assignmentRulesOf } from '@/domain/building-config';
import type { AssignmentRule, BuildingConfig } from '@/domain/types';
import { formatVndInput, parseVndInput } from '@/utils/money';

/** Text form state of a building configuration. */
export interface ConfigDraft {
  days: Partial<Record<TaskKind, string>>;
  workflowName: string;
  workflowDescription: string;
  approvalStepKeys: ApprovalStepKey[];
  assignmentRules: AssignmentRule[];
  emergencyLimit: string;
  emergencyHours: string;
  recentDays: string;
  repeatMin: string;
  priceRatio: string;
}

export const toDraft = (config: BuildingConfig): ConfigDraft => ({
  days: Object.fromEntries(CONFIG_DUE_KINDS.map(({ kind }) => [kind, String(config.taskDueDays[kind] ?? '')])),
  workflowName: config.workflowName ?? 'Quy trình sửa chữa và bảo trì',
  workflowDescription: config.workflowDescription ?? 'Quy trình xử lý hồ sơ theo từng bước được cấu hình cho tòa nhà.',
  approvalStepKeys: [...config.approvalStepKeys],
  assignmentRules: assignmentRulesOf(config.assignmentRules),
  emergencyLimit: formatVndInput(config.emergencyLimitVnd),
  emergencyHours: String(config.emergencyDocHours),
  recentDays: String(config.recentRepairDays),
  repeatMin: String(config.repeatMinRecords),
  priceRatio: String(config.priceRatio).replace('.', ','),
});

const toNumber = (value: string | undefined): number | undefined => {
  const text = (value ?? '').trim().replace(',', '.');
  if (text === '') return undefined;
  const number = Number(text);
  // Garbage input becomes "missing" so the service reports a field error instead of storing NaN.
  return Number.isFinite(number) ? number : undefined;
};

/** Payload for updateBuildingConfig; the service validates ranges. */
export const toConfigPayload = (draft: ConfigDraft, templateKey?: string, includeAssignmentRules = true): Record<string, unknown> & Partial<ConfigValues> => ({
  templateKey,
  workflowName: draft.workflowName,
  workflowDescription: draft.workflowDescription,
  taskDueDays: Object.fromEntries(CONFIG_DUE_KINDS.map(({ kind }) => [kind, toNumber(draft.days[kind])])),
  approvalStepKeys: [...draft.approvalStepKeys],
  ...(includeAssignmentRules ? { assignmentRules: draft.assignmentRules } : {}),
  emergencyLimitVnd: parseVndInput(draft.emergencyLimit),
  emergencyDocHours: toNumber(draft.emergencyHours),
  recentRepairDays: toNumber(draft.recentDays),
  repeatMinRecords: toNumber(draft.repeatMin),
  priceRatio: toNumber(draft.priceRatio),
});
