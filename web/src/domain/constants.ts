export const ROLE = {
  ADMIN: 'ADMIN',
  BQL: 'BQL',
  TECH_CONFIRMER: 'TECH_CONFIRMER',
  TECH_CONSULTANT: 'TECH_CONSULTANT',
  OWNERS_BOARD: 'OWNERS_BOARD',
  ACCOUNTANT: 'ACCOUNTANT',
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị demo',
  BQL: 'Ban quản lý',
  TECH_CONFIRMER: 'Kỹ thuật',
  TECH_CONSULTANT: 'Tư vấn kỹ thuật (TVKT)',
  OWNERS_BOARD: 'Ban quản trị (BQT)',
  ACCOUNTANT: 'Kế toán',
};

/** Short codes shown for system roles. */
export const ROLE_CODE: Record<Role, string> = {
  ADMIN: 'ADMIN',
  BQL: 'BQL',
  TECH_CONFIRMER: 'KT',
  TECH_CONSULTANT: 'TVKT',
  OWNERS_BOARD: 'BQT',
  ACCOUNTANT: 'KTOAN',
};

export const REPAIR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  NEEDS_RECORD_UPDATE: 'NEEDS_RECORD_UPDATE',
  PENDING_PROPOSAL: 'PENDING_PROPOSAL',
  EMERGENCY_IN_PROGRESS: 'EMERGENCY_IN_PROGRESS',
  PENDING_TECH_APPROVAL: 'PENDING_TECH_APPROVAL',
  PENDING_TECH_REVIEW: 'PENDING_TECH_REVIEW',
  PENDING_BOARD_APPROVAL: 'PENDING_BOARD_APPROVAL',
  PENDING_CUSTOM_APPROVAL: 'PENDING_CUSTOM_APPROVAL',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'PENDING_CUSTOM_PAYMENT_APPROVAL',
  NEEDS_SUBMISSION_UPDATE: 'NEEDS_SUBMISSION_UPDATE',
  REJECTED_RESUBMITTABLE: 'REJECTED_RESUBMITTABLE',
  READY_FOR_CONSTRUCTION: 'READY_FOR_CONSTRUCTION',
  IN_CONSTRUCTION: 'IN_CONSTRUCTION',
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  NEEDS_REPAIR: 'NEEDS_REPAIR',
  PENDING_PAYMENT_REQUEST: 'PENDING_PAYMENT_REQUEST',
  PENDING_PAYMENT_APPROVAL: 'PENDING_PAYMENT_APPROVAL',
  NEEDS_PAYMENT_UPDATE: 'NEEDS_PAYMENT_UPDATE',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  COMPLETED: 'COMPLETED',
  CLOSED_NO_REPAIR: 'CLOSED_NO_REPAIR',
  UNRESOLVED: 'UNRESOLVED',
  CLOSED_WITHDRAWN: 'CLOSED_WITHDRAWN',
  POST_REVIEW_REJECTED: 'POST_REVIEW_REJECTED',
  CLOSED_POST_REVIEW_REJECTED: 'CLOSED_POST_REVIEW_REJECTED',
} as const;
export type RepairStatus = (typeof REPAIR_STATUS)[keyof typeof REPAIR_STATUS];

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  NEEDS_RECORD_UPDATE: 'Cần bổ sung thông tin',
  PENDING_PROPOSAL: 'Chờ lập tờ trình',
  EMERGENCY_IN_PROGRESS: 'Đang xử lý khẩn cấp',
  PENDING_TECH_APPROVAL: 'Chờ kỹ thuật duyệt',
  PENDING_TECH_REVIEW: 'Chờ TVKT thẩm định',
  PENDING_BOARD_APPROVAL: 'Chờ BQT duyệt',
  PENDING_CUSTOM_APPROVAL: 'Chờ phê duyệt theo workflow',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'Chờ duyệt thanh toán theo workflow',
  NEEDS_SUBMISSION_UPDATE: 'Cần bổ sung tờ trình',
  REJECTED_RESUBMITTABLE: 'Từ chối và được trình lại',
  READY_FOR_CONSTRUCTION: 'Chờ thi công',
  IN_CONSTRUCTION: 'Đang thi công',
  PENDING_ACCEPTANCE: 'Chờ nghiệm thu',
  NEEDS_REPAIR: 'Cần khắc phục',
  PENDING_PAYMENT_REQUEST: 'Chờ đề nghị thanh toán',
  PENDING_PAYMENT_APPROVAL: 'Chờ duyệt thanh toán',
  NEEDS_PAYMENT_UPDATE: 'Cần bổ sung thanh toán',
  PENDING_PAYMENT: 'Chờ thanh toán',
  COMPLETED: 'Hoàn tất',
  CLOSED_NO_REPAIR: 'Đóng vì không cần sửa',
  UNRESOLVED: 'Chưa xử lý',
  CLOSED_WITHDRAWN: 'Đóng do rút hồ sơ',
  POST_REVIEW_REJECTED: 'Không được duyệt hậu kiểm',
  CLOSED_POST_REVIEW_REJECTED: 'Đã đóng: không được duyệt hậu kiểm',
};

