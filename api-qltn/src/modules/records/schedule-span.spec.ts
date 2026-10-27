import { isConstructionLate, scheduleSpan, spanOverlaps } from './schedule-span';

const TODAY = '2026-11-25';
const running = { startDate: '2026-11-20', plannedEndDate: '2026-11-26', completedDate: null };

describe('construction schedule span (B4-S1 BR-B4-01)', () => {
  it('runs to the planned end while not completed and not yet due', () => {
    expect(scheduleSpan(running, 'IN_CONSTRUCTION', TODAY)).toEqual({ start: '2026-11-20', end: '2026-11-26' });
    expect(isConstructionLate(running, 'IN_CONSTRUCTION', TODAY)).toBe(false);
  });

  it('is not late on the planned end day itself', () => {
    const due = { ...running, plannedEndDate: TODAY };
    expect(scheduleSpan(due, 'IN_CONSTRUCTION', TODAY).end).toBe(TODAY);
    expect(isConstructionLate(due, 'IN_CONSTRUCTION', TODAY)).toBe(false);
  });

  it('stretches a late construction to today and flags it (AC-B4.3, D-B4-1)', () => {
    const late = { ...running, plannedEndDate: '2026-11-22' };
    expect(scheduleSpan(late, 'IN_CONSTRUCTION', TODAY)).toEqual({ start: '2026-11-20', end: TODAY });
    expect(isConstructionLate(late, 'IN_CONSTRUCTION', TODAY)).toBe(true);
    expect(isConstructionLate(late, 'EMERGENCY_IN_PROGRESS', TODAY)).toBe(true);
  });

  it('ends on the completion date and is never late once completed (AC-B4.4)', () => {
    const done = { ...running, plannedEndDate: '2026-11-22', completedDate: '2026-11-22' };
    for (const status of ['PENDING_ACCEPTANCE', 'PENDING_PAYMENT_REQUEST', 'PENDING_PAYMENT', 'COMPLETED']) {
      expect(scheduleSpan(done, status, TODAY)).toEqual({ start: '2026-11-20', end: '2026-11-22' });
      expect(isConstructionLate(done, status, TODAY)).toBe(false);
    }
  });

  it('keeps "Cần khắc phục" running to today or the planned end, whichever is later, without a late flag (AC-B4.5)', () => {
    const redo = { ...running, plannedEndDate: '2026-11-22', completedDate: '2026-11-22' };
    expect(scheduleSpan(redo, 'NEEDS_REPAIR', TODAY)).toEqual({ start: '2026-11-20', end: TODAY });
    expect(scheduleSpan({ ...redo, plannedEndDate: '2026-11-28' }, 'NEEDS_REPAIR', TODAY).end).toBe('2026-11-28');
    expect(isConstructionLate({ ...redo, completedDate: null }, 'NEEDS_REPAIR', TODAY)).toBe(false);
  });

  it('ends on the planned end for a finished record without a completion date', () => {
    const closed = { ...running, plannedEndDate: '2026-11-22' };
    for (const status of ['COMPLETED', 'CLOSED_WITHDRAWN', 'CLOSED_POST_REVIEW_REJECTED', 'UNRESOLVED']) {
      expect(scheduleSpan(closed, status, TODAY).end).toBe('2026-11-22');
      expect(isConstructionLate(closed, status, TODAY)).toBe(false);
    }
  });

  it('never ends before it starts', () => {
    const odd = { startDate: '2026-11-24', plannedEndDate: '2026-11-24', completedDate: '2026-11-23' };
    expect(scheduleSpan(odd, 'PENDING_ACCEPTANCE', TODAY)).toEqual({ start: '2026-11-24', end: '2026-11-24' });
  });
});

describe('span overlap (B4-S1 BR-B4-02)', () => {
  const span = { start: '2026-11-20', end: '2026-11-26' };

  it('matches both weeks a span crosses (AC-B4.2)', () => {
    expect(spanOverlaps(span, '2026-11-17', '2026-11-23')).toBe(true);
    expect(spanOverlaps(span, '2026-11-24', '2026-11-30')).toBe(true);
    expect(spanOverlaps(span, '2026-11-24')).toBe(true);
  });

  it('matches when the span touches the edge of the range', () => {
    expect(spanOverlaps(span, '2026-11-26', '2026-12-02')).toBe(true);
    expect(spanOverlaps(span, '2026-11-14', '2026-11-20')).toBe(true);
  });

  it('does not match a range outside the span', () => {
    expect(spanOverlaps(span, '2026-11-27', '2026-12-03')).toBe(false);
    expect(spanOverlaps(span, '2026-11-13', '2026-11-19')).toBe(false);
    expect(spanOverlaps(span, undefined, '2026-11-19')).toBe(false);
  });

  it('matches everything without bounds', () => {
    expect(spanOverlaps(span)).toBe(true);
  });
});
