import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { useCommand } from '@/hooks/useCommand';
import type { StatementLine } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { signedVnd } from '../fund-ui';
import { RECORD_KIND_TEXT } from '../statement-ui';

interface RecordFromStatementDialogProps {
  line: StatementLine;
  command: ReturnType<typeof useCommand>;
  onClose: () => void;
}

/**
 * "Ghi nhận từ sao kê" (BR-F4-08): a bank fee goes out, demand-deposit interest comes in; a ledger line of the same day
 * and amount is created, already matched. Anything else needs its own document first.
 */
export const RecordFromStatementDialog = ({ line, command, onClose }: RecordFromStatementDialogProps) => {
  const confirm = async () => {
    const result = await command.execute({ subjectType: 'FUND', subjectId: line.id, action: 'recordFromStatement', payload: { kind: line.recordAs } });
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Ghi nhận từ sao kê · ${RECORD_KIND_TEXT[line.recordAs]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={() => void confirm()}>
            Ghi nhận
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm">
        <p>
          {line.code} · {formatDate(line.txnDate)} · <span className="tabular-nums">{signedVnd(line.direction, line.amountVnd)}</span> · {line.description}
        </p>
        <p className="text-ink-2">
          Tạo một dòng sổ "{RECORD_KIND_TEXT[line.recordAs]}" cùng ngày, cùng số tiền, ghép sẵn với {line.code}. Tiền đơn vị chuyển hay khoản chi
          khác phải lập đúng chứng từ rồi ghép.
        </p>
        {command.fieldErrors.kind ? (
          <p className="text-crit" role="alert">
            {command.fieldErrors.kind}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};
