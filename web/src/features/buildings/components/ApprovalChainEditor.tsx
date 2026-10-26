import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPTANCE_ONLY_STEP_KEYS, APPROVAL_STEPS } from '@/domain/constants';
import type { ApprovalStepKey } from '@/domain/constants';
import { NativeSelect } from '@/components/ui/input';

interface ApprovalChainEditorProps {
  value: ApprovalStepKey[];
  disabled?: boolean;
  onChange: (value: ApprovalStepKey[]) => void;
}

const stepByKey = new Map<string, (typeof APPROVAL_STEPS)[number]>(APPROVAL_STEPS.map((step) => [step.key, step]));

/** Builds a configurable approval chain from the available system roles. */
export const ApprovalChainEditor = ({ value, disabled = false, onChange }: ApprovalChainEditorProps) => {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, current) => current !== index));
  };

  const add = (key: ApprovalStepKey) => {
    if (!key || value.includes(key)) return;
    onChange([...value, key]);
  };

  const availableSteps = APPROVAL_STEPS.filter((step) => !value.includes(step.key) && !ACCEPTANCE_ONLY_STEP_KEYS.includes(step.key));

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
      {value.map((key, index) => {
        const step = stepByKey.get(key);
        return (
          <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{step?.label ?? key}</p>
                <p className="text-xs text-ink-3">{step?.actor ?? 'Người duyệt'}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`Đưa ${step?.actor ?? key} lên`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Đưa ${step?.actor ?? key} xuống`} disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Xóa ${step?.actor ?? key}`} disabled={disabled || value.length <= 1} onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 text-crit" />
              </Button>
            </div>
          </li>
        );
      })}
      </ol>
      {availableSteps.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <NativeSelect aria-label="Thêm bước duyệt" value="" disabled={disabled} onChange={(event) => add(event.target.value as ApprovalStepKey)}>
            <option value="">Chọn vai trò để thêm vào chuỗi</option>
            {availableSteps.map((step) => <option key={step.key} value={step.key}>{step.label}</option>)}
          </NativeSelect>
          <span className="inline-flex items-center gap-1 text-xs text-ink-3"><Plus className="size-3.5" /> Có thể đổi thứ tự bằng nút mũi tên</span>
        </div>
      ) : null}
    </div>
  );
};
