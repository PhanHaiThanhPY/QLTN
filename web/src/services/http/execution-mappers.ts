import type { ExecutionHistory } from '@/domain/execution';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { asNumber, asRecord, asString, asStringArray } from '@/domain/validation';
import { MISSING_VERSION_MESSAGE } from './version';

/** `execution` of `GET /records/:id`; copied so screens never mutate the query cache. */
export const mapExecution = (row: ExecutionHistory | undefined): ExecutionHistory => ({
  construction: row?.construction ? { ...row.construction, updates: [...row.construction.updates] } : null,
  acceptances: (row?.acceptances ?? []).map((round) => ({
    ...round,
    memberStepKeys: [...round.memberStepKeys],
    decisions: round.decisions.map((decision) => ({ ...decision })),
  })),
  repairDraft: row?.repairDraft ? { ...row.repairDraft } : null,
});

const requireVersion = (expectedVersion: number | undefined): number => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return expectedVersion;
};

/** Keeps the listed keys of the payload that are present; strings trimmed, id lists as arrays, numbers as numbers. */
const pick = (payload: unknown, keys: { text?: readonly string[]; ids?: readonly string[]; numbers?: readonly string[] }) => {
  const row = asRecord(payload);
  const body: Record<string, unknown> = {};
  for (const key of keys.text ?? []) if (row[key] !== undefined) body[key] = asString(row[key]);
  for (const key of keys.ids ?? []) if (row[key] !== undefined) body[key] = asStringArray(row[key]);
  for (const key of keys.numbers ?? []) if (row[key] !== undefined) body[key] = asNumber(row[key]);
  return body;
};

/** Body of each S3 action (T10–T16); unknown payload keys are dropped instead of being sent. */
export const EXECUTION_BODY_KEYS = {
  startConstruction: { text: ['startDate', 'plannedEndDate', 'planNote'] },
  updateConstruction: { text: ['note'], ids: ['attachmentIds'], numbers: ['progressPercent'] },
  submitAcceptance: {
    text: ['completedDate', 'inspectedAt', 'inspectionLocation', 'content', 'otherMembers'],
    ids: ['photoAttachmentIds'],
  },
  resubmitAcceptance: {
    text: ['completedDate', 'inspectedAt', 'inspectionLocation', 'content', 'otherMembers'],
    ids: ['photoAttachmentIds'],
  },
  passAcceptance: { text: ['acceptanceId', 'note', 'signature'], ids: ['attachmentIds'] },
  failAcceptance: { text: ['acceptanceId', 'note', 'signature'], ids: ['attachmentIds'] },
  saveRepairEvidence: { text: ['note'], ids: ['attachmentIds'] },
} as const;
export type ExecutionAction = keyof typeof EXECUTION_BODY_KEYS;

export const toExecutionBody = (
  action: ExecutionAction,
  payload: unknown,
  expectedVersion: number | undefined,
): Record<string, unknown> => ({ version: requireVersion(expectedVersion), ...pick(payload, EXECUTION_BODY_KEYS[action]) });
