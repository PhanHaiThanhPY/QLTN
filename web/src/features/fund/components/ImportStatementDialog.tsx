import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isAppError } from '@/domain/errors';
import { useCommand } from '@/hooks/useCommand';
import { apiRequestBlob } from '@/services/http/client';
import { STATEMENT_TEMPLATE_PATH, previewStatement, statementForm, type ManualLine, type StatementPreview } from '@/services/statement-api';
import { monthBoundsLast } from '../reconciliation-dates';
import { EMPTY_LINE, ManualLinesEditor } from './ManualLinesEditor';
import { StatementPreviewTable } from './StatementPreviewTable';

interface ImportStatementDialogProps {
  fundId: string;
  month: string;
  onClose: () => void;
}

const SIGNED = /^-?\d+$/;
const digits = (value: string): string => {
  const negative = value.trim().startsWith('-');
  const body = value.replace(/\D/g, '');
  return body ? `${negative ? '-' : ''}${body}` : '';
};

/**
 * "Nhập sao kê" (BR-F4-01, BR-F4-02, ui-brief §2.2), two steps: the period, the bank's balances and a template file or
 * typed lines; then the server's preview. Nothing is imported while a line is wrong or the statement does not close,
 * and the file and figures stay when anything fails.
 */
export const ImportStatementDialog = ({ fundId, month, onClose }: ImportStatementDialogProps) => {
  const command = useCommand({
    onSuccess: (result) => {
      const data = result.data ?? {};
      const imported = (data.import ?? {}) as { newCount?: number; duplicateCount?: number };
      toast.success(`Đã nhập ${imported.newCount ?? 0} dòng, bỏ qua ${imported.duplicateCount ?? 0} dòng trùng, ${String(data.suggestions ?? 0)} đề xuất ghép.`);
    },
  });
  const [mode, setMode] = useState<'file' | 'manual'>('file');
  const [periodFrom, setPeriodFrom] = useState(`${month}-01`);
  const [periodTo, setPeriodTo] = useState(monthBoundsLast(month));
  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<ManualLine[]>([EMPTY_LINE]);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fields = { periodFrom, periodTo, openingBalanceVnd: digits(opening), closingBalanceVnd: digits(closing) };
  const form = () => statementForm(fields, mode === 'file' ? { file } : { lines });
  const filled = Boolean(periodFrom && periodTo && SIGNED.test(fields.openingBalanceVnd) && SIGNED.test(fields.closingBalanceVnd)) && (mode === 'file' ? Boolean(file) : lines.length > 0);

  const check = async () => {
    setChecking(true);
    setProblem(null);
    try {
      setPreview(await previewStatement(fundId, form()));
    } catch (error) {
      console.error(error);
      setProblem(isAppError(error) ? error.message : 'Không đọc được sao kê.');
    } finally {
      setChecking(false);
    }
  };
  const submit = async () => {
    const result = await command.execute({ subjectType: 'FUND', subjectId: fundId, action: 'importStatement', payload: { form: form() } });
    if (result) onClose();
  };
  const downloadTemplate = async () => {
    try {
      const blob = await apiRequestBlob(STATEMENT_TEMPLATE_PATH);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mau-sao-ke.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Không tải được mẫu tệp.');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={preview ? 'Nhập sao kê · Xem trước' : 'Nhập sao kê'}
      size="lg"
      footer={
        preview ? (
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Quay lại
            </Button>
            <Button isLoading={command.isPending} disabled={preview.blocked} onClick={() => void submit()}>
              Nhập
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button isLoading={checking} disabled={!filled} onClick={() => void check()}>
              Xem trước
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <StatementPreviewTable preview={preview} openingVnd={fields.openingBalanceVnd} closingVnd={fields.closingBalanceVnd} />
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Cách nhập" className="grid grid-cols-2 gap-2">
            {(['file', 'manual'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={mode === value ? 'min-h-11 rounded-lg border border-accent bg-accent-soft font-semibold' : 'min-h-11 rounded-lg border border-line'}
              >
                {value === 'file' ? 'Tải tệp' : 'Nhập tay'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kỳ từ" htmlFor="st-from" required error={command.fieldErrors.periodFrom}>
              <Input id="st-from" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
            </Field>
            <Field label="Kỳ đến" htmlFor="st-to" required error={command.fieldErrors.periodTo}>
              <Input id="st-to" type="date" min={periodFrom} value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
            </Field>
            <Field label="Số dư đầu kỳ theo ngân hàng (VND)" htmlFor="st-opening" required error={command.fieldErrors.openingBalanceVnd}>
              <Input id="st-opening" inputMode="numeric" className="tabular-nums" value={opening} onChange={(event) => setOpening(event.target.value)} />
            </Field>
            <Field label="Số dư cuối kỳ theo ngân hàng (VND)" htmlFor="st-closing" required error={command.fieldErrors.closingBalanceVnd}>
              <Input id="st-closing" inputMode="numeric" className="tabular-nums" value={closing} onChange={(event) => setClosing(event.target.value)} />
            </Field>
          </div>
          {mode === 'file' ? (
            <Field label="Tệp sao kê (CSV UTF-8 hoặc XLSX, theo mẫu)" htmlFor="st-file" required hint="Tối đa 5.000 dòng, 5 MB.">
              <Input id="st-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </Field>
          ) : (
            <ManualLinesEditor lines={lines} onChange={setLines} />
          )}
          <Button size="sm" variant="ghost" onClick={() => void downloadTemplate()}>
            Tải mẫu tệp
          </Button>
          {problem ? (
            <p className="text-sm text-crit" role="alert">
              {problem}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
};
