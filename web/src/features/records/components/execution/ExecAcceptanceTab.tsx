import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Notice } from '@/components/common/Notice';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { ExecutionHistory } from '@/domain/execution';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { MemberDecisionDialog } from './MemberDecisionDialog';
import { MinutesCard } from './MinutesCard';
import { RepairDraftCard } from './RepairDraftCard';
import { memberLabel, openStepsOf } from './execution-utils';

const NOT_MEMBER = 'Bạn không còn bước nghiệm thu nào cần quyết định trong lượt này.';

/** Tab "Nghiệm thu" for records served by api-qltn (S3): the open round, repair work and every set of minutes. */
export const ExecAcceptanceTab = ({ execution }: { execution: ExecutionHistory }) => {
  const { detail, viewer } = useRecordContext();
  const { record } = detail;
  const pass = useRepairAction('passAcceptance');
  const fail = useRepairAction('failAcceptance');
  const [outcome, setOutcome] = useState<'pass' | 'fail' | null>(null);
  const rounds = execution.acceptances;
  if (rounds.length === 0) {
    return (
      <EmptyState
        title="Chưa có biên bản nghiệm thu"
        description="BQL gửi nghiệm thu khi tiến độ thi công đạt 100%, kèm thời gian, địa điểm, nội dung và ảnh kết quả."
      />
    );
  }
  const open = rounds.find((round) => round.outcome === 'PENDING');
  const myStep = open ? openStepsOf(record, open, viewer.id)[0] : undefined;
  const waiting = open
    ? open.memberStepKeys.filter((key) => !open.decisions.some((row) => row.stepKey === key)).map((key) => memberLabel(record, key))
    : [];

  return (
    <div className="space-y-4">
      {open ? (
        <Card className="border-warn/40">
          <CardHeader
            title={`Lượt ${open.roundNo} đang chờ nghiệm thu`}
            description={`Còn chờ: ${waiting.join(', ') || '—'}. Các thành phần quyết định song song; một người KHÔNG ĐẠT thì lượt không đạt ngay.`}
            actions={
              pass.relevant ? (
                <>
                  <ActionButton variant="secondary" state={withPrecondition(fail.state, Boolean(myStep), NOT_MEMBER)} onClick={() => setOutcome('fail')}>
                    Không đạt
                  </ActionButton>
                  <ActionButton state={withPrecondition(pass.state, Boolean(myStep), NOT_MEMBER)} onClick={() => setOutcome('pass')}>
                    Đạt
                  </ActionButton>
                </>
              ) : null
            }
          />
          {myStep ? (
            <CardBody>
              <Notice tone="info" title={`Bạn quyết định với vai trò: ${memberLabel(record, myStep)}`}>
                Mỗi người chỉ quyết định một lần trong một lượt và phải ký.
              </Notice>
            </CardBody>
          ) : null}
          {outcome && myStep ? (
            <MemberDecisionDialog
              recordId={record.id}
              roundId={open.id}
              roundNo={open.roundNo}
              stepLabel={memberLabel(record, myStep)}
              outcome={outcome}
              onClose={() => setOutcome(null)}
            />
          ) : null}
        </Card>
      ) : null}
      <RepairDraftCard execution={execution} />
      {[...rounds].reverse().map((round) => (
        <MinutesCard key={round.id} round={round} />
      ))}
    </div>
  );
};
