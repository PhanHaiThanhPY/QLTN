import { z } from 'zod';
import { LIMITS } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import type { ApiChecklistItem, ApiPlanDetail } from '@/services/maintenance-plans-api';
import { checklistRowSchema, EMPTY_CHECKLIST_ROW } from '../components/plan-form-schema';
import type { ChecklistRowValues } from '../components/plan-form-schema';
import { SCHEDULE_LIMIT } from './plan-api-ui';

const CHECKLIST_MAX = 50;
const NAME_MESSAGE = `Tên kế hoạch từ ${LIMITS.TITLE_MIN} đến ${LIMITS.TITLE_MAX} ký tự.`;

const baseSchema = z.object({
  itemId: z.string().min(1, 'Cần chọn thiết bị.'),
  name: z.string().trim().min(LIMITS.TITLE_MIN, NAME_MESSAGE).max(LIMITS.TITLE_MAX, NAME_MESSAGE),
  unit: z.enum(['WEEK', 'MONTH']),
  every: z.number({ message: 'Cần nhập chu kỳ.' }).int('Chu kỳ là số nguyên.'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ.'),
  performerUserId: z.string().min(1, 'Cần chọn người thực hiện.'),
  reviewerUserId: z.string().min(1, 'Cần chọn người xác nhận.'),
  contractorName: z.string().max(LIMITS.CONTRACTOR_NAME_MAX, `Nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.`),
  checklist: z.array(checklistRowSchema).min(1, 'Danh mục kiểm cần ít nhất 1 mục.').max(CHECKLIST_MAX, `Danh mục kiểm tối đa ${CHECKLIST_MAX} mục.`),
});

export type PlanApiFormValues = z.infer<typeof baseSchema>;

/** SPEC MT-S2 BR-MT2-01..03 on the client; the start date only while the schedule is editable (a draft). */
export const buildPlanApiSchema = (today: IsoDate, scheduleLocked: boolean) =>
  baseSchema.superRefine((values, ctx) => {
    const max = SCHEDULE_LIMIT[values.unit];
    if (values.every < 1 || values.every > max) {
      ctx.addIssue({ code: 'custom', path: ['every'], message: `Chu kỳ ${values.unit === 'WEEK' ? 'tuần' : 'tháng'} từ 1 đến ${max}.` });
    }
    if (!values.checklist.some((row) => row.required)) {
      ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'Danh mục kiểm cần ít nhất 1 mục bắt buộc.' });
    }
    if (values.reviewerUserId && values.reviewerUserId === values.performerUserId) {
      ctx.addIssue({ code: 'custom', path: ['reviewerUserId'], message: 'Người xác nhận phải khác người thực hiện.' });
    }
    if (!scheduleLocked && values.startDate < today) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Ngày bắt đầu không được trước hôm nay.' });
    }
  });

const toRowValues = (item: ApiChecklistItem): ChecklistRowValues => ({
  id: item.id,
  label: item.label,
  required: item.required,
  inputType: item.kind,
  unit: item.unit ?? '',
  minValue: item.min ?? undefined,
  maxValue: item.max ?? undefined,
  photoRequired: item.photoRequired,
});

export const toPlanApiDefaults = (detail: ApiPlanDetail | undefined, today: IsoDate, itemId = ''): PlanApiFormValues => {
  if (!detail) {
    return {
      itemId,
      name: '',
      unit: 'MONTH',
      every: 1,
      startDate: today,
      performerUserId: '',
      reviewerUserId: '',
      contractorName: '',
      checklist: [{ ...EMPTY_CHECKLIST_ROW }],
    };
  }
  const { plan } = detail;
  return {
    itemId: plan.itemId,
    name: plan.name,
    unit: plan.schedule?.unit ?? 'MONTH',
    every: plan.schedule?.every ?? 1,
    startDate: plan.schedule?.anchorDate ?? today,
    performerUserId: plan.performerUserId,
    reviewerUserId: plan.reviewerUserId,
    contractorName: plan.contractorName ?? '',
    checklist: plan.checklist.map(toRowValues),
  };
};

/** The API body: schedule fields and the item only while the plan is a draft (BR-MT2-04). */
export const toPlanApiPayload = (values: PlanApiFormValues, scheduleLocked: boolean): Record<string, unknown> => ({
  name: values.name.trim(),
  performerUserId: values.performerUserId,
  reviewerUserId: values.reviewerUserId,
  contractorName: values.contractorName.trim() || null,
  checklist: values.checklist.map((row) => {
    const measured = row.inputType === 'MEASUREMENT';
    return {
      ...(row.id ? { id: row.id } : {}),
      label: row.label.trim(),
      required: row.required,
      kind: row.inputType,
      unit: measured ? row.unit.trim() : null,
      min: measured ? (row.minValue ?? null) : null,
      max: measured ? (row.maxValue ?? null) : null,
      photoRequired: row.photoRequired === true,
    };
  }),
  ...(scheduleLocked ? {} : { itemId: values.itemId, unit: values.unit, every: values.every, startDate: values.startDate }),
});
