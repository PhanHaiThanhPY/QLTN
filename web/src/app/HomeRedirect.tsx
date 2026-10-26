import { Navigate } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { CAPABILITY, hasCapability } from '@/domain/permissions';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getReferenceData } from '@/services/reference-service';

/**
 * api mode has no dashboard yet: land on a module that talks to the backend.
 * Building settings need `BUILDING_CONFIG` (ADMIN only since matrix v2), the employee directory `ADMIN_VIEW`;
 * every other role lands on the record list.
 */
const landingPathOf = (viewer: Parameters<typeof hasCapability>[0]): string => {
  if (hasCapability(viewer, CAPABILITY.BUILDING_CONFIG)) return '/settings/buildings';
  if (hasCapability(viewer, CAPABILITY.ADMIN_VIEW)) return '/admin/employees';
  return '/records';
};

export const HomeRedirect = () => {
  const query = useServiceQuery(['reference'], getReferenceData);
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const viewer = query.data?.viewer;
  if (!viewer) return <LoadingState />;
  const to = landingPathOf(viewer);
  return <Navigate to={to} replace />;
};
