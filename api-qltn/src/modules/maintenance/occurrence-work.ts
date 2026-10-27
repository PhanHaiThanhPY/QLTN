import type { FieldErrors } from '../../common/validation/field-errors';
import {
  effectiveResult,
  entryField,
  type CheckResult,
  type ChecklistItemRule,
  type WorkEntry,
} from '../../domain/maintenance-execution';

const NOTE_MAX = 1000;
const RESULTS: readonly CheckResult[] = ['PASS', 'FAIL', 'NA'];

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

/**
 * BR-MT3-03: the entries of a save or a submission, one per checklist item in the checklist's order. Unknown items
 * and foreign files are refused on the item; a measurement outside its threshold is stored as FAIL (D-MT3-2).
 */
export const normalizeEntries = (
  errors: FieldErrors,
  items: readonly ChecklistItemRule[],
  previous: readonly WorkEntry[],
  input: readonly unknown[],
  ownFiles: ReadonlySet<string>,
): WorkEntry[] => {
  const rows = input.map(record);
  for (const row of rows) {
    errors.when(!items.some((item) => item.id === row.itemId), 'entries', 'Mục không thuộc danh mục kiểm của lượt.');
  }
  return items.map((item) => {
    const row = rows.find((candidate) => candidate.itemId === item.id);
    const before = previous.find((entry) => entry.itemId === item.id);
    if (!row) return before ?? { itemId: item.id, result: null, value: null, note: null, attachmentIds: [] };
    const field = entryField(item.id);
    const chosen = RESULTS.find((value) => value === row.result) ?? null;
    errors.when(
      row.result !== null && row.result !== undefined && !chosen,
      field,
      `${item.label}: kết quả không hợp lệ.`,
    );
    const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;
    errors.when(
      row.value !== null && row.value !== undefined && value === null,
      field,
      `${item.label}: số đo không hợp lệ.`,
    );
    errors.when(item.kind !== 'MEASUREMENT' && value !== null, field, `${item.label}: mục này không nhập số đo.`);
    const note = typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null;
    errors.when((note ?? '').length > NOTE_MAX, field, `${item.label}: ghi chú tối đa ${NOTE_MAX} ký tự.`);
    const attachmentIds = Array.isArray(row.attachmentIds)
      ? row.attachmentIds.filter((id): id is string => typeof id === 'string')
      : [];
    errors.when(
      attachmentIds.some((id) => !ownFiles.has(id)),
      field,
      `${item.label}: ảnh không thuộc lượt này.`,
    );
    const entry: WorkEntry = {
      itemId: item.id,
      result: chosen,
      value,
      note,
      attachmentIds: [...new Set(attachmentIds)],
    };
    return { ...entry, result: effectiveResult(item, entry) };
  });
};
