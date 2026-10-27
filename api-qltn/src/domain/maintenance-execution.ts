/**
 * Pure rules of running a maintenance occurrence (SPEC MT-S3 BR-MT3-02..06, BR-MT3-09, BR-MT3-11). Dates are
 * `YYYY-MM-DD` Vietnam days; the reviewer's due time is an instant.
 */
import { addDays } from './maintenance-schedule';

export type CheckResult = 'PASS' | 'FAIL' | 'NA';

/** The checklist item as snapshotted on the occurrence (MT-S2 BR-MT2-03). */
export interface ChecklistItemRule {
  id: string;
  label: string;
  required: boolean;
  kind: 'CHECK' | 'MEASUREMENT';
  unit: string | null;
  min: number | null;
  max: number | null;
  photoRequired: boolean;
}

/** One item's work as the performer fills it. */
export interface WorkEntry {
  itemId: string;
  result: CheckResult | null;
  value: number | null;
  note: string | null;
  attachmentIds: string[];
}

export interface WorkSummary {
  summary: string | null;
  attachmentIds: string[];
}

/** BR-MT3-02 / D-MT3-1: start from 3 days before the scheduled day. */
export const START_WINDOW_DAYS = 3;
export const SUMMARY_MIN = 5;
export const RESOLUTION_MIN = 10;
export const REWORK_REASON_MIN = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export const canStartOn = (scheduledDate: string, today: string): boolean =>
  today >= addDays(scheduledDate, -START_WINDOW_DAYS);

/** "2–6 bar", "≥ 2 bar", "≤ 6 bar" or null when the item has no threshold. */
export const thresholdText = (item: Pick<ChecklistItemRule, 'min' | 'max' | 'unit'>): string | null => {
  const unit = item.unit ? ` ${item.unit}` : '';
  if (item.min !== null && item.max !== null) return `${item.min}–${item.max}${unit}`;
  if (item.min !== null) return `≥ ${item.min}${unit}`;
  if (item.max !== null) return `≤ ${item.max}${unit}`;
  return null;
};

export const isOutOfRange = (item: Pick<ChecklistItemRule, 'min' | 'max'>, value: number | null): boolean =>
  value !== null && ((item.min !== null && value < item.min) || (item.max !== null && value > item.max));

/**
 * BR-MT3-03 / D-MT3-2: a measurement outside its threshold is a failure whatever was chosen; inside it, the chosen
 * result stands (a measured item defaults to PASS once it has a value).
 */
export const effectiveResult = (
  item: ChecklistItemRule,
  entry: Pick<WorkEntry, 'result' | 'value'>,
): CheckResult | null => {
  if (item.kind !== 'MEASUREMENT') return entry.result;
  if (isOutOfRange(item, entry.value)) return 'FAIL';
  if (entry.value === null) return entry.result === 'NA' ? 'NA' : null;
  return entry.result ?? 'PASS';
};

/** Field key of an item's error (`entries.<itemId>`), so the screen shows it on the item. */
export const entryField = (itemId: string): string => `entries.${itemId}`;

export interface SubmitProblem {
  field: string;
  message: string;
}

/**
 * BR-MT3-04: what blocks a submission, item by item, then the summary and the general photo. `isImage` tells
 * whether an attachment id is a photo (a failed item needs a photo, a PDF does not count, D-MT3-3).
 */
export const submitProblems = (
  items: readonly ChecklistItemRule[],
  entries: readonly WorkEntry[],
  summary: WorkSummary,
  isImage: (attachmentId: string) => boolean,
): SubmitProblem[] => {
  const problems: SubmitProblem[] = [];
  for (const item of items) {
    const entry = entries.find((row) => row.itemId === item.id) ?? {
      itemId: item.id,
      result: null,
      value: null,
      note: null,
      attachmentIds: [],
    };
    const result = effectiveResult(item, entry);
    const photos = entry.attachmentIds.filter(isImage).length;
    const at = (message: string) => problems.push({ field: entryField(item.id), message: `${item.label}: ${message}` });
    if (item.kind === 'MEASUREMENT' && entry.value === null && result !== 'NA' && item.required) at('cần nhập số đo.');
    else if (item.required && !result) at('chưa có kết quả.');
    if ((result === 'FAIL' || result === 'NA') && !entry.note?.trim())
      at(result === 'FAIL' ? 'mục lỗi cần ghi chú.' : 'mục không áp dụng cần ghi chú.');
    if (result === 'FAIL' && photos === 0) at('mục lỗi cần ít nhất 1 ảnh.');
    else if (item.photoRequired && result !== 'NA' && photos === 0) at('mục này cần ảnh.');
  }
  if ((summary.summary ?? '').trim().length < SUMMARY_MIN)
    problems.push({ field: 'summary', message: `Kết quả chung cần tối thiểu ${SUMMARY_MIN} ký tự.` });
  if (summary.attachmentIds.filter(isImage).length === 0)
    problems.push({ field: 'attachmentIds', message: 'Cần ít nhất 1 ảnh chung của lượt.' });
  return problems;
};

/** BR-MT3-06 / MD-01: submission time + the building's "Kiểm tra kết quả bảo trì" days. */
export const reviewDueAt = (submittedAt: Date, days: number): Date => new Date(submittedAt.getTime() + days * DAY_MS);

/** BR-MT3-11: days past the scheduled day for an occurrence still to be done (0 when not late). */
export const overdueDays = (scheduledDate: string, today: string): number => {
  if (scheduledDate >= today) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${scheduledDate}T00:00:00Z`)) / DAY_MS);
};

/**
 * BR-MT3-09 / MD-07: every failed item needs either an active repair record made from that very item, or the
 * reviewer's resolution of 10+ characters. Answers the items still without one.
 */
export const unresolvedFailures = (
  failedItemIds: readonly string[],
  itemsWithActiveRecord: ReadonlySet<string>,
  resolutions: Readonly<Record<string, string>>,
): string[] =>
  failedItemIds.filter(
    (id) => !itemsWithActiveRecord.has(id) && (resolutions[id] ?? '').trim().length < RESOLUTION_MIN,
  );
