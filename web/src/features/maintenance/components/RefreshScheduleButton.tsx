import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { hasCapability } from '@/domain/permissions';
import type { User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

/** BQL-only manual run of the same schedule generation (command refreshSchedule). */
export const RefreshScheduleButton = ({ viewer }: { viewer: User | undefined }) => {
  const command = useCommand();
  if (!viewer || !hasCapability(viewer, 'MAINTENANCE_MANAGE')) return null;
  const handleClick = async () => {
    const result = await command.execute({ subjectType: 'MAINTENANCE_PLAN', action: 'refreshSchedule' });
    if (!result) return;
    const created = typeof result.data?.created === 'number' ? result.data.created : 0;
    toast.success(created > 0 ? `Đã sinh ${created} lượt bảo trì mới.` : 'Lịch đã cập nhật, không có lượt mới.');
    if (result.data?.hasMore === true) toast.info('Còn lịch chưa sinh do chạm giới hạn 100 lượt/lần. Bấm “Cập nhật lịch” lần nữa để tiếp tục.');
  };
  return (
    <Button variant="secondary" isLoading={command.isPending} onClick={() => void handleClick()}>
      <RefreshCw className="h-4 w-4" />
      Cập nhật lịch
    </Button>
  );
};
