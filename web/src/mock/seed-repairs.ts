import { APPROVAL_STEPS, DEFAULT_PROPOSAL_STEP_KEYS } from '@/domain/constants';
import type { ApprovalStepKey, Priority } from '@/domain/constants';
import { BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D, USER_ID } from './seed-reference';
import { getDb } from '@/storage/db';
import { signatureDataUrl } from './signature-art';
import type { SeedRunner } from './seed-runner';

const STAGES = [
  'DRAFT',
  'SUBMITTED',
  'CONFIRMED',
  'PROPOSED',
  'TECH_REVIEWED',
  'BOARD_APPROVED',
  'APPROVED',
  'STARTED',
  'BUILT',
  'ACCEPTANCE_SUBMITTED',
  'ACCEPTED',
  'PAYMENT_REQUESTED',
  'PAYMENT_APPROVED',
  'PAID',
  'COMPLETED',
] as const;
type Stage = (typeof STAGES)[number];

/** Stage reached after each approval step of the chain, in order. */
const APPROVAL_STAGES: Stage[] = ['TECH_REVIEWED', 'BOARD_APPROVED'];
/** Seeded records were created under the default proposal chain (TVKT → BQT). */
const DEMO_APPROVAL_STEPS = APPROVAL_STEPS.filter((step) => DEFAULT_PROPOSAL_STEP_KEYS.includes(step.key));

export const APPROVER_OF: Record<ApprovalStepKey, string> = {
  TECH_CONFIRM: USER_ID.KT_A,
  TECH: USER_ID.TVKT,
  BOARD: USER_ID.BQT,
};

interface Team {
  buildingId: string;
  bql: string;
  kt: string;
  contractor: string;
}

const TEAMS: Record<'A' | 'B' | 'C' | 'D', Team> = {
  A: { buildingId: BUILDING_A, bql: USER_ID.BQL_A, kt: USER_ID.KT_A, contractor: 'Công ty CP Cơ điện Sao Việt' },
  B: { buildingId: BUILDING_B, bql: USER_ID.BQL_B, kt: USER_ID.KT_B, contractor: 'Công ty TNHH Điện lạnh Minh Châu' },
  C: { buildingId: BUILDING_C, bql: USER_ID.BQL_B, kt: USER_ID.KT_B, contractor: 'Công ty CP Xây dựng Bình An' },
  D: { buildingId: BUILDING_D, bql: USER_ID.BQL_B, kt: USER_ID.KT_B, contractor: 'Công ty TNHH Dịch vụ Kỹ thuật Thiên Phú' },
};

interface ApprovalEvent {
  outcome: 'NEEDS_UPDATE' | 'REJECTED';
  at: ApprovalStepKey;
}

export interface RepairScenario {
  team: keyof typeof TEAMS;
  title: string;
  description: string;
  locationId: string;
  priority: Priority;
  /** Day offset (negative) of the first action. */
  startDay: number;
  stopAt: Stage;
  confirmerId?: string;
  /** Code of the maintenance item the record is about (same building). */
  itemCode?: string;
  /** "Không thuộc thiết bị cụ thể" (structural repairs). Records with neither this nor itemCode must stay DRAFT. */
  noItem?: boolean;
  /** Contractor and proposal text of the submitted proposal (defaults: the team's contractor, a generic text). */
  contractor?: string;
  proposalText?: string;
  baseAmount?: number;
  /** Decisions on earlier submissions; steps before `at` approve first. */
  proposalHistory?: ApprovalEvent[];
  /** Decision left open on the last submission (no resubmit). */
  finalDecision?: ApprovalEvent;
  constructionProgress?: number[];
  failAcceptanceFirst?: boolean;
  /** Reviewer note on the failed round and BQL note on the fix (defaults describe a leaking joint). */
  failAcceptanceNote?: string;
  fixAcceptanceNote?: string;
  /** Stop right after the failed acceptance (state NEEDS_REPAIR). */
  stopAfterFailedAcceptance?: boolean;
  /** Stop with the confirmer's request for more info (state NEEDS_RECORD_UPDATE). */
  requestUpdate?: string;
  closeNoRepair?: string;
  /** BQL starts emergency work right after submitting (state EMERGENCY_IN_PROGRESS). */
  emergency?: { reason: string; estimatedAmountVnd: number; contractorName: string };
}

