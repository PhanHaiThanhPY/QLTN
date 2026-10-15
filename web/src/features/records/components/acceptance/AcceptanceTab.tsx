import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useRecordContext } from '../../record-context';
import { DialogActionButton } from '../shared/DialogActionButton';
import { AcceptanceDecisionDialog } from './AcceptanceDecisionDialog';
import { AcceptanceRoundCard } from './AcceptanceRoundCard';
import { RepairEvidenceForm } from './RepairEvidenceForm';
import { REVIEWER_LABEL } from './acceptance-labels';

/** Nghiệm thu: rounds (failed ones kept), KT and TVKT decisions, repair evidence + resubmit. */
export const AcceptanceTab = () => {
  const { detail } = useRecordContext();
  const rounds = detail.acceptances;
  if (rounds.length === 0) {
    return <EmptyState title="Chưa có lượt nghiệm thu" description="BQL gửi nghiệm thu khi tiến độ thi công đạt 100% và có ảnh kết quả." />;
  }
  const pending = rounds.find((round) => round.result === 'PENDING');
  const waitingFor = (detail.record.pendingAcceptanceSlots ?? []).map((slot) => REVIEWER_LABEL[slot]).join(' và ');
  return (
    <div className="space-y-4">
      {pending ? (
        <Card className="border-warn/40">
          <CardHeader
            title={`Lượt ${pending.roundNo} đang chờ nghiệm thu`}
            description={`Cần cả Kỹ thuật và TVKT nghiệm thu đạt. Đang chờ: ${waitingFor || "—"}.`}
            actions={
              <>
                <DialogActionButton
                  action="failAcceptance"
                  variant="secondary"
                  renderDialog={(close) => <AcceptanceDecisionDialog outcome="fail" roundNo={pending.roundNo} onClose={close} />}
                />
                <DialogActionButton
                  action="passAcceptance"
                  renderDialog={(close) => <AcceptanceDecisionDialog outcome="pass" roundNo={pending.roundNo} onClose={close} />}
                />
              </>
            }
          />
          <CardBody>
            <p className="text-sm text-ink-2">Đạt cần kết luận (Kỹ thuật kèm biên bản nghiệm thu). Một người ghi không đạt thì hồ sơ chuyển sang “Cần khắc phục”.</p>
          </CardBody>
        </Card>
      ) : null}
      <RepairEvidenceForm />
      {[...rounds].reverse().map((round) => (
        <AcceptanceRoundCard key={round.id} round={round} />
      ))}
    </div>
  );
};
