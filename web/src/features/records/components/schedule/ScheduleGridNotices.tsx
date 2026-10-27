import { Notice } from '@/components/common/Notice';
import { useOnline } from '@/hooks/useOnline';

interface ScheduleGridNoticesProps {
  shown: number;
  total: number;
}

/** Above a loaded grid: stale data while offline, and a cut page that never hides silently (ui-brief §4). */
export const ScheduleGridNotices = ({ shown, total }: ScheduleGridNoticesProps) => {
  const online = useOnline();
  return (
    <>
      {online ? null : <p className="text-xs text-ink-3">Đang mất kết nối, lịch có thể chưa mới nhất.</p>}
      {total > shown ? (
        <Notice tone="warning">
          Đang hiện {shown} trên {total} hồ sơ. Chọn tòa hoặc nhóm trạng thái để thu hẹp.
        </Notice>
      ) : null}
    </>
  );
};
