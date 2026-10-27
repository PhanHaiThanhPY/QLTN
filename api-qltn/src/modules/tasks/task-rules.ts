import type { DueKind } from '../../domain/building-config';
import type { RepairRecord } from '../records/entities/repair-record.entity';
import { RECORD_FINAL_STATUSES } from '../records/record-status-groups';
import { approvalStepOf, currentStepKeyOf, stepHolderOf } from '../records/record-steps';
import { MANAGER_TASK_BY_STATUS, REPAIR_TASK_KINDS, type RepairTaskKind } from './task-kinds';

const DAY_MS = 86_400_000;
const FINAL: readonly string[] = RECORD_FINAL_STATUSES;

/** Why a holder can no longer act (BR-TK-03): "(đã khóa)" for a locked account, else "(không còn hợp lệ)". */
export type HolderState = 'OK' | 'LOCKED' | 'INVALID';

/** An instalment waiting on approval or on its transfer (advance or settlement). */
export interface OpenInstalment {
  id: string;
  kind: 'TAM_UNG' | 'QUYET_TOAN';
  status: 'PENDING_APPROVAL' | 'PENDING_TRANSFER';
  currentStepKey: string | null;
  /** When the current step started (submission or the previous step's decision). */
  stepStartedAt: Date;
}

/** What the rules need besides the record, loaded in bulk by `task-facts.ts`. */
export interface RecordTaskFacts {
  /** Latest time the record entered its current status (audit trail, BR-TK-04). */
  enteredAt: Date | null;
  /** Start of the proposal step the record waits on (submission or the previous approval). */
  proposalStepStartedAt: Date | null;
  /** The open acceptance round and the member steps that already decided in it. */
  round: { startedAt: Date; memberStepKeys: string[]; decidedStepKeys: string[] } | null;
  instalments: OpenInstalment[];
  /** Holder check against the building's people and rules; `stepKey` null checks the record's manager. */
  holderState: (userId: string | null, stepKey: string | null) => HolderState;
  /** Display name of a user, for the "Cần phân công lại" line. */
  userName: (userId: string | null) => string;
}

/** Who receives a task: one user, every holder of a capability in the building, or the building's admins. */
export type TaskAssignee = { userId: string } | { capability: 'PAYMENT_CONFIRM' } | { role: 'ADMIN' };

export interface RecordTask {
  kind: RepairTaskKind;
  assignee: TaskAssignee;
  dueAt: Date | null;
  /** When the step started; orders tasks without a deadline (BR-TK-07). */
  startedAt: Date | null;
  /** Extra line: the blocked steps of "Cần phân công lại". */
  detail: string | null;
  /** Distinguishes two tasks of one kind on one record (two instalments). */
  key: string;
}

interface Blocked {
  label: string;
  userId: string | null;
  state: HolderState;
}

/** BR-TK-04: start + the snapshotted days of the kind; no days (or a kind without them) means no deadline. */
export const dueOf = (
  record: Pick<RepairRecord, 'taskDueDays'>,
  dueKind: DueKind | undefined,
  start: Date | null,
): Date | null => {
  if (!dueKind || !start) return null;
  const days = record.taskDueDays?.[dueKind];
  return typeof days === 'number' && days > 0 ? new Date(start.getTime() + days * DAY_MS) : null;
};

const kindDue = (record: RepairRecord, kind: RepairTaskKind, start: Date | null): Date | null =>
  dueOf(record, (REPAIR_TASK_KINDS[kind] as { dueKind?: DueKind }).dueKind, start);

const stepLabel = (record: RepairRecord, key: string): string => approvalStepOf(record, key)?.label ?? key;

const stateText = (state: HolderState): string => (state === 'LOCKED' ? 'đã khóa' : 'không còn hợp lệ');

/**
 * Open tasks of one repair record (SPEC TK-S1 BR-TK-01..03): who must act now, from the status, the step holders and
 * the same slots as `record-actions.ts`. A holder who can no longer act gets nothing; the record's manager (or the
 * building's admins when the manager is the one blocked) gets one "Cần phân công lại" listing every blocked step.
 */
