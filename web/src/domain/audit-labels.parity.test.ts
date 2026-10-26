import * as api from '../../../api-qltn/src/domain/audit-labels';
import { AUDIT_ACTION_LABEL, AUDIT_SUBJECT_LABEL } from './audit-labels';

/** SPEC AD-S1 BR-04/BR-05: the screen and the CSV export show the same labels. */
describe('operation log labels parity with api-qltn', () => {
  it('declares the same subject and action labels', () => {
    expect(AUDIT_SUBJECT_LABEL).toEqual(api.AUDIT_SUBJECT_LABEL);
    expect(AUDIT_ACTION_LABEL).toEqual(api.AUDIT_ACTION_LABEL);
  });
});
