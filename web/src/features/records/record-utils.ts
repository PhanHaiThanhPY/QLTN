import { REPAIR_ACTIONS, evaluateAction } from '@/domain/actions';
import type { ActionDef, ActionState, RepairAction } from '@/domain/actions';
import { REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { RepairStatus } from '@/domain/constants';
import type { Attachment, RepairRecord, User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';

export const RECORD_TABS = ['overview', 'approval', 'construction', 'acceptance', 'payment', 'history'] as const;
export type RecordTab = (typeof RECORD_TABS)[number];

export const isRecordTab = (value: string | null): value is RecordTab =>
  value !== null && (RECORD_TABS as readonly string[]).includes(value);

const actionDef = (action: RepairAction): ActionDef<RepairStatus> => REPAIR_ACTIONS[action];

/** Whether the action belongs to the record's current status (otherwise the button is hidden). */
export const isActionRelevant = (action: RepairAction, status: RepairStatus): boolean => actionDef(action).from.includes(status);

export const repairActionState = (action: RepairAction, viewer: User, record: RepairRecord): ActionState =>
  evaluateAction(actionDef(action), viewer, record);

/** Combines a permission state with an extra business precondition shown as the disabled reason. */
export const withPrecondition = (state: ActionState, isMet: boolean, reason: string): ActionState => {
  if (!state.allowed) return state;
  return isMet ? state : { allowed: false, reason };
};

export const isRecordFinal = (record: RepairRecord): boolean => REPAIR_FINAL_STATUSES.includes(record.status);

/** Resolves attachment rows of the record by id, keeping the id order. */
export const pickAttachments = (attachments: Attachment[], ids: readonly string[]): Attachment[] => {
  const byId = new Map(attachments.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is Attachment => Boolean(row));
};

export const approvedSubmission = (detail: RecordDetail) =>
  detail.submissions.find((view) => view.submission.id === detail.record.approvedSubmissionId)?.submission;

export const currentSubmissionView = (detail: RecordDetail) =>
  detail.submissions.find((view) => view.submission.id === detail.record.currentSubmissionId);
