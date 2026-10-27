import { entry } from './__fixtures__/schedule-entries';
import { entriesOnDay, entryLabel, entryTone, isOnDay, plannedNote, spanText } from './repair-schedule-ui';

describe('repair schedule helpers (B4-S1)', () => {
  it('places an entry on every day of its span, edges included (BR-B4-02)', () => {
    const row = entry('SC-031', '2026-11-20', '2026-11-26');
    expect(['2026-11-20', '2026-11-23', '2026-11-26'].every((day) => isOnDay(row, day))).toBe(true);
    expect(isOnDay(row, '2026-11-19')).toBe(false);
    expect(isOnDay(row, '2026-11-27')).toBe(false);
    expect(entriesOnDay([row, entry('SC-032', '2026-11-27', '2026-11-27')], '2026-11-24')).toEqual([row]);
  });

  it('names an entry for screen readers with its span, status and flags (ui-brief §4)', () => {
    const late = entry('SC-031', '2026-11-20', '2026-11-26', { isLate: true, emergency: true });
    expect(entryLabel(late)).toBe('SC-031 Công việc SC-031, 20/11 đến 26/11, Đang thi công, trễ thi công, khẩn cấp');
  });

  it('prints the span, "xong" once built, and the planned end of a late entry (BR-B4-07)', () => {
    expect(spanText(entry('SC-031', '2026-11-20', '2026-11-26'))).toBe('20/11 – 26/11');
    const built = entry('SC-033', '2026-11-20', '2026-11-22', { status: 'PENDING_ACCEPTANCE', completedDate: '2026-11-22' });
    expect(spanText(built)).toBe('20/11 – 22/11 · xong 22/11');
    const late = entry('SC-034', '2026-11-20', '2026-11-25', { isLate: true, plannedEndDate: '2026-11-22' });
    expect(plannedNote(late)).toBe('dự kiến 22/11');
    expect(plannedNote(built)).toBeNull();
  });

  it('colours late, redo, built and running entries with the brief tokens (ui-brief §1)', () => {
    expect(entryTone(entry('A', '2026-11-20', '2026-11-25', { isLate: true }))).toContain('bg-crit-soft');
    expect(entryTone(entry('B', '2026-11-20', '2026-11-25', { status: 'NEEDS_REPAIR', completedDate: '2026-11-22' }))).toContain('bg-warn-soft');
    expect(entryTone(entry('C', '2026-11-20', '2026-11-22', { status: 'PENDING_PAYMENT', completedDate: '2026-11-22' }))).toContain('bg-good-soft');
    expect(entryTone(entry('D', '2026-11-20', '2026-11-25'))).toContain('bg-accent-soft');
  });
});
