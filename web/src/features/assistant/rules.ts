import type { DashboardData } from '@/services/report-service';

export type OperationalSuggestionTone = 'crit' | 'warn' | 'accent' | 'good';

export interface OperationalSuggestion {
  key: string;
  title: string;
  description: string;
  count: number;
  href: string;
  tone: OperationalSuggestionTone;
}

export interface DailyBrief {
  hasPriority: boolean;
  headline: string;
  summary: string;
  nextStep: OperationalSuggestion | null;
}

/** Builds deterministic operational suggestions from the current dashboard counters. */
export const buildOperationalSuggestions = (data: DashboardData): OperationalSuggestion[] => {
  const suggestions: OperationalSuggestion[] = [];
  if (data.overdueRepairCount > 0) {
    suggestions.push({
      key: 'overdue-repairs',
      title: 'Xử lý hồ sơ sửa chữa quá hạn',
      description: 'Kiểm tra cập nhật mới nhất và bước đang chờ xử lý.',
      count: data.overdueRepairCount,
      href: '/records?overdue=1',
      tone: 'crit',
    });
  }
  if (data.needsInformationCount > 0) {
    suggestions.push({
      key: 'incomplete-records',
      title: 'Bổ sung hồ sơ đang thiếu thông tin',
      description: 'Mở hồ sơ để xem lý do trả lại và hoàn thiện trước khi gửi bước tiếp theo.',
      count: data.needsInformationCount,
      href: '/records?statusGroup=NEEDS_ACTION',
      tone: 'warn',
    });
  }
  if (data.pendingProposalCount > 0) {
    suggestions.push({
      key: 'pending-proposals',
      title: 'Hoàn thiện tờ trình sửa chữa',
      description: 'Kiểm tra phương án, nhà thầu, giá trị và tài liệu trước khi trình duyệt.',
      count: data.pendingProposalCount,
      href: '/records?status=PENDING_PROPOSAL',
      tone: 'accent',
    });
  }
  if (data.unresolvedCount > 0) {
    suggestions.push({
      key: 'unresolved-records',
      title: 'Rà soát hồ sơ chưa xử lý',
      description: 'Xem lý do bị từ chối ở lần trình cuối và quyết định hướng xử lý tiếp theo.',
      count: data.unresolvedCount,
      href: '/records?status=UNRESOLVED',
      tone: 'crit',
    });
  }
  if (data.overdueMaintenance.length > 0) {
    suggestions.push({
      key: 'overdue-maintenance',
      title: 'Rà soát lượt bảo trì quá hạn',
      description: 'Mở lịch để cập nhật kết quả hoặc điều chỉnh lịch.',
      count: data.overdueMaintenance.length,
      href: '/maintenance/schedule?indicator=OVERDUE',
      tone: 'warn',
    });
  }
  if (data.pendingApprovalCount > 0) {
    suggestions.push({
      key: 'pending-approvals',
      title: 'Theo dõi hồ sơ chờ phê duyệt',
      description: 'Kiểm tra chuỗi duyệt để tránh chậm tiến độ thanh toán.',
      count: data.pendingApprovalCount,
      href: '/records',
      tone: 'accent',
    });
  }
  if (data.pendingReviewCount > 0) {
    suggestions.push({
      key: 'pending-reviews',
      title: 'Kiểm tra kết quả bảo trì',
      description: 'Các lượt đã gửi kết quả và đang chờ người xác nhận.',
      count: data.pendingReviewCount,
      href: '/maintenance/schedule?status=PENDING_REVIEW',
      tone: 'warn',
    });
  }
  if (data.myOpenTaskCount > 0) {
    suggestions.push({
      key: 'my-tasks',
      title: 'Mở công việc được giao',
      description: 'Ưu tiên các công việc gần hạn trong danh sách của bạn.',
      count: data.myOpenTaskCount,
      href: '/tasks',
      tone: 'accent',
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      key: 'all-clear',
      title: 'Chưa có việc cần ưu tiên',
      description: 'Các chỉ số hiện tại chưa phát hiện cảnh báo cần xử lý ngay.',
      count: 0,
      href: '/tasks',
      tone: 'good',
    });
  }
  return suggestions;
};

/** Turns operational rules into a calm, human-readable first decision for the day. */
export const buildDailyBrief = (data: DashboardData, viewerName?: string): DailyBrief => {
  const suggestions = buildOperationalSuggestions(data);
  const nextStep = suggestions[0] ?? null;
  const name = viewerName ? `, ${viewerName}` : '';
  const greetingName = viewerName ? ` ${viewerName}` : ' bạn';

  if (!nextStep || nextStep.key === 'all-clear') {
    const notificationNote = data.unreadNotificationCount > 0
      ? ` Có ${data.unreadNotificationCount} thông báo mới, bạn có thể xem khi thuận tiện.`
      : '';
    return {
      hasPriority: false,
      headline: `Hôm nay bạn có thể yên tâm${name}`,
      summary: `Chưa có công việc ưu tiên nào cần bạn xử lý ngay. Bạn có thể nghỉ ngơi hoặc chủ động xem hoạt động khác khi thuận tiện.${notificationNote}`,
      nextStep: null,
    };
  }

  return {
    hasPriority: true,
    headline: `Chào${greetingName}, mình đã xếp việc ưu tiên`,
    summary: `Có ${nextStep.count} việc nên xem trước. Mình đề xuất bắt đầu từ đây.`,
    nextStep,
  };
};
