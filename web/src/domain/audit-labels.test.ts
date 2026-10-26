import { AUDIT_ACTION_LABEL, AUDIT_ACTIONS_BY_SUBJECT, auditActionLabel, auditSubjectLabel } from './audit-labels';

describe('operation log labels (SPEC AD-S1 BR-04, BR-05)', () => {
  it('labels every action offered by the filter', () => {
    for (const action of Object.values(AUDIT_ACTIONS_BY_SUBJECT).flat()) expect(AUDIT_ACTION_LABEL[action]).toBeTruthy();
  });

  it('shows the raw code of an unknown action or subject', () => {
    expect(auditActionLabel('confirmRepair')).toBe('Xác nhận cần sửa');
    expect(auditActionLabel('mergeAccount')).toBe('mergeAccount');
    expect(auditSubjectLabel('ROLE')).toBe('Vai trò');
    expect(auditSubjectLabel('INVOICE')).toBe('INVOICE');
  });
});
