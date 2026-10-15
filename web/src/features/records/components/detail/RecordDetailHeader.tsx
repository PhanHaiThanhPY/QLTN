import { PageHeader } from '@/components/common/PageHeader';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Badge, Tag } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PRIORITY_LABEL } from '@/domain/constants';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { useRecordContext } from '../../record-context';
import { RecordFlags } from '../list/RecordFlags';
import { EmergencyDialog } from '../emergency/EmergencyDialog';
import { DialogActionButton } from '../shared/DialogActionButton';
import { ReasonActionButton } from '../shared/ReasonActionButton';
import { EditRecordButton } from './EditRecordButton';
import { RecordWorkflowStepper } from './RecordWorkflowStepper';
import { ReassignButton } from './ReassignButton';
import { RecordDocumentButton } from './RecordDocumentButton';

/** Topbar title + breadcrumb, then a header card with code, status, building, badges and record-level actions. */
export const RecordDetailHeader = () => {
  const { detail } = useRecordContext();
  const { buildingName, locationName } = useReferenceData();
  const { record } = detail;
  const isHighPriority = record.priority === 'URGENT' || record.priority === 'HIGH';
  const name = record.title || '(Chưa đặt tên)';
  return (
    <>
      <PageHeader isCompact
        title={`${record.code} · ${name}`}
        description={buildingName(record.buildingId)}
        breadcrumbs={[{ label: 'Hồ sơ sửa chữa', to: '/records' }, { label: record.code }]}
      />
      <Card className="mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{record.code}</Tag>
              <RepairStatusBadge status={record.status} />
              {isHighPriority ? <Badge tone="warn">Ưu tiên {PRIORITY_LABEL[record.priority].toLowerCase()}</Badge> : null}
              <RecordFlags isOverdue={detail.isOverdue} needsReassignment={detail.inactiveSlots.length > 0} isEmergency={Boolean(record.emergency)} />
            </div>
            <h2 className="break-words text-lg font-semibold tracking-tight text-ink">{name}</h2>
            <p className="text-sm text-ink-2">
              {buildingName(record.buildingId)} · {locationName(record.locationId)}
            </p>
            <p className="text-xs text-ink-3">Cập nhật {formatDateTime(record.updatedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <DialogActionButton action="startEmergencyRepair" variant="danger" renderDialog={(close) => <EmergencyDialog onClose={close} />} />
            <EditRecordButton />
            <RecordDocumentButton />
            <ReassignButton />
            <ReasonActionButton
              action="withdrawRecord"
              field="reason"
              dialogTitle="Rút hồ sơ"
              dialogDescription="Hồ sơ chuyển sang “Đóng do rút hồ sơ”, toàn bộ lịch sử được giữ. Không mở lại được."
              confirmVariant="danger"
              variant="secondary"
              successMessage="Đã rút hồ sơ."
            />
          </div>
        </div>
        <RecordWorkflowStepper status={record.status} />
      </Card>
    </>
  );
};