/** Compact status groups shown in lists and filters; the detailed status remains available in the record detail and audit history. */
export const REPAIR_STATUS_GROUP = {
  INTAKE: 'INTAKE',
  NEEDS_ACTION: 'NEEDS_ACTION',
  APPROVAL: 'APPROVAL',
  CONSTRUCTION: 'CONSTRUCTION',
  ACCEPTANCE: 'ACCEPTANCE',
  PAYMENT: 'PAYMENT',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
} as const;
export type RepairStatusGroup = (typeof REPAIR_STATUS_GROUP)[keyof typeof REPAIR_STATUS_GROUP];

export const REPAIR_STATUS_GROUP_LABEL: Record<RepairStatusGroup, string> = {
  INTAKE: 'Tiếp nhận',
  NEEDS_ACTION: 'Cần xử lý',
  APPROVAL: 'Phê duyệt',
  CONSTRUCTION: 'Thi công',
  ACCEPTANCE: 'Nghiệm thu',
  PAYMENT: 'Thanh toán',
  COMPLETED: 'Hoàn tất',
  CLOSED: 'Đã đóng',
};

export const REPAIR_STATUS_GROUP_BY_STATUS: Record<RepairStatus, RepairStatusGroup> = {
  DRAFT: 'INTAKE',
  PENDING_CONFIRMATION: 'INTAKE',
  NEEDS_RECORD_UPDATE: 'NEEDS_ACTION',
  PENDING_PROPOSAL: 'APPROVAL',
  EMERGENCY_IN_PROGRESS: 'CONSTRUCTION',
  PENDING_TECH_APPROVAL: 'APPROVAL',
  PENDING_TECH_REVIEW: 'APPROVAL',
  PENDING_BOARD_APPROVAL: 'APPROVAL',
  PENDING_CUSTOM_APPROVAL: 'APPROVAL',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'PAYMENT',
  NEEDS_SUBMISSION_UPDATE: 'NEEDS_ACTION',
  REJECTED_RESUBMITTABLE: 'NEEDS_ACTION',
  READY_FOR_CONSTRUCTION: 'CONSTRUCTION',
  IN_CONSTRUCTION: 'CONSTRUCTION',
  PENDING_ACCEPTANCE: 'ACCEPTANCE',
  NEEDS_REPAIR: 'NEEDS_ACTION',
  PENDING_PAYMENT_REQUEST: 'PAYMENT',
  PENDING_PAYMENT_APPROVAL: 'PAYMENT',
  NEEDS_PAYMENT_UPDATE: 'NEEDS_ACTION',
  PENDING_PAYMENT: 'PAYMENT',
  COMPLETED: 'COMPLETED',
  CLOSED_NO_REPAIR: 'CLOSED',
  UNRESOLVED: 'NEEDS_ACTION',
  CLOSED_WITHDRAWN: 'CLOSED',
  POST_REVIEW_REJECTED: 'NEEDS_ACTION',
  CLOSED_POST_REVIEW_REJECTED: 'CLOSED',
};

