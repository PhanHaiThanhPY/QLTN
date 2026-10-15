import { FREQUENCY_MONTHS } from '@/domain/constants';
import type { CheckResult, Frequency } from '@/domain/constants';
import type { IsoDate, MaintenanceOccurrence } from '@/domain/types';
import { addDays, addMonthsClamped } from '@/utils/date';
import { getDb } from '@/storage/db';
import { BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D, USER_ID } from './seed-reference';
import type { SeedRunner } from './seed-runner';

interface EquipmentSeed {
  key: string;
  buildingId: string;
  bql: string;
  code: string;
  name: string;
  type: string;
  locationId: string;
  /** Equipment data; months (plus optional days for the warranty) are offsets from the seed day D. */
  equipment?: { model: string; supplier: string; installMonths: number; warrantyMonths: number; warrantyDays?: number };
}

interface ItemSeed extends EquipmentSeed {
  checklist: { label: string; required: boolean }[];
}

const ITEMS: ItemSeed[] = [
  {
    key: 'TM', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'TM-A01', name: 'Thang máy số 1', type: 'Thang máy', locationId: 'loc-a-roof',
    equipment: { model: 'Mitsubishi NexWay 1000kg', supplier: 'Công ty TNHH Thang máy & Bảo trì Nam Long', installMonths: -18, warrantyMonths: 6 },
    checklist: [
      { label: 'Kiểm tra phanh và bộ hãm an toàn', required: true },
      { label: 'Vệ sinh, tra dầu ray dẫn hướng', required: true },
      { label: 'Kiểm tra nút gọi, chuông và điện thoại cứu hộ', required: true },
      { label: 'Kiểm tra độ bằng tầng khi dừng', required: false },
    ],
  },
  {
    key: 'BOM', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'BOM-A01', name: 'Bơm nước sinh hoạt', type: 'Bơm nước', locationId: 'loc-a-b2',
    equipment: { model: 'Ebara 3M 40-200/7.5', supplier: 'Công ty CP Cơ điện Sao Việt', installMonths: -40, warrantyMonths: -16 },
    checklist: [
      { label: 'Kiểm tra áp lực đầu đẩy', required: true },
      { label: 'Kiểm tra rò rỉ phớt và mặt bích', required: true },
      { label: 'Đo dòng điện động cơ', required: true },
      { label: 'Vệ sinh lưới lọc', required: false },
    ],
  },
  {
    key: 'MPD', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'MPD-A01', name: 'Máy phát điện dự phòng', type: 'Máy phát điện', locationId: 'loc-a-elec',
    equipment: { model: 'Cummins C250D5', supplier: 'Công ty CP Cơ điện Sao Việt', installMonths: -10, warrantyMonths: 14 },
    checklist: [
      { label: 'Chạy thử không tải 15 phút', required: true },
      { label: 'Kiểm tra mức nhiên liệu và dầu bôi trơn', required: true },
      { label: 'Kiểm tra ắc quy khởi động', required: true },
      { label: 'Kiểm tra bộ chuyển nguồn ATS', required: false },
    ],
  },
  {
    key: 'BC', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'BC-A01', name: 'Hệ thống báo cháy tự động', type: 'PCCC', locationId: 'loc-a-g',
    checklist: [
      { label: 'Thử đầu báo khói theo khu vực', required: true },
      { label: 'Kiểm tra tủ trung tâm báo cháy', required: true },
      { label: 'Thử chuông, đèn báo và nút ấn khẩn', required: true },
    ],
  },
  {
    key: 'CS', buildingId: BUILDING_B, bql: USER_ID.BQL_B, code: 'CS-B01', name: 'Chiếu sáng chung', type: 'Chiếu sáng', locationId: 'loc-b-g',
    checklist: [
      { label: 'Kiểm tra đèn sảnh và hành lang', required: true },
      { label: 'Kiểm tra đèn sự cố, đèn exit', required: true },
      { label: 'Kiểm tra hẹn giờ và cảm biến', required: false },
    ],
  },
  {
    key: 'TG', buildingId: BUILDING_B, bql: USER_ID.BQL_B, code: 'TG-B01', name: 'Hệ thống thông gió', type: 'Thông gió', locationId: 'loc-b-roof',
    checklist: [
      { label: 'Vệ sinh cánh quạt và lưới chắn', required: true },
      { label: 'Kiểm tra dây curoa, ổ bi', required: true },
      { label: 'Đo lưu lượng gió tại miệng hút', required: true },
    ],
  },
];

