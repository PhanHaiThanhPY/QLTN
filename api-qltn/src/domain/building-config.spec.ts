import {
  approvalDefinitionsOf,
  type ConfigValues,
  diffConfig,
  requiredStepCapabilities,
  sortAssignmentRules,
  templateValues,
  validateConfigRules,
} from './building-config';

const base = (): ConfigValues => {
  const values = templateValues('STANDARD');
  if (!values) throw new Error('STANDARD template missing');
  return values;
};

const fields = (values: ConfigValues) => validateConfigRules(values).map((e) => e.field);

describe('building-config', () => {
  it('builds a valid configuration from every template', () => {
    for (const key of ['STANDARD', 'RESIDENTIAL', 'OFFICE']) {
      const values = templateValues(key);
      expect(values).toBeDefined();
      expect(validateConfigRules(values as ConfigValues)).toEqual([]);
    }
    expect(templateValues('NOPE')).toBeUndefined();
  });

  it('fills due days missing from a template with the defaults', () => {
    expect(templateValues('RESIDENTIAL')?.taskDueDays).toEqual({
      CONFIRM_RECORD: 2,
      APPROVE_PROPOSAL: 2,
      REVIEW_ACCEPTANCE: 2,
      APPROVE_PAYMENT: 3,
      REVIEW_MAINTENANCE: 2,
    });
  });

  it('keeps system steps available and never lets a custom step override one', () => {
    const steps = approvalDefinitionsOf([
      { key: 'TECH', label: 'Giả', actor: 'X', role: 'BQL', status: 'PENDING_CUSTOM_APPROVAL' },
      { key: 'LEGAL', label: 'Pháp chế', actor: 'PC', role: 'OWNERS_BOARD', status: 'PENDING_CUSTOM_APPROVAL' },
    ]);
    expect(steps.map((s) => s.key)).toEqual(['TECH_CONFIRM', 'TECH', 'BOARD', 'LEGAL']);
    expect(steps.find((s) => s.key === 'TECH')?.role).toBe('TECH_CONSULTANT');
  });

  it('rejects a chain with unknown or duplicated steps', () => {
    expect(fields({ ...base(), approvalStepKeys: ['TECH', 'TECH'] })).toContain('approvalStepKeys');
    expect(fields({ ...base(), approvalStepKeys: ['GHOST'] })).toContain('approvalStepKeys');
    expect(fields({ ...base(), approvalStepKeys: [] })).toContain('approvalStepKeys');
  });

  it('requires the step role to hold the decision capability of every stage using it', () => {
    const values = base();
    values.workflowApprovalSteps.push({
      key: 'BQL_SIGN',
      label: 'BQL ký',
      actor: 'BQL',
      role: 'BQL',
      status: 'PENDING_CUSTOM_APPROVAL',
    });
    values.workflowStages[1].approvalStepKeys.push('BQL_SIGN');
    expect(requiredStepCapabilities(values.workflowStages, 'BQL_SIGN')).toEqual(['PROPOSAL_DECIDE']);
    expect(fields(values)).toContain('workflowApprovalSteps.3.role');
  });

  it('rejects a business step bound to an approval step outside its stage', () => {
    const values = base();
    values.workflowStages[0].stepBindings = [{ businessStepKey: 'CONFIRM_CONDITION', approvalStepKey: 'BOARD' }];
    expect(fields(values)).toContain('workflowStages.0.stepBindings');
  });

  it('rejects duplicated assignment rules regardless of location order', () => {
    const rule = { departmentId: 'd1', role: 'BQL' as const, priority: 1 };
    const values = {
      ...base(),
      assignmentRules: [
        { ...rule, locationIds: ['a', 'b'] },
        { ...rule, locationIds: ['b', 'a'], priority: 2 },
      ],
    };
    expect(fields(values)).toContain('assignmentRules');
  });

  it('rejects ADMIN as an assignment role', () => {
    const values = { ...base(), assignmentRules: [{ departmentId: 'd1', role: 'ADMIN' as const, priority: 1 }] };
    expect(fields(values)).toContain('assignmentRules.0.role');
  });

  it('sorts assignment rules by priority then role', () => {
    const sorted = sortAssignmentRules([
      { departmentId: 'b', role: 'TECH_CONFIRMER', priority: 20 },
      { departmentId: 'a', role: 'BQL', priority: 10 },
    ]);
    expect(sorted.map((r) => r.priority)).toEqual([10, 20]);
  });

  it('describes changes in Vietnamese with formatted money', () => {
    const before = base();
    const after = { ...before, emergencyLimitVnd: '50000000', approvalStepKeys: ['TECH', 'BOARD'] };
    const changes = diffConfig(before, after);
    expect(changes).toContainEqual({ label: 'Thứ tự chuỗi phê duyệt', from: 'TVKT', to: 'TVKT → BQT' });
    expect(changes.find((c) => c.label === 'Hạn mức sửa chữa khẩn cấp')?.to).toContain('50.000.000');
    expect(diffConfig(before, before)).toEqual([]);
  });
});
