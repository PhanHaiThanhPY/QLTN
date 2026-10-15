import { useRouteError } from 'react-router';
import { ErrorState } from '@/components/common/States';

/** Error boundary for route rendering errors. */
export const RouteErrorPage = () => {
  const error = useRouteError();
  console.error('Route error:', error);
  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    </div>
  );
};
