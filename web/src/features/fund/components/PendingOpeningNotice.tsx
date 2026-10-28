import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/useCommand';
import type { Fund } from '@/services/fund-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';

/** D-F3-5: an opening change waiting for BQT; BQT approves or refuses it here. */
export const PendingOpeningNotice = ({ fund, canApprove, online }: { fund: Fund; canApprove: boolean; online: boolean }) => {
  const command = useCommand({ successMessage: 'Đã ghi quyết định.' });
  const [rejecting, setRejecting] = useState(false);
  const pending = fund.pendingOpening;
  if (!pending) return null;
  const decide = (action: string, payload: Record<string, unknown> = {}) =>
    command.execute({ subjectType: 'FUND', subjectId: fund.id, expectedVersion: fund.version, action, payload });
  return (
    <Notice tone="warning">
      <span className="flex flex-wrap items-center gap-2">
        Chờ BQT duyệt đổi số dư đầu thành {formatVndText(pending.openingBalanceVnd)} từ {formatDate(pending.openingDate)}: {pending.reason}
        {canApprove ? (
          <>
            <Button size="sm" disabled={!online} isLoading={command.isPending} onClick={() => void decide('approveFundOpening')}>
              Duyệt
            </Button>
            <Button size="sm" variant="secondary" disabled={!online} onClick={() => setRejecting(true)}>
              Từ chối
            </Button>
          </>
        ) : null}
      </span>
      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Từ chối đổi số dư đầu"
        confirmLabel="Từ chối"
        confirmVariant="danger"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => void decide('rejectFundOpening', { reason }).then((result) => (result ? setRejecting(false) : undefined))}
      />
    </Notice>
  );
};
