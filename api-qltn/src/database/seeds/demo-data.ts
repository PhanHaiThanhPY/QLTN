import type { Role } from '../../domain/permissions';

/** Demo reference data, mirroring web/src/mock/seed-reference.ts (codes are the stable keys). */

export interface SeedBuilding {
  code: string;
  name: string;
  address: string;
}

export interface SeedDepartment {
  code: string;
  name: string;
  description: string;
}

export interface SeedUser {
  code: string;
  fullName: string;
  role: Role;
  departmentCode: string;
  jobTitle: string;
  buildingCodes: string[];
  active: boolean;
}

const ALL_BUILDINGS = ['A', 'B', 'C', 'D'];

export interface SeedLocation {
  buildingCode: string;
  floor: string;
  name: string;
}

/** Configuration template per demo building; the demo proposal chain is TVKT → BQT. */
export const DEMO_BUILDING_TEMPLATES: Readonly<Record<string, string>> = {
  A: 'STANDARD',
  B: 'OFFICE',
  C: 'RESIDENTIAL',
  D: 'OFFICE',
};
export const DEMO_APPROVAL_STEP_KEYS = ['TECH', 'BOARD'];

/** Department code → workflow role resolved by the default assignment rules of every demo building. */
export const DEMO_ASSIGNMENT_RULES: ReadonlyArray<{ departmentCode: string; role: Role; priority: number }> = [
  { departmentCode: 'BQL', role: 'BQL', priority: 10 },
  { departmentCode: 'KT', role: 'TECH_CONFIRMER', priority: 20 },
  { departmentCode: 'TVKT', role: 'TECH_CONSULTANT', priority: 30 },
  { departmentCode: 'BQT', role: 'OWNERS_BOARD', priority: 40 },
  { departmentCode: 'KTOAN', role: 'ACCOUNTANT', priority: 50 },
];

/** Custom role seeded as VT-01 (BQL without emergency start or building configuration). */
export const DEMO_CUSTOM_ROLE = {
  code: 'VT-01',
  name: 'Nhân viên BQL (không xử lý khẩn cấp)',
  baseRole: 'BQL' as Role,
  removed: ['EMERGENCY_START', 'BUILDING_CONFIG'],
};

export const DEMO_LOCATIONS: readonly SeedLocation[] = [
  { buildingCode: 'A', floor: 'B1', name: 'Hầm xe B1' },
  { buildingCode: 'A', floor: 'B2', name: 'Phòng bơm & bể nước ngầm' },
  { buildingCode: 'A', floor: 'Trệt', name: 'Sảnh chính' },
  { buildingCode: 'A', floor: '5', name: 'Hành lang tầng 5' },
  { buildingCode: 'A', floor: '12', name: 'Hành lang tầng 12' },
  { buildingCode: 'A', floor: 'Mái', name: 'Sân thượng & phòng kỹ thuật thang máy' },
  { buildingCode: 'A', floor: 'B1', name: 'Phòng máy phát & tủ điện tổng' },
  { buildingCode: 'B', floor: 'Trệt', name: 'Sảnh & khu thương mại' },
  { buildingCode: 'B', floor: '3', name: 'Văn phòng tầng 3' },
  { buildingCode: 'B', floor: 'Mái', name: 'Phòng quạt & sân thượng' },
  { buildingCode: 'C', floor: 'B1', name: 'Hầm xe & phòng bơm' },
  { buildingCode: 'C', floor: 'Trệt', name: 'Sảnh chính' },
  { buildingCode: 'C', floor: 'Mái', name: 'Sân thượng & tháp giải nhiệt' },
  { buildingCode: 'D', floor: 'Trệt', name: 'Sảnh & quầy lễ tân' },
  { buildingCode: 'D', floor: '8', name: 'Văn phòng tầng 8' },
  { buildingCode: 'D', floor: 'B1', name: 'Phòng điện & máy phát' },
];

export const DEMO_BUILDINGS: readonly SeedBuilding[] = [
  { code: 'A', name: 'Tòa A – An Khang Residence', address: '12 Nguyễn Văn Linh, Quận 7, TP.HCM' },
  { code: 'B', name: 'Tòa B – Bình Minh Tower', address: '88 Võ Văn Kiệt, Quận 1, TP.HCM' },
  { code: 'C', name: 'Tòa C – Cát Tường Plaza', address: '25 Phạm Văn Đồng, TP. Thủ Đức' },
  { code: 'D', name: 'Tòa D – Đông Phương Office', address: '140 Lý Thường Kiệt, Quận 10, TP.HCM' },
];

