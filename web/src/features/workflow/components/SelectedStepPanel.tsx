import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ApprovalStepDefinition } from '../workflow-designer-meta';

/** Explains which approval step new business steps will be bound to. */
export const SelectedStepPanel = ({ step }: { step?: ApprovalStepDefinition }) => (
  <section className={cn('rounded-lg border p-3', step ? 'border-accent/25 bg-accent-soft/40' : 'border-dashed border-line-2 bg-surface-2')}>
    <div className="flex items-center gap-2 text-xs font-semibold text-accent-strong"><Info className="size-4" /> {step ? 'Bước đang chọn' : 'Chưa chọn bước phê duyệt'}</div>
    {step ? <><p className="mt-2 text-sm font-semibold text-ink">{step.label}</p><p className="mt-0.5 text-xs text-ink-2">Vai trò thực hiện: {step.actor}</p><p className="mt-2 text-2xs leading-relaxed text-ink-3">Các bước nghiệp vụ thêm mới sẽ được gắn vào bước này.</p></> : <p className="mt-2 text-2xs leading-relaxed text-ink-2">Chọn một thẻ phê duyệt trên luồng để mở danh sách bước nghiệp vụ.</p>}
  </section>
);