export const REPAIR_FINAL_STATUSES: readonly RepairStatus[] = [
  'COMPLETED',
  'CLOSED_NO_REPAIR',
  'UNRESOLVED',
  'CLOSED_WITHDRAWN',
  'CLOSED_POST_REVIEW_REJECTED',
];

/** Available approval steps. Administrators choose and order a subset per building. */
export interface ApprovalStepDefinition {
  key: string;
  status: RepairStatus;
  role: Role;
  roleDefId?: string;
  actor: string;
  label: string;
}

export const APPROVAL_STEPS = [
  { key: 'TECH_CONFIRM', status: 'PENDING_TECH_APPROVAL', role: 'TECH_CONFIRMER', actor: 'KT', label: 'Kỹ thuật duyệt' },
  { key: 'TECH', status: 'PENDING_TECH_REVIEW', role: 'TECH_CONSULTANT', actor: 'TVKT', label: 'TVKT thẩm định' },
  { key: 'BOARD', status: 'PENDING_BOARD_APPROVAL', role: 'OWNERS_BOARD', actor: 'BQT', label: 'BQT duyệt' },
  // ADR-0001 R3: the record's own manager as an acceptance member, valid only in the ACCEPTANCE stage.
  { key: 'MANAGER', status: 'PENDING_ACCEPTANCE', role: 'BQL', actor: 'BQL', label: 'BQL nghiệm thu' },
] as const satisfies readonly ApprovalStepDefinition[];
/** Built-in steps valid only in the ACCEPTANCE stage (mirrors api-qltn). */
export const ACCEPTANCE_ONLY_STEP_KEYS: readonly string[] = ['MANAGER'];
export type ApprovalStepKey = string;
/**
 * Default PROPOSAL stage of a new building (DF-02: TVKT reviews, then BQT approves). The proposal approval chain is
 * always this stage's steps (BR-10); the administrator can add, remove and reorder them.
 */
export const DEFAULT_PROPOSAL_STEP_KEYS: readonly ApprovalStepKey[] = ['TECH', 'BOARD'];
export type ApprovalStatus = RepairStatus;
export const APPROVAL_STATUSES: readonly RepairStatus[] = [
  ...APPROVAL_STEPS.filter((step) => !ACCEPTANCE_ONLY_STEP_KEYS.includes(step.key)).map((step) => step.status),
  'PENDING_CUSTOM_APPROVAL',
];

