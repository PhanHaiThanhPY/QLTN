import {
  canStartOn,
  effectiveResult,
  overdueDays,
  reviewDueAt,
  submitProblems,
  thresholdText,
  unresolvedFailures,
  type ChecklistItemRule,
} from './maintenance-execution';

const ITEMS: ChecklistItemRule[] = [
  {
    id: 'run',
    label: 'Vận hành',
    required: true,
    kind: 'CHECK',
    unit: null,
    min: null,
    max: null,
    photoRequired: false,
  },
  { id: 'leak', label: 'Rò rỉ', required: false, kind: 'CHECK', unit: null, min: null, max: null, photoRequired: true },
  {
    id: 'pressure',
    label: 'Áp suất',
    required: true,
    kind: 'MEASUREMENT',
    unit: 'bar',
    min: 2,
    max: 6,
    photoRequired: false,
  },
];
const image = (id: string) => id.startsWith('img');

describe('maintenance execution rules (SPEC MT-S3)', () => {
  it('starts from 3 days before the scheduled day (BR-MT3-02, AC-MT3.1)', () => {
    expect(canStartOn('2026-11-12', '2026-11-08')).toBe(false);
    expect(canStartOn('2026-11-12', '2026-11-09')).toBe(true);
    expect(canStartOn('2026-11-12', '2026-11-20')).toBe(true);
  });

  it('fails a measurement outside its threshold whatever was chosen (D-MT3-2, AC-MT3.2)', () => {
    const pressure = ITEMS[2];
    expect(thresholdText(pressure)).toBe('2–6 bar');
    expect(effectiveResult(pressure, { result: 'PASS', value: 7 })).toBe('FAIL');
    expect(effectiveResult(pressure, { result: null, value: 4 })).toBe('PASS');
    expect(effectiveResult(pressure, { result: null, value: null })).toBeNull();
  });

  it('names every blocking item of a submission (BR-MT3-04, AC-MT3.3)', () => {
    const problems = submitProblems(
      ITEMS,
      [
        { itemId: 'run', result: 'PASS', value: null, note: null, attachmentIds: [] },
        { itemId: 'leak', result: 'PASS', value: null, note: null, attachmentIds: [] },
        { itemId: 'pressure', result: null, value: 7, note: null, attachmentIds: ['doc.pdf'] },
      ],
      { summary: 'Ok', attachmentIds: [] },
      image,
    );
    expect(problems.map((row) => row.field)).toEqual([
      'entries.leak',
      'entries.pressure',
      'entries.pressure',
      'summary',
      'attachmentIds',
    ]);
    expect(
      submitProblems(
        ITEMS,
        [
          { itemId: 'run', result: 'PASS', value: null, note: null, attachmentIds: [] },
          { itemId: 'leak', result: 'PASS', value: null, note: null, attachmentIds: ['img-1'] },
          { itemId: 'pressure', result: null, value: 7, note: 'Áp suất cao.', attachmentIds: ['img-2'] },
        ],
        { summary: 'Đã kiểm xong.', attachmentIds: ['img-3'] },
        image,
      ),
    ).toEqual([]);
  });

  it('adds the building days to the submission time (MD-01, AC-MT3.4)', () => {
    expect(reviewDueAt(new Date('2026-11-10T02:00:00.000Z'), 3).toISOString()).toBe('2026-11-13T02:00:00.000Z');
  });

  it('counts overdue days (BR-MT3-11)', () => {
    expect(overdueDays('2026-11-12', '2026-11-13')).toBe(1);
    expect(overdueDays('2026-11-12', '2026-11-12')).toBe(0);
  });

  it('checks every failed item on its own (MD-07, AC-MT3.9)', () => {
    expect(unresolvedFailures(['a', 'b'], new Set(['a']), {})).toEqual(['b']);
    expect(unresolvedFailures(['a', 'b'], new Set(['a']), { b: 'Siết lại khớp nối, theo dõi lượt sau.' })).toEqual([]);
    expect(unresolvedFailures(['b'], new Set(['a']), { b: 'ngắn' })).toEqual(['b']);
  });
});
