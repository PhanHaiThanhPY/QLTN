import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { isOpenInstalment, type PaymentHistory } from '@/domain/payment';
import { formatVndString } from '@/domain/quote-proposal';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { ConfirmActionButton } from '../shared/ConfirmActionButton';
import { DialogActionButton } from '../shared/DialogActionButton';
import { InstalmentCard } from './InstalmentCard';
import { PaymentRequestDialog } from './PaymentRequestDialog';

/** B06-S1 ui-brief §2.6: nothing is paid for an emergency record the board did not accept. */
const NO_PAYMENT_STATUSES: readonly string[] = ['POST_REVIEW_REJECTED', 'CLOSED_POST_REVIEW_REJECTED'];

/** Tab "Thanh toán" for records served by api-qltn (S4): advances during the work, settlement, transfers, close. */
export const ExecPaymentTab = ({ history }: { history: PaymentHistory }) => {
  const { detail } = useRecordContext();
  const newAdvance = useRepairAction('submitAdvanceRequest');
  const settle = useRepairAction('submitPaymentRequest');
  const complete = useRepairAction('completeRecord');
  const advances = history.payments.filter((row) => row.kind === 'TAM_UNG');
  const settlement = history.payments.find((row) => row.kind === 'QUYET_TOAN');
  const openAdvance = advances.find(isOpenInstalment);
  const returnedAdvance = advances.find((row) => row.status === 'NEEDS_UPDATE');
  const transferredAdvances = advances
    .filter((row) => row.status === 'TRANSFERRED')
    .reduce((total, row) => total + BigInt(row.amountVnd), 0n)
    .toString();
  const settled = settlement?.settlementAmountVnd ?? null;
  const canClose = settlement?.status === 'TRANSFERRED' && settled !== null && history.transferredTotalVnd === settled;

  if (NO_PAYMENT_STATUSES.includes(detail.record.status)) {
    return <Notice tone="warning">Hồ sơ không được duyệt hậu kiểm: không có thanh toán.</Notice>;
  }
  if (!history.approvedAmountVnd) {
    return <EmptyState title="Chưa đến bước thanh toán" description="Thanh toán mở sau khi tờ trình được duyệt và có số được duyệt." />;
  }
  const payee = settlement ?? advances.at(-1);
  const initial = {
    ...(payee ? { payeeName: payee.payeeName, accountNo: payee.accountNo, bankName: payee.bankName } : {}),
    ...(history.draft ?? {}),
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Thanh toán theo đợt"
          actions={
            <>
              <DialogActionButton
                action="submitAdvanceRequest"
                variant="secondary"
                stateOverride={withPrecondition(newAdvance.state, !openAdvance, 'Đang có một đợt tạm ứng chưa hoàn tất.')}
                renderDialog={(close) => <PaymentRequestDialog action="submitAdvanceRequest" initial={{ ...initial, amountVnd: '' }} onClose={close} />}
              />
              {returnedAdvance ? (
                <DialogActionButton
                  action="resubmitAdvanceRequest"
                  variant="secondary"
                  renderDialog={(close) => (
                    <PaymentRequestDialog
                      action="resubmitAdvanceRequest"
                      initial={{ ...returnedAdvance, requestAttachmentIds: returnedAdvance.requestAttachmentIds }}
                      onClose={close}
                    />
                  )}
                />
              ) : null}
              <DialogActionButton
                action="submitPaymentRequest"
                stateOverride={withPrecondition(settle.state, !openAdvance, 'Còn đợt tạm ứng chưa chuyển khoản.')}
                renderDialog={(close) => (
                  <PaymentRequestDialog
                    action="submitPaymentRequest"
                    initial={{ ...initial, amountVnd: settled ?? history.approvedAmountVnd ?? '' }}
                    transferredAdvancesVnd={transferredAdvances}
                    onClose={close}
                  />
                )}
              />
              {complete.relevant ? (
                <ConfirmActionButton
                  action="completeRecord"
                  dialogTitle="Đóng hồ sơ hoàn tất"
                  confirmLabel="Đóng hồ sơ"
                  successMessage="Đã đóng hồ sơ."
                  stateOverride={withPrecondition(complete.state, canClose, 'Quyết toán phải đã chuyển khoản đủ số quyết toán.')}
                >
                  <p>Tổng đã chuyển khoản {formatVndString(history.transferredTotalVnd)} bằng số quyết toán. Hồ sơ sẽ chuyển sang “Hoàn tất”.</p>
                </ConfirmActionButton>
              ) : null}
            </>
          }
        />
        <CardBody>
          <InfoGrid
            items={[
              { label: 'Số được duyệt', value: <span className="tnum font-semibold">{formatVndString(history.approvedAmountVnd)}</span> },
              { label: 'Đã chuyển khoản', value: <span className="tnum">{formatVndString(history.transferredTotalVnd)}</span> },
              { label: 'Số quyết toán', value: formatVndString(settled) },
              { label: 'Nhà thầu thực hiện', value: detail.quoteProposal?.executingContractorName ?? '—' },
            ]}
          />
        </CardBody>
      </Card>
      {history.payments.length === 0 ? (
        <EmptyState title="Chưa có đợt thanh toán" description="BQL có thể đề nghị tạm ứng trong lúc thi công; quyết toán sau khi nghiệm thu đạt." />
      ) : (
        [...history.payments].reverse().map((payment) => <InstalmentCard key={payment.id} payment={payment} />)
      )}
    </div>
  );
};
