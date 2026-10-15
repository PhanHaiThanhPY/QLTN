import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useSessionStore } from '@/store/session-store';

/** Query bound to the current demo account; every data change invalidates all queries. */
export const useServiceQuery = <T>(key: QueryKey, fn: () => Promise<T>, enabled = true) => {
  const userId = useSessionStore((state) => state.userId);
  return useQuery({
    queryKey: ['svc', userId, ...key],
    queryFn: fn,
    enabled: enabled && Boolean(userId),
  });
};
