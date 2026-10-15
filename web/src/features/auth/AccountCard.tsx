import { ArrowRight, Building2, ClipboardCheck, HardHat, Settings2, UserX, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROLE_LABEL } from '@/domain/constants';
import type { Role } from '@/domain/constants';
import type { User } from '@/domain/types';
import { SEED_BUILDINGS } from '@/mock/seed-reference';
import { cn } from '@/lib/cn';

const ROLE_ICON: Record<Role, LucideIcon> = {
  ADMIN: Settings2,
  BQL: Building2,
  TECH_CONFIRMER: HardHat,
  TECH_CONSULTANT: ClipboardCheck,
  OWNERS_BOARD: Users,
};

const buildingLabel = (user: User): string =>
  user.buildingIds.map((id) => SEED_BUILDINGS.find((building) => building.id === id)?.code ?? id).join(' + ');

interface AccountCardProps {
  user: User;
  onSelect: (user: User) => void;
}

/** One seeded demo account; inactive accounts are listed but cannot be chosen. */
export const AccountCard = ({ user, onSelect }: AccountCardProps) => {
  const RoleIcon = user.active ? ROLE_ICON[user.role] : UserX;
  return (
  <button
    type="button"
    disabled={!user.active}
    onClick={() => onSelect(user)}
    className={cn(
      'group flex w-full items-center gap-3 rounded-2xl border border-line/90 bg-gradient-to-br from-surface to-surface-2 px-4 py-3.5 text-left shadow-card transition-all',
      'enabled:hover:-translate-y-0.5 enabled:hover:border-accent/55 enabled:hover:shadow-pop disabled:cursor-not-allowed disabled:opacity-55',
    )}
  >
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent group-enabled:group-hover:bg-accent group-enabled:group-hover:text-accent-fg">
      <RoleIcon className="size-[18px]" aria-hidden />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold text-ink">{user.code}</span>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-2xs font-semibold text-ink-2">Tòa {buildingLabel(user)}</span>
        {user.active ? null : <span className="rounded-full bg-crit-soft px-2 py-0.5 text-2xs font-semibold text-crit">Ngừng hoạt động</span>}
      </span>
      <span className="mt-0.5 block truncate text-xs text-ink-2">
        {user.fullName} · {ROLE_LABEL[user.role]}
      </span>
    </span>
    {user.active ? (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-3 transition-all group-hover:bg-accent group-hover:text-accent-fg">
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    ) : null}
  </button>
  );
};
