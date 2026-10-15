import { useState } from 'react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Notice } from '@/components/common/Notice';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { todayVn } from '@/services/runtime';
import { addDays } from '@/utils/date';
import { formatVnd, parseVndInput } from '@/utils/money';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

const SHOWN = ['reason', 'contractorName', 'estimatedAmountVnd', 'plannedEndDate'] as const;

/** BQL lets the work start now within the building's emergency limit; approvers are informed. */
export const EmergencyDialog = ({ onClose }: { onClose: () => void }) => {
  const { detail } = useRecordContext();
  const config = detail.buildingConfig;
  const [reason, setReason] = useState('');
  const [contractorName, setContractorName] = useState(detail.proposalDraft?.contractorName ?? '');
  const [amount, setAmount] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState(addDays(todayVn(), 2));
  const command = useRecordCommand({ successMessage: 'Đã bắt đầu sửa chữa khẩn cấp và báo người duyệt.', onSuccess: onClose });
  const errors = command.fieldErrors;
  const limit = config?.emergencyLimitVnd;
  const hours = config?.emergencyDocHours ?? 24;
  return (
    <CommandDialog
      title="Sửa chữa khẩn cấp"
      description={`Cho làm ngay trước khi duyệt. Hồ sơ (tờ trình, chữ ký) phải bổ sung trong ${hours} giờ; trễ hạn phải ghi lý do.`}
      confirmLabel="Bắt đầu xử lý khẩn cấp"
      confirmVariant="danger"
      isPending={command.isPending}
      canConfirm={reason.trim().length >= LIMITS.REASON_MIN && contractorName.trim().length > 0 && parseVndInput(amount) !== undefined}
      onClose={onClose}
      onConfirm={() =>
        void command.run('startEmergencyRepair', { reason: reason.trim(), contractorName: contractorName.trim(), estimatedAmountVnd: parseVndInput(amount), plannedEndDate })
      }
    >
      <Notice tone="warning" title={`Hạn mức khẩn cấp của tòa: ${formatVnd(limit)}`}>
        Vượt hạn mức thì phải đi quy trình duyệt thông thường. Các vai trò trong workflow của tòa nhà sẽ nhận thông báo.
      </Notice>
      <Field label="Lý do phải xử lý ngay" htmlFor="em-reason" required error={errors.reason}>
        <Textarea id="em-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả lý do cần xử lý khẩn cấp..." value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nhà thầu thực hiện" htmlFor="em-contractor" required error={errors.contractorName}>
          <Input id="em-contractor" maxLength={LIMITS.CONTRACTOR_NAME_MAX} placeholder="Tên nhà thầu thực hiện" value={contractorName} onChange={(event) => setContractorName(event.target.value)} />
        </Field>
        <Field label="Chi phí dự kiến" htmlFor="em-amount" required error={errors.estimatedAmountVnd}>
          <MoneyInput id="em-amount" value={amount} onChange={setAmount} invalid={Boolean(errors.estimatedAmountVnd)} />
        </Field>
        <Field label="Ngày dự kiến xong" htmlFor="em-end" required error={errors.plannedEndDate}>
          <Input id="em-end" type="date" value={plannedEndDate} onChange={(event) => setPlannedEndDate(event.target.value)} />
        </Field>
      </div>
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
