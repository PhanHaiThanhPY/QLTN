import { AppError, ERROR_CODE } from '@/domain/errors';
import type { EmergencyDecision, EmergencyInfo } from '@/domain/types';
import { asRecord, asString, asStringArray } from '@/domain/validation';
import { MISSING_VERSION_MESSAGE } from './version';

/** `emergency` of a record from api-qltn (SPEC B06-S1 §3, BR-E-11); money is integer VND as strings. */
export interface ApiEmergency {
  reason: string;
  contractorName: string;
  estimatedAmountVnd: string;
  plannedEndDate: string;
  limitVnd: string;
  docsDueAt: string;
  startedBy: string;
  startedAt: string;
  docsSubmittedAt: string | null;
  lateReason: string | null;
  postReviewOutcome: 'APPROVED' | 'REJECTED' | null;
  postReviewRejection: EmergencyDecision | null;
  closeDecision: (EmergencyDecision & { attachmentIds: string[] }) | null;
  docsOverdue: boolean;
  hoursLeft: number | null;
  overEmergencyLimit: boolean;
}

/** `emergencyPolicy` of `GET /records/:id`: the building's current limit and hours for the E-T1 dialog. */
export interface ApiEmergencyPolicy {
  limitVnd: string;
  docHours: number;
}

/** The web `EmergencyInfo` keeps amounts as numbers (the demo shape); 15-digit VND stays exact in a double. */
export const mapEmergency = (row: ApiEmergency): EmergencyInfo => ({
  startedAt: row.startedAt,
  startedBy: row.startedBy,
  reason: row.reason,
  estimatedAmountVnd: Number(row.estimatedAmountVnd),
  contractorName: row.contractorName,
  limitVnd: Number(row.limitVnd),
  docsDueAt: row.docsDueAt,
  ...(row.docsSubmittedAt ? { docsSubmittedAt: row.docsSubmittedAt } : {}),
  ...(row.lateReason ? { lateReason: row.lateReason } : {}),
  plannedEndDate: row.plannedEndDate,
  hoursLeft: row.hoursLeft,
  docsOverdue: row.docsOverdue,
  overEmergencyLimit: row.overEmergencyLimit,
  postReviewOutcome: row.postReviewOutcome,
  postReviewRejection: row.postReviewRejection ? { ...row.postReviewRejection } : null,
  closeDecision: row.closeDecision ? { ...row.closeDecision, attachmentIds: [...row.closeDecision.attachmentIds] } : null,
});

export const mapEmergencyPolicy = (row: ApiEmergencyPolicy | null | undefined) =>
  row ? { limitVnd: Number(row.limitVnd), docHours: row.docHours } : undefined;

const requireVersion = (expectedVersion: number | undefined): number => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return expectedVersion;
};

const amountString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  return typeof value === 'string' ? value : '';
};

/** Web `startEmergencyRepair` payload → `StartEmergencyRepairDto` (amount sent as an integer string). */
export const toStartEmergencyBody = (payload: unknown, expectedVersion: number | undefined) => {
  const row = asRecord(payload);
  return {
    version: requireVersion(expectedVersion),
    reason: asString(row.reason),
    contractorName: asString(row.contractorName),
    estimatedAmountVnd: amountString(row.estimatedAmountVnd),
    plannedEndDate: asString(row.plannedEndDate),
  };
};

/** Web `closePostReviewRejected` payload → `ClosePostReviewRejectedDto`. */
export const toClosePostReviewBody = (payload: unknown, expectedVersion: number | undefined) => {
  const row = asRecord(payload);
  const attachmentIds = asStringArray(row.attachmentIds);
  return {
    version: requireVersion(expectedVersion),
    reason: asString(row.reason),
    ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
  };
};
