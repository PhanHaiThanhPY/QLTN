import type { DataSource } from 'typeorm';
import type { RepairRecord } from '../records/entities/repair-record.entity';
import { loadTaskFacts } from './task-facts';
import { currentStepDue } from './task-rules';

/** Deadline of a record's current step and whether it has passed (SPEC TK-S1 BR-TK-04), for B04 and B01 to reuse. */
export interface RecordDue {
  dueAt: Date | null;
  isOverdue: boolean;
}

export const recordDues = async (
  dataSource: DataSource,
  records: readonly RepairRecord[],
  now = new Date(),
): Promise<Map<string, RecordDue>> => {
  const facts = await loadTaskFacts(dataSource, records);
  return new Map(
    records.map((record) => {
      const recordFacts = facts.get(record.id);
      const dueAt = recordFacts ? currentStepDue(record, recordFacts) : null;
      return [record.id, { dueAt, isOverdue: Boolean(dueAt && dueAt.getTime() < now.getTime()) }] as const;
    }),
  );
};
