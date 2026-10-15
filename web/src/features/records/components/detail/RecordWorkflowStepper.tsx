import { Check, Circle } from 'lucide-react';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { RepairStatus } from '@/domain/constants';
import { cn } from '@/lib/cn';

interface RecordWorkflowStepperProps {
  status: RepairStatus;
}

interface WorkflowStage {
  label: string;
  description: string;
}

const STAGES: readonly WorkflowStage[] = [
  { label: 'Tiếp nhận', description: 'Tạo và xác nhận hiện trạng' },
  { label: 'Phê duyệt', description: 'Tờ trình theo workflow đã cấu hình' },
  { label: 'Thi công', description: 'Thực hiện công việc' },
  { label: 'Nghiệm thu', description: 'Kiểm tra kết quả' },
  { label: 'Hoàn tất', description: 'Thanh toán và đóng hồ sơ' },
];

const RECEIVING_STATUSES: readonly RepairStatus[] = ['DRAFT', 'PENDING_CONFIRMATION', 'NEEDS_RECORD_UPDATE'];
const APPROVAL_STATUSES: readonly RepairStatus[] = [
  'PENDING_PROPOSAL',
  'PENDING_TECH_APPROVAL',
  'PENDING_TECH_REVIEW',
  'PENDING_BOARD_APPROVAL',
  'NEEDS_SUBMISSION_UPDATE',
  'REJECTED_RESUBMITTABLE',
  'UNRESOLVED',
];
const CONSTRUCTION_STATUSES: readonly RepairStatus[] = ['READY_FOR_CONSTRUCTION', 'IN_CONSTRUCTION', 'EMERGENCY_IN_PROGRESS'];
const ACCEPTANCE_STATUSES: readonly RepairStatus[] = ['PENDING_ACCEPTANCE', 'NEEDS_REPAIR'];
const EARLY_CLOSE_STATUSES: readonly RepairStatus[] = ['CLOSED_NO_REPAIR', 'CLOSED_WITHDRAWN'];

const currentStage = (status: RepairStatus): number => {
  if (RECEIVING_STATUSES.includes(status)) return 0;
  if (APPROVAL_STATUSES.includes(status)) return 1;
  if (CONSTRUCTION_STATUSES.includes(status)) return 2;
  if (ACCEPTANCE_STATUSES.includes(status)) return 3;
  return 4;
};

const stageMessage = (status: RepairStatus): string => {
  if (status === 'CLOSED_NO_REPAIR') return 'Đã đóng vì không cần sửa';
  if (status === 'CLOSED_WITHDRAWN') return 'Đã đóng do rút hồ sơ';
  if (status === 'UNRESOLVED') return 'Dừng ở chuỗi phê duyệt';
  return REPAIR_STATUS_LABEL[status];
};

/** Compact five-stage progress view; detailed approval steps remain in the approval tab. */
export const RecordWorkflowStepper = ({ status }: RecordWorkflowStepperProps) => {
  const activeIndex = currentStage(status);
  const isEarlyClose = EARLY_CLOSE_STATUSES.includes(status);
  const isCompleted = status === 'COMPLETED';

  return (
    <div className="border-t border-line pt-4" aria-label="Tiến độ hồ sơ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Tiến độ hồ sơ</p>
        <p className="text-sm font-semibold text-ink-2">{stageMessage(status)}</p>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {STAGES.map((stage, index) => {
          const isCurrent = index === activeIndex && !isCompleted;
          const isDone = isCompleted || (!isEarlyClose && index < activeIndex) || (isEarlyClose && index === 0);
          const isSkipped = isEarlyClose && index > 0;
          return (
            <li
              key={stage.label}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2',
                isCurrent && 'border-accent/40 bg-accent-soft/50',
                isDone && 'border-good/30 bg-good-soft/40',
                isSkipped && 'border-line bg-surface-2',
                !isCurrent && !isDone && !isSkipped && 'border-line bg-surface-2',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className={cn('mt-0.5 shrink-0 text-ink-3', isCurrent && 'text-accent', isDone && 'text-good')}>
                {isDone ? <Check className="size-4" aria-hidden /> : <Circle className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-sm font-semibold', isCurrent ? 'text-accent-strong' : 'text-ink')}>{stage.label}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{isSkipped ? 'Không áp dụng' : stage.description}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
