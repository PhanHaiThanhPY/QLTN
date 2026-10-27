import { useBlocker } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

/** "Bạn có thay đổi chưa lưu. Rời trang?" with the app's dialog, never window.confirm (ui-brief §2.1). */
export const UnsavedChangesGuard = ({ dirty }: { dirty: boolean }) => {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => (open ? undefined : blocker.reset?.())}
      title="Rời trang?"
      confirmLabel="Rời trang"
      confirmVariant="danger"
      onConfirm={() => blocker.proceed?.()}
    >
      Bạn có thay đổi chưa lưu. Rời trang?
    </ConfirmDialog>
  );
};
