import {
  BarChart3,
  Bell,
  Building,
  Building2,
  CalendarDays,
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
import type { Capability } from '@/domain/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the role lacks this capability; routes still check access in services. */
  capability?: Capability;
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, group: 'Làm việc' },
  { to: '/tasks', label: 'Công việc của tôi', icon: ListChecks, group: 'Làm việc' },
  { to: '/records', label: 'Hồ sơ sửa chữa', icon: Wrench, group: 'Sửa chữa' },
  { to: '/records/schedule', label: 'Lịch sửa chữa', icon: CalendarDays, group: 'Sửa chữa' },
  { to: '/maintenance/schedule', label: 'Lịch bảo trì', icon: CalendarDays, group: 'Bảo trì' },
  { to: '/maintenance/plans', label: 'Kế hoạch bảo trì', icon: ClipboardList, group: 'Bảo trì' },
  { to: '/maintenance/items', label: 'Thiết bị', icon: Building2, group: 'Bảo trì' },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, capability: 'REPORT_VIEW', group: 'Theo dõi' },
  { to: '/notifications', label: 'Thông báo', icon: Bell, group: 'Theo dõi' },
  { to: '/space', label: 'Không gian chung cư', icon: Map, group: 'Theo dõi' },
  { to: '/settings/buildings', label: 'Tòa nhà và cấu hình', icon: Building, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/settings/workflow', label: 'Workflow Engine', icon: Workflow, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/settings/locations', label: 'Tầng, khu vực, vị trí', icon: MapPin, capability: 'BUILDING_CONFIG', group: 'Hệ thống' },
  { to: '/admin/employees', label: 'Nhân viên', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/departments', label: 'Bộ phận', icon: Building2, capability: 'ADMIN_VIEW', group: 'Quản trị' },
  { to: '/admin/roles', label: 'Vai trò & ma trận quyền', icon: Settings, capability: 'ADMIN_VIEW', group: 'Quản trị' },
];
