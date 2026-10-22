import {
  BarChart3,
  Bell,
  Building,
  Building2,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  ListChecks,
  Map,
  Settings,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IS_API_MODE } from '@/config/data-source';
import type { Capability } from '@/domain/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the role lacks this capability; routes still check access in services. */
  capability?: Capability;
  group?: string;
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

  { to: '/space', label: 'Không gian chung cư', icon: Map, group: 'Theo dõi' },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, capability: 'REPORT_VIEW', group: 'Theo dõi' },

  { to: '/settings/buildings', label: 'Tòa nhà và cấu hình', icon: Building, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/settings/locations', label: 'Tầng, khu vực, vị trí', icon: MapPin, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/settings/workflow', label: 'Workflow Engine', icon: Workflow, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },

  { to: '/admin/employees', label: 'Nhân viên', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/departments', label: 'Bộ phận', icon: Building2, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/roles', label: 'Vai trò & ma trận quyền', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
];

/** Modules that already talk to api-qltn (plan decision D2): entering them in api mode is allowed. */
const API_READY_GROUPS = new Set(['Hệ thống', 'Quản trị']);

/**
 * In api mode only modules backed by the real backend stay in the menu; the rest stay in the code
 * base for mock mode and their routes render "chưa nối API" instead.
 */
export const NAV_ITEMS: NavItem[] = IS_API_MODE
  ? ALL_NAV_ITEMS.filter((item) => item.group !== undefined && API_READY_GROUPS.has(item.group))
  : ALL_NAV_ITEMS;
