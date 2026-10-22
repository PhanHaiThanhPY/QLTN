import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { approvalStepOf } from '@/domain/actions';
import type { PaymentRequest } from '@/domain/types';
import { formatVnd } from '@/utils/money';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { ConfirmActionButton } from '../shared/ConfirmActionButton';
import { ReasonActionButton } from '../shared/ReasonActionButton';
import { RecordFiles } from '../shared/RecordFiles';

/** Approver panel for the current payment request revision. */
export const PaymentDecisionCard = ({ request }: { request: PaymentRequest }) => {
  const approve = useRepairAction('approvePayment');
  const { detail } = useRecordContext();
  const currentStep = approvalStepOf(detail.record.status, request.approvalStepKeys, detail.record.workflowApprovalSteps, request.currentApprovalStepKey);
  if (!approve.relevant || request.decision) return null;
  return (
    <Card className="border-warn/40">
      <CardHeader
        title={`Đề nghị thanh toán lần ${request.revisionNo} – ${currentStep?.label ?? 'chờ duyệt'}`}
        actions={
          <>
            <ReasonActionButton
              action="requestPaymentUpdate"
              field="reason"
              dialogTitle="Trả đề nghị thanh toán"
              dialogDescription="BQL sửa và gửi lần đề nghị mới; quyết định này được giữ lại."
              successMessage="Đã trả đề nghị thanh toán."
            />
            <ConfirmActionButton action="approvePayment" dialogTitle="Duyệt thanh toán" successMessage="Đã duyệt đề nghị thanh toán.">
              Duyệt đề nghị lần {request.revisionNo} với số tiền <strong className="tnum">{formatVnd(request.amountVnd)}</strong>?
            </ConfirmActionButton>
          </>
        }
      />
      <CardBody className="space-y-2">
        <p className="tnum text-lg font-semibold text-ink">{formatVnd(request.amountVnd)}</p>
        <RecordFiles ids={request.attachmentIds} />
      </CardBody>
    </Card>
  );
};