export const tasksOfRecord = (record: RepairRecord, facts: RecordTaskFacts): RecordTask[] => {
  if (FINAL.includes(record.status)) return [];
  const tasks: RecordTask[] = [];
  const blocked: Blocked[] = [];
  const give = (
    kind: RepairTaskKind,
    userId: string | null,
    stepKey: string | null,
    label: string,
    task: Omit<RecordTask, 'kind' | 'assignee' | 'detail'>,
  ) => {
    const state = facts.holderState(userId, stepKey);
    if (state === 'OK' && userId) tasks.push({ kind, assignee: { userId }, detail: null, ...task });
    else blocked.push({ label, userId, state });
  };

  const managerKind = MANAGER_TASK_BY_STATUS[record.status];
  if (managerKind) {
    // B06 BR-E-04: the emergency documents keep their own deadline until the proposal is submitted.
    const dueAt =
      managerKind === 'SUBMIT_EMERGENCY_DOCS' && record.emergency && !record.emergency.docsSubmittedAt
        ? new Date(record.emergency.docsDueAt)
        : null;
    give(managerKind, record.managerUserId, null, 'BQL quản lý', {
      dueAt,
      startedAt: facts.enteredAt,
      key: managerKind,
    });
  }

  if (record.status === 'PENDING_CONFIRMATION') {
    const due = kindDue(record, 'CONFIRM_RECORD', facts.enteredAt);
    give('CONFIRM_RECORD', record.confirmationUserId, 'INTAKE', 'Xác nhận hiện trạng', {
      dueAt: due,
      startedAt: facts.enteredAt,
      key: 'CONFIRM_RECORD',
    });
  }

  const proposalStep = currentStepKeyOf(record);
  if (proposalStep) {
    const start = facts.proposalStepStartedAt ?? facts.enteredAt;
    give('APPROVE_PROPOSAL', stepHolderOf(record, proposalStep), proposalStep, stepLabel(record, proposalStep), {
      dueAt: kindDue(record, 'APPROVE_PROPOSAL', start),
      startedAt: start,
      key: 'APPROVE_PROPOSAL',
    });
  }

  if (record.status === 'PENDING_ACCEPTANCE' && facts.round) {
    const { round } = facts;
    const given = new Set<string>();
    for (const key of round.memberStepKeys.filter((step) => !round.decidedStepKeys.includes(step))) {
      const holder = stepHolderOf(record, key);
      // One task per person even when they hold two member steps.
      if (holder && given.has(holder)) continue;
      if (holder) given.add(holder);
      give('REVIEW_ACCEPTANCE', holder, key, stepLabel(record, key), {
        dueAt: kindDue(record, 'REVIEW_ACCEPTANCE', round.startedAt),
        startedAt: round.startedAt,
        key: `REVIEW_ACCEPTANCE:${holder ?? key}`,
      });
    }
  }

  for (const instalment of facts.instalments) {
    const advance = instalment.kind === 'TAM_UNG';
    if (instalment.status === 'PENDING_APPROVAL' && instalment.currentStepKey) {
      const kind: RepairTaskKind = advance ? 'APPROVE_ADVANCE' : 'APPROVE_PAYMENT';
      const step = instalment.currentStepKey;
      give(kind, stepHolderOf(record, step), step, stepLabel(record, step), {
        dueAt: kindDue(record, kind, instalment.stepStartedAt),
        startedAt: instalment.stepStartedAt,
        key: `${kind}:${instalment.id}`,
      });
    }
    if (instalment.status === 'PENDING_TRANSFER') {
      const kind: RepairTaskKind = advance ? 'RECORD_ADVANCE_PAYMENT' : 'RECORD_PAYMENT';
      // D-TK-2 (ADR-0001 R4): every PAYMENT_CONFIRM holder of the building.
      tasks.push({
        kind,
        assignee: { capability: 'PAYMENT_CONFIRM' },
        dueAt: null,
        startedAt: instalment.stepStartedAt,
        detail: null,
        key: `${kind}:${instalment.id}`,
      });
    }
  }

  if (record.status === 'POST_REVIEW_REJECTED') {
    give('CLOSE_POST_REVIEW', stepHolderOf(record, 'BOARD'), 'BOARD', stepLabel(record, 'BOARD'), {
      dueAt: null,
      startedAt: facts.enteredAt,
      key: 'CLOSE_POST_REVIEW',
    });
  }

  if (blocked.length > 0) {
    const managerOk = facts.holderState(record.managerUserId, null) === 'OK';
    tasks.push({
      kind: 'REASSIGN_REQUIRED',
      assignee: managerOk ? { userId: record.managerUserId } : { role: 'ADMIN' },
      dueAt: null,
      startedAt: facts.enteredAt,
      detail: blocked
        .map((row) => `Bước ${row.label} · ${facts.userName(row.userId)} (${stateText(row.state)})`)
        .join('; '),
      key: 'REASSIGN_REQUIRED',
    });
  }
  return tasks;
};

/** Deadline of the record's current step, for `GET /records` and `GET /records/:id` (BR-TK-04), whoever holds it. */
export const currentStepDue = (record: RepairRecord, facts: RecordTaskFacts): Date | null => {
  const open = tasksOfRecord(record, { ...facts, holderState: () => 'OK' });
  const dues = open.map((task) => task.dueAt).filter((due): due is Date => due !== null);
  return dues.length ? new Date(Math.min(...dues.map((due) => due.getTime()))) : null;
};
