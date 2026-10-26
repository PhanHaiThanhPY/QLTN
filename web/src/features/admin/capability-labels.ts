import type { Capability } from '@/domain/permissions';

/** Short Vietnamese names of capabilities, used when copying or editing a role. */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  VIEW: 'Xem dữ liệu trong phạm vi',
  RECORD_EDIT: 'Lập, sửa, trình hồ sơ sửa chữa',
  RECORD_CONFIRM: 'Xác nhận hiện trạng',
  PROPOSAL_DECIDE: 'Duyệt tờ trình (đúng bước)',
  CONSTRUCTION: 'Cập nhật thi công',
  ACCEPTANCE_DECIDE: 'Nghiệm thu',
  PAYMENT_DECIDE: 'Duyệt thanh toán',
  PAYMENT_RECORD: 'Lập đề nghị thanh toán, ghi nhận, đóng hồ sơ',
  PAYMENT_CONFIRM: 'Xác nhận đã chuyển khoản',
  FUND_OPERATE: 'Nghiệp vụ tiền của các quỹ',
  MAINTENANCE_MANAGE: 'Quản lý bảo trì',
  MAINTENANCE_REVIEW: 'Kiểm tra kết quả bảo trì',
  ITEM_CONDITION: 'Cập nhật tình trạng thiết bị',
  REASSIGN: 'Giao lại người xử lý',
  REPLACE_MANAGER: 'Thay BQL đã nghỉ',
  REPORT_VIEW: 'Xem báo cáo',
  ADMIN_VIEW: 'Vào trang quản trị',
  BUILDING_CONFIG: 'Cấu hình tòa nhà, workflow',
  LOCATION_MANAGE: 'Quản lý tầng, khu vực, vị trí',
  ACCOUNT_MANAGE: 'Quản lý tài khoản, vai trò',
  EMERGENCY_START: 'Cho sửa chữa khẩn cấp',
  AUDIT_VIEW: 'Xem nhật ký thao tác',
};
