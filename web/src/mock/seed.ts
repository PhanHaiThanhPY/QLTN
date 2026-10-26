import type { IsoDate } from '@/domain/types';
import { deleteStaleDatabases, getDb } from '@/storage/db';
import { addDays } from '@/utils/date';
import { broadcastChange } from '@/services/change-channel';
import { registerAllHandlers } from '@/services/handlers';
import { enableSequentialIds, getSessionUserId, setFixedNow, setSessionUserId, todayVn } from '@/services/runtime';
import { DEFAULT_PROPOSAL_STEP_KEYS, ROLE, ROLE_CODE, ROLE_LABEL } from '@/domain/constants';
import { DEFAULT_WORKFLOW_STAGES, defaultConfigValues, templateValues } from '@/domain/building-config';
import { roleCapabilities } from '@/domain/permissions';
import type { RoleDefinition } from '@/domain/types';
import { ALL_BUILDINGS, assignmentRulesForBuilding, SEED_BUILDING_TEMPLATES, SEED_BUILDINGS, SEED_DEPARTMENTS, SEED_LOCATIONS, SEED_USERS, USER_ID } from './seed-reference';
import { EARLY_SCENARIOS, LATE_SCENARIOS, playRepair } from './seed-repairs';
import { seedMaintenance, seedMaintenanceItems } from './seed-maintenance';
import { SeedRunner } from './seed-runner';

const SEED_META_KEY = 'seed';
/** Demo scenarios exercise a multi-step chain; production users can replace it per building. */

export interface SeedInfo {
  seedDate: IsoDate;
  seededAt: string;
}

/** System roles (fixed) plus one custom role copied from BQL without emergency start, to demo role copying. */
const seedRoles = (seedDate: IsoDate): RoleDefinition[] => {
  const at = `${seedDate}T00:00:00.000Z`;
  const system = Object.values(ROLE).map((role) => ({
    id: `role-${role.toLowerCase()}`,
    code: ROLE_CODE[role],
    name: ROLE_LABEL[role],
    baseRole: role,
    capabilities: [...roleCapabilities(role)],
    isSystem: true,
    version: 1,
    createdAt: at,
    updatedAt: at,
  }));
  const staff: RoleDefinition = {
    id: 'role-bql-staff',
    code: 'VT-01',
    name: 'Nhân viên BQL (không xử lý khẩn cấp)',
    baseRole: 'BQL',
    capabilities: roleCapabilities('BQL').filter((capability) => capability !== 'EMERGENCY_START' && capability !== 'BUILDING_CONFIG'),
    isSystem: false,
    sourceRoleId: 'role-bql',
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  return [...system, staff];
};

/** SC-004: created from BT-005, confirmed, with a proposal draft still being prepared. */
const createLinkedRepair = async (seed: SeedRunner, occurrenceId: string, date: IsoDate): Promise<string> => {
  const db = getDb();
  const photos = await db.attachments.where('[subjectType+subjectId]').equals(['MAINTENANCE_OCCURRENCE', occurrenceId]).toArray();
  const created = await seed.atDate(date, 11).as(USER_ID.BQL_A).run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', occurrenceId, {
    title: 'Thay phớt cơ khí bơm nước sinh hoạt số 1',
    description: 'Bảo trì định kỳ phát hiện phớt cơ khí bơm số 1 rò nước liên tục, cần thay phớt và kiểm tra trục.',
    priority: 'HIGH',
    confirmationUserId: USER_ID.KT_A,
    attachmentIds: photos.map((photo) => photo.id),
  });
  const recordId = created.subjectId as string;
  await seed.atDate(addDays(date, 1), 10).run('submitRecord', 'REPAIR_RECORD', recordId);
  await seed.atDate(addDays(date, 2), 9).as(USER_ID.KT_A).run('confirmRepair', 'REPAIR_RECORD', recordId, {
    note: 'Phớt rò rõ rệt, cần thay trước khi hư trục bơm.',
  });
  await seed.atDate(addDays(date, 4), 10).as(USER_ID.BQL_A).run('saveProposalDraft', 'REPAIR_RECORD', recordId, {
    proposal: 'Thay phớt cơ khí và kiểm tra độ đảo trục bơm số 1.',
    contractorName: 'Công ty TNHH Kỹ thuật Hòa Phát Xanh',
  });
  return recordId;
};