/** Lifecycle steps that can be enabled for each workflow stage. */
export const BUSINESS_WORKFLOW_STEPS = [
  { key: 'CREATE_RECORD', label: 'Tạo hồ sơ & lưu nháp', description: 'BQL ghi nhận yêu cầu và hoàn thiện thông tin ban đầu.', actor: 'BQL', stage: 'INTAKE', defaultApprovalStepKey: undefined },
  { key: 'SUBMIT_CONFIRMATION', label: 'Gửi xác nhận hiện trạng', description: 'Chuyển hồ sơ cho kỹ thuật kiểm tra tại hiện trường.', actor: 'BQL', stage: 'INTAKE', defaultApprovalStepKey: undefined },
  { key: 'CONFIRM_CONDITION', label: 'Kỹ thuật xác nhận hiện trạng', description: 'Kiểm tra sự cố, ảnh hiện trường và kết luận nhu cầu sửa chữa.', actor: 'KT', stage: 'INTAKE', defaultApprovalStepKey: 'TECH_CONFIRM' },
  { key: 'PREPARE_PROPOSAL', label: 'Lập tờ trình', description: 'BQL chuẩn bị phương án, chi phí dự kiến và hồ sơ trình duyệt.', actor: 'BQL', stage: 'PROPOSAL', defaultApprovalStepKey: 'TECH' },
  { key: 'START_CONSTRUCTION', label: 'Bắt đầu thi công', description: 'BQL xác nhận đủ điều kiện và mở giai đoạn thi công.', actor: 'BQL', stage: 'ACCEPTANCE', defaultApprovalStepKey: undefined },
  { key: 'UPDATE_PROGRESS', label: 'Cập nhật tiến độ', description: 'Ghi nhận tiến độ thực hiện cho đến khi hoàn thành.', actor: 'BQL', stage: 'ACCEPTANCE', defaultApprovalStepKey: undefined },
  { key: 'SUBMIT_ACCEPTANCE', label: 'Gửi nghiệm thu', description: 'Chuyển kết quả thi công sang bước nghiệm thu.', actor: 'BQL', stage: 'ACCEPTANCE', defaultApprovalStepKey: undefined },
  { key: 'PASS_ACCEPTANCE', label: 'Nghiệm thu đạt', description: 'KT và TVKT kiểm tra kết quả trước khi thanh toán.', actor: 'KT + TVKT', stage: 'ACCEPTANCE', defaultApprovalStepKey: 'TECH' },
  { key: 'PREPARE_PAYMENT', label: 'Lập đề nghị thanh toán', description: 'BQL tổng hợp chứng từ và gửi đề nghị thanh toán.', actor: 'BQL', stage: 'PAYMENT', defaultApprovalStepKey: undefined },
  { key: 'APPROVE_PAYMENT', label: 'BQT duyệt thanh toán', description: 'BQT kiểm tra hồ sơ và quyết định thanh toán.', actor: 'BQT', stage: 'PAYMENT', defaultApprovalStepKey: 'BOARD' },
  { key: 'RECORD_PAYMENT', label: 'Ghi nhận thanh toán', description: 'Ghi nhận khoản chi đã được thực hiện.', actor: 'BQL', stage: 'PAYMENT', defaultApprovalStepKey: undefined },
  { key: 'COMPLETE_RECORD', label: 'Đóng hoàn tất', description: 'Hệ thống đóng hồ sơ sau khi hoàn thành thanh toán.', actor: 'Hệ thống', stage: 'PAYMENT', defaultApprovalStepKey: undefined },
] as const;
export type BusinessWorkflowStepKey = (typeof BUSINESS_WORKFLOW_STEPS)[number]['key'];

export const OCCURRENCE_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REWORK: 'REWORK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUS)[keyof typeof OCCURRENCE_STATUS];

export const OCCURRENCE_STATUS_LABEL: Record<OccurrenceStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang thực hiện',
  PENDING_REVIEW: 'Chờ kiểm tra',
  REWORK: 'Cần làm lại',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

/** Statuses counted as overdue when scheduledDate is before today (spec 6.2). */
export const OCCURRENCE_OVERDUE_STATUSES: readonly OccurrenceStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'REWORK'];
export const OCCURRENCE_FINAL_STATUSES: readonly OccurrenceStatus[] = ['COMPLETED', 'CANCELLED'];

export const PLAN_STATUS = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', PAUSED: 'PAUSED' } as const;
export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm dừng',
};

export const FREQUENCY_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
} as const;
export type Frequency = keyof typeof FREQUENCY_MONTHS;
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  MONTHLY: 'Hằng tháng',
  QUARTERLY: 'Hằng quý',
  SEMI_ANNUAL: '6 tháng',
  YEARLY: 'Hằng năm',
};

export const ITEM_CONDITION = { UNKNOWN: 'UNKNOWN', GOOD: 'GOOD', NEEDS_ATTENTION: 'NEEDS_ATTENTION' } as const;
export type ItemCondition = (typeof ITEM_CONDITION)[keyof typeof ITEM_CONDITION];
export const ITEM_CONDITION_LABEL: Record<ItemCondition, string> = {
  UNKNOWN: 'Chưa rõ',
  GOOD: 'Tốt',
  NEEDS_ATTENTION: 'Cần chú ý',
};