/**
 * Equipment without a maintenance plan, so every building has items for the equipment report and record form.
 * CAM-A01's warranty ends within 30 days of D; TD-D01's warranty has already expired (like BOM-A01).
 */
const EXTRA_ITEMS: EquipmentSeed[] = [
  {
    key: 'CSH', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'CS-A01', name: 'Chiếu sáng hầm xe B1', type: 'Chiếu sáng', locationId: 'loc-a-b1',
    equipment: { model: 'Rạng Đông LED tube T8 1m2', supplier: 'Công ty CP Bóng đèn Phích nước Rạng Đông', installMonths: -30, warrantyMonths: -6 },
  },
  {
    key: 'CAM', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'CAM-A01', name: 'Hệ thống camera an ninh', type: 'Camera/CCTV', locationId: 'loc-a-g',
    equipment: { model: 'Hikvision DS-7716NI-K4 + 24 camera', supplier: 'Công ty TNHH Giải pháp An ninh Toàn Cầu', installMonths: -24, warrantyMonths: 0, warrantyDays: 20 },
  },
  {
    key: 'CC', buildingId: BUILDING_A, bql: USER_ID.BQL_A, code: 'CC-A01', name: 'Cửa cuốn lối vào hầm', type: 'Cửa cuốn', locationId: 'loc-a-b1',
    equipment: { model: 'Austdoor S50i + motor YH500', supplier: 'Công ty CP Tập đoàn Austdoor', installMonths: -36, warrantyMonths: -12 },
  },
  {
    key: 'DHB', buildingId: BUILDING_B, bql: USER_ID.BQL_B, code: 'DH-B01', name: 'Điều hòa trung tâm VRV văn phòng', type: 'Điều hòa trung tâm', locationId: 'loc-b-3',
    equipment: { model: 'Daikin VRV A RXQ20AYM', supplier: 'Công ty TNHH Điện lạnh Minh Châu', installMonths: -14, warrantyMonths: 10 },
  },
  {
    key: 'CHC', buildingId: BUILDING_C, bql: USER_ID.BQL_B, code: 'CH-C01', name: 'Chiller & tháp giải nhiệt', type: 'Điều hòa trung tâm/Chiller', locationId: 'loc-c-roof',
    equipment: { model: 'Trane CVHE 350RT + tháp Liang Chi LBC-300', supplier: 'Công ty CP Cơ điện lạnh REE', installMonths: -60, warrantyMonths: -36 },
  },
  {
    key: 'BOMC', buildingId: BUILDING_C, bql: USER_ID.BQL_B, code: 'BOM-C01', name: 'Cụm bơm cấp nước sinh hoạt', type: 'Bơm nước', locationId: 'loc-c-b1',
    equipment: { model: 'Grundfos Hydro MPC-E 3 CRE 15-3', supplier: 'Công ty TNHH Cơ điện Đông Á', installMonths: -20, warrantyMonths: 4 },
  },
  {
    key: 'PCCC', buildingId: BUILDING_C, bql: USER_ID.BQL_B, code: 'PCCC-C01', name: 'Hệ thống chữa cháy sprinkler', type: 'PCCC', locationId: 'loc-c-g',
    equipment: { model: 'Tủ điều khiển Hochiki + bơm chữa cháy Pentax', supplier: 'Công ty TNHH Kỹ thuật Hòa Phát Xanh', installMonths: -48, warrantyMonths: -24 },
  },
  {
    key: 'TDD', buildingId: BUILDING_D, bql: USER_ID.BQL_B, code: 'TD-D01', name: 'Tủ điện tổng & bộ chuyển nguồn ATS', type: 'Điện', locationId: 'loc-d-elec',
    equipment: { model: 'Schneider Prisma P + ATS Socomec Atys', supplier: 'Công ty TNHH Điện Thăng Long', installMonths: -40, warrantyMonths: -3 },
  },
  {
    key: 'MPDD', buildingId: BUILDING_D, bql: USER_ID.BQL_B, code: 'MPD-D01', name: 'Máy phát điện dự phòng', type: 'Máy phát điện', locationId: 'loc-d-elec',
    equipment: { model: 'Denyo DCA-400SPK', supplier: 'Công ty CP Cơ điện Sao Việt', installMonths: -8, warrantyMonths: 16 },
  },
  {
    key: 'TMD', buildingId: BUILDING_D, bql: USER_ID.BQL_B, code: 'TM-D01', name: 'Thang máy khách số 1', type: 'Thang máy', locationId: 'loc-d-g',
    equipment: { model: 'Schindler 5500 1350kg', supplier: 'Công ty TNHH Thang máy Schindler Việt Nam', installMonths: -26, warrantyMonths: -2 },
  },
];

