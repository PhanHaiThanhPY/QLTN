import { Link, useLocation } from 'react-router';
import type { NavItem } from '@/app/navigation';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

interface SidebarLinkProps {
  item: NavItem;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

/** Navigation row with a dark navy surface and a teal active anchor. */
const isSidebarItemActive = (itemPath: string, currentPath: string): boolean => {
  if (itemPath === '/') return currentPath === '/';

  if (itemPath === '/records') {
    return currentPath === '/records'
      || (currentPath.startsWith('/records/') && !currentPath.startsWith('/records/schedule'));
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
};

export const SidebarLink = ({ item, isCollapsed, onNavigate }: SidebarLinkProps) => {
  const Icon = item.icon;
  const { pathname } = useLocation();
  const isActive = isSidebarItemActive(item.to, pathname);
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-label={isCollapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-11 w-full items-center rounded-lg text-sm transition-colors',
        isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
        isActive
          ? 'bg-[#0d5968] font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-7 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-cyan-300'
          : 'font-medium text-sky-100/65 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', isCollapsed && 'mx-auto', isActive ? 'text-cyan-200' : 'text-sky-100/75')} aria-hidden />
      <span className={cn('min-w-0 flex-1 truncate', isCollapsed && 'sr-only')}>{item.label}</span>
      {isActive && !isCollapsed ? <span className="size-1.5 rounded-full bg-cyan-200" aria-hidden /> : null}
    </Link>
  );
  if (!isCollapsed) return link;
  return <Tooltip content={item.label}>{link}</Tooltip>;
};
