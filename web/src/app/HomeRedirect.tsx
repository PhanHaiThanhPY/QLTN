import { Navigate } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { CAPABILITY, hasCapability } from '@/domain/permissions';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getReferenceData } from '@/services/reference-service';

/**
 * api mode has no dashboard yet: land on a module that talks to the backend.
 * Building settings need `BUILDING_CONFIG`, otherwise fall back to the employee directory.
 */
export const HomeRedirect = () => {
  const query = useServiceQuery(['reference'], getReferenceData);
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const viewer = query.data?.viewer;
  if (!viewer) return <LoadingState />;
  const to = hasCapability(viewer, CAPABILITY.BUILDING_CONFIG) ? '/settings/buildings' : '/admin/employees';
  return <Navigate to={to} replace />;
};
