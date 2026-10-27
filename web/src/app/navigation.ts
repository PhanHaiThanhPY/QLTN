import {
  BarChart3,
  Banknote,
  Bell,
  BookOpen,
  Building,
  Building2,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  FileSignature,
  Landmark,
  LayoutDashboard,
  MapPin,
  Receipt,
  ScrollText,
  ListChecks,
  Map,
  Settings,
  Workflow,
  Wrench,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IS_API_MODE } from '@/config/data-source';
import { hasCapability } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type { User } from '@/domain/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the role lacks this capability; routes still check access in services. */
  capability?: Capability;
  group?: string;
  /** Exists only against api-qltn (no mock data behind it): hidden in mock mode. */
  apiOnly?: boolean;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, group: 'Làm việc' },
  { to: '/tasks', label: 'Công việc của tôi', icon: ListChecks, group: 'Làm việc' },
  { to: '/notifications', label: 'Thông báo', icon: Bell, group: 'Làm việc' },

  { to: '/records', label: 'Hồ sơ sửa chữa', icon: Wrench, group: 'Sửa chữa' },
  { to: '/records/schedule', label: 'Lịch sửa chữa', icon: CalendarClock, group: 'Sửa chữa' },

  // Maintenance follows the setup-to-execution flow: assets, plans, then the schedule.
  { to: '/maintenance/items', label: 'Thiết bị', icon: Building2, group: 'Bảo trì' },
  { to: '/maintenance/plans', label: 'Kế hoạch bảo trì', icon: ClipboardList, group: 'Bảo trì' },
  { to: '/maintenance/schedule', label: 'Lịch bảo trì', icon: CalendarDays, group: 'Bảo trì' },

  { to: '/exploitation/packages', label: 'Mời thầu khai thác', icon: Landmark, capability: 'EXPLOITATION_VIEW', group: 'Quỹ khai thác', apiOnly: true },
  { to: '/exploitation/partners', label: 'Đơn vị khai thác', icon: Store, capability: 'EXPLOITATION_VIEW', group: 'Quỹ khai thác', apiOnly: true },
  {
    to: '/exploitation/contracts',
    label: 'Hợp đồng khai thác',
    icon: FileSignature,
    capability: 'EXPLOITATION_CONTRACT_VIEW',
    group: 'Quỹ khai thác',
    apiOnly: true,
  },
  // F-S3 (D-F3-6): Kế toán and BQT only; BQL follows what is owed on the contract's "Khoản thu" tab.
  { to: '/exploitation/fund', label: 'Sổ quỹ', icon: BookOpen, capability: 'FUND_VIEW', group: 'Quỹ khai thác', apiOnly: true },
  { to: '/exploitation/tax', label: 'Thuế', icon: Receipt, capability: 'FUND_VIEW', group: 'Quỹ khai thác', apiOnly: true },
  { to: '/exploitation/vouchers', label: 'Phiếu chi', icon: Banknote, capability: 'FUND_VIEW', group: 'Quỹ khai thác', apiOnly: true },

  { to: '/space', label: 'Không gian chung cư', icon: Map, group: 'Theo dõi' },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, capability: 'REPORT_VIEW', group: 'Theo dõi' },
  { to: '/audit', label: 'Nhật ký thao tác', icon: ScrollText, capability: 'AUDIT_VIEW', group: 'Theo dõi', apiOnly: true },

  { to: '/settings/buildings', label: 'Tòa nhà và cấu hình', icon: Building, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/settings/locations', label: 'Tầng, khu vực, vị trí', icon: MapPin, capability: 'LOCATION_MANAGE', group: 'Hệ thống' },
  { to: '/settings/workflow', label: 'Workflow Engine', icon: Workflow, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },

  { to: '/admin/employees', label: 'Nhân viên', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/departments', label: 'Bộ phận', icon: Building2, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/roles', label: 'Vai trò & ma trận quyền', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
];

/** Modules that already talk to api-qltn (plan decision D2): entering them in api mode is allowed. */
const API_READY_GROUPS = new Set(['Hệ thống', 'Quản trị']);
/**
 * Single entries ready before the rest of their group: my tasks (TK-S1), record list (T4), repair schedule (B4-S1),
 * equipment (MT-S1), maintenance plans (MT-S2), maintenance occurrences as a list (MT-S3; week and month views in
 * MT-S4) and the exploitation group (F-S1, api only).
 */
const API_READY_PATHS = new Set([
  '/tasks',
  '/records',
  '/records/schedule',
  '/maintenance/items',
  '/maintenance/plans',
  '/maintenance/schedule',
  '/exploitation/packages',
  '/exploitation/partners',
  '/exploitation/contracts',
  '/exploitation/fund',
  '/exploitation/tax',
  '/exploitation/vouchers',
  '/audit',
  '/notifications',
]);

/**
 * In api mode only modules backed by the real backend stay in the menu; the rest stay in the code
 * base for mock mode and their routes render "chưa nối API" instead.
 */
const itemsFor = (apiMode: boolean): NavItem[] =>
  apiMode
    ? ALL_NAV_ITEMS.filter(
        (item) =>
          API_READY_PATHS.has(item.to) || (item.group !== undefined && API_READY_GROUPS.has(item.group)),
      )
    : ALL_NAV_ITEMS.filter((item) => !item.apiOnly);

export const NAV_ITEMS: NavItem[] = itemsFor(IS_API_MODE);

/** Menu entries a user sees: the data source's modules, narrowed by capability. */
export const visibleNavItems = (user: User | undefined, apiMode: boolean = IS_API_MODE): NavItem[] =>
  itemsFor(apiMode).filter((item) => !item.capability || (user !== undefined && hasCapability(user, item.capability)));