export const CHECK_RESULT = {
  NOT_CHECKED: 'NOT_CHECKED',
  OK: 'OK',
  ISSUE: 'ISSUE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type CheckResult = (typeof CHECK_RESULT)[keyof typeof CHECK_RESULT];
export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  NOT_CHECKED: 'Chưa kiểm tra',
  OK: 'Đạt',
  ISSUE: 'Có vấn đề',
  NOT_APPLICABLE: 'Không áp dụng',
};

export const PRIORITY = { LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT' } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];
export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

export const ATTACHMENT_PURPOSE = {
  SITE_PHOTO: 'SITE_PHOTO',
  PROPOSAL: 'PROPOSAL',
  QUOTATION: 'QUOTATION',
  INCIDENT_MINUTES: 'INCIDENT_MINUTES',
  BOARD_MINUTES: 'BOARD_MINUTES',
  BOARD_DECISION: 'BOARD_DECISION',
  CONSTRUCTION: 'CONSTRUCTION',
  ACCEPTANCE: 'ACCEPTANCE',
  PAYMENT_REQUEST: 'PAYMENT_REQUEST',
  PAYMENT_PROOF: 'PAYMENT_PROOF',
  INVOICE: 'INVOICE',
  MAINTENANCE_RESULT: 'MAINTENANCE_RESULT',
  ITEM_DOCUMENT: 'ITEM_DOCUMENT',
  /** F-S1, api mode only. */
  EXPLOITATION_DOCUMENT: 'EXPLOITATION_DOCUMENT',
  BID_DOCUMENT: 'BID_DOCUMENT',
  /** F-S2, api mode only. */
  SELECTION_MINUTES: 'SELECTION_MINUTES',
  ASSEMBLY_DOCUMENT: 'ASSEMBLY_DOCUMENT',
  CONTRACT_DOCUMENT: 'CONTRACT_DOCUMENT',
  OTHER: 'OTHER',
} as const;
export type AttachmentPurpose = (typeof ATTACHMENT_PURPOSE)[keyof typeof ATTACHMENT_PURPOSE];
export const ATTACHMENT_PURPOSE_LABEL: Record<AttachmentPurpose, string> = {
  SITE_PHOTO: 'Ảnh hiện trường',
  PROPOSAL: 'Tờ trình',
  QUOTATION: 'Báo giá nhà thầu',
  INCIDENT_MINUTES: 'Biên bản ghi nhận sự việc',
  BOARD_MINUTES: 'Biên bản họp BQT',
  BOARD_DECISION: 'Quyết định xử lý chi phí của BQT',
  CONSTRUCTION: 'Thi công',
  ACCEPTANCE: 'Nghiệm thu',
  PAYMENT_REQUEST: 'Đề nghị thanh toán',
  PAYMENT_PROOF: 'Chứng từ thanh toán',
  INVOICE: 'Hóa đơn GTGT',
  MAINTENANCE_RESULT: 'Kết quả bảo trì',
  ITEM_DOCUMENT: 'Tài liệu thiết bị',
  EXPLOITATION_DOCUMENT: 'Tài liệu mời thầu khai thác',
  BID_DOCUMENT: 'Tài liệu dự thầu',
  SELECTION_MINUTES: 'Biên bản đánh giá',
  ASSEMBLY_DOCUMENT: 'Tài liệu hội nghị',
  CONTRACT_DOCUMENT: 'Tài liệu hợp đồng',
  OTHER: 'Khác',
};

export const SUBJECT_TYPE = {
  REPAIR_RECORD: 'REPAIR_RECORD',
  MAINTENANCE_OCCURRENCE: 'MAINTENANCE_OCCURRENCE',
  MAINTENANCE_PLAN: 'MAINTENANCE_PLAN',
  MAINTENANCE_ITEM: 'MAINTENANCE_ITEM',
  BUILDING: 'BUILDING',
  ACCOUNT: 'ACCOUNT',
  /** F-S1, api mode only. */
  EXPLOITATION_PARTNER: 'EXPLOITATION_PARTNER',
  EXPLOITATION_PACKAGE: 'EXPLOITATION_PACKAGE',
  EXPLOITATION_BID: 'EXPLOITATION_BID',
  EXPLOITATION_SELECTION: 'EXPLOITATION_SELECTION',
  EXPLOITATION_ASSEMBLY: 'EXPLOITATION_ASSEMBLY',
  EXPLOITATION_CONTRACT: 'EXPLOITATION_CONTRACT',
} as const;
export type SubjectType = (typeof SUBJECT_TYPE)[keyof typeof SUBJECT_TYPE];
export const SUBJECT_TYPE_LABEL: Record<SubjectType, string> = {
  REPAIR_RECORD: 'Sửa chữa',
  MAINTENANCE_OCCURRENCE: 'Bảo trì',
  MAINTENANCE_PLAN: 'Kế hoạch bảo trì',
  MAINTENANCE_ITEM: 'Hạng mục bảo trì',
  BUILDING: 'Tòa nhà',
  ACCOUNT: 'Tài khoản',
  EXPLOITATION_PARTNER: 'Đơn vị khai thác',
  EXPLOITATION_PACKAGE: 'Gói khai thác',
  EXPLOITATION_BID: 'Hồ sơ dự thầu',
  EXPLOITATION_SELECTION: 'Kết quả chọn đơn vị',
  EXPLOITATION_ASSEMBLY: 'Hồ sơ hội nghị',
  EXPLOITATION_CONTRACT: 'Hợp đồng khai thác',
};

export const NOTIFICATION_KIND = {
  WORK_ASSIGNED: 'WORK_ASSIGNED',
  TASK_DUE_SOON: 'TASK_DUE_SOON',
  TASK_OVERDUE: 'TASK_OVERDUE',
} as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

export const TASK_KIND = {
  UPDATE_RECORD: 'UPDATE_RECORD',
  CONFIRM_RECORD: 'CONFIRM_RECORD',
  PREPARE_PROPOSAL: 'PREPARE_PROPOSAL',
  APPROVE_PROPOSAL: 'APPROVE_PROPOSAL',
  ISSUE_UNRESOLVED_NOTICE: 'ISSUE_UNRESOLVED_NOTICE',
  SUBMIT_EMERGENCY_DOCS: 'SUBMIT_EMERGENCY_DOCS',
  START_CONSTRUCTION: 'START_CONSTRUCTION',
  UPDATE_CONSTRUCTION: 'UPDATE_CONSTRUCTION',
  REVIEW_ACCEPTANCE: 'REVIEW_ACCEPTANCE',
  FIX_DEFECT: 'FIX_DEFECT',
  PREPARE_PAYMENT_REQUEST: 'PREPARE_PAYMENT_REQUEST',
  APPROVE_PAYMENT: 'APPROVE_PAYMENT',
  RECORD_PAYMENT: 'RECORD_PAYMENT',
  PERFORM_MAINTENANCE: 'PERFORM_MAINTENANCE',
  REVIEW_MAINTENANCE: 'REVIEW_MAINTENANCE',
  REWORK_MAINTENANCE: 'REWORK_MAINTENANCE',
  REVIEW_SCHEDULE_CHANGE: 'REVIEW_SCHEDULE_CHANGE',
  REASSIGN_REQUIRED: 'REASSIGN_REQUIRED',
} as const;
export type TaskKind = (typeof TASK_KIND)[keyof typeof TASK_KIND];
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  UPDATE_RECORD: 'Bổ sung thông tin hồ sơ',
  CONFIRM_RECORD: 'Xác nhận hiện trạng',
  PREPARE_PROPOSAL: 'Lập tờ trình',
  APPROVE_PROPOSAL: 'Duyệt tờ trình',
  ISSUE_UNRESOLVED_NOTICE: 'Phát hành thông báo chưa xử lý',
  SUBMIT_EMERGENCY_DOCS: 'Bổ sung hồ sơ sửa chữa khẩn cấp',
  START_CONSTRUCTION: 'Bắt đầu thi công',
  UPDATE_CONSTRUCTION: 'Cập nhật thi công',
  REVIEW_ACCEPTANCE: 'Nghiệm thu',
  FIX_DEFECT: 'Khắc phục sau nghiệm thu',
  PREPARE_PAYMENT_REQUEST: 'Lập đề nghị thanh toán',
  APPROVE_PAYMENT: 'Duyệt thanh toán',
  RECORD_PAYMENT: 'Ghi nhận thanh toán',
  PERFORM_MAINTENANCE: 'Thực hiện bảo trì',
  REVIEW_MAINTENANCE: 'Kiểm tra kết quả bảo trì',
  REWORK_MAINTENANCE: 'Làm lại bảo trì',
  REVIEW_SCHEDULE_CHANGE: 'Rà soát lượt sau đổi lịch',
  REASSIGN_REQUIRED: 'Cần phân công lại',
};

