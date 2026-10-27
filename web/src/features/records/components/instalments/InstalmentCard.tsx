import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { NO_TRANSFER_LABEL, PAYMENT_KIND_LABEL, instalmentStatusLabel, isNoTransferInstalment, vndInWords, type PaymentInstalment, type PaymentStatus } from '@/domain/payment';
import { formatVndString } from '@/domain/quote-proposal';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDate, formatDateTime } from '@/utils/date';
import { useRecordContext } from '../../record-context';
import { memberLabel } from '../execution/execution-utils';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { InstalmentDecisionDialog } from './InstalmentDecisionDialog';
import { decisionState, paymentStepHolder, transferState } from './instalment-utils';
import { TransferDialog } from './TransferDialog';

const STATUS_TONE: Readonly<Record<PaymentStatus, BadgeTone>> = {
  PENDING_APPROVAL: 'warn',
  NEEDS_UPDATE: 'crit',
  PENDING_TRANSFER: 'info',
  TRANSFERRED: 'good',
};

/** The payee may be left out on a 0-đồng settlement (FX-S2 BR-FX2-03). */
const payeeLine = (payment: PaymentInstalment): string =>
  [payment.payeeName, payment.accountNo, payment.bankName].filter(Boolean).join(' · ') || '—';

/** One instalment (D5-TDN): amount and how it was computed, payee, files, chain decisions, transfer proof. */
export const InstalmentCard = ({ payment }: { payment: PaymentInstalment }) => {
  const { detail, viewer } = useRecordContext();
  const { userName } = useReferenceData();
  const { record } = detail;
  const [dialog, setDialog] = useState<'approve' | 'update' | 'transfer' | null>(null);
  const stepLabel = payment.currentStepKey ? memberLabel(record, payment.currentStepKey) : '';
  const noTransfer = isNoTransferInstalment(payment);
  const advancesDeducted =
    payment.settlementAmountVnd !== null ? (BigInt(payment.settlementAmountVnd) - BigInt(payment.amountVnd)).toString() : null;

  return (
    <Card>
      <CardHeader
        title={`${PAYMENT_KIND_LABEL[payment.kind]} · đợt ${payment.seqNo}`}
        description={<ActorLine prefix={`Lần gửi ${payment.revisionNo} bởi`} actorId={payment.submittedBy} at={payment.submittedAt} />}
        actions={
          <>
            <Badge tone={STATUS_TONE[payment.status]}>{instalmentStatusLabel(payment)}</Badge>
            {payment.status === 'PENDING_APPROVAL' ? (
              <>
                <ActionButton size="sm" variant="secondary" state={decisionState(viewer, record, payment)} onClick={() => setDialog('update')}>
                  Trả đề nghị
                </ActionButton>
                <ActionButton size="sm" state={decisionState(viewer, record, payment)} onClick={() => setDialog('approve')}>
                  Duyệt
                </ActionButton>
              </>
            ) : null}
            {payment.status === 'PENDING_TRANSFER' ? (
              <ActionButton size="sm" state={transferState(viewer)} onClick={() => setDialog('transfer')}>
                Xác nhận đã chuyển khoản
              </ActionButton>
            ) : null}
          </>
        }
      />
      <CardBody className="space-y-4">
        <InfoGrid
          items={[
            {
              label: 'Số tiền của đợt',
              value: (
                <span>
                  <span className="tnum font-semibold">{formatVndString(payment.amountVnd)}</span>
                  <span className="block text-xs text-ink-3">{vndInWords(payment.amountVnd)}</span>
                </span>
              ),
            },
            ...(advancesDeducted !== null
              ? [
                  {
                    label: 'Cách tính',
                    value: `${formatVndString(payment.settlementAmountVnd)} − tạm ứng đã chuyển ${formatVndString(advancesDeducted)}`,
                  },
                ]
              : []),
            { label: 'Người hưởng', value: payeeLine(payment) },
            { label: 'Nội dung chuyển khoản', value: payment.transferContent },
            ...(payment.status === 'PENDING_APPROVAL'
              ? [{ label: 'Đang chờ', value: `${stepLabel} – ${userName(paymentStepHolder(record, payment.currentStepKey))}` }]
              : []),
            ...(payment.status === 'TRANSFERRED' && noTransfer ? [{ label: 'Chuyển khoản', value: NO_TRANSFER_LABEL }] : []),
            ...(payment.status === 'TRANSFERRED' && !noTransfer
              ? [
                  {
                    label: 'Đã chuyển khoản',
                    value: `${formatDate(payment.transferDate ?? undefined)} · mã ${payment.transferReference ?? ''} · xác nhận bởi ${userName(payment.confirmedBy ?? undefined)}`,
                  },
                ]
              : []),
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">Đề nghị của nhà thầu</p>
            <RecordFiles ids={payment.requestAttachmentIds} />
          </div>
          {payment.invoiceAttachmentIds.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-3">Hóa đơn GTGT</p>
              <RecordFiles ids={payment.invoiceAttachmentIds} />
            </div>
          ) : null}
          {payment.proofAttachmentIds.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-3">Chứng từ chuyển khoản</p>
              <RecordFiles ids={payment.proofAttachmentIds} />
            </div>
          ) : null}
        </div>
        {payment.decisions.length > 0 ? (
          <ol className="space-y-1 text-sm">
            {payment.decisions.map((decision) => (
              <li key={decision.id} className="text-ink-2">
                Lần {decision.revisionNo} · {memberLabel(record, decision.stepKey)} · {userName(decision.actorId)}:{' '}
                <span className="font-semibold text-ink">{decision.outcome === 'APPROVED' ? 'Đã duyệt' : 'Trả đề nghị'}</span>
                {decision.reason ? ` – ${decision.reason}` : ''} · {formatDateTime(decision.createdAt)}
              </li>
            ))}
          </ol>
        ) : null}
        {payment.signatureDataUrl ? (
          <figure>
            <figcaption className="text-xs text-ink-3">Chữ ký BQL (lần gửi {payment.revisionNo})</figcaption>
            <img src={payment.signatureDataUrl} alt="Chữ ký BQL đề nghị thanh toán" className="h-14 w-40 rounded bg-white object-contain" />
          </figure>
        ) : null}
      </CardBody>
      {dialog === 'approve' || dialog === 'update' ? (
        <InstalmentDecisionDialog payment={payment} outcome={dialog} stepLabel={stepLabel} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'transfer' ? <TransferDialog payment={payment} onClose={() => setDialog(null)} /> : null}
    </Card>
  );
};
