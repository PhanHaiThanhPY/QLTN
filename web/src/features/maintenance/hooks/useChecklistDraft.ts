import { useState } from 'react';
import type { CheckResult } from '@/domain/constants';
import type { Attachment, MaintenanceChecklistEntry, MaintenanceOccurrence } from '@/domain/types';

export interface ChecklistDraft {
  checklist: MaintenanceChecklistEntry[];
  resultNote: string;
  performerName: string;
  contractorName: string;
  attachmentIds: string[];
}

export type DraftTextField = 'resultNote' | 'performerName' | 'contractorName';

const fromOccurrence = (occurrence: MaintenanceOccurrence): ChecklistDraft => ({
  checklist: occurrence.checklist.map((entry) => ({ ...entry, attachmentIds: [...entry.attachmentIds] })),
  resultNote: occurrence.resultNote ?? '',
  performerName: occurrence.performerName ?? '',
  contractorName: occurrence.contractorName ?? '',
  attachmentIds: [...occurrence.attachmentIds],
});

/**
 * Local working copy of an occurrence checklist. `baseVersion` is the version the draft was
 * loaded from; it is sent as expectedVersion so edits from another tab are never overwritten silently.
 */
export const useChecklistDraft = (occurrence: MaintenanceOccurrence) => {
  const [draft, setDraft] = useState<ChecklistDraft>(() => fromOccurrence(occurrence));
  const [baseVersion, setBaseVersion] = useState(occurrence.version);
  const [uploaded, setUploaded] = useState<Attachment[]>([]);

  const updateEntry = (index: number, patch: Partial<Pick<MaintenanceChecklistEntry, 'result' | 'note' | 'attachmentIds'>>) =>
    setDraft((prev) => ({ ...prev, checklist: prev.checklist.map((entry, row) => (row === index ? { ...entry, ...patch } : entry)) }));

  return {
    draft,
    baseVersion,
    uploaded,
    isStale: occurrence.version !== baseVersion,
    setField: (field: DraftTextField, value: string) => setDraft((prev) => ({ ...prev, [field]: value })),
    setResult: (index: number, result: CheckResult) => updateEntry(index, { result }),
    setNote: (index: number, note: string) => updateEntry(index, { note }),
    addEntryFiles: (index: number, files: Attachment[]) => {
      setUploaded((prev) => [...prev, ...files]);
      setDraft((prev) => ({
        ...prev,
        checklist: prev.checklist.map((entry, row) =>
          row === index ? { ...entry, attachmentIds: [...entry.attachmentIds, ...files.map((file) => file.id)] } : entry,
        ),
      }));
    },
    removeEntryFile: (index: number, id: string) =>
      setDraft((prev) => ({
        ...prev,
        checklist: prev.checklist.map((entry, row) =>
          row === index ? { ...entry, attachmentIds: entry.attachmentIds.filter((value) => value !== id) } : entry,
        ),
      })),
    addResultFiles: (files: Attachment[]) => {
      setUploaded((prev) => [...prev, ...files]);
      setDraft((prev) => ({ ...prev, attachmentIds: [...prev.attachmentIds, ...files.map((file) => file.id)] }));
    },
    removeResultFile: (id: string) => setDraft((prev) => ({ ...prev, attachmentIds: prev.attachmentIds.filter((value) => value !== id) })),
    /** Our own successful save bumps the version by exactly one. */
    markSaved: () => setBaseVersion((prev) => prev + 1),
    keepMine: () => setBaseVersion(occurrence.version),
    reload: () => {
      setDraft(fromOccurrence(occurrence));
      setBaseVersion(occurrence.version);
    },
  };
};

export type ChecklistDraftApi = ReturnType<typeof useChecklistDraft>;

export const draftPayload = (draft: ChecklistDraft) => ({
  checklist: draft.checklist.map((entry) => ({
    templateItemId: entry.templateItemId,
    result: entry.result,
    note: entry.note ?? '',
    attachmentIds: entry.attachmentIds,
  })),
  resultNote: draft.resultNote,
  performerName: draft.performerName,
  contractorName: draft.contractorName,
  attachmentIds: draft.attachmentIds,
});
