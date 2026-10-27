/**
 * Emergency repair (SPEC B06-S1): work started before approval within the building's emergency limit, with the
 * proposal following within the configured hours and a post-review by the proposal chain. Money is integer VND as
 * strings, compared with BigInt.
 */

export const EMERGENCY_IN_PROGRESS = 'EMERGENCY_IN_PROGRESS';
/** BR-E-07: the board did not accept the emergency work; the board holder closes the record (E-T2). */
export const POST_REVIEW_REJECTED = 'POST_REVIEW_REJECTED';
export const CLOSED_POST_REVIEW_REJECTED = 'CLOSED_POST_REVIEW_REJECTED';

/** Statuses an emergency may start from (E-T1). */
export const EMERGENCY_START_STATUSES: readonly string[] = ['DRAFT', 'PENDING_CONFIRMATION', 'PENDING_PROPOSAL'];

export type PostReviewOutcome = 'APPROVED' | 'REJECTED';

export interface PostReviewRejection {
  reason: string;
  decidedBy: string;
  decidedAt: string;
}

export interface PostReviewCloseDecision {
  reason: string;
  attachmentIds: string[];
  decidedBy: string;
  decidedAt: string;
}

/** Stored on the record (`repair_records.emergency`); never cleared, even once the record is closed (SPEC §3). */
export interface EmergencyInfo {
  reason: string;
  contractorName: string;
  estimatedAmountVnd: string;
  plannedEndDate: string;
  /** `emergencyLimitVnd` of the building when the emergency started (D-B6-3). */
  limitVnd: string;
  /** Start + `emergencyDocHours` of the building at that time. */
  docsDueAt: string;
  fromStatus: string;
  startedBy: string;
  startedAt: string;
  /** First submission of the proposal (T05). */
  docsSubmittedAt: string | null;
  lateReason: string | null;
  /** Proposed total of the latest submission, for the over-limit warning before the last approval. */
  proposedAmountVnd: string | null;
  postReviewOutcome: PostReviewOutcome | null;
  postReviewRejection: PostReviewRejection | null;
  closeDecision: PostReviewCloseDecision | null;
}

export interface EmergencyTiming {
  /** Documents not yet submitted and the deadline has passed. */
  docsOverdue: boolean;
  /** Whole hours left (rounded up) while documents are due, negative hours overdue; null once submitted. */
  hoursLeft: number | null;
}

const HOUR_MS = 3_600_000;

/** BR-E-11: computed by the server clock so every screen shows the same deadline. */
export const emergencyTiming = (
  info: Pick<EmergencyInfo, 'docsDueAt' | 'docsSubmittedAt'>,
  now: Date,
): EmergencyTiming => {
  if (info.docsSubmittedAt) return { docsOverdue: false, hoursLeft: null };
  const diff = new Date(info.docsDueAt).getTime() - now.getTime();
  if (diff >= 0) return { docsOverdue: false, hoursLeft: Math.ceil(diff / HOUR_MS) };
  return { docsOverdue: true, hoursLeft: -Math.ceil(-diff / HOUR_MS) };
};

/** BR-E-02: an amount equal to the limit is allowed. */
export const isWithinEmergencyLimit = (amountVnd: string, limitVnd: string): boolean =>
  BigInt(amountVnd) <= BigInt(limitVnd);

/** BR-E-06: the approved amount, else the latest proposed total, above the limit applied at the start. */
export const isOverEmergencyLimit = (info: EmergencyInfo, approvedAmountVnd: string | null): boolean => {
  const amount = approvedAmountVnd ?? info.proposedAmountVnd;
  return amount !== null && !isWithinEmergencyLimit(amount, info.limitVnd);
};

/** BR-E-05: a first submission after `docsDueAt` needs a late reason. */
export const isLateSubmission = (info: Pick<EmergencyInfo, 'docsDueAt'>, at: Date): boolean =>
  at.getTime() > new Date(info.docsDueAt).getTime();
