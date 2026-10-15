import { Navigate, Outlet } from 'react-router';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useReferenceData } from '@/hooks/useReferenceData';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { AssistantRouteHint } from '@/components/assistant/AssistantRouteHint';
import { useAutoSyncDueNotifications } from '@/hooks/useAutoSyncDueNotifications';

/** Shell: quiet sky blue navigation rail and airy content canvas. */
export const AppLayout = () => {
  const userId = useSessionStore((state) => state.userId);
  const { data } = useReferenceData();
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const isCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  useAutoSyncDueNotifications(data?.viewer);
  if (!userId) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className={cn('hidden h-full shrink-0 transition-[width] duration-200 lg:block', isCollapsed ? 'w-20' : 'w-64')}>
        <Sidebar user={data?.viewer} isCollapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>
      <DialogPrimitive.Root open={isSidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] animate-sheet-in shadow-pop lg:hidden">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Điều hướng chính</DialogPrimitive.Description>
            <Sidebar user={data?.viewer} onNavigate={() => setSidebarOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <AppHeader user={data?.viewer} />
        <div className="relative flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:pb-24 lg:px-8 lg:pb-5">
            <div className="mx-auto w-full max-w-[112rem]">
              <AssistantRouteHint />
              <Outlet />
            </div>
          </main>
          <AssistantPanel />
        </div>
      </div>
    </div>
  );
};
