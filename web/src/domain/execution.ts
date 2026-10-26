/** Construction and acceptance of a repair record as served by api-qltn (SPEC B03–B09 v2 slice S3). */

export interface ConstructionUpdate {
  id: string;
  progressPercent: number;
  note: string;
  attachmentIds: string[];
  actorId: string;
  createdAt: string;
}

export interface ExecutionConstruction {
  startDate: string;
  plannedEndDate: string;
  planNote: string;
  progressPercent: number;
  completedDate: string | null;
  startedBy: string;
  updates: ConstructionUpdate[];
}

export type AcceptanceRoundOutcome = 'PENDING' | 'PASSED' | 'FAILED';
export type MemberOutcome = 'PASSED' | 'FAILED';

export interface MemberDecision {
  id: string;
  stepKey: string;
  actorId: string;
  outcome: MemberOutcome;
  note: string | null;
  attachmentIds: string[];
  signatureDataUrl: string | null;
  createdAt: string;
}

/** One set of minutes (D5-NT, SPEC §4.3); members decide in parallel; locked once closed. */
export interface AcceptanceRound {
  id: string;
  roundNo: number;
  completedDate: string;
  inspectedAt: string;
  inspectionLocation: string;
  content: string;
  otherMembers: string | null;
  photoAttachmentIds: string[];
  memberStepKeys: string[];
  outcome: AcceptanceRoundOutcome;
  submittedBy: string;
  createdAt: string;
  closedAt: string | null;
  decisions: MemberDecision[];
}

export interface ExecutionHistory {
  construction: ExecutionConstruction | null;
  /** Oldest first. */
  acceptances: AcceptanceRound[];
  repairDraft: { note?: string; attachmentIds?: string[] } | null;
}

export const ROUND_OUTCOME_LABEL: Readonly<Record<AcceptanceRoundOutcome, string>> = {
  PENDING: 'Đang nghiệm thu',
  PASSED: 'Đạt',
  FAILED: 'Không đạt',
};