/**
 * Clears the demo database and replays the seed scenarios at simulated times (spec section 10).
 * Ids are sequential during seeding so deep links stay stable across resets.
 */
export const seedDemo = async (seedDate: IsoDate = todayVn()): Promise<SeedInfo> => {
  registerAllHandlers();
  const db = getDb();
  const previousSession = getSessionUserId();
  enableSequentialIds(true);
  try {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
      await db.buildings.bulkAdd(SEED_BUILDINGS);
      await db.departments.bulkAdd(SEED_DEPARTMENTS);
      await db.locations.bulkAdd(SEED_LOCATIONS);
      await db.users.bulkAdd(SEED_USERS.map((user) => ({ ...user })));
      await db.roleDefs.bulkAdd(seedRoles(seedDate));
      // VT-01 is seeded, so custom roles created in the demo continue from VT-02.
      await db.meta.put({ key: 'counter:VT', value: 1 });
      await db.buildingConfigs.bulkAdd(
        SEED_BUILDINGS.map((building) => ({
          buildingId: building.id,
          ...(templateValues(SEED_BUILDING_TEMPLATES[building.id]) ?? defaultConfigValues()),
          approvalStepKeys: [...DEFAULT_PROPOSAL_STEP_KEYS],
          workflowStages: DEFAULT_WORKFLOW_STAGES.map((stage) => ({ ...stage, approvalStepKeys: [...stage.approvalStepKeys] })),
          assignmentRules: assignmentRulesForBuilding(),
          version: 1,
          updatedAt: `${seedDate}T00:00:00.000Z`,
          updatedBy: USER_ID.ADMIN,
        })),
      );
    });

    const seed = new SeedRunner(seedDate);
    const items = await seedMaintenanceItems(seed);
    for (const scenario of EARLY_SCENARIOS) await playRepair(seed, scenario);
    await seedMaintenance(seed, items, { createLinkedRepair: (occurrenceId, date) => createLinkedRepair(seed, occurrenceId, date) });
    for (const scenario of LATE_SCENARIOS) await playRepair(seed, scenario);

    // KT-A-CU leaves after handling SC-003, which now needs reassignment.
    await db.users.update(USER_ID.KT_A_OLD, { active: false, version: 2 });
    await seed.at(0, 7).system(ALL_BUILDINGS);

    const info: SeedInfo = { seedDate, seededAt: new Date().toISOString() };
    await db.meta.put({ key: SEED_META_KEY, value: info });
    return info;
  } finally {
    setFixedNow(null);
    enableSequentialIds(false);
    setSessionUserId(previousSession);
    broadcastChange();
  }
};

export const getSeedInfo = async (): Promise<SeedInfo | null> => {
  const row = await getDb().meta.get(SEED_META_KEY);
  const value = row?.value as SeedInfo | undefined;
  return value?.seedDate ? value : null;
};

/** Seeds once when the database is empty (first open); old demo databases are cleaned up in the background. */
export const ensureSeeded = async (): Promise<void> => {
  // Never awaited: cleanup must not block or fail boot.
  void deleteStaleDatabases();
  const seedIfEmpty = async (): Promise<void> => {
    const count = await getDb().users.count();
    const info = await getSeedInfo();
    if (count === 0 || !info) await seedDemo();
  };
  // Two tabs opened at once must not seed twice.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request('qltn-demo-seed', seedIfEmpty);
    return;
  }
  await seedIfEmpty();
};
