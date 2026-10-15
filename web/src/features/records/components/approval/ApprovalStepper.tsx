import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { APPROVAL_STEP_SLOT, approvalStepsFor } from '@/domain/actions';
import type { ApprovalStepKey } from '@/domain/constants';
import { slotUserId } from '@/domain/permissions';
import type { ApprovalDecision, RepairRecord } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/utils/date';
import { APPROVAL_OUTCOME } from './approval-labels';

interface ApprovalStepperProps {
  record: RepairRecord;
  decisions: ApprovalDecision[];
  /** Whether these decisions belong to the record's current submission (only then a step can be "waiting"). */
  isCurrent: boolean;
}

interface StepState {
  label: string;
  tone: BadgeTone;
  decision?: ApprovalDecision;
}

const stepState = (key: ApprovalStepKey, status: string, props: ApprovalStepperProps): StepState => {
  const decision = props.decisions.find((row) => row.step === key);
  if (decision) return { ...APPROVAL_OUTCOME[decision.outcome], decision };
  if (props.isCurrent && status === props.record.status) return { label: 'Đang chờ', tone: 'warn' };
  return { label: 'Chưa tới', tone: 'outline' };
};

/** Configured approval steps with who decided, when, or who is awaited. */
export const ApprovalStepper = (props: ApprovalStepperProps) => {
  const { userName } = useReferenceData();
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {approvalStepsFor(props.record.approvalStepKeys).map((step, index) => {
        const state = stepState(step.key, step.status, props);
        const isWaiting = state.label === 'Đang chờ';
        const assignee = state.decision?.actorId ?? slotUserId(props.record, APPROVAL_STEP_SLOT[step.key]);
        return (
          <li
            key={step.key}
            className={cn('rounded-lg border px-3 py-2.5', isWaiting ? 'border-warn/40 bg-warn-soft/40' : 'border-line bg-surface-2')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                {index + 1}. {step.label}
              </span>
              <Badge tone={state.tone}>{state.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink">{userName(assignee)}</p>
            {state.decision ? <p className="text-xs text-ink-3">{formatDateTime(state.decision.createdAt)}</p> : null}
            {state.decision?.reason ? <p className="mt-1 whitespace-pre-line text-xs text-ink-2">{state.decision.reason}</p> : null}
          </li>
        );
      })}
    </ol>
  );
};
