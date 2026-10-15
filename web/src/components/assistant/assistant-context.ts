export type AssistantScreen = 'dashboard' | 'tasks' | 'schedule' | 'records' | 'maintenance' | 'reports' | 'admin' | 'notifications' | 'other';

export interface AssistantContext {
  screen: AssistantScreen;
  label: string;
  shortLabel: string;
  description: string;
  suggestions: string[];
}

const CONTEXTS: Record<AssistantScreen, AssistantContext> = {
  dashboard: {
    screen: 'dashboard',
    label: 'Tổng quan vận hành',
    shortLabel: 'Tổng quan',
    description: 'Tóm tắt tình hình, điểm tích cực và việc cần chú ý.',
    suggestions: ['Tóm tắt hiện tại', 'Việc nào nên ưu tiên?', 'Điểm nào đang có rủi ro?'],
  },
  tasks: {
    screen: 'tasks',
    label: 'Công việc của tôi',
    shortLabel: 'Công việc',
    description: 'Đề xuất thứ tự xử lý và hỗ trợ cập nhật công việc.',
    suggestions: ['Sắp xếp việc cần làm', 'Việc nào sắp quá hạn?', 'Soạn cập nhật tiến độ'],
  },
  schedule: {
    screen: 'schedule',
    label: 'Lịch công việc',
    shortLabel: 'Lịch',
    description: 'Nhận xét lịch trống, lịch trùng và kế hoạch sắp xếp.',
    suggestions: ['Kiểm tra lịch trùng', 'Tóm tắt tuần này', 'Đề xuất lịch hẹn'],
  },
  records: {
    screen: 'records',
    label: 'Hồ sơ sửa chữa',
    shortLabel: 'Hồ sơ sửa chữa',
    description: 'Tìm thông tin thiếu và hồ sơ tương tự.',
    suggestions: ['Kiểm tra thông tin', 'Tìm tương tự', 'Soạn tờ trình'],
  },
  maintenance: {
    screen: 'maintenance',
    label: 'Bảo trì và thiết bị',
    shortLabel: 'Bảo trì',
    description: 'Tóm tắt tình trạng, lịch sử, bảo hành và checklist thực hiện.',
    suggestions: ['Tóm tắt tình trạng', 'Gợi ý checklist', 'Rà soát lịch bảo trì'],
  },
  reports: {
    screen: 'reports',
    label: 'Báo cáo',
    shortLabel: 'Báo cáo',
    description: 'Giải thích số liệu và tạo bản tóm tắt dễ chia sẻ.',
    suggestions: ['Giải thích số liệu', 'Tóm tắt báo cáo', 'Điểm cần lưu ý'],
  },
  admin: {
    screen: 'admin',
    label: 'Quản trị hệ thống',
    shortLabel: 'Quản trị',
    description: 'Giải thích cấu hình và quyền; không tự thay đổi thiết lập.',
    suggestions: ['Giải thích quyền hiện tại', 'Kiểm tra cấu hình', 'Điều gì cần xác nhận?'],
  },
  notifications: {
    screen: 'notifications',
    label: 'Thông báo',
    shortLabel: 'Thông báo',
    description: 'Tóm tắt các thông báo cần chú ý và liên kết tới dữ liệu nguồn.',
    suggestions: ['Tóm tắt thông báo mới', 'Việc nào cần phản hồi?'],
  },
  other: {
    screen: 'other',
    label: 'Màn hình hiện tại',
    shortLabel: 'màn hình này',
    description: 'Giải thích nội dung đang xem và gợi ý bước tiếp theo khi đủ dữ liệu.',
    suggestions: ['Tóm tắt nội dung', 'Tôi cần kiểm tra gì?'],
  },
};

export const getAssistantContext = (pathname: string): AssistantContext => {
  if (pathname === '/') return CONTEXTS.dashboard;
  if (pathname.startsWith('/tasks')) return CONTEXTS.tasks;
  if (pathname.startsWith('/maintenance/schedule')) return CONTEXTS.schedule;
  if (pathname.startsWith('/maintenance')) return CONTEXTS.maintenance;
  if (pathname.startsWith('/records')) return CONTEXTS.records;
  if (pathname.startsWith('/reports')) return CONTEXTS.reports;
  if (pathname.startsWith('/notifications')) return CONTEXTS.notifications;
  if (pathname.startsWith('/admin') || pathname.startsWith('/settings')) return CONTEXTS.admin;
  if (pathname.startsWith('/assistant')) return CONTEXTS.other;
  return CONTEXTS.other;
};