const reached = (scenario: RepairScenario, stage: Stage): boolean => STAGES.indexOf(scenario.stopAt) >= STAGES.indexOf(stage);

const stepIndex = (key: ApprovalStepKey): number => DEMO_APPROVAL_STEPS.findIndex((step) => step.key === key);

/** Drives one record through the real workflow up to its target stage. */
export const playRepair = async (seed: SeedRunner, scenario: RepairScenario): Promise<string> => {
  const team = TEAMS[scenario.team];
  const amount = scenario.baseAmount ?? 18_500_000;
  let day = scenario.startDay;
  const step = (gap = 1): number => {
    day += gap;
    return day;
  };
  /** Approvers sign off the chain in order, one per day, up to (not including) `untilIndex`. */
  const approveUntil = async (untilIndex: number): Promise<void> => {
    for (const approval of DEMO_APPROVAL_STEPS.slice(0, untilIndex)) {
      await seed.at(step(), 15).as(APPROVER_OF[approval.key]).run('approveProposal', 'REPAIR_RECORD', id);
    }
  };

  const item = scenario.itemCode
    ? await getDb().maintenanceItems.where('buildingId').equals(team.buildingId).filter((row) => row.code === scenario.itemCode).first()
    : undefined;
  if (scenario.itemCode && !item) throw new Error(`Seed: missing item ${scenario.itemCode}`);
  seed.at(day, 8, 30).as(team.bql);
  const created = await seed.run('createRecord', 'REPAIR_RECORD', undefined, {
    maintenanceItemId: item?.id,
    noMaintenanceItem: scenario.noItem === true,
    buildingId: team.buildingId,
    locationId: scenario.locationId,
    title: scenario.title,
    description: scenario.description,
    priority: scenario.priority,
    confirmationUserId: scenario.confirmerId ?? team.kt,
  });
  const id = created.subjectId as string;
  const photo = await seed.photo('REPAIR_RECORD', id, 'SITE_PHOTO', 'anh-hien-truong');
  await seed.at(day, 9).run('saveRecordDraft', 'REPAIR_RECORD', id, { attachmentIds: [photo] });
  if (!reached(scenario, 'SUBMITTED')) return id;

  await seed.at(day, 10).run('submitRecord', 'REPAIR_RECORD', id);
  if (scenario.emergency) {
    await seed.at(day, 10, 30).run('startEmergencyRepair', 'REPAIR_RECORD', id, { ...scenario.emergency, plannedEndDate: seed.date(day + 3) });
    return id;
  }
  const confirmer = scenario.confirmerId ?? team.kt;
  if (scenario.requestUpdate) {
    await seed.at(step(), 9).as(confirmer).run('requestRecordUpdate', 'REPAIR_RECORD', id, { note: scenario.requestUpdate });
    return id;
  }
  if (scenario.closeNoRepair) {
    await seed.at(step(), 9).as(confirmer).run('closeNoRepair', 'REPAIR_RECORD', id, { note: scenario.closeNoRepair });
    return id;
  }
  if (!reached(scenario, 'CONFIRMED')) return id;
  await seed.at(step(), 9).as(confirmer).run('confirmRepair', 'REPAIR_RECORD', id, {
    note: 'Đã kiểm tra hiện trường, xác nhận cần sửa chữa.',
  });
  if (!reached(scenario, 'PROPOSED')) return id;

  seed.at(step(2), 10).as(team.bql);
  const proposalFile = await seed.pdf('REPAIR_RECORD', id, 'PROPOSAL', 'To trinh');
  const proposal = {
    proposal: scenario.proposalText ?? 'Thuê nhà thầu đáp ứng tiến độ 10 ngày, bảo hành 12 tháng.',
    contractorName: scenario.contractor ?? team.contractor,
    amountVnd: amount,
    attachmentIds: [proposalFile],
    signature: signatureDataUrl(team.bql),
  };
  await seed.run('submitProposal', 'REPAIR_RECORD', id, proposal);
  for (const event of scenario.proposalHistory ?? []) {
    await approveUntil(stepIndex(event.at));
    const action = event.outcome === 'NEEDS_UPDATE' ? 'requestProposalUpdate' : 'rejectProposal';
    const reason = event.outcome === 'NEEDS_UPDATE' ? 'Bổ sung bảng khối lượng chi tiết theo hạng mục.' : 'Giá còn cao so với mặt bằng, cần thương lượng lại.';
    await seed.at(step(), 14).as(APPROVER_OF[event.at]).run(action, 'REPAIR_RECORD', id, { reason });
    await seed.at(step(2), 9).as(team.bql).run('resubmitProposal', 'REPAIR_RECORD', id, {
      ...proposal,
      proposal: `${proposal.proposal} Đã cập nhật theo ý kiến người duyệt.`,
    });
  }
  if (scenario.finalDecision) {
    await approveUntil(stepIndex(scenario.finalDecision.at));
    await seed.at(step(), 14).as(APPROVER_OF[scenario.finalDecision.at]).run('requestProposalUpdate', 'REPAIR_RECORD', id, {
      reason: 'Bổ sung bản vẽ hiện trạng và tiến độ thi công chi tiết.',
    });
    return id;
  }
  const approvals = APPROVAL_STAGES.filter((stage) => reached(scenario, stage)).length;
  await approveUntil(approvals);
  if (!reached(scenario, 'STARTED')) return id;

  const startDate = seed.date(step(2));
  seed.at(day, 8).as(team.bql);
  await seed.run('startConstruction', 'REPAIR_RECORD', id, { startDate, plannedEndDate: seed.date(day + 10) });
  for (const progress of scenario.constructionProgress ?? [100]) {
    const image = await seed.at(step(3), 16).photo('REPAIR_RECORD', id, 'CONSTRUCTION', `thi-cong-${progress}`);
    await seed.run('updateConstruction', 'REPAIR_RECORD', id, {
      progressPercent: progress,
      note: `Cập nhật tiến độ thi công đạt ${progress}%.`,
      attachmentIds: [image],
    });
  }
  if (!reached(scenario, 'ACCEPTANCE_SUBMITTED')) return id;

  const result = await seed.at(step(), 9).photo('REPAIR_RECORD', id, 'ACCEPTANCE', 'anh-ket-qua');
  await seed.run('submitAcceptance', 'REPAIR_RECORD', id, {
    completedDate: seed.date(day),
    note: 'Hoàn thành thi công, đề nghị nghiệm thu.',
    attachmentIds: [result],
  });
  if (scenario.failAcceptanceFirst) {
    await seed.at(step(), 10).as(confirmer).run('failAcceptance', 'REPAIR_RECORD', id, {
      note: scenario.failAcceptanceNote ?? 'Mối nối còn rò rỉ nhẹ, chưa đạt yêu cầu.',
    });
    if (scenario.stopAfterFailedAcceptance) return id;
    const fixed = await seed.at(step(), 9).as(team.bql).photo('REPAIR_RECORD', id, 'ACCEPTANCE', 'anh-sau-khac-phuc');
    await seed.run('resubmitAcceptance', 'REPAIR_RECORD', id, {
      note: scenario.fixAcceptanceNote ?? 'Đã xử lý lại mối nối, kiểm tra kín nước.',
      attachmentIds: [fixed],
    });
  }
  if (!reached(scenario, 'ACCEPTED')) return id;

  seed.at(step(), 10).as(confirmer);
  const report = await seed.pdf('REPAIR_RECORD', id, 'ACCEPTANCE', 'Bien ban nghiem thu');
  await seed.run('passAcceptance', 'REPAIR_RECORD', id, { note: 'Đạt yêu cầu kỹ thuật.', reportAttachmentIds: [report] });
  await seed.at(day, 15).as(USER_ID.TVKT).run('passAcceptance', 'REPAIR_RECORD', id, { note: 'TVKT thống nhất kết quả nghiệm thu.' });
  if (!reached(scenario, 'PAYMENT_REQUESTED')) return id;

  seed.at(step(), 9).as(team.bql);
  const requestFile = await seed.pdf('REPAIR_RECORD', id, 'PAYMENT_REQUEST', 'De nghi thanh toan');
  await seed.run('submitPaymentRequest', 'REPAIR_RECORD', id, { amountVnd: amount, attachmentIds: [requestFile] });
  if (!reached(scenario, 'PAYMENT_APPROVED')) return id;
  await seed.at(step(), 14).as(USER_ID.BQT).run('approvePayment', 'REPAIR_RECORD', id);
  if (!reached(scenario, 'PAID')) return id;

  seed.at(step(), 10).as(team.bql);
  const proof = await seed.pdf('REPAIR_RECORD', id, 'PAYMENT_PROOF', 'Uy nhiem chi');
  await seed.run('recordPayment', 'REPAIR_RECORD', id, {
    amountVnd: amount,
    paidDate: seed.date(day),
    reference: `UNC-${seed.date(day).replace(/-/g, '')}`,
    attachmentIds: [proof],
  });
  if (!reached(scenario, 'COMPLETED')) return id;
  await seed.at(day, 15).run('completeRecord', 'REPAIR_RECORD', id);
  return id;
};

