import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ManualLine } from '@/services/statement-api';

export const EMPTY_LINE: ManualLine = { date: '', credit: '', debit: '', description: '', reference: '' };

interface ManualLinesEditorProps {
  lines: readonly ManualLine[];
  onChange: (lines: ManualLine[]) => void;
}

const FIELDS = [
  { key: 'date', label: 'Ngày (dd/mm/yyyy)', numeric: false },
  { key: 'credit', label: 'Ghi có', numeric: true },
  { key: 'debit', label: 'Ghi nợ', numeric: true },
  { key: 'description', label: 'Nội dung', numeric: false },
  { key: 'reference', label: 'Số tham chiếu', numeric: false },
] as const;

/** "Nhập tay" (BR-F4-02): the template's columns, one line at a time; the server checks them like a file. */
export const ManualLinesEditor = ({ lines, onChange }: ManualLinesEditorProps) => {
  const set = (index: number, key: keyof ManualLine, value: string) => onChange(lines.map((line, at) => (at === index ? { ...line, [key]: value } : line)));
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[8rem_7rem_7rem_1fr_7rem_auto]">
            {FIELDS.map((field) => (
              <Input
                key={field.key}
                aria-label={`Dòng ${index + 1}: ${field.label}`}
                placeholder={field.label}
                inputMode={field.numeric ? 'numeric' : undefined}
                className={field.numeric ? 'text-right tabular-nums' : undefined}
                value={line[field.key]}
                onChange={(event) => set(index, field.key, event.target.value)}
              />
            ))}
            <Button size="sm" variant="ghost" aria-label={`Xóa dòng ${index + 1}`} onClick={() => onChange(lines.filter((_, at) => at !== index))}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="secondary" onClick={() => onChange([...lines, EMPTY_LINE])}>
        Thêm dòng
      </Button>
    </div>
  );
};
