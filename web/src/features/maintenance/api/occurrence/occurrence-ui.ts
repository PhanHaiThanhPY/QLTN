import type { StatusTone } from '@/components/ui/badge';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import { effectiveResult, submitProblems, type ChecklistItemRule, type SubmitProblem } from '@/domain/maintenance-execution';
import type { Attachment, User } from '@/domain/types';
import type { CheckResult, ExecutionOccurrence, OccurrenceDetail, OccurrenceStatus, WorkEntry } from '@/services/maintenance-occurrences-api';

export const OCCURRENCE_STATUS_TEXT: Readonly<Record<OccurrenceStatus, string>> = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang làm',
  PENDING_REVIEW: 'Chờ xác nhận',
  REWORK: 'Làm lại',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
} as const;

export const OCCURRENCE_STATUS_TONE: Readonly<Record<OccurrenceStatus, StatusTone>> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'accent',
  PENDING_REVIEW: 'warn',
  REWORK: 'warn',
  COMPLETED: 'good',
  CANCELLED: 'neutral',
} as const;

/** ui-brief §1: Đạt good, Lỗi crit, Không áp dụng neutral. */
export const RESULT_TEXT: Readonly<Record<CheckResult, string>> = { PASS: 'Đạt', FAIL: 'Lỗi', NA: 'Không áp dụng' } as const;
export const RESULT_TONE: Readonly<Record<CheckResult, StatusTone>> = { PASS: 'good', FAIL: 'crit', NA: 'neutral' } as const;
export const RESULTS: readonly CheckResult[] = ['PASS', 'FAIL', 'NA'];

/** Who the viewer is on this occurrence (BR-MT3-01 "Ai"). */
export interface ViewerSlots {
  performer: boolean;
  reviewer: boolean;
  manager: boolean;
}

export const viewerSlots = (detail: Pick<OccurrenceDetail, 'occurrence' | 'plan'>, viewer: Pick<User, 'id'>): ViewerSlots => ({
  performer: detail.occurrence.performerUserId === viewer.id,
  reviewer: detail.occurrence.reviewerUserId === viewer.id,
  manager: detail.plan.managerUserId === viewer.id,
});

export const isWorking = (status: OccurrenceStatus): boolean => status === 'IN_PROGRESS' || status === 'REWORK';
export const isFinal = (status: OccurrenceStatus): boolean => status === 'COMPLETED' || status === 'CANCELLED';

/** "Quá hạn N ngày" / "Quá hạn xác nhận" (BR-MT3-11), or null. */
export const lateText = (occurrence: Pick<ExecutionOccurrence, 'overdueDays' | 'reviewOverdue'>): string | null => {
  if (occurrence.reviewOverdue) return 'Quá hạn xác nhận';
  return occurrence.overdueDays > 0 ? `Quá hạn ${occurrence.overdueDays} ngày` : null;
};

/** Draft of the performer's form; values as typed (the measurement as text, so "7," is not lost while typing). */
export interface EntryDraft {
  itemId: string;
  result: CheckResult | null;
  value: string;
  note: string;
  attachmentIds: string[];
}

export interface WorkDraft {
  entries: EntryDraft[];
  summary: string;
  contractorName: string;
  actualWorker: string;
  attachmentIds: string[];
}

export const toDraft = (occurrence: ExecutionOccurrence): WorkDraft => ({
  entries: occurrence.checklist.map((item) => {
    const entry = occurrence.work.entries.find((row) => row.itemId === item.id);
    return {
      itemId: item.id,
      result: entry?.result ?? null,
      value: entry?.value === null || entry?.value === undefined ? '' : String(entry.value),
      note: entry?.note ?? '',
      attachmentIds: entry?.attachmentIds ?? [],
    };
  }),
  summary: occurrence.work.summary ?? '',
  contractorName: occurrence.contractorName ?? '',
  actualWorker: occurrence.work.actualWorker ?? '',
  attachmentIds: occurrence.work.attachmentIds,
});

/** "7,5" or "7.5" → 7.5; empty or unreadable → null. */
export const parseMeasure = (text: string): number | null => {
  const normalized = text.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

export const toEntry = (draft: EntryDraft): WorkEntry => ({
  itemId: draft.itemId,
  result: draft.result,
  value: parseMeasure(draft.value),
  note: draft.note.trim() || null,
  attachmentIds: draft.attachmentIds,
});

export const toPayload = (draft: WorkDraft): Record<string, unknown> => ({
  entries: draft.entries.map(toEntry),
  summary: draft.summary.trim() || null,
  contractorName: draft.contractorName.trim() || null,
  actualWorker: draft.actualWorker.trim() || null,
  attachmentIds: draft.attachmentIds,
});

/** The result shown for a draft item: a measurement outside its threshold is a failure (D-MT3-2). */
export const draftResult = (item: ChecklistItemRule, draft: EntryDraft): CheckResult | null => effectiveResult(item, toEntry(draft));

/** "Đã kiểm k/n mục · m lỗi" (ui-brief §2.1). */
export const progressText = (items: readonly ChecklistItemRule[], draft: WorkDraft): string => {
  const results = items.map((item) => draftResult(item, draft.entries.find((row) => row.itemId === item.id) ?? { itemId: item.id, result: null, value: '', note: '', attachmentIds: [] }));
  const failed = results.filter((result) => result === 'FAIL').length;
  return `Đã kiểm ${results.filter(Boolean).length}/${items.length} mục${failed ? ` · ${failed} lỗi` : ''}`;
};

/** BR-MT3-04 on the draft, before calling the server; images are known from the file metadata. */
export const draftProblems = (items: readonly ChecklistItemRule[], draft: WorkDraft, files: Readonly<Record<string, Attachment>>): SubmitProblem[] =>
  submitProblems(
    items,
    draft.entries.map(toEntry),
    { summary: draft.summary, attachmentIds: draft.attachmentIds },
    (id) => Boolean(files[id]?.mimeType.startsWith('image/')),
  );

/** "SC-031 · Nháp": the linked record with its current state (BR-MT3-09: completed ≠ repaired). */
export const repairText = (repair: { code: string; status: string }): string =>
  `${repair.code} · ${(REPAIR_STATUS_LABEL as Readonly<Record<string, string>>)[repair.status] ?? repair.status}`;