export interface AssistantReplyFacts {
  dashboard?: {
    openRepairCount: number;
    overdueRepairCount: number;
    completedRepairCount: number;
    myOpenTaskCount: number;
    upcomingMaintenanceCount: number;
    overdueMaintenanceCount: number;
    pendingApprovalCount: number;
    pendingReviewCount: number;
    needsInformationCount: number;
    pendingProposalCount: number;
    unresolvedCount: number;
  };
  taskSummary?: {
    openCount: number;
    overdueCount: number;
    upcomingCount: number;
  };
  scheduleSummary?: {
    total: number;
    overdueCount: number;
    upcomingCount: number;
    pendingReviewCount: number;
  };
  recordsSummary?: {
    total: number;
    overdueCount: number;
  };
}

export const getAssistantReply = (context: AssistantContext, prompt: string, facts: AssistantReplyFacts = {}): string => {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('tóm tắt')) {
    if (context.screen === 'dashboard' && facts.dashboard) {
      const dashboard = facts.dashboard;
      return `Tóm tắt hiện tại: ${dashboard.openRepairCount} hồ sơ đang mở, ${dashboard.overdueRepairCount} hồ sơ quá hạn, ${dashboard.overdueMaintenanceCount + dashboard.upcomingMaintenanceCount} lượt bảo trì đến hạn và ${dashboard.pendingApprovalCount} hồ sơ chờ phê duyệt. Đã hoàn tất ${dashboard.completedRepairCount} hồ sơ. Nên xử lý hồ sơ quá hạn trước, sau đó rà soát hồ sơ chờ phê duyệt. Nguồn: Tổng quan vận hành trong phạm vi được cấp quyền. Kết quả mô phỏng; chưa có thao tác nào được thực hiện.`;
    }
    if (context.screen === 'tasks' && facts.taskSummary) {
      const tasks = facts.taskSummary;
      return `Trong danh sách của bạn hiện có ${tasks.openCount} việc đang mở, ${tasks.overdueCount} việc quá hạn và ${tasks.upcomingCount} việc có hạn xử lý. Nên bắt đầu từ việc quá hạn rồi chuyển sang việc gần hạn. Đây là tóm tắt mô phỏng từ dữ liệu hiện tại; chưa có thao tác nào được thực hiện.`;
    }
    if (context.screen === 'schedule' && facts.scheduleSummary) {
      const schedule = facts.scheduleSummary;
      return `Theo bộ lọc hiện tại, lịch có ${schedule.total} lượt công việc; trong đó ${schedule.overdueCount} lượt quá hạn, ${schedule.upcomingCount} lượt sắp đến hạn và ${schedule.pendingReviewCount} lượt chờ kiểm tra. Tôi chưa tự đổi lịch hay tạo lịch hẹn. Đây là tóm tắt mô phỏng từ dữ liệu hiện tại.`;
    }
    if (context.screen === 'records' && facts.recordsSummary) {
      const records = facts.recordsSummary;
      return `Theo bộ lọc hiện tại có ${records.total} hồ sơ sửa chữa, trong đó ${records.overdueCount} hồ sơ quá hạn. Hãy mở dữ liệu nguồn để kiểm tra từng hồ sơ trước khi cập nhật. Đây là tóm tắt mô phỏng từ dữ liệu hiện tại.`;
    }
    return `Tôi chưa có đủ dữ liệu đã tải cho màn hình này để tạo tóm tắt chính xác. Bạn có thể thử lại sau khi dữ liệu hiển thị đầy đủ.`;
  }
  if (normalized.includes('trùng') || normalized.includes('xung đột')) {
    return `Trong phạm vi ${context.shortLabel.toLowerCase()}, tôi chưa thấy đủ dữ liệu để tự kết luận có lịch trùng. Bạn có thể mở bộ lọc theo tuần và kiểm tra các mục cùng thời điểm. Kết quả này là mô phỏng theo dữ liệu hiện tại.`;
  }
  if (normalized.includes('thiếu') || normalized.includes('bổ sung') || normalized.includes('kiểm tra thông tin')) {
    const count = facts.dashboard?.needsInformationCount;
    if (count !== undefined) {
      return `Có ${count} hồ sơ cần bổ sung thông tin trước khi đi tiếp. Hãy mở từng hồ sơ để xem lý do trả lại, tài liệu còn thiếu và người đang giữ bước xử lý. Nguồn: danh sách Hồ sơ sửa chữa trong phạm vi được cấp quyền. Kết quả mô phỏng; tôi không tự thay đổi dữ liệu.`;
    }
    return 'Hãy mở hồ sơ nguồn để kiểm tra các trường bắt buộc, tài liệu và lý do yêu cầu bổ sung. Tôi chỉ gợi ý, không tự thay đổi dữ liệu.';
  }
  if (normalized.includes('bao nhiêu') || normalized.includes('số lượng') || normalized.includes('thống kê')) {
    if (facts.dashboard) {
      const dashboard = facts.dashboard;
      if (normalized.includes('quá hạn')) return `Số liệu hiện tại: ${dashboard.overdueRepairCount} hồ sơ sửa chữa quá hạn và ${dashboard.overdueMaintenanceCount} lượt bảo trì quá hạn. Nguồn: Tổng quan vận hành, trong phạm vi tòa nhà được cấp quyền.`;
      if (normalized.includes('bảo trì') || normalized.includes('lịch')) return `Số liệu hiện tại: ${dashboard.overdueMaintenanceCount} lượt bảo trì quá hạn và ${dashboard.upcomingMaintenanceCount} lượt sắp đến hạn. Nguồn: Lịch bảo trì, trong phạm vi tòa nhà được cấp quyền.`;
      if (normalized.includes('duyệt') || normalized.includes('phê duyệt')) return `Số liệu hiện tại: ${dashboard.pendingApprovalCount} hồ sơ đang chờ phê duyệt. Nguồn: Tổng quan vận hành và chuỗi phê duyệt của hồ sơ.`;
      if (normalized.includes('hồ sơ') || normalized.includes('sửa chữa')) return `Số liệu hiện tại: ${dashboard.openRepairCount} hồ sơ đang mở, ${dashboard.completedRepairCount} hồ sơ đã hoàn tất và ${dashboard.unresolvedCount} hồ sơ chưa xử lý. Nguồn: Danh sách Hồ sơ sửa chữa.`;
    }
    if (facts.recordsSummary) return `Theo bộ lọc hiện tại có ${facts.recordsSummary.total} hồ sơ, trong đó ${facts.recordsSummary.overdueCount} hồ sơ quá hạn. Nguồn: danh sách Hồ sơ sửa chữa.`;
    return 'Tôi chưa có số liệu của màn hình hiện tại. Hãy để dữ liệu tải xong rồi hỏi lại; tôi chỉ trả lời trong phạm vi được cấp quyền.';
  }
  if (normalized.includes('tờ trình') || normalized.includes('phê duyệt')) {
    const pendingProposal = facts.dashboard?.pendingProposalCount;
    const pendingApproval = facts.dashboard?.pendingApprovalCount;
    if (pendingProposal !== undefined && pendingApproval !== undefined) {
      return `Có ${pendingProposal} hồ sơ đang chờ lập tờ trình và ${pendingApproval} hồ sơ đang trong chuỗi phê duyệt. Nên kiểm tra phương án, nhà thầu, giá trị và tài liệu trước khi gửi. Nguồn: Tổng quan và tab Tờ trình của từng hồ sơ.`;
    }
    return 'Hãy kiểm tra tờ trình, tài liệu và bước duyệt hiện tại trước khi gửi hoặc quyết định. Tôi không tự gửi hay phê duyệt thay bạn.';
  }
  if (normalized.includes('nguồn') || normalized.includes('tra cứu')) {
    return `Tôi chỉ trả lời từ dữ liệu đã tải trong phạm vi tòa nhà của tài khoản hiện tại. Nguồn có thể kiểm tra lại gồm Tổng quan, Hồ sơ sửa chữa, Công việc và Lịch bảo trì. Chưa có kết nối dữ liệu bên ngoài.`;
  }
  if (normalized.includes('ưu tiên') || normalized.includes('sắp xếp')) {
    return `Tôi đề xuất bắt đầu từ việc quá hạn hoặc có ảnh hưởng trực tiếp đến vận hành, sau đó xử lý các việc có hạn gần nhất. Hãy kiểm tra danh sách nguồn trước khi cập nhật trạng thái. Kết quả này là mô phỏng theo dữ liệu hiện tại.`;
  }
  return `Tôi đang xem ngữ cảnh “${context.label}”. Bạn có thể yêu cầu tôi tóm tắt, kiểm tra điểm thiếu hoặc chuẩn bị bản nháp. Mọi thao tác lưu, gửi, đổi lịch hay xác nhận vẫn cần bạn kiểm tra và thực hiện. Kết quả này là mô phỏng theo dữ liệu hiện tại.`;
};