export const DEMO_DEPARTMENTS: readonly SeedDepartment[] = [
  { code: 'QTHT', name: 'Quản trị hệ thống', description: 'Quản lý tài khoản, vai trò và cấu hình hệ thống.' },
  { code: 'BQL', name: 'Ban quản lý', description: 'Tiếp nhận, điều phối và theo dõi công việc tại tòa nhà.' },
  { code: 'KT', name: 'Kỹ thuật', description: 'Xác nhận hiện trạng, xử lý kỹ thuật và nghiệm thu.' },
  { code: 'TVKT', name: 'Tư vấn kỹ thuật', description: 'Thẩm định phương án và hỗ trợ kiểm soát chất lượng.' },
  { code: 'BQT', name: 'Ban quản trị', description: 'Phê duyệt hồ sơ theo phạm vi được phân quyền.' },
  { code: 'KTOAN', name: 'Kế toán', description: 'Xác nhận chuyển khoản và nghiệp vụ tiền của các quỹ (phía BQT).' },
];

/** Username = lower-case code. KT-A-CU is inactive, as at the end of the frontend seed ("Cần phân công lại"). */
export const DEMO_USERS: readonly SeedUser[] = [
  {
    code: 'ADMIN-DEMO',
    fullName: 'Quản trị demo',
    role: 'ADMIN',
    departmentCode: 'QTHT',
    jobTitle: 'Quản trị hệ thống',
    buildingCodes: ALL_BUILDINGS,
    active: true,
  },
  {
    code: 'BQL-A',
    fullName: 'Nguyễn Thu Hà',
    role: 'BQL',
    departmentCode: 'BQL',
    jobTitle: 'Trưởng ban quản lý',
    buildingCodes: ['A'],
    active: true,
  },
  {
    code: 'KT-A',
    fullName: 'Trần Minh Khoa',
    role: 'TECH_CONFIRMER',
    departmentCode: 'KT',
    jobTitle: 'Kỹ thuật trưởng',
    buildingCodes: ['A'],
    active: true,
  },
  {
    code: 'KT-A2',
    fullName: 'Lê Quốc Bảo',
    role: 'TECH_CONFIRMER',
    departmentCode: 'KT',
    jobTitle: 'Kỹ thuật viên',
    buildingCodes: ['A'],
    active: true,
  },
  {
    code: 'KT-A-CU',
    fullName: 'Phạm Văn Tùng',
    role: 'TECH_CONFIRMER',
    departmentCode: 'KT',
    jobTitle: 'Kỹ thuật viên',
    buildingCodes: ['A'],
    active: false,
  },
  {
    code: 'BQL-B',
    fullName: 'Đặng Ngọc Lan',
    role: 'BQL',
    departmentCode: 'BQL',
    jobTitle: 'Trưởng ban quản lý',
    buildingCodes: ['B', 'C', 'D'],
    active: true,
  },
  {
    code: 'KT-B',
    fullName: 'Huỳnh Gia Huy',
    role: 'TECH_CONFIRMER',
    departmentCode: 'KT',
    jobTitle: 'Kỹ thuật viên',
    buildingCodes: ['B', 'C', 'D'],
    active: true,
  },
  {
    code: 'TVKT',
    fullName: 'Võ Thanh Tâm',
    role: 'TECH_CONSULTANT',
    departmentCode: 'TVKT',
    jobTitle: 'Tư vấn kỹ thuật',
    buildingCodes: ALL_BUILDINGS,
    active: true,
  },
  {
    code: 'BQT',
    fullName: 'Bùi Hải Yến',
    role: 'OWNERS_BOARD',
    departmentCode: 'BQT',
    jobTitle: 'Đại diện ban quản trị',
    buildingCodes: ALL_BUILDINGS,
    active: true,
  },
  {
    code: 'KTOAN-A',
    fullName: 'Đỗ Minh Châu',
    role: 'ACCOUNTANT',
    departmentCode: 'KTOAN',
    jobTitle: 'Kế toán',
    buildingCodes: ['A'],
    active: true,
  },
];
