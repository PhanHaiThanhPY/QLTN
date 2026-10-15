import { DemoDatabase, setDb } from '@/storage/db';
import { registerAllHandlers } from '@/services/handlers';
import { executeCommand } from '@/services/command-engine';
import type { CommandResult } from '@/services/command-engine';
import type { SubjectType } from '@/domain/constants';
import { getDb } from '@/storage/db';
import { newId, setFixedNow, setSessionUserId } from '@/services/runtime';
import { vnDateTimeToIso } from '@/utils/date';
import { seedDemo } from '@/mock/seed';

let counter = 0;

/** Fresh isolated IndexedDB (fake) per test. */
export const useFreshDb = (): DemoDatabase => {
  counter += 1;
  const db = new DemoDatabase(`test-db-${counter}-${Math.random().toString(36).slice(2)}`);
  setDb(db);
  registerAllHandlers();
  return db;
};

export const SEED_DATE = '2026-10-12';

/** Seeds and pins the clock at noon of the seed day. */
export const seedAt = async (date = SEED_DATE): Promise<void> => {
  useFreshDb();
  await seedDemo(date);
  setFixedNow(new Date(vnDateTimeToIso(date, 12)));
};

export const asUser = (userId: string): void => setSessionUserId(userId);

export const versionOf = async (subjectType: SubjectType, id: string): Promise<number | undefined> => {
  const db = getDb();
  if (subjectType === 'REPAIR_RECORD') return (await db.records.get(id))?.version;
  if (subjectType === 'MAINTENANCE_OCCURRENCE') return (await db.occurrences.get(id))?.version;
  if (subjectType === 'MAINTENANCE_PLAN') return (await db.maintenancePlans.get(id))?.version;
  if (subjectType === 'BUILDING') return (await db.buildingConfigs.get(id))?.version ?? 0;
  if (subjectType === 'ACCOUNT') return (await db.users.get(id))?.version ?? (await db.roleDefs.get(id))?.version;
  return (await db.maintenanceItems.get(id))?.version;
};

export const run = async (
  action: string,
  subjectType: SubjectType,
  subjectId: string | undefined,
  payload: unknown = {},
  commandId = newId('cmd'),
): Promise<CommandResult> =>
  executeCommand({
    commandId,
    subjectType,
    subjectId,
    expectedVersion: subjectId ? await versionOf(subjectType, subjectId) : undefined,
    action,
    payload,
  });

export const recordByCode = async (code: string) => {
  const record = await getDb().records.where('code').equals(code).first();
  if (!record) throw new Error(`No record ${code}`);
  return record;
};

export const occurrenceByCode = async (code: string) => {
  const row = await getDb().occurrences.where('code').equals(code).first();
  if (!row) throw new Error(`No occurrence ${code}`);
  return row;
};
