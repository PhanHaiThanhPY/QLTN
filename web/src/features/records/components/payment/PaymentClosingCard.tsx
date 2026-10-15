import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { PaymentRequest } from '@/domain/types';
import { formatVnd } from '@/utils/money';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { ConfirmActionButton } from '../shared/ConfirmActionButton';
import { DialogActionButton } from '../shared/DialogActionButton';
import { RecordPaymentDialog } from './RecordPaymentDialog';

interface PaymentClosingCardProps {
  request: PaymentRequest;
  approvedAmount: number;
  paidTotal: number;
}

/** PENDING_PAYMENT: record the payment, then close the record as a separate reviewed step. */
export const PaymentClosingCard = ({ request, approvedAmount, paidTotal }: PaymentClosingCardProps) => {
  const { detail } = useRecordContext();
  const recordPay = useRepairAction('recordPayment');
  const complete = useRepairAction('completeRecord');
  if (!recordPay.relevant) return null;
  const isPaid = detail.payments.some((payment) => payment.paymentRequestId === request.id);
  const recordState = withPrecondition(recordPay.state, !isPaid, 'Đề nghị này đã được ghi nhận thanh toán (demo chỉ thanh toán một lần).');
  const completeState = withPrecondition(complete.state, paidTotal === approvedAmount, 'Chưa ghi nhận thanh toán đủ số được duyệt.');
  return (
    <Card className="border-accent/40">
      <CardHeader
        title="Thanh toán và đóng hồ sơ"
        description="Ghi nhận thanh toán và đóng hoàn tất là hai bước riêng để rà soát trước khi đóng."
        actions={
          <>
            <DialogActionButton
              action="recordPayment"
              variant={isPaid ? 'secondary' : 'primary'}
              stateOverride={recordState}
              renderDialog={(close) => <RecordPaymentDialog approvedAmount={approvedAmount} onClose={close} />}
            />
            <ConfirmActionButton
              action="completeRecord"
              dialogTitle="Đóng hoàn tất hồ sơ"
              stateOverride={completeState}
              successMessage="Hồ sơ đã hoàn tất."
            >
              Hồ sơ sẽ chuyển sang “Hoàn tất” và chỉ còn xem được; chưa có chức năng mở lại. Đã thanh toán{' '}
              <strong className="tnum">{formatVnd(paidTotal)}</strong> / {formatVnd(approvedAmount)}.
            </ConfirmActionButton>
          </>
        }
      />
      <CardBody>
        <p className="text-sm text-ink-2">{isPaid ? 'Đã ghi nhận thanh toán – rà soát rồi bấm “Đóng hoàn tất”.' : 'Đề nghị đã được duyệt – chờ ghi nhận thanh toán.'}</p>
      </CardBody>
    </Card>
  );
};
