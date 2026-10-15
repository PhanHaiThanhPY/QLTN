import { InfoGrid } from '@/components/common/InfoGrid';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatDate } from '@/utils/date';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { DialogActionButton } from '../shared/DialogActionButton';
import { ProgressBar } from '../shared/ProgressBar';
import { ConstructionLogList } from './ConstructionLogList';
import { ProgressDialog } from './ProgressDialog';
import { StartConstructionDialog } from './StartConstructionDialog';
import { SubmitAcceptanceDialog } from './SubmitAcceptanceDialog';

/** Thi công: start, progress logs and hand-over to acceptance. */
export const ConstructionTab = () => {
  const { detail } = useRecordContext();
  const { construction, record } = detail;
  const submit = useRepairAction('submitAcceptance');

  if (!construction) {
    if (record.status === 'READY_FOR_CONSTRUCTION') {
      return (
        <EmptyState
          title="Chưa bắt đầu thi công"
          description="Tờ trình đã được duyệt và mô phỏng ký. BQL quản lý nhập ngày bắt đầu và ngày dự kiến hoàn thành."
          action={<DialogActionButton action="startConstruction" renderDialog={(close) => <StartConstructionDialog onClose={close} />} />}
        />
      );
    }
    return <EmptyState title="Chưa có dữ liệu thi công" description="Thi công bắt đầu sau khi tờ trình được duyệt và mô phỏng xác nhận đã ký." />;
  }

  const isDone = construction.progressPercent === 100;
  const submitState = withPrecondition(submit.state, isDone, 'Tiến độ phải đạt 100% trước khi gửi nghiệm thu.');
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Thi công"
          actions={
            <>
              <DialogActionButton action="updateConstruction" variant="secondary" renderDialog={(close) => <ProgressDialog onClose={close} />} />
              <DialogActionButton action="submitAcceptance" stateOverride={submitState} renderDialog={(close) => <SubmitAcceptanceDialog onClose={close} />} />
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
              { label: 'Ngày bắt đầu', value: formatDate(construction.startDate) },
              { label: 'Dự kiến hoàn thành', value: formatDate(construction.plannedEndDate) },
              { label: 'Ngày hoàn thành', value: formatDate(construction.completedDate) },
              { label: 'Số lần cập nhật', value: <span className="tnum">{construction.logs.length}</span> },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Nhật ký thi công" />
        <CardBody>
          <ConstructionLogList logs={construction.logs} />
        </CardBody>
      </Card>
    </div>
  );
};
