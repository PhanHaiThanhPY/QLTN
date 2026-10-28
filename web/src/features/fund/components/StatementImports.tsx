import { useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { apiRequestBlob } from '@/services/http/client';
import { listStatementImports, type StatementImport } from '@/services/statement-api';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';

/** "Lần nhập" (ui-brief §2.3): who imported what; an import with nothing matched can be deleted with a reason. */
export const StatementImports = ({ fundId, canWrite }: { fundId: string; canWrite: boolean }) => {
  const { userName } = useReferenceData();
  const query = useServiceQuery(['fund', 'statement-imports', fundId], () => listStatementImports(fundId));
  const command = useCommand({ successMessage: 'Đã xóa lần nhập.' });
  const [removing, setRemoving] = useState<StatementImport | null>(null);
  const rows = query.data ?? [];
  /** The original file, fetched with the session (a plain link would carry no token). */
  const download = async (attachmentId: string) => {
    try {
      const blob = await apiRequestBlob(`/attachments/${attachmentId}/content`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      toast.error('Không tải được tệp sao kê.');
    }
  };
  if (!rows.length) return <p className="text-sm text-ink-2">Chưa có lần nhập nào.</p>;
  return (
    <>
      <ul className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.id} className={row.deletedAt ? 'flex flex-wrap items-center gap-2 text-ink-3' : 'flex flex-wrap items-center gap-2'}>
            <span>
              {formatDateTime(row.createdAt)} · {userName(row.createdBy)} · kỳ {formatDate(row.periodFrom)}–{formatDate(row.periodTo)} · {row.newCount} dòng mới,{' '}
              {row.duplicateCount} trùng · đầu {formatVndText(row.openingBalanceVnd)}, cuối {formatVndText(row.closingBalanceVnd)}
            </span>
            {row.attachmentId ? (
              <Button size="sm" variant="ghost" onClick={() => void download(row.attachmentId as string)}>
                Tệp gốc
              </Button>
            ) : (
              <Badge tone="neutral">Nhập tay</Badge>
            )}
            {row.deletedAt ? <Badge tone="neutral">Đã xóa: {row.deleteReason}</Badge> : null}
            {canWrite && !row.deletedAt && row.matchedCount === 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setRemoving(row)}>
                Xóa lần nhập
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title="Xóa lần nhập sao kê"
        description="Chỉ xóa được khi chưa có dòng nào của lần nhập được ghép."
        confirmLabel="Xóa lần nhập"
        confirmVariant="danger"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason ?? command.errorMessage ?? undefined}
        onConfirm={(reason) => {
          if (!removing) return;
          void command
            .execute({ subjectType: 'FUND', subjectId: removing.id, action: 'deleteStatementImport', payload: { reason } })
            .then((result) => (result ? setRemoving(null) : undefined));
        }}
      />
    </>
  );
};
