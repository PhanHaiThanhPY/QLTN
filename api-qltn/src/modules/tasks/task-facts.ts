import { In, type DataSource } from 'typeorm';
import { intakeStepKeyOf } from '../../domain/building-config';
import { AuditEvent, SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { RepairAcceptanceDecision } from '../records/entities/repair-acceptance-decision.entity';
import { RepairAcceptance } from '../records/entities/repair-acceptance.entity';
import { RepairPaymentDecision } from '../records/entities/repair-payment-decision.entity';
import { RepairPayment } from '../records/entities/repair-payment.entity';
import { RepairProposalDecision } from '../records/entities/repair-proposal-decision.entity';
import type { RepairRecord } from '../records/entities/repair-record.entity';
import {
  isActiveUserForApprovalStep,
  isActiveUserInRole,
  loadAssignmentContext,
  type AssignmentContext,
} from '../records/record-assignment';
import { approvalStepOf } from '../records/record-steps';
import type { HolderState, OpenInstalment, RecordTaskFacts } from './task-rules';

const latest = (dates: ReadonlyArray<Date | null | undefined>): Date | null => {
  const times = dates.filter((date): date is Date => Boolean(date)).map((date) => date.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
};

/**
 * BR-TK-03 holder check, as the actions themselves check it: a step holder must be active, in scope and eligible for
 * the step (`isActiveUserForApprovalStep`); the confirmer for the INTAKE step or, as BR-07 allows, as BQT; the manager
 * (stepKey null or MANAGER) as an active BQL of the record's area.
 */
const holderStateOf =
  (ctx: AssignmentContext, record: RepairRecord) =>
  (userId: string | null, stepKey: string | null): HolderState => {
    const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
    if (!user) return 'INVALID';
    if (!user.isActive) return 'LOCKED';
    const { buildingId, locationId } = record;
    if (stepKey === null || stepKey === 'MANAGER') {
      return isActiveUserInRole(ctx, user.id, 'BQL', buildingId, locationId) ? 'OK' : 'INVALID';
    }
    const key = stepKey === 'INTAKE' ? intakeStepKeyOf(record.workflowStageApprovalStepKeys) : stepKey;
    const step = approvalStepOf(record, key);
    if (step && isActiveUserForApprovalStep(ctx, user.id, step, buildingId, locationId)) return 'OK';
    const boardFallback =
      stepKey === 'INTAKE' && isActiveUserInRole(ctx, user.id, 'OWNERS_BOARD', buildingId, locationId);
    return boardFallback ? 'OK' : 'INVALID';
  };

/**
 * Everything `tasksOfRecord` needs for many records in a fixed number of queries: when each record entered its
 * status (audit rows whose status changed), the start of the proposal step, the open acceptance round with its
 * decisions, the instalments waiting on approval or transfer, and the people and rules of each building.
 */
export const loadTaskFacts = async (
  dataSource: DataSource,
  records: readonly RepairRecord[],
): Promise<Map<string, RecordTaskFacts>> => {
  if (records.length === 0) return new Map();
  const ids = records.map((record) => record.id);
  const [entries, approvals, rounds, payments, contexts] = await Promise.all([
    dataSource
      .getRepository(AuditEvent)
      .createQueryBuilder('a')
      .select('a.subject_id', 'recordId')
      .addSelect('a.to_status', 'status')
      .addSelect('MAX(a.created_at)', 'at')
      .where('a.subject_type = :type', { type: SUBJECT_TYPE.REPAIR_RECORD })
      .andWhere('a.subject_id IN (:...ids)', { ids })
      .andWhere('a.to_status IS NOT NULL AND a.from_status IS DISTINCT FROM a.to_status')
      .groupBy('a.subject_id')
      .addGroupBy('a.to_status')
      .getRawMany<{ recordId: string; status: string; at: Date }>(),
    dataSource.getRepository(RepairProposalDecision).findBy({ recordId: In(ids), outcome: 'APPROVED' }),
    dataSource.getRepository(RepairAcceptance).findBy({ recordId: In(ids), outcome: 'PENDING' }),
    dataSource
      .getRepository(RepairPayment)
      .findBy({ recordId: In(ids), status: In(['PENDING_APPROVAL', 'PENDING_TRANSFER']) }),
    Promise.all(
      [...new Set(records.map((record) => record.buildingId))].map(
        async (buildingId) => [buildingId, await loadAssignmentContext(dataSource.manager, buildingId)] as const,
      ),
    ),
  ]);
  const [acceptanceDecisions, paymentDecisions] = await Promise.all([
    rounds.length
      ? dataSource.getRepository(RepairAcceptanceDecision).findBy({ acceptanceId: In(rounds.map((row) => row.id)) })
      : [],
    payments.length
      ? dataSource.getRepository(RepairPaymentDecision).findBy({ paymentId: In(payments.map((row) => row.id)) })
      : [],
  ]);
  const contextOf = new Map(contexts);

  return new Map(
    records.map((record) => {
      const enteredAt = entries.find((row) => row.recordId === record.id && row.status === record.status)?.at ?? null;
      const round = rounds.find((row) => row.recordId === record.id);
      const instalments = payments
        .filter((row) => row.recordId === record.id)
        .map((row): OpenInstalment => ({
          id: row.id,
          kind: row.kind,
          status: row.status as OpenInstalment['status'],
          currentStepKey: row.currentStepKey,
          stepStartedAt:
            latest([
              row.submittedAt,
              ...paymentDecisions
                .filter((decision) => decision.paymentId === row.id && decision.revisionNo === row.revisionNo)
                .map((decision) => decision.createdAt),
            ]) ?? row.submittedAt,
        }));
      const ctx = contextOf.get(record.buildingId) ?? { users: [], rules: [] };
      const facts: RecordTaskFacts = {
        enteredAt: enteredAt ? new Date(enteredAt) : null,
        proposalStepStartedAt: latest([
          enteredAt ? new Date(enteredAt) : null,
          ...approvals
            .filter((row) => row.recordId === record.id && row.submissionId === record.currentSubmissionId)
            .map((row) => row.createdAt),
        ]),
        round: round
          ? {
              startedAt: round.createdAt,
              memberStepKeys: [...round.memberStepKeys],
              decidedStepKeys: acceptanceDecisions
                .filter((row) => row.acceptanceId === round.id)
                .map((row) => row.stepKey),
            }
          : null,
        instalments,
        holderState: holderStateOf(ctx, record),
        userName: (userId) => {
          const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
          return user ? `${user.fullName} (${user.code})` : 'Chưa có người';
        },
      };
      return [record.id, facts] as const;
    }),
  );
};
