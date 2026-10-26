import { useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound, LogOut } from 'lucide-react';
import { IS_API_MODE } from '@/config/data-source';
import { ROLE_LABEL } from '@/domain/constants';
import type { User } from '@/domain/types';
import { Tooltip } from '@/components/ui/tooltip';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { useSessionStore } from '@/store/session-store';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const CHANGE_PASSWORD_LABEL = 'Đổi mật khẩu';
const ICON_BUTTON_CLASS =
  'flex size-8 shrink-0 items-center justify-center rounded-lg text-sky-100/65 transition-colors hover:bg-white/10 hover:text-white';

/**
 * Current account at the bottom of the sidebar: sign out (api) or switch demo account (mock), and in api mode
 * the "Đổi mật khẩu" entry (SPEC AU-S1), reachable whether the sidebar is collapsed or not.
 */
export const SidebarUser = ({ user, isCollapsed }: { user?: User; isCollapsed: boolean }) => {
  const navigate = useNavigate();
  const signOut = useSessionStore((state) => state.signOut);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  if (!user) return null;
  const actionLabel = IS_API_MODE ? 'Đăng xuất' : 'Đổi tài khoản demo';
  const handleSwitch = () => {
    void signOut();
    navigate('/login');
  };
  const avatar = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-200/90 text-xs font-bold text-[#0b3554]">
      {initials(user.fullName)}
    </span>
  );
  const changePasswordButton = IS_API_MODE ? (
    <Tooltip content={CHANGE_PASSWORD_LABEL}>
      <button
        type="button"
        onClick={() => setIsChangingPassword(true)}
        className={ICON_BUTTON_CLASS}
        aria-label={CHANGE_PASSWORD_LABEL}
      >
        <KeyRound className="size-4" />
      </button>
    </Tooltip>
  ) : null;
  const changePasswordDialog = IS_API_MODE ? (
    <ChangePasswordDialog open={isChangingPassword} onOpenChange={setIsChangingPassword} />
  ) : null;
  if (isCollapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1 border-t border-white/10 py-3">
        <Tooltip content={`${user.fullName} · ${actionLabel}`}>
          <button type="button" onClick={handleSwitch} aria-label={actionLabel}>
            {avatar}
          </button>
        </Tooltip>
        {changePasswordButton}
        {changePasswordDialog}
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
        {changePasswordButton}
        <Tooltip content={actionLabel}>
          <button type="button" onClick={handleSwitch} className={ICON_BUTTON_CLASS} aria-label={actionLabel}>
            <LogOut className="size-4" />
          </button>
        </Tooltip>
      </div>
      {changePasswordDialog}
    </div>
  );
};