/** SC-001..SC-003 (SC-004 is created from maintenance occurrence BT-005). SC-001 is a draft not yet tied to equipment. */
export const EARLY_SCENARIOS: RepairScenario[] = [
  {
    team: 'A', title: 'Bong tróc sơn tường hành lang tầng 5', locationId: 'loc-a-5', priority: 'LOW', startDay: -1, stopAt: 'DRAFT',
    description: 'Mảng sơn tường khoảng 2m² bị bong tróc gần cửa thang thoát hiểm.',
  },
  {
    team: 'A', title: 'Rò rỉ nước trần sảnh chính', locationId: 'loc-a-g', priority: 'HIGH', startDay: -6, stopAt: 'SUBMITTED',
    noItem: true,
    description: 'Trần thạch cao sảnh chính có vệt ố và nhỏ giọt khi mưa lớn, nghi rò từ ống thoát nước tầng 2.',
  },
  {
    team: 'A', title: 'Đèn chiếu sáng hầm B1 chập chờn', locationId: 'loc-a-b1', priority: 'NORMAL', startDay: -10, stopAt: 'SUBMITTED',
    itemCode: 'CS-A01',
    description: 'Dãy đèn khu vực ô đỗ 40–60 hầm B1 chập chờn vào buổi tối, một số bóng tắt hẳn.',
    confirmerId: USER_ID.KT_A_OLD,
    requestUpdate: 'Bổ sung ảnh chụp tủ điện chiếu sáng và thời điểm xảy ra sự cố.',
  },
];

