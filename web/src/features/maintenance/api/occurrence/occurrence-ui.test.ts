import type { ChecklistItemRule } from '@/domain/maintenance-execution';
import type { Attachment } from '@/domain/types';
import { draftProblems, lateText, parseMeasure, progressText, type WorkDraft } from './occurrence-ui';

const ITEMS: ChecklistItemRule[] = [
  { id: 'run', label: 'Vận hành', required: true, kind: 'CHECK', unit: null, min: null, max: null, photoRequired: false },
  { id: 'leak', label: 'Rò rỉ', required: false, kind: 'CHECK', unit: null, min: null, max: null, photoRequired: true },
  { id: 'pressure', label: 'Áp suất', required: true, kind: 'MEASUREMENT', unit: 'bar', min: 2, max: 6, photoRequired: false },
];
const draft = (overrides: Partial<WorkDraft> = {}): WorkDraft => ({
  entries: [
    { itemId: 'run', result: 'PASS', value: '', note: '', attachmentIds: [] },
    { itemId: 'leak', result: null, value: '', note: '', attachmentIds: [] },
    { itemId: 'pressure', result: null, value: '7', note: '', attachmentIds: [] },
  ],
  summary: '',
  contractorName: '',
  actualWorker: '',
  attachmentIds: [],
  ...overrides,
});
const image = { mimeType: 'image/png' } as Attachment;

describe('occurrence-ui (SPEC MT-S3)', () => {
  it('reads decimals with a comma or a dot', () => {
    expect(parseMeasure('7,5')).toBe(7.5);
    expect(parseMeasure(' 4 ')).toBe(4);
    expect(parseMeasure('')).toBeNull();
    expect(parseMeasure('abc')).toBeNull();
  });

  it('counts checked items and failures; out of range counts as a failure (ui-brief §2.1)', () => {
    expect(progressText(ITEMS, draft())).toBe('Đã kiểm 2/3 mục · 1 lỗi');
  });

  it('names each blocking item before submitting (BR-MT3-04)', () => {
    const fields = draftProblems(ITEMS, draft(), { img: image }).map((row) => row.field);
    expect(fields).toEqual(['entries.leak', 'entries.pressure', 'entries.pressure', 'summary', 'attachmentIds']);
  });

  it('says how late an occurrence is', () => {
    expect(lateText({ overdueDays: 1, reviewOverdue: false })).toBe('Quá hạn 1 ngày');
    expect(lateText({ overdueDays: 0, reviewOverdue: true })).toBe('Quá hạn xác nhận');
    expect(lateText({ overdueDays: 0, reviewOverdue: false })).toBeNull();
  });
});
