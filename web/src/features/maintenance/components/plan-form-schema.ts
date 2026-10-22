import { z } from 'zod';
import { FREQUENCY_MONTHS, LIMITS } from '@/domain/constants';
import type { Frequency } from '@/domain/constants';

const FREQUENCIES = Object.keys(FREQUENCY_MONTHS) as [Frequency, ...Frequency[]];

const checklistRowSchema = z.object({
  id: z.string(),
  label: z
    .string()
    .trim()
    .min(LIMITS.CHECKLIST_LABEL_MIN, `Nhãn cần tối thiểu ${LIMITS.CHECKLIST_LABEL_MIN} ký tự.`)
    .max(LIMITS.CHECKLIST_LABEL_MAX, `Nhãn tối đa ${LIMITS.CHECKLIST_LABEL_MAX} ký tự.`),
  required: z.boolean(),
  inputType: z.enum(['CHECK', 'MEASUREMENT']),
  unit: z.string().trim().max(30, 'Đơn vị tối đa 30 ký tự.'),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
}).superRefine((row, ctx) => {
  if (row.inputType === 'MEASUREMENT' && !row.unit) {
    ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Mục đo cần có đơn vị.' });
  }
  if (row.minValue !== undefined && row.maxValue !== undefined && row.minValue > row.maxValue) {
    ctx.addIssue({ code: 'custom', path: ['maxValue'], message: 'Giá trị tối đa phải lớn hơn hoặc bằng tối thiểu.' });
  }
});

const basePlanSchema = z.object({
  itemId: z.string().min(1, 'Cần chọn hạng mục bảo trì.'),
  title: z
    .string()
    .trim()
    .min(LIMITS.TITLE_MIN, `Tên kế hoạch cần tối thiểu ${LIMITS.TITLE_MIN} ký tự.`)
    .max(LIMITS.TITLE_MAX, `Tên kế hoạch tối đa ${LIMITS.TITLE_MAX} ký tự.`),
  frequency: z.enum(FREQUENCIES, { message: 'Cần chọn chu kỳ.' }),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày gốc không hợp lệ.'),
  checklist: z.array(checklistRowSchema).min(1, 'Checklist cần ít nhất 1 mục.'),
  confirmationUserId: z.string().min(1, 'Cần chọn người xác nhận kỹ thuật.'),
  contractorName: z.string().max(LIMITS.CONTRACTOR_NAME_MAX, `Tên nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.`),
});

export type PlanFormValues = z.infer<typeof basePlanSchema>;

/** Plan form rules (spec 6.4, 6.6); the anchor date rule applies only while the schedule is editable. */
export const buildPlanSchema = (today: string, scheduleLocked: boolean) =>
  basePlanSchema.superRefine((values, ctx) => {
    if (!values.checklist.some((row) => row.required)) {
      ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'Checklist cần ít nhất 1 mục bắt buộc.' });
    }
    if (!scheduleLocked && values.anchorDate < today) {
      ctx.addIssue({ code: 'custom', path: ['anchorDate'], message: 'Ngày gốc không được trước hôm nay.' });
    }
  });

export const EMPTY_CHECKLIST_ROW = { id: '', label: '', required: true, inputType: 'CHECK' as const, unit: '', minValue: undefined, maxValue: undefined };