/** Detail tab that a task kind should open. */
export const TASK_KIND_TAB: Record<TaskKind, string> = {
  UPDATE_RECORD: 'overview',
  CONFIRM_RECORD: 'overview',
  PREPARE_PROPOSAL: 'approval',
  APPROVE_PROPOSAL: 'approval',
  ISSUE_UNRESOLVED_NOTICE: 'approval',
  SUBMIT_EMERGENCY_DOCS: 'approval',
  START_CONSTRUCTION: 'construction',
  UPDATE_CONSTRUCTION: 'construction',
  REVIEW_ACCEPTANCE: 'acceptance',
  FIX_DEFECT: 'acceptance',
  PREPARE_PAYMENT_REQUEST: 'payment',
  APPROVE_PAYMENT: 'payment',
  RECORD_PAYMENT: 'payment',
  PERFORM_MAINTENANCE: 'checklist',
  REVIEW_MAINTENANCE: 'checklist',
  REWORK_MAINTENANCE: 'checklist',
  REVIEW_SCHEDULE_CHANGE: 'overview',
  REASSIGN_REQUIRED: 'overview',
};

export const LIMITS = {
  CONTRACTOR_NAME_MAX: 200,
  /** Data URL of a drawn signature (PNG from the pad, SVG in seed data). */
  SIGNATURE_MAX_CHARS: 400_000,
  NOTICE_TITLE_MAX: 200,
  NOTICE_BODY_MIN: 20,
  NOTICE_BODY_MAX: 5000,
  SUPPLIER_MAX: 120,
  MODEL_MAX: 120,
  MAX_SUBMISSION_ATTEMPTS: 3,
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  TITLE_MIN: 3,
  TITLE_MAX: 120,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 2000,
  REASON_MIN: 5,
  REASON_MAX: 1000,
  PROPOSAL_MIN: 10,
  CHECKLIST_LABEL_MIN: 3,
  CHECKLIST_LABEL_MAX: 200,
  CHECKLIST_UNIT_MAX: 30,
  GENERATION_WINDOW_DAYS: 30,
  GENERATION_LIMIT: 100,
  UPCOMING_DAYS: 7,
  PAGE_SIZE: 10,
} as const;

/** Default due days per task kind; each building overrides them in its configuration (not a customer SLA). */
export const TASK_DUE_DAYS: Partial<Record<TaskKind, number>> = {
  CONFIRM_RECORD: 3,
  REVIEW_ACCEPTANCE: 3,
  APPROVE_PROPOSAL: 3,
  APPROVE_PAYMENT: 3,
  REVIEW_MAINTENANCE: 2,
};

export const SYSTEM_ACTOR_ID = 'SYSTEM';
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Rule-based alerts on repair records (proposal 2.3); demo defaults, configurable per building later. */
export const ALERT_RULES = {
  /** A completed repair on the same item within this many days before a new record = "mới sửa đã hỏng". */
  RECENT_REPAIR_DAYS: 90,
  /** Look-back window and count for "hỏng lặp lại". */
  REPEAT_WINDOW_DAYS: 365,
  REPEAT_MIN_RECORDS: 2,
  /** Proposed amount above this ratio of the average of earlier approved repairs on the item = "giá cao bất thường". */
  PRICE_RATIO: 1.5,
} as const;
