import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { useRecordContext } from '../../record-context';
import { approvedSubmission, isActionRelevant } from '../../record-utils';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { ExecPaymentTab } from '../instalments/ExecPaymentTab';
import { PaymentClosingCard } from './PaymentClosingCard';
import { PaymentDecisionCard } from './PaymentDecisionCard';
import { PaymentRequestForm } from './PaymentRequestForm';
import { PaymentRevisionList } from './PaymentRevisionList';

/** Thanh toán: request revisions, approver decision, payment record, final close. */
export const PaymentTab = () => {
  const { detail } = useRecordContext();
  if (detail.paymentHistory) return <ExecPaymentTab history={detail.paymentHistory} />;
  const { record, paymentRequests, payments } = detail;
  const approved = approvedSubmission(detail);
  const isOpen = isActionRelevant('savePaymentDraft', record.status);
  if (!approved || (paymentRequests.length === 0 && !isOpen)) {
    return <EmptyState title="Chưa đến bước thanh toán" description="Đề nghị thanh toán được lập sau khi nghiệm thu đạt, theo đúng số tiền đã duyệt." />;
  }
  const latest = paymentRequests[paymentRequests.length - 1];
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amountVnd, 0);
  const lastReturn = record.status === 'NEEDS_PAYMENT_UPDATE' ? latest?.reason : undefined;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Giá trị thanh toán" />
        <CardBody>
          <InfoGrid
            items={[
              { label: 'Giá trị đã duyệt', value: <span className="tnum font-semibold">{formatVnd(approved.amountVnd)}</span> },
              { label: 'Đã thanh toán', value: <span className="tnum">{formatVnd(paidTotal)}</span> },
            ]}
          />
        </CardBody>
      </Card>
      {lastReturn ? (
        <Notice tone="warning" title="BQT trả đề nghị thanh toán">
          <span className="whitespace-pre-line">{lastReturn}</span>
        </Notice>
      ) : null}
      {latest ? <PaymentDecisionCard request={latest} /> : null}
      {latest ? <PaymentClosingCard request={latest} approvedAmount={approved.amountVnd} paidTotal={paidTotal} /> : null}
      <PaymentRequestForm approvedAmount={approved.amountVnd} />
      {payments.length > 0 ? (
        <Card>
          <CardHeader title="Thanh toán đã ghi nhận" />
          <CardBody className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-line p-3">
                <p className="tnum text-sm font-semibold text-ink">{formatVnd(payment.amountVnd)}</p>
                <p className="text-sm text-ink-2">
                  Ngày {formatDate(payment.paidDate)} · Mã tham chiếu {payment.reference}
                </p>
                <ActorLine prefix="Ghi nhận bởi" actorId={payment.recordedBy} at={payment.createdAt} />
                <div className="mt-2">
                  <RecordFiles ids={payment.attachmentIds} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Các lần đề nghị thanh toán" />
        <CardBody>
          <PaymentRevisionList requests={paymentRequests} />
        </CardBody>
      </Card>
    </div>
  );
};
