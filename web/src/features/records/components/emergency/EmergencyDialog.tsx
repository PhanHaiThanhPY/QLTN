import { useState } from 'react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Notice } from '@/components/common/Notice';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { IS_API_MODE } from '@/config/data-source';
import { LIMITS } from '@/domain/constants';
import { vndInWords } from '@/domain/payment';
import { useOnline } from '@/hooks/useOnline';
import { todayVn } from '@/services/runtime';
import { addDays } from '@/utils/date';
import { formatVnd, parseVndInput } from '@/utils/money';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

const SHOWN = ['reason', 'contractorName', 'estimatedAmountVnd', 'plannedEndDate'] as const;
const SUCCESS = IS_API_MODE ? 'Đã bắt đầu xử lý khẩn cấp. Đã báo BQT và TVKT.' : 'Đã bắt đầu sửa chữa khẩn cấp và báo người duyệt.';

/**
 * BQL lets the work start now within the building's emergency limit; approvers are informed (B06-S1 ui-brief §2.2).
 * In api mode the limit and hours come from `emergencyPolicy` of the record detail.
 */
export const EmergencyDialog = ({ onClose }: { onClose: () => void }) => {
  const { detail } = useRecordContext();
  const isOnline = useOnline();
  const policy = detail.emergencyPolicy ?? (detail.buildingConfig ? { limitVnd: detail.buildingConfig.emergencyLimitVnd, docHours: detail.buildingConfig.emergencyDocHours } : undefined);
  const [reason, setReason] = useState('');
  const [contractorName, setContractorName] = useState(detail.proposalDraft?.contractorName ?? '');
  const [amount, setAmount] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState(addDays(todayVn(), 2));
  const command = useRecordCommand({ successMessage: SUCCESS, onSuccess: onClose });
  const errors = command.fieldErrors;
  const hours = policy?.docHours ?? 24;
  const amountValue = parseVndInput(amount);
  const isComplete = reason.trim().length >= LIMITS.REASON_MIN && contractorName.trim().length > 0 && amountValue !== undefined;
  return (
    <CommandDialog
      title="Sửa chữa khẩn cấp"
      description={`Cho làm ngay trước khi duyệt. Tờ trình phải nộp bổ sung trong ${hours} giờ; trễ hạn phải ghi lý do.`}
      confirmLabel="Bắt đầu xử lý"
      confirmVariant="danger"
      isPending={command.isPending}
      canConfirm={isComplete && Boolean(policy) && isOnline}
      onClose={onClose}
      onConfirm={() =>
        void command.run('startEmergencyRepair', { reason: reason.trim(), contractorName: contractorName.trim(), estimatedAmountVnd: amountValue, plannedEndDate })
      }
    >
      {policy ? (
        <Notice tone="warning" title={`Hạn mức khẩn cấp của tòa: ${formatVnd(policy.limitVnd)}`}>
          Vượt hạn mức thì đi quy trình duyệt thông thường. Tờ trình phải nộp bổ sung trong {policy.docHours} giờ.
        </Notice>
      ) : (
        <Skeleton className="h-16 w-full" />
      )}
      <fieldset disabled={command.isPending} className="min-w-0 space-y-4">
        <Field label="Lý do phải xử lý ngay" htmlFor="em-reason" required error={errors.reason}>
          <Textarea id="em-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả lý do cần xử lý khẩn cấp..." value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nhà thầu thực hiện" htmlFor="em-contractor" required error={errors.contractorName}>
            <Input id="em-contractor" maxLength={LIMITS.CONTRACTOR_NAME_MAX} placeholder="Tên nhà thầu thực hiện" value={contractorName} onChange={(event) => setContractorName(event.target.value)} />
          </Field>
          <Field label="Chi phí dự kiến" htmlFor="em-amount" required error={errors.estimatedAmountVnd} hint={amountValue ? vndInWords(String(amountValue)) : undefined}>
            <MoneyInput id="em-amount" value={amount} onChange={setAmount} invalid={Boolean(errors.estimatedAmountVnd)} />
          </Field>
          <Field label="Ngày dự kiến xong" htmlFor="em-end" required error={errors.plannedEndDate}>
            <Input id="em-end" type="date" min={todayVn()} value={plannedEndDate} onChange={(event) => setPlannedEndDate(event.target.value)} />
          </Field>
        </div>
      </fieldset>
      {isOnline ? null : <p className="text-sm text-crit">Đang mất kết nối — chưa gửi được.</p>}
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
