import type { Priority } from './constants';

export interface PriorityGuidance {
  priority: Priority;
  reason: string;
}

export interface ProposalGuidance {
  missing: string[];
  warnings: string[];
  summary: string;
}

export type OperationalRiskTone = 'crit' | 'warn' | 'good';

export interface OperationalRiskGuidance {
  tone: OperationalRiskTone;
  title: string;
  reason: string;
  count: number;
  href: string;
}

const normalize = (value: string): string => value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const includesAny = (value: string, terms: readonly string[]): boolean => terms.some((term) => value.includes(term));

/** AI-03 demo rule: suggest a priority from incident language without changing the form. */
export const suggestIncidentPriority = (title: string, description: string): PriorityGuidance | null => {
  const source = normalize(`${title} ${description}`.trim());
  if (source.length < 4) return null;
  if (includesAny(source, ['chay', 'khoi', 'chay no', 'dien giat', 'ngap', 'thang may ket', 'mat dien toan bo', 'nguy hiem'])) {
    return { priority: 'URGENT', reason: 'Có từ khóa liên quan đến an toàn, gián đoạn lớn hoặc nguy cơ phát sinh sự cố nghiêm trọng.' };
  }
  if (includesAny(source, ['ro ri', 'vo ong', 'khong hoat dong', 'hong', 'dieu hoa', 'bom nuoc', 'thang may'])) {
    return { priority: 'HIGH', reason: 'Có từ khóa cho thấy thiết bị hoặc hạng mục đang ảnh hưởng trực tiếp đến vận hành.' };
  }
  if (includesAny(source, ['son', 'trầy', 'tray', 'me', 'tham my', 've sinh'])) {
    return { priority: 'LOW', reason: 'Nội dung có dấu hiệu thuộc nhóm hoàn thiện hoặc ảnh hưởng thấp đến vận hành.' };
  }
  return { priority: 'NORMAL', reason: 'Chưa phát hiện tín hiệu cần nâng hoặc hạ mức ưu tiên theo rule hiện tại.' };
};

/** AI-04 demo rule: checks the proposal before it is submitted for approval. */
export const buildProposalGuidance = (input: {
  proposal: string;
  contractorName: string;
  amountVnd?: number;
  attachmentCount: number;
  priceAlertCount: number;
}): ProposalGuidance => {
  const missing: string[] = [];
  if (input.proposal.trim().length < 30) missing.push('Nội dung và phạm vi phương án');
  if (!input.contractorName.trim()) missing.push('Tên nhà thầu thực hiện');
  if (!input.amountVnd || input.amountVnd <= 0) missing.push('Giá trị đề nghị');
  if (input.attachmentCount === 0) missing.push('Tài liệu tờ trình');
  const warnings = input.priceAlertCount > 0 ? ['Có cảnh báo giá hoặc hạn mức cần giải trình trước khi trình.'] : [];
  const summary = input.proposal.trim() ? input.proposal.trim().slice(0, 180) : 'Chưa có nội dung tờ trình để tóm tắt.';
  return { missing, warnings, summary };
};

/** AI-07 demo rule: turns current operational counters into one explainable risk signal. */
export const buildOperationalRiskGuidance = (input: {
  overdueRepairCount: number;
  overdueMaintenanceCount: number;
  pendingApprovalCount: number;
  pendingReviewCount: number;
  unresolvedCount: number;
}): OperationalRiskGuidance => {
  const overdueCount = input.overdueRepairCount + input.overdueMaintenanceCount;
  if (input.unresolvedCount > 0) {
    return {
      tone: 'crit',
      title: 'Có hồ sơ chưa xử lý cần chốt hướng đi',
      reason: `${input.unresolvedCount} hồ sơ đã vượt giới hạn trình lại và cần BQL quyết định tiếp tục, đóng hoặc phát hành thông báo.`,
      count: input.unresolvedCount,
      href: '/records?status=UNRESOLVED',
    };
  }
  if (overdueCount > 0) {
    return {
      tone: 'crit',
      title: 'Tồn đọng quá hạn đang ảnh hưởng vận hành',
      reason: `${input.overdueRepairCount} hồ sơ sửa chữa và ${input.overdueMaintenanceCount} lượt bảo trì đã quá hạn theo dữ liệu hiện tại.`,
      count: overdueCount,
      href: '/records?overdue=1',
    };
  }
  if (input.pendingApprovalCount > 0 && input.pendingReviewCount > 0) {
    return {
      tone: 'warn',
      title: 'Có việc đang chờ ở nhiều điểm kiểm soát',
      reason: `${input.pendingApprovalCount} hồ sơ chờ duyệt và ${input.pendingReviewCount} lượt bảo trì chờ kiểm tra kết quả.`,
      count: input.pendingApprovalCount + input.pendingReviewCount,
      href: '/tasks',
    };
  }
  if (input.pendingApprovalCount > 0) {
    return {
      tone: 'warn',
      title: 'Chuỗi phê duyệt cần được theo dõi',
      reason: `${input.pendingApprovalCount} hồ sơ đang chờ các vai trò được cấu hình trong workflow xử lý.`,
      count: input.pendingApprovalCount,
      href: '/records',
    };
  }
  if (input.pendingReviewCount > 0) {
    return {
      tone: 'warn',
      title: 'Có kết quả bảo trì chờ kiểm tra',
      reason: `${input.pendingReviewCount} lượt bảo trì đã gửi kết quả nhưng chưa được xác nhận.`,
      count: input.pendingReviewCount,
      href: '/maintenance/schedule?status=PENDING_REVIEW',
    };
  }
  return {
    tone: 'good',
    title: 'Chưa phát hiện rủi ro vận hành nổi bật',
    reason: 'Các rule AI-07 chưa thấy tồn đọng quá hạn, hồ sơ chưa xử lý hoặc điểm chờ cần ưu tiên.',
    count: 0,
    href: '/tasks',
  };
};
