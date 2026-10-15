import { hasCapability } from '@/domain/permissions';
import type { User } from '@/domain/types';
import { NAV_ITEMS } from '@/app/navigation';
import type { NavItem } from '@/app/navigation';
import { SidebarBrand } from './SidebarBrand';
import { SidebarAssistant } from './SidebarAssistant';
import { SidebarLink } from './SidebarLink';
import { SidebarUser } from './SidebarUser';

interface SidebarProps {
  user?: User;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

const groupItems = (items: NavItem[]): { name?: string; items: NavItem[] }[] =>
  items.reduce<{ name?: string; items: NavItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else acc.push({ name: item.group, items: [item] });
    return acc;
  }, []);

export const Sidebar = ({ user, isCollapsed = false, onToggleCollapsed, onNavigate }: SidebarProps) => {
  const items = NAV_ITEMS.filter((item) => !item.capability || (user && hasCapability(user, item.capability)));
  return (
    <div className="flex h-full flex-col border-r border-[#183653] bg-[#071a30] text-white">
      <SidebarBrand isCollapsed={isCollapsed} onToggleCollapsed={onToggleCollapsed} />
      <nav className="sidebar-scroll scroll-thin min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-3 pb-2 pt-5" aria-label="Điều hướng chính">
        {groupItems(items).map((group) => (
          <div key={group.name ?? 'main'} className="space-y-1">
            {group.name && !isCollapsed ? <p className="px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-sky-100/55">{group.name}</p> : null}
            {group.name && isCollapsed ? <div className="mx-2 mb-1.5 h-px bg-white/10" aria-hidden /> : null}
            {group.items.map((item) => (
              <SidebarLink key={item.to} item={item} isCollapsed={isCollapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
      <SidebarAssistant isCollapsed={isCollapsed} />
      <SidebarUser user={user} isCollapsed={isCollapsed} />
    </div>
  );
};
