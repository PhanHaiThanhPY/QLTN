import { buildPlanApiSchema, toPlanApiDefaults, toPlanApiPayload } from './plan-api-form-schema';
import type { PlanApiFormValues } from './plan-api-form-schema';
import { planDetailOf } from './__fixtures__/api-plans';

const values = (overrides: Partial<PlanApiFormValues> = {}): PlanApiFormValues => ({
  ...toPlanApiDefaults(undefined, '2026-10-27', 'itm-1'),
  name: 'Kiểm tra bơm',
  performerUserId: 'u-kt',
  reviewerUserId: 'u-kt2',
  checklist: [
    { id: '', label: 'Áp suất', required: true, inputType: 'MEASUREMENT', unit: 'bar', minValue: 2, maxValue: 6, photoRequired: true },
  ],
  ...overrides,
});

const issues = (input: PlanApiFormValues, locked = false) =>
  buildPlanApiSchema('2026-10-27', locked)
    .safeParse(input)
    .error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('plan api form (SPEC MT-S2 BR-MT2-01..04)', () => {
  it('checks the schedule range, the people and the start day', () => {
    expect(issues(values())).toEqual([]);
    expect(issues(values({ unit: 'WEEK', every: 9 }))).toEqual(['every']);
    expect(issues(values({ reviewerUserId: 'u-kt' }))).toEqual(['reviewerUserId']);
    expect(issues(values({ startDate: '2026-10-26' }))).toEqual(['startDate']);
    expect(issues(values({ startDate: '2026-10-26' }), true)).toEqual([]);
  });

  it('needs one required checklist item', () => {
    const row = { ...values().checklist[0], required: false };
    expect(issues(values({ checklist: [row] }))).toEqual(['checklist']);
  });

  it('sends the API checklist shape and the schedule only while a draft', () => {
    const draft = toPlanApiPayload(values(), false);
    expect(draft).toMatchObject({ itemId: 'itm-1', unit: 'MONTH', every: 1, startDate: '2026-10-27', contractorName: null });
    expect(draft.checklist).toEqual([{ label: 'Áp suất', required: true, kind: 'MEASUREMENT', unit: 'bar', min: 2, max: 6, photoRequired: true }]);
    const locked = toPlanApiPayload(values(), true);
    expect(Object.keys(locked)).toEqual(['name', 'performerUserId', 'reviewerUserId', 'contractorName', 'checklist']);
  });

  it('fills the form from a plan', () => {
    expect(toPlanApiDefaults(planDetailOf(), '2026-10-27')).toMatchObject({ name: 'Kiểm tra bơm hằng tháng', unit: 'MONTH', every: 1, startDate: '2026-11-12' });
  });
});
