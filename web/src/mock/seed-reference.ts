import type { AssignmentRule, Building, Department, Location, User } from '@/domain/types';

export const BUILDING_A = 'bld-a';
export const BUILDING_B = 'bld-b';
export const BUILDING_C = 'bld-c';
export const BUILDING_D = 'bld-d';
export const ALL_BUILDINGS = [BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D];

export const SEED_BUILDINGS: Building[] = [
  { id: BUILDING_A, code: 'A', name: 'Tòa A – An Khang Residence', address: '12 Nguyễn Văn Linh, Quận 7, TP.HCM' },
  { id: BUILDING_B, code: 'B', name: 'Tòa B – Bình Minh Tower', address: '88 Võ Văn Kiệt, Quận 1, TP.HCM' },
  { id: BUILDING_C, code: 'C', name: 'Tòa C – Cát Tường Plaza', address: '25 Phạm Văn Đồng, TP. Thủ Đức' },
  { id: BUILDING_D, code: 'D', name: 'Tòa D – Đông Phương Office', address: '140 Lý Thường Kiệt, Quận 10, TP.HCM' },
];

export const SEED_LOCATIONS: Location[] = [
  { id: 'loc-a-b1', buildingId: BUILDING_A, floor: 'B1', name: 'Hầm xe B1' },
  { id: 'loc-a-b2', buildingId: BUILDING_A, floor: 'B2', name: 'Phòng bơm & bể nước ngầm' },
  { id: 'loc-a-g', buildingId: BUILDING_A, floor: 'Trệt', name: 'Sảnh chính' },
  { id: 'loc-a-5', buildingId: BUILDING_A, floor: '5', name: 'Hành lang tầng 5' },
  { id: 'loc-a-12', buildingId: BUILDING_A, floor: '12', name: 'Hành lang tầng 12' },
  { id: 'loc-a-roof', buildingId: BUILDING_A, floor: 'Mái', name: 'Sân thượng & phòng kỹ thuật thang máy' },
  { id: 'loc-a-elec', buildingId: BUILDING_A, floor: 'B1', name: 'Phòng máy phát & tủ điện tổng' },
  { id: 'loc-b-g', buildingId: BUILDING_B, floor: 'Trệt', name: 'Sảnh & khu thương mại' },
  { id: 'loc-b-3', buildingId: BUILDING_B, floor: '3', name: 'Văn phòng tầng 3' },
  { id: 'loc-b-roof', buildingId: BUILDING_B, floor: 'Mái', name: 'Phòng quạt & sân thượng' },
  { id: 'loc-c-b1', buildingId: BUILDING_C, floor: 'B1', name: 'Hầm xe & phòng bơm' },
  { id: 'loc-c-g', buildingId: BUILDING_C, floor: 'Trệt', name: 'Sảnh chính' },
  { id: 'loc-c-roof', buildingId: BUILDING_C, floor: 'Mái', name: 'Sân thượng & tháp giải nhiệt' },
  { id: 'loc-d-g', buildingId: BUILDING_D, floor: 'Trệt', name: 'Sảnh & quầy lễ tân' },
  { id: 'loc-d-8', buildingId: BUILDING_D, floor: '8', name: 'Văn phòng tầng 8' },
  { id: 'loc-d-elec', buildingId: BUILDING_D, floor: 'B1', name: 'Phòng điện & máy phát' },
];

export const DEPARTMENT_ID = {
  ADMIN: 'dep-admin',
  MANAGEMENT: 'dep-management',
  TECHNICAL: 'dep-technical',
  CONSULTING: 'dep-consulting',
  BOARD: 'dep-board',
} as const;

export const SEED_DEPARTMENTS: Department[] = [
  { id: DEPARTMENT_ID.ADMIN, code: 'QTHT', name: 'Quản trị hệ thống', description: 'Quản lý tài khoản, vai trò và cấu hình hệ thống.', buildingIds: ALL_BUILDINGS },
  { id: DEPARTMENT_ID.MANAGEMENT, code: 'BQL', name: 'Ban quản lý', description: 'Tiếp nhận, điều phối và theo dõi công việc tại tòa nhà.', buildingIds: ALL_BUILDINGS },
  { id: DEPARTMENT_ID.TECHNICAL, code: 'KT', name: 'Kỹ thuật', description: 'Xác nhận hiện trạng, xử lý kỹ thuật và nghiệm thu.', buildingIds: ALL_BUILDINGS },
  { id: DEPARTMENT_ID.CONSULTING, code: 'TVKT', name: 'Tư vấn kỹ thuật', description: 'Thẩm định phương án và hỗ trợ kiểm soát chất lượng.', buildingIds: ALL_BUILDINGS },
  { id: DEPARTMENT_ID.BOARD, code: 'BQT', name: 'Ban quản trị', description: 'Phê duyệt hồ sơ theo phạm vi được phân quyền.', buildingIds: ALL_BUILDINGS },
];

