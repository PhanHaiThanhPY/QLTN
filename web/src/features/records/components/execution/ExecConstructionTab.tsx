import { InfoGrid } from '@/components/common/InfoGrid';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { ExecutionHistory } from '@/domain/execution';
import { formatDate, formatDateTime } from '@/utils/date';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { StartConstructionDialog } from '../construction/StartConstructionDialog';
import { ActorLine } from '../shared/ActorLine';
import { DialogActionButton } from '../shared/DialogActionButton';
import { ProgressBar } from '../shared/ProgressBar';
import { RecordFiles } from '../shared/RecordFiles';
import { MinutesFormDialog } from './MinutesFormDialog';
import { ProgressUpdateDialog } from './ProgressUpdateDialog';

/** Tab "Thi công" for records served by api-qltn (S3): plan, progress updates and hand-over to acceptance. */
export const ExecConstructionTab = ({ execution }: { execution: ExecutionHistory }) => {
  const { detail } = useRecordContext();
  const { record } = detail;
  const submit = useRepairAction('submitAcceptance');
  const construction = execution.construction;

  if (!construction) {
    return (
      <EmptyState
        title="Chưa bắt đầu thi công"
        description="Sau khi tờ trình được duyệt, BQL nhập kế hoạch thi công; BQT và TVKT nhận thông báo kế hoạch trong hệ thống."
        action={<DialogActionButton action="startConstruction" renderDialog={(close) => <StartConstructionDialog onClose={close} />} />}
      />
    );
  }

  const isDone = construction.progressPercent === 100;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Thi công"
          actions={
            <>
              <DialogActionButton
                action="updateConstruction"
                variant="secondary"
                renderDialog={(close) => (
                  <ProgressUpdateDialog recordId={record.id} currentPercent={construction.progressPercent} onClose={close} />
                )}
              />
              <DialogActionButton
                action="submitAcceptance"
                stateOverride={withPrecondition(submit.state, isDone, 'Tiến độ phải đạt 100% trước khi gửi nghiệm thu.')}
                renderDialog={(close) => <MinutesFormDialog recordId={record.id} action="submitAcceptance" onClose={close} />}
              />
            </>
          }
        />
        <CardBody className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-2">Tiến độ</span>
              <span className="tnum font-semibold text-ink">{construction.progressPercent}%</span>
            </div>
            <ProgressBar value={construction.progressPercent} tone={isDone ? 'good' : 'accent'} label="Tiến độ thi công" />
          </div>
          <InfoGrid
            items={[
              { label: 'Nhà thầu thực hiện', value: detail.quoteProposal?.executingContractorName ?? '—' },
              { label: 'Ngày bắt đầu', value: formatDate(construction.startDate) },
              { label: 'Dự kiến hoàn thành', value: formatDate(construction.plannedEndDate) },
              { label: 'Ngày hoàn thành', value: formatDate(construction.completedDate ?? undefined) },
              { label: 'Kế hoạch thi công', value: <span className="whitespace-pre-line">{construction.planNote}</span>, wide: true },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`Nhật ký thi công (${construction.updates.length})`} />
        <CardBody>
          {construction.updates.length === 0 ? (
            <p className="text-sm text-ink-3">Chưa có lần cập nhật nào.</p>
          ) : (
            <ol className="space-y-3">
              {[...construction.updates].reverse().map((update) => (
                <li key={update.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="tnum font-semibold text-ink">{update.progressPercent}%</span>
                    <span className="text-xs text-ink-3">{formatDateTime(update.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{update.note}</p>
                  <ActorLine prefix="Cập nhật bởi" actorId={update.actorId} at={update.createdAt} />
                  {update.attachmentIds.length > 0 ? <RecordFiles ids={update.attachmentIds} /> : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
