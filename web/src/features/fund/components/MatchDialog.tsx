import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/common/States';
import { useCommand } from '@/hooks/useCommand';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getCandidates, type LedgerSide, type StatementLine } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { signedVnd } from '../fund-ui';
import { daysText } from '../statement-ui';

interface MatchDialogProps {
  fundId: string;
  /** The side "Ghép…" was opened from. */
  line?: StatementLine;
  entry?: LedgerSide;
  onClose: () => void;
}

/**
 * "Ghép…" (BR-F4-05, ui-brief §2.1): the other side's candidates — same direction and amount — nearest first, each
 * saying why; one more than 5 days away asks for a reason.
 */
export const MatchDialog = ({ fundId, line, entry, onClose }: MatchDialogProps) => {
  const command = useCommand({ successMessage: 'Đã ghép.' });
  const query = useServiceQuery(['fund', 'candidates', fundId, line?.id, entry?.id], () =>
    getCandidates(fundId, line ? { lineId: line.id } : { entryId: entry?.id }),
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const options = query.data ?? [];
  const picked = chosen === null ? undefined : options[chosen];
  const lineId = line?.id ?? picked?.line?.id;
  const entryId = entry?.id ?? picked?.entry?.id;
  const ready = Boolean(picked) && (!picked?.needsReason || reason.trim().length >= 10);
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'FUND',
      subjectId: lineId,
      action: 'matchStatementLine',
      payload: { entryId, reason: picked?.needsReason ? reason.trim() : null },
    });
    if (result) onClose();
  };
  const own = line ? `${line.code} · ${formatDate(line.txnDate)} · ${signedVnd(line.direction, line.amountVnd)}` : `${entry?.sourceCode} · ${entry ? formatDate(entry.entryDate) : ''} · ${entry ? signedVnd(entry.direction, entry.amountVnd) : ''}`;
  const body = () => {
    if (query.isLoading) return <LoadingState rows={2} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!options.length) return <p className="text-sm text-ink-2">Không có dòng nào cùng chiều và cùng số tiền.</p>;
    return (
      <div role="radiogroup" aria-label="Chọn dòng để ghép" className="space-y-2">
        {options.map((option, index) => {
          const label = option.entry
            ? `${option.entry.sourceCode} · ${formatDate(option.entry.entryDate)} · ${option.entry.description}`
            : `${option.line?.code} · ${option.line ? formatDate(option.line.txnDate) : ''} · ${option.line?.description}`;
          return (
            <button
              key={option.entry?.id ?? option.line?.id}
              type="button"
              role="radio"
              aria-checked={chosen === index}
              onClick={() => setChosen(index)}
              className={cn('block w-full rounded-lg border p-3 text-left text-sm', chosen === index ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-accent')}
            >
              <span className="block font-medium">{label}</span>
              <span className={cn('text-xs', option.needsReason ? 'text-warn' : 'text-ink-2')}>
                {daysText(option.days)}
                {option.needsReason ? ' · lệch quá 5 ngày, cần lý do' : ''}
              </span>
            </button>
          );
        })}
      </div>
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Ghép sao kê với chứng từ"
      description={own}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!ready} onClick={() => void submit()}>
            Ghép
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {command.errorMessage ? (
          <p className="text-sm text-crit" role="alert">
            {command.errorMessage}
          </p>
        ) : null}
        {body()}
        {picked?.needsReason ? (
          <Field label="Lý do ghép khi lệch quá 5 ngày" htmlFor="match-reason" required error={command.fieldErrors.reason} hint="Tối thiểu 10 ký tự.">
            <Textarea id="match-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
};