export const assignmentRulesForBuilding = (): AssignmentRule[] => [
  { departmentId: DEPARTMENT_ID.MANAGEMENT, role: 'BQL', priority: 10 },
  { departmentId: DEPARTMENT_ID.TECHNICAL, role: 'TECH_CONFIRMER', priority: 20 },
  { departmentId: DEPARTMENT_ID.CONSULTING, role: 'TECH_CONSULTANT', priority: 30 },
  { departmentId: DEPARTMENT_ID.BOARD, role: 'OWNERS_BOARD', priority: 40 },
];

/** Stable ids so deep links survive a demo reset. */
export const USER_ID = {
  ADMIN: 'usr-admin',
  BQL_A: 'usr-bql-a',
  KT_A: 'usr-kt-a',
  KT_A2: 'usr-kt-a2',
  KT_A_OLD: 'usr-kt-a-cu',
  BQL_B: 'usr-bql-b',
  KT_B: 'usr-kt-b',
  TVKT: 'usr-tvkt',
  BQT: 'usr-bqt',
} as const;

/** 11 internal users over 4 buildings (customer brief). BQL-B and KT-B cover B, C and D. */
export const SEED_USERS: User[] = [
  { id: USER_ID.ADMIN, code: 'ADMIN-DEMO', fullName: 'Quản trị demo', role: 'ADMIN', departmentId: DEPARTMENT_ID.ADMIN, jobTitle: 'Quản trị hệ thống', buildingIds: ALL_BUILDINGS, active: true, version: 1 },
  { id: USER_ID.BQL_A, code: 'BQL-A', fullName: 'Nguyễn Thu Hà', role: 'BQL', departmentId: DEPARTMENT_ID.MANAGEMENT, jobTitle: 'Trưởng ban quản lý', buildingIds: [BUILDING_A], active: true, version: 1 },
  { id: USER_ID.KT_A, code: 'KT-A', fullName: 'Trần Minh Khoa', role: 'TECH_CONFIRMER', departmentId: DEPARTMENT_ID.TECHNICAL, jobTitle: 'Kỹ thuật trưởng', buildingIds: [BUILDING_A], active: true, version: 1 },
  { id: USER_ID.KT_A2, code: 'KT-A2', fullName: 'Lê Quốc Bảo', role: 'TECH_CONFIRMER', departmentId: DEPARTMENT_ID.TECHNICAL, jobTitle: 'Kỹ thuật viên', buildingIds: [BUILDING_A], active: true, version: 1 },
  // Becomes inactive at the end of the seed to demo "Cần phân công lại".
  { id: USER_ID.KT_A_OLD, code: 'KT-A-CU', fullName: 'Phạm Văn Tùng', role: 'TECH_CONFIRMER', departmentId: DEPARTMENT_ID.TECHNICAL, jobTitle: 'Kỹ thuật viên', buildingIds: [BUILDING_A], active: true, version: 1 },
  { id: USER_ID.BQL_B, code: 'BQL-B', fullName: 'Đặng Ngọc Lan', role: 'BQL', departmentId: DEPARTMENT_ID.MANAGEMENT, jobTitle: 'Trưởng ban quản lý', buildingIds: [BUILDING_B, BUILDING_C, BUILDING_D], active: true, version: 1 },
  { id: USER_ID.KT_B, code: 'KT-B', fullName: 'Huỳnh Gia Huy', role: 'TECH_CONFIRMER', departmentId: DEPARTMENT_ID.TECHNICAL, jobTitle: 'Kỹ thuật viên', buildingIds: [BUILDING_B, BUILDING_C, BUILDING_D], active: true, version: 1 },
  { id: USER_ID.TVKT, code: 'TVKT', fullName: 'Võ Thanh Tâm', role: 'TECH_CONSULTANT', departmentId: DEPARTMENT_ID.CONSULTING, jobTitle: 'Tư vấn kỹ thuật', buildingIds: ALL_BUILDINGS, active: true, version: 1 },
  { id: USER_ID.BQT, code: 'BQT', fullName: 'Bùi Hải Yến', role: 'OWNERS_BOARD', departmentId: DEPARTMENT_ID.BOARD, jobTitle: 'Đại diện ban quản trị', buildingIds: ALL_BUILDINGS, active: true, version: 1 },
];

/** Configuration template applied to each building at seed time. */
export const SEED_BUILDING_TEMPLATES: Record<string, string> = {
  [BUILDING_A]: 'STANDARD',
  [BUILDING_B]: 'OFFICE',
  [BUILDING_C]: 'RESIDENTIAL',
  [BUILDING_D]: 'OFFICE',
};
