import { ErrorState, LoadingState } from '@/components/common/States';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { useOnline } from '@/hooks/useOnline';

interface ScheduleLoadStateProps {
  isLoading: boolean;
  error: Error | null;
  hasData: boolean;
  rows: number;
  onRetry: () => void;
}

const OFFLINE_MESSAGE = 'Đang mất kết nối — không tải được lịch.';

/** What a view shows before it has data: loading, offline or an error with "Thử lại" (ui-brief §4); null once loaded. */
export const ScheduleLoadState = ({ isLoading, error, hasData, rows, onRetry }: ScheduleLoadStateProps) => {
  const online = useOnline();
  if (hasData) return null;
  if (!online) return <ErrorState error={new AppError(ERROR_CODE.NETWORK_ERROR, OFFLINE_MESSAGE)} onRetry={onRetry} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading) return <LoadingState rows={rows} />;
  // A paused or aborted query without data is not "empty": say so and offer a retry.
  return <ErrorState error={new AppError(ERROR_CODE.NETWORK_ERROR, 'Không tải được lịch. Vui lòng thử lại.')} onRetry={onRetry} />;
};
