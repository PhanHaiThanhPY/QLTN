import type { Role } from '@/domain/constants';
import type { Capability } from '@/domain/permissions';

export const MATRIX_ROLES: readonly Role[] = [
  'ADMIN',
  'BQL',
  'TECH_CONFIRMER',
  'TECH_CONSULTANT',
  'OWNERS_BOARD',
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
  { group: 'Sửa chữa', label: 'Cập nhật thi công, lập đề nghị thanh toán', capability: 'CONSTRUCTION' },
  { group: 'Sửa chữa', label: 'Ghi nhận nghiệm thu đạt/không đạt (cần cả KT và TVKT đạt)', capability: 'ACCEPTANCE_DECIDE' },
  { group: 'Sửa chữa', label: 'Duyệt/trả đề nghị thanh toán', capability: 'PAYMENT_DECIDE' },
  { group: 'Sửa chữa', label: 'Ghi nhận thanh toán và đóng hoàn tất', capability: 'PAYMENT_RECORD' },
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
  { group: 'Chung', label: 'Xem quản trị và khôi phục demo', capability: 'ADMIN_VIEW' },
] as const;
