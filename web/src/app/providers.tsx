import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IS_API_MODE } from '@/config/data-source';
import { useUnhandledRejectionToast } from '@/hooks/useUnhandledRejectionToast';
import { subscribeExternalChanges, subscribeLocalChanges } from '@/services/change-channel';
import { API_SESSION_STORAGE_KEY } from '@/services/http/token-store';
import { SESSION_STORAGE_KEY, useSessionStore } from '@/store/session-store';

const createClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 } },
  });

/** mock mode syncs the demo account; api mode syncs the token pair written by another tab. */
const SESSION_KEY = IS_API_MODE ? API_SESSION_STORAGE_KEY : SESSION_STORAGE_KEY;

/** Query cache + toasts; any data change (this tab or another tab) refreshes all queries. */
export const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(createClient);
  const syncFromStorage = useSessionStore((state) => state.syncFromStorage);
  useUnhandledRejectionToast();

  useEffect(() => {
    const refresh = () => void client.invalidateQueries();
    const offLocal = subscribeLocalChanges(refresh);
    const offExternal = subscribeExternalChanges(refresh);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY) return;
      syncFromStorage();
      refresh();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      offLocal();
      offExternal();
      window.removeEventListener('storage', handleStorage);
    };
  }, [client, syncFromStorage]);

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
};
