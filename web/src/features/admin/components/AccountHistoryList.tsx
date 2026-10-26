import { ErrorState, LoadingState } from '@/components/common/States';
import type { AccountHistoryRow } from '@/services/http/users-api';
import { formatDateTime } from '@/utils/date';

/** Vietnamese labels of account audit actions (SPEC US-S1 BR-05); unknown actions show their code. */
export const ACCOUNT_ACTION_LABEL: Readonly<Record<string, string>> = {
  createUser: 'Tạo tài khoản',
  updateUser: 'Cập nhật thông tin',
  deactivateUser: 'Ngừng hoạt động',
  resetPassword: 'Đặt lại mật khẩu',
};

interface AccountHistoryListProps {
  rows: readonly AccountHistoryRow[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

/** Rows of the account history: time, actor ("Hệ thống" when none), action label and note. */
export const AccountHistoryList = ({ rows, isLoading, error, onRetry }: AccountHistoryListProps) => {
  if (isLoading) return <LoadingState rows={3} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (rows.length === 0) return <p className="text-sm text-ink-3">Chưa có lịch sử.</p>;
  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold text-ink">{ACCOUNT_ACTION_LABEL[row.action] ?? row.action}</span>
            <span className="text-xs text-ink-3">{formatDateTime(row.createdAt)}</span>
          </div>
          <p className="text-xs text-ink-2">{row.actorName || 'Hệ thống'}</p>
          {row.reason ? <p className="mt-0.5 text-xs text-ink-2">{row.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
};
