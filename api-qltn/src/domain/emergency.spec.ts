import {
  emergencyTiming,
  isLateSubmission,
  isOverEmergencyLimit,
  isWithinEmergencyLimit,
  type EmergencyInfo,
} from './emergency';

const info = (overrides: Partial<EmergencyInfo> = {}): EmergencyInfo => ({
  reason: 'Ống cấp chính vỡ, nước tràn hầm B1.',
  contractorName: 'Cty TNHH Bình An',
  estimatedAmountVnd: '12500000',
  plannedEndDate: '2026-10-28',
  limitVnd: '15000000',
  docsDueAt: '2026-10-28T02:10:00.000Z',
  fromStatus: 'PENDING_PROPOSAL',
  startedBy: 'usr-bql',
  startedAt: '2026-10-27T02:10:00.000Z',
  docsSubmittedAt: null,
  lateReason: null,
  proposedAmountVnd: null,
  postReviewOutcome: null,
  postReviewRejection: null,
  closeDecision: null,
  ...overrides,
});

describe('emergency limit (SPEC B06-S1 BR-E-02)', () => {
  it('allows an amount equal to the limit and refuses one đồng above', () => {
    expect(isWithinEmergencyLimit('15000000', '15000000')).toBe(true);
    expect(isWithinEmergencyLimit('15000001', '15000000')).toBe(false);
    expect(isWithinEmergencyLimit('999999999999999', '999999999999998')).toBe(false);
  });

  it('flags the approved amount, else the latest proposed total, above the applied limit (BR-E-06)', () => {
    expect(isOverEmergencyLimit(info(), null)).toBe(false);
    expect(isOverEmergencyLimit(info({ proposedAmountVnd: '16000000' }), null)).toBe(true);
    expect(isOverEmergencyLimit(info({ proposedAmountVnd: '16000000' }), '15000000')).toBe(false);
  });
});

describe('document deadline (BR-E-05, BR-E-11)', () => {
  const at = (iso: string) => new Date(iso);

  it('counts the hours left rounded up while documents are due', () => {
    expect(emergencyTiming(info(), at('2026-10-27T08:10:00.000Z'))).toEqual({ docsOverdue: false, hoursLeft: 18 });
    expect(emergencyTiming(info(), at('2026-10-28T01:40:00.000Z'))).toEqual({ docsOverdue: false, hoursLeft: 1 });
    expect(emergencyTiming(info(), at('2026-10-28T02:10:00.000Z'))).toEqual({ docsOverdue: false, hoursLeft: 0 });
  });

  it('reports overdue hours as a negative number', () => {
    expect(emergencyTiming(info(), at('2026-10-28T02:10:01.000Z'))).toEqual({ docsOverdue: true, hoursLeft: -1 });
    expect(emergencyTiming(info(), at('2026-10-28T05:00:00.000Z'))).toEqual({ docsOverdue: true, hoursLeft: -3 });
  });

  it('stops counting once the documents are submitted', () => {
    const submitted = info({ docsSubmittedAt: '2026-10-28T09:00:00.000Z' });
    expect(emergencyTiming(submitted, at('2026-10-29T00:00:00.000Z'))).toEqual({ docsOverdue: false, hoursLeft: null });
  });

  it('is late only strictly after the deadline', () => {
    expect(isLateSubmission(info(), at('2026-10-28T02:10:00.000Z'))).toBe(false);
    expect(isLateSubmission(info(), at('2026-10-28T02:10:00.001Z'))).toBe(true);
  });
});
