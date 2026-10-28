import type { Role } from '@/domain/constants';
import type { Capability } from '@/domain/permissions';

export const MATRIX_ROLES: readonly Role[] = [
  'ADMIN',
  'BQL',
  'TECH_CONFIRMER',
  'TECH_CONSULTANT',
  'OWNERS_BOARD',
  'ACCOUNTANT',
] as const;

export interface PermissionRow {
  group: string;
  label: string;
  /** Checked against the role matrix; 'ALL' = every role (system-run step). */
  capability: Capability | 'ALL';
  /** Extra note per role, e.g. a conditional permission. */
  notes?: Partial<Record<Role, string>>;
}

/** Rows of the permission table in spec section 3, evaluated live with hasCapability. */
export const PERMISSION_ROWS: readonly PermissionRow[] = [
  { group: 'Chung', label: 'Xem hồ sơ, lượt bảo trì và tệp trong phạm vi', capability: 'VIEW' },
  { group: 'Sửa chữa', label: 'Tạo/sửa nháp, bổ sung hồ sơ, rút hồ sơ', capability: 'RECORD_EDIT' },
  { group: 'Sửa chữa', label: 'Gửi xác nhận, lập tờ trình (tên nhà thầu và giá)', capability: 'RECORD_EDIT' },
  { group: 'Sửa chữa', label: 'Xác nhận cần sửa, trả bổ sung, đóng không cần sửa', capability: 'RECORD_CONFIRM' },
  {
    group: 'Sửa chữa',
    label: 'Duyệt, yêu cầu bổ sung, từ chối tờ trình theo workflow được cấu hình',
    capability: 'PROPOSAL_DECIDE',
  },
  { group: 'Sửa chữa', label: 'Bắt đầu, cập nhật thi công, gửi nghiệm thu', capability: 'CONSTRUCTION' },
  { group: 'Sửa chữa', label: 'Ghi nhận nghiệm thu đạt/không đạt (cần cả KT và TVKT đạt)', capability: 'ACCEPTANCE_DECIDE' },
  { group: 'Sửa chữa', label: 'Duyệt/trả đề nghị thanh toán', capability: 'PAYMENT_DECIDE' },
  { group: 'Sửa chữa', label: 'Lập đề nghị thanh toán, ghi nhận thanh toán và đóng hoàn tất', capability: 'PAYMENT_RECORD' },
  {
    group: 'Sửa chữa',
    label: 'Xác nhận đã chuyển khoản một đợt thanh toán (dùng từ luồng thanh toán nhiều đợt)',
    capability: 'PAYMENT_CONFIRM',
  },
  {
    group: 'Quỹ',
    label: 'Ghi khoản thu, nhận cọc, thuế, phiếu chi của quỹ khai thác (nhóm T dùng tiếp cho quỹ bảo trì)',
    capability: 'FUND_OPERATE',
  },
  { group: 'Quỹ', label: 'Xem gói khai thác, đơn vị, hồ sơ dự thầu kèm giá chào và tài liệu', capability: 'EXPLOITATION_VIEW' },
  { group: 'Quỹ', label: 'Lập, phát hành, ghi nhận hồ sơ, yêu cầu bổ sung, đóng nhận, hủy gói khai thác', capability: 'EXPLOITATION_MANAGE' },
  { group: 'Quỹ', label: 'Duyệt, yêu cầu sửa, từ chối kết quả chọn đơn vị khai thác', capability: 'EXPLOITATION_APPROVE' },
  { group: 'Quỹ', label: 'Xem hợp đồng khai thác và lịch phải thu (không xem giá chào)', capability: 'EXPLOITATION_CONTRACT_VIEW' },
  { group: 'Quỹ', label: 'Xem sổ quỹ, thuế và phiếu chi', capability: 'FUND_VIEW' },
  { group: 'Quỹ', label: 'Duyệt phiếu chi, hủy phiếu đã chi và đổi số dư đầu của quỹ', capability: 'FUND_APPROVE' },
  { group: 'Bảo trì', label: 'Tạo/sửa/vô hiệu hóa hạng mục bảo trì', capability: 'MAINTENANCE_MANAGE' },
  { group: 'Bảo trì', label: 'Tạo/sửa/kích hoạt/tạm dừng/đổi lịch kế hoạch', capability: 'MAINTENANCE_MANAGE' },
  { group: 'Bảo trì', label: 'Kích hoạt sinh lịch tự động khi mở màn hình (chạy dưới danh nghĩa SYSTEM)', capability: 'ALL' },
  { group: 'Bảo trì', label: 'Bấm “Cập nhật lịch”, tạo lượt bù thủ công', capability: 'MAINTENANCE_MANAGE' },
  { group: 'Bảo trì', label: 'Bắt đầu, cập nhật checklist, gửi kết quả, đổi lịch, hủy lượt', capability: 'MAINTENANCE_MANAGE' },
  { group: 'Bảo trì', label: 'Tạo hồ sơ sửa chữa từ lượt bảo trì', capability: 'MAINTENANCE_MANAGE' },
  { group: 'Bảo trì', label: 'Kiểm tra, yêu cầu làm lại, xác nhận hoàn tất lượt', capability: 'MAINTENANCE_REVIEW' },
  {
    group: 'Bảo trì',
    label: 'Cập nhật tình trạng hạng mục',
    capability: 'ITEM_CONDITION',
    notes: { TECH_CONFIRMER: 'khi xác nhận lượt' },
  },
  { group: 'Chung', label: 'Giao lại người xử lý hồ sơ/lượt', capability: 'REASSIGN' },
  { group: 'Chung', label: 'Thay BQL quản lý đang ngừng hoạt động', capability: 'REPLACE_MANAGER' },
  { group: 'Chung', label: 'Xem báo cáo', capability: 'REPORT_VIEW' },
  { group: 'Chung', label: 'Xem nhật ký thao tác trong phạm vi tòa (dòng toàn hệ thống: chỉ ADMIN)', capability: 'AUDIT_VIEW' },
  { group: 'Chung', label: 'Xem quản trị và khôi phục demo', capability: 'ADMIN_VIEW' },
  { group: 'Cấu hình', label: 'Sửa cấu hình tòa, áp mẫu, Workflow Designer, xem lịch sử cấu hình', capability: 'BUILDING_CONFIG' },
  { group: 'Cấu hình', label: 'Quản lý tầng, khu vực, vị trí', capability: 'LOCATION_MANAGE' },
] as const;
