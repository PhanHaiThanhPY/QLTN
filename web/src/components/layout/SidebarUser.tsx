import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { ROLE_LABEL } from '@/domain/constants';
import type { User } from '@/domain/types';
import { Tooltip } from '@/components/ui/tooltip';
import { useSessionStore } from '@/store/session-store';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** Current demo account at the bottom of the sidebar with the switch-account action. */
export const SidebarUser = ({ user, isCollapsed }: { user?: User; isCollapsed: boolean }) => {
  const navigate = useNavigate();
  const signOut = useSessionStore((state) => state.signOut);
  if (!user) return null;
  const handleSwitch = () => {
    signOut();
    navigate('/login');
  };
  const avatar = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-200/90 text-xs font-bold text-[#0b3554]">
      {initials(user.fullName)}
    </span>
  );
  if (isCollapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-white/10 py-3">
        <Tooltip content={`${user.fullName} · Đổi tài khoản`}>
          <button type="button" onClick={handleSwitch} aria-label="Đổi tài khoản demo">
            {avatar}
          </button>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="shrink-0 border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-2.5">
        {avatar}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
          <p className="truncate text-2xs text-sky-100/60">
            {user.code} · {ROLE_LABEL[user.role]}
          </p>
        </div>
        <Tooltip content="Đổi tài khoản demo">
          <button
            type="button"
            onClick={handleSwitch}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sky-100/65 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Đổi tài khoản demo"
          >
            <LogOut className="size-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