const findOccurrence = async (planId: string, date: string): Promise<MaintenanceOccurrence> => {
  const row = await getDb().occurrences.where('scheduleKey').equals(`${planId}|${date}`).first();
  if (!row) throw new Error(`Seed: missing occurrence ${planId} ${date}`);
  return row;
};

const answers = (occurrence: MaintenanceOccurrence, overrides: Record<number, { result: CheckResult; note?: string }> = {}) =>
  occurrence.checklist.map((entry, index) => ({
    templateItemId: entry.templateItemId,
    result: overrides[index]?.result ?? 'OK',
    note: overrides[index]?.note,
  }));

interface PerformOptions {
  date: IsoDate;
  /** Days between scheduled date and submission (late work). */
  submitAfterDays?: number;
  bql: string;
  performer: string;
  overrides?: Record<number, { result: CheckResult; note?: string }>;
}

/** Start, fill checklist with photo, and submit an occurrence. */
const performAndSubmit = async (seed: SeedRunner, occurrenceId: string, options: PerformOptions): Promise<IsoDate> => {
  const submitDate = addDays(options.date, options.submitAfterDays ?? 0);
  await seed.atDate(options.date, 8).as(options.bql).run('startMaintenance', 'MAINTENANCE_OCCURRENCE', occurrenceId);
  const photo = await seed.atDate(submitDate, 14).photo('MAINTENANCE_OCCURRENCE', occurrenceId, 'MAINTENANCE_RESULT', 'anh-bao-tri');
  const occurrence = (await getDb().occurrences.get(occurrenceId)) as MaintenanceOccurrence;
  await seed.atDate(submitDate, 15).run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', occurrenceId, {
    checklist: answers(occurrence, options.overrides),
    resultNote: 'Đã thực hiện đầy đủ các hạng mục theo checklist.',
    performerName: options.performer,
    attachmentIds: [photo],
  });
  return submitDate;
};

const confirm = (seed: SeedRunner, occurrenceId: string, kt: string, date: IsoDate, extra: Record<string, unknown> = {}) =>
  seed.atDate(date, 17).as(kt).run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', occurrenceId, extra);

interface PlanHandle {
  id: string;
  /** Period n date, computed with the same anchor rule as the generator. */
  period: (n: number) => IsoDate;
}

const createPlan = async (
  seed: SeedRunner,
  item: SeededItem,
  frequency: Frequency,
  anchorDate: IsoDate,
  confirmer: string,
  contractorName: string,
): Promise<PlanHandle> => {
  seed.atDate(addDays(anchorDate, -2), 9).as(item.bql);
  const created = await seed.run('createMaintenancePlan', 'MAINTENANCE_PLAN', undefined, {
    itemId: item.id,
    title: `Bảo trì định kỳ ${item.name.toLowerCase()}`,
    frequency,
    anchorDate,
    checklistTemplate: item.checklist,
    confirmationUserId: confirmer,
    contractorName,
  });
  const id = created.subjectId as string;
  await seed.run('activateMaintenancePlan', 'MAINTENANCE_PLAN', id);
  return { id, period: (n) => addMonthsClamped(anchorDate, n * FREQUENCY_MONTHS[frequency]) };
};

export type SeededItem = ItemSeed & { id: string };

const createItem = async (seed: SeedRunner, item: EquipmentSeed): Promise<string> => {
  const result = await seed.at(0, 9, 0, -7).as(item.bql).run('createMaintenanceItem', 'MAINTENANCE_ITEM', undefined, {
    buildingId: item.buildingId,
    code: item.code,
    name: item.name,
    type: item.type,
    locationId: item.locationId,
    ownerUserId: item.bql,
    model: item.equipment?.model,
    supplier: item.equipment?.supplier,
    installDate: item.equipment ? seed.date(0, item.equipment.installMonths) : undefined,
    warrantyUntil: item.equipment ? seed.date(item.equipment.warrantyDays ?? 0, item.equipment.warrantyMonths) : undefined,
  });
  return result.subjectId as string;
};

