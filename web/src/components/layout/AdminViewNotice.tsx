import { useLocation } from 'react-router';
import { Notice } from '@/components/common/Notice';
import type { User } from '@/domain/types';

/** Business modules ADMIN reads but never acts on (RM-S2 BR-RM2-04); system pages are its own work. */
const BUSINESS_PREFIXES = ['/records', '/maintenance', '/exploitation', '/deposits'] as const;

export const isAdminReadOnlyPath = (pathname: string): boolean =>
  BUSINESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** "Bạn đang xem với quyền Quản trị — chỉ xem", once above every business page for ADMIN. */
export const AdminViewNotice = ({ user }: { user: User | undefined }) => {
  const { pathname } = useLocation();
  if (user?.role !== 'ADMIN' || !isAdminReadOnlyPath(pathname)) return null;
  return (
    <div className="mb-4">
      <Notice tone="info">Bạn đang xem với quyền Quản trị — chỉ xem.</Notice>
    </div>
  );
};