/**
 * SC-005..SC-021 (SC-016 in building C, SC-017 in building D; SC-018/019 are earlier repairs of TM-A01 for the alerts demo
 * and the repeated-failure history — SC-018 fails its first acceptance; SC-020 is an emergency repair whose documents are
 * overdue; SC-021 is a draft not yet tied to equipment, like SC-001).
 */
export const LATE_SCENARIOS: RepairScenario[] = [
  {
    team: 'A', title: 'Thay gioăng cửa kính sảnh', locationId: 'loc-a-g', priority: 'NORMAL', startDay: -12, stopAt: 'PROPOSED', baseAmount: 9_800_000,
    noItem: true,
    description: 'Gioăng cao su cửa kính tự động sảnh chính bị lão hóa, cửa đóng không kín, vào nước khi mưa.',
  },
  {
    team: 'A', title: 'Sửa máy bơm tăng áp tầng mái', locationId: 'loc-a-roof', priority: 'HIGH', startDay: -14, stopAt: 'PROPOSED', baseAmount: 24_000_000,
    itemCode: 'BOM-A01',
    finalDecision: { outcome: 'NEEDS_UPDATE', at: 'TECH' },
    description: 'Máy bơm tăng áp số 2 phát tiếng ồn lớn, áp lực nước các tầng cao giảm vào giờ cao điểm.',
  },
  {
    team: 'A', title: 'Chống thấm sân thượng khu B', locationId: 'loc-a-roof', priority: 'HIGH', startDay: -24, stopAt: 'TECH_REVIEWED', baseAmount: 64_000_000,
    noItem: true,
    description: 'Lớp chống thấm sân thượng bị nứt, nước thấm xuống trần căn hộ tầng 20 sau các trận mưa.',
    proposalHistory: [{ outcome: 'NEEDS_UPDATE', at: 'TECH' }],
  },
  {
    team: 'A', title: 'Thay cáp tải thang máy số 1', locationId: 'loc-a-roof', priority: 'URGENT', startDay: -40, stopAt: 'TECH_REVIEWED', baseAmount: 120_000_000,
    description: 'Đơn vị bảo trì báo cáp tải thang máy số 1 mòn quá giới hạn, cần thay thế toàn bộ bộ cáp.',
    itemCode: 'TM-A01',
    contractor: 'Công ty TNHH Thang máy Thái Bình Dương',
    proposalText: 'Thay trọn bộ 6 sợi cáp tải 10mm và puly dẫn hướng, thi công 3 ngày ngoài giờ cao điểm, bảo hành 24 tháng.',
    proposalHistory: [{ outcome: 'NEEDS_UPDATE', at: 'TECH' }, { outcome: 'REJECTED', at: 'BOARD' }],
  },
  {
    team: 'A', title: 'Sơn lại vạch kẻ đường hầm B1', locationId: 'loc-a-b1', priority: 'LOW', startDay: -14, stopAt: 'APPROVED', baseAmount: 15_600_000,
    noItem: true,
    description: 'Vạch kẻ đường, mũi tên chỉ hướng và số ô đỗ hầm B1 bị mờ, gây khó khăn khi lưu thông.',
  },
  {
    team: 'A', title: 'Thay ống cấp nước trục đứng tầng 12', locationId: 'loc-a-12', priority: 'HIGH', startDay: -45, stopAt: 'STARTED', baseAmount: 42_000_000,
    noItem: true,
    description: 'Ống cấp nước trục đứng tầng 12 bị gỉ sét, rò rỉ tại các mối nối, cần thay đoạn ống dài 6m.',
    constructionProgress: [30, 60],
  },
  {
    team: 'A', title: 'Sửa hệ thống thoát nước hầm B2', locationId: 'loc-a-b2', priority: 'HIGH', startDay: -40, stopAt: 'ACCEPTANCE_SUBMITTED', baseAmount: 36_500_000,
    noItem: true,
    description: 'Hố ga thoát nước hầm B2 tắc nghẽn, nước đọng sau mưa, cần nạo vét và thay đoạn ống.',
    failAcceptanceFirst: true, stopAfterFailedAcceptance: true,
  },
  {
    team: 'A', title: 'Thay bộ điều khiển cửa cuốn hầm', locationId: 'loc-a-b1', priority: 'NORMAL', startDay: -50, stopAt: 'PAYMENT_REQUESTED', baseAmount: 21_000_000,
    itemCode: 'CC-A01',
    description: 'Bộ điều khiển cửa cuốn lối vào hầm hỏng, cửa không tự đóng mở theo thẻ từ.',
  },
  {
    team: 'A', title: 'Sửa camera an ninh sảnh và hầm', locationId: 'loc-a-g', priority: 'NORMAL', startDay: -55, stopAt: 'PAYMENT_APPROVED', baseAmount: 27_300_000,
    itemCode: 'CAM-A01',
    description: '6 camera an ninh tại sảnh và hầm mất tín hiệu, đầu ghi báo lỗi ổ cứng.',
  },
  {
    team: 'B', title: 'Thay quạt hút khói hành lang', locationId: 'loc-b-roof', priority: 'HIGH', startDay: -80, stopAt: 'COMPLETED', baseAmount: 48_000_000,
    itemCode: 'TG-B01',
    description: 'Quạt hút khói hành lang khu thương mại không khởi động khi thử nghiệm định kỳ.',
  },
  {
    team: 'B', title: 'Kiểm tra vết nứt tường văn phòng tầng 3', locationId: 'loc-b-3', priority: 'NORMAL', startDay: -20, stopAt: 'SUBMITTED',
    noItem: true,
    description: 'Khách thuê phản ánh vết nứt chân chim trên tường thạch cao văn phòng tầng 3.',
    closeNoRepair: 'Vết nứt bề mặt lớp bả, không ảnh hưởng kết cấu; xử lý trong đợt sơn định kỳ.',
  },
  {
    team: 'C', title: 'Thay bơm tuần hoàn tháp giải nhiệt', locationId: 'loc-c-roof', priority: 'HIGH', startDay: -12, stopAt: 'TECH_REVIEWED', baseAmount: 56_000_000,
    itemCode: 'CH-C01',
    description: 'Bơm tuần hoàn tháp giải nhiệt số 2 kêu to và nóng bất thường, lưu lượng nước giảm rõ.',
  },
  {
    team: 'D', title: 'Sửa tủ điện tổng phòng máy phát', locationId: 'loc-d-elec', priority: 'URGENT', startDay: -70, stopAt: 'COMPLETED', baseAmount: 33_000_000,
    itemCode: 'TD-D01',
    description: 'Aptomat tổng tủ điện phòng máy phát nhảy liên tục khi chuyển nguồn, đầu cos bị cháy sém.',
  },
  {
    team: 'A', title: 'Sửa bo điều khiển cửa tầng thang máy số 1', locationId: 'loc-a-roof', priority: 'HIGH', startDay: -100, stopAt: 'COMPLETED', baseAmount: 28_000_000,
    description: 'Cửa tầng thang máy số 1 đóng mở chập chờn, bo điều khiển cửa báo lỗi.',
    itemCode: 'TM-A01',
    contractor: 'Công ty TNHH Thang máy & Bảo trì Nam Long',
    proposalText: 'Thay bo điều khiển cửa tầng và cảm biến rèm hồng ngoại, cân chỉnh lại hành trình cửa, bảo hành 6 tháng.',
    failAcceptanceFirst: true,
    failAcceptanceNote: 'Cửa tầng 7 vẫn đóng chậm, cảm biến rèm hồng ngoại chưa cân chỉnh đạt.',
    fixAcceptanceNote: 'Đã cân chỉnh lại cảm biến rèm và hành trình cửa tầng 7, chạy thử 50 lượt không lỗi.',
  },
  {
    team: 'A', title: 'Thay ắc quy cứu hộ thang máy số 1', locationId: 'loc-a-roof', priority: 'NORMAL', startDay: -200, stopAt: 'COMPLETED', baseAmount: 12_000_000,
    description: 'Ắc quy bộ cứu hộ tự động (ARD) thang máy số 1 không giữ điện khi thử mất nguồn.',
    itemCode: 'TM-A01',
    contractor: 'Công ty CP Kỹ thuật Thang máy Việt Phát',
    proposalText: 'Thay bộ 4 ắc quy kín khí 12V-7Ah cho bộ cứu hộ ARD, thử mất nguồn 3 lần sau khi thay.',
  },
  {
    team: 'C', title: 'Vỡ ống cấp nước chính hầm B1', locationId: 'loc-c-b1', priority: 'URGENT', startDay: -2, stopAt: 'SUBMITTED',
    itemCode: 'BOM-C01',
    description: 'Ống cấp nước chính D90 tại hầm B1 bị vỡ mối nối, nước tràn khu vực đỗ xe, phải khóa van tổng.',
    emergency: {
      reason: 'Nước tràn hầm, nguy cơ chập điện tủ chiếu sáng; cần thay đoạn ống ngay trong đêm.',
      estimatedAmountVnd: 12_500_000,
      contractorName: 'Công ty CP Xây dựng Bình An',
    },
  },
  {
    team: 'B', title: 'Cửa kính tự động sảnh kẹt khi đóng', locationId: 'loc-b-g', priority: 'NORMAL', startDay: -3, stopAt: 'DRAFT',
    description: 'Cửa kính tự động sảnh B đóng không hết hành trình, đôi lúc kẹt nửa chừng vào giờ cao điểm.',
  },
];