/**
 * Creates all equipment first, so every repair scenario (including SC-001..SC-003) can link to an item.
 * Returns the planned items in ITEMS order for seedMaintenance.
 */
export const seedMaintenanceItems = async (seed: SeedRunner): Promise<SeededItem[]> => {
  const items: SeededItem[] = [];
  for (const item of ITEMS) items.push({ ...item, id: await createItem(seed, item) });
  for (const item of EXTRA_ITEMS) await createItem(seed, item);
  return items;
};

export interface MaintenanceSeedHooks {
  /** Called while BT-005 is in progress; must create SC-004 from it and return its id. */
  createLinkedRepair: (occurrenceId: string, date: IsoDate) => Promise<string>;
}

/**
 * Seeds plans KH-01..KH-06 (on the items from seedMaintenanceItems) and occurrences BT-001..BT-013 (spec 10.3–10.4).
 * Each plan's timeline is replayed completely before the next plan exists, so codes stay grouped by plan.
 */
export const seedMaintenance = async (seed: SeedRunner, items: SeededItem[], hooks: MaintenanceSeedHooks): Promise<void> => {
  const [tm, bom, mpd, bc, cs, tg] = items;
  const { BQL_A, BQL_B, KT_A, KT_A2, KT_B } = USER_ID;

  // KH-01 Thang máy: BT-001 done on time, BT-002 done 2 days late, BT-003 overdue, BT-004 scheduled.
  const kh01 = await createPlan(seed, tm, 'MONTHLY', seed.date(-3, -2), KT_A, 'Công ty TNHH Thang máy & Bảo trì Nam Long');
  const bt001 = await findOccurrence(kh01.id, kh01.period(0));
  await performAndSubmit(seed, bt001.id, { date: kh01.period(0), bql: BQL_A, performer: 'Nam Long Elevator' });
  await confirm(seed, bt001.id, KT_A, kh01.period(0), { itemCondition: 'GOOD', conditionNote: 'Thang vận hành ổn định.' });
  await seed.atDate(addDays(kh01.period(1), -5), 6).system([BUILDING_A]);
  const bt002 = await findOccurrence(kh01.id, kh01.period(1));
  const lateDate = await performAndSubmit(seed, bt002.id, { date: kh01.period(1), submitAfterDays: 2, bql: BQL_A, performer: 'Nam Long Elevator' });
  await confirm(seed, bt002.id, KT_A, lateDate);
  await seed.atDate(addDays(kh01.period(2), -20), 6).system([BUILDING_A]);
  await seed.at(0, 6).system([BUILDING_A]);

  // KH-02 Bơm nước: BT-005 finds an issue and creates SC-004, then completes; BT-006 upcoming.
  const kh02 = await createPlan(seed, bom, 'MONTHLY', seed.date(5, -1), KT_A, 'Công ty CP Cơ điện Sao Việt');
  const bt005Date = kh02.period(0);
  const bt005 = await findOccurrence(kh02.id, bt005Date);
  await seed.atDate(bt005Date, 8).as(BQL_A).run('startMaintenance', 'MAINTENANCE_OCCURRENCE', bt005.id);
  const issuePhoto = await seed.atDate(bt005Date, 10).photo('MAINTENANCE_OCCURRENCE', bt005.id, 'MAINTENANCE_RESULT', 'ro-ri-phot-bom');
  const started = (await getDb().occurrences.get(bt005.id)) as MaintenanceOccurrence;
  await seed.run('saveMaintenanceProgress', 'MAINTENANCE_OCCURRENCE', bt005.id, {
    checklist: answers(started, { 1: { result: 'ISSUE', note: 'Phớt cơ khí bơm số 1 rò nước, cần thay.' } }),
    performerName: 'Kỹ thuật tòa nhà',
    attachmentIds: [issuePhoto],
  });
  seed.atDate(bt005Date, 11);
  await hooks.createLinkedRepair(bt005.id, bt005Date);
  const withRepair = (await getDb().occurrences.get(bt005.id)) as MaintenanceOccurrence;
  await seed.atDate(bt005Date, 15).as(BQL_A).run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt005.id, {
    checklist: answers(withRepair, { 1: { result: 'ISSUE', note: 'Phớt cơ khí bơm số 1 rò nước, đã lập hồ sơ sửa chữa.' } }),
    resultNote: 'Bơm vận hành được; phát hiện rò phớt bơm số 1, đã tạo hồ sơ sửa chữa.',
  });
  await confirm(seed, bt005.id, KT_A, bt005Date, { itemCondition: 'NEEDS_ATTENTION', conditionNote: 'Chờ thay phớt bơm số 1.' });
  await seed.at(0, 6).system([BUILDING_A]);

  // KH-03 Máy phát: BT-007 in progress (overdue), BT-008 scheduled.
  const kh03 = await createPlan(seed, mpd, 'MONTHLY', seed.date(-1), KT_A, 'Công ty CP Cơ điện Sao Việt');
  const bt007 = await findOccurrence(kh03.id, kh03.period(0));
  await seed.atDate(kh03.period(0), 9).as(BQL_A).run('startMaintenance', 'MAINTENANCE_OCCURRENCE', bt007.id);
  const running = (await getDb().occurrences.get(bt007.id)) as MaintenanceOccurrence;
  await seed.atDate(kh03.period(0), 10).run('saveMaintenanceProgress', 'MAINTENANCE_OCCURRENCE', bt007.id, {
    checklist: [{ templateItemId: running.checklist[0].templateItemId, result: 'OK' }],
    performerName: 'Kỹ thuật tòa nhà',
  });
  await seed.at(0, 6).system([BUILDING_A]);

  // KH-04 Báo cháy (6 tháng, KT-A2): BT-009 done, BT-010 waiting for review.
  const kh04 = await createPlan(seed, bc, 'SEMI_ANNUAL', seed.date(-2, -6), KT_A2, 'Công ty TNHH Kỹ thuật Hòa Phát Xanh');
  const bt009 = await findOccurrence(kh04.id, kh04.period(0));
  await performAndSubmit(seed, bt009.id, { date: kh04.period(0), bql: BQL_A, performer: 'Hòa Phát Xanh PCCC' });
  await confirm(seed, bt009.id, KT_A2, kh04.period(0));
  await seed.atDate(addDays(kh04.period(1), -20), 6).system([BUILDING_A]);
  const bt010 = await findOccurrence(kh04.id, kh04.period(1));
  await performAndSubmit(seed, bt010.id, { date: kh04.period(1), bql: BQL_A, performer: 'Hòa Phát Xanh PCCC' });
  await seed.at(0, 6).system([BUILDING_A]);

  // KH-05 Chiếu sáng tòa B: BT-011 cancelled, BT-012 upcoming.
  const kh05 = await createPlan(seed, cs, 'QUARTERLY', seed.date(5, -3), KT_B, 'Công ty TNHH Điện lạnh Minh Châu');
  const bt011 = await findOccurrence(kh05.id, kh05.period(0));
  await seed.atDate(addDays(kh05.period(0), -1), 10).as(BQL_B).run('cancelMaintenance', 'MAINTENANCE_OCCURRENCE', bt011.id, {
    reason: 'Gộp vào đợt cải tạo chiếu sáng sảnh do chủ đầu tư thực hiện.',
  });
  await seed.at(0, 6).system([BUILDING_B]);

  // KH-06 Thông gió tòa B: BT-013 sent back for rework.
  const kh06 = await createPlan(seed, tg, 'YEARLY', seed.date(-4), KT_B, 'Công ty TNHH Dịch vụ Kỹ thuật Thiên Phú');
  const bt013 = await findOccurrence(kh06.id, kh06.period(0));
  await performAndSubmit(seed, bt013.id, { date: kh06.period(0), bql: BQL_B, performer: 'Thiên Phú Service' });
  await seed.atDate(addDays(kh06.period(0), 1), 16).as(KT_B).run('requestMaintenanceRework', 'MAINTENANCE_OCCURRENCE', bt013.id, {
    reason: 'Thiếu ảnh đo lưu lượng gió tại miệng hút tầng mái.',
  });
  await seed.at(0, 6).system([BUILDING_B]);
};
