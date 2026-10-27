import { RECORD_STATUS_LABEL } from '../../../api-qltn/src/modules/records/record-status-labels';
import { RECORD_FINAL_STATUSES, RECORD_STATUS_GROUP_BY_STATUS } from '../../../api-qltn/src/modules/records/record-status-groups';
import { REPAIR_FINAL_STATUSES, REPAIR_STATUS_GROUP_BY_STATUS, REPAIR_STATUS_LABEL } from './constants';

/** SPEC B06-S1 §4 and §7: repair status labels, filter groups and closed statuses match api-qltn. */
describe('repair status parity with api-qltn', () => {
  it('declares the same label and group for every status', () => {
    expect(REPAIR_STATUS_LABEL).toEqual(RECORD_STATUS_LABEL);
    expect(REPAIR_STATUS_GROUP_BY_STATUS).toEqual(RECORD_STATUS_GROUP_BY_STATUS);
    expect([...REPAIR_FINAL_STATUSES].sort()).toEqual([...RECORD_FINAL_STATUSES].sort());
  });

  it('files the post-review statuses under "needs action" and "closed"', () => {
    expect(REPAIR_STATUS_GROUP_BY_STATUS.POST_REVIEW_REJECTED).toBe('NEEDS_ACTION');
    expect(REPAIR_STATUS_GROUP_BY_STATUS.CLOSED_POST_REVIEW_REJECTED).toBe('CLOSED');
  });
});
