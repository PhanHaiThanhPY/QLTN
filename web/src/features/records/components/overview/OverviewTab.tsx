import { Notice } from '@/components/common/Notice';
import { IS_API_MODE } from '@/config/data-source';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useRecordContext } from '../../record-context';
import { EmergencyCard } from '../emergency/EmergencyCard';
import { RecordAlerts } from '../shared/RecordAlerts';
import { RecordFiles } from '../shared/RecordFiles';
import { AssigneesCard } from './AssigneesCard';
import { ConfirmationActions } from './ConfirmationActions';
import { ConfirmationHistory } from './ConfirmationHistory';
import { ReassignNotice } from './ReassignNotice';
import { RecordInfoCard } from './RecordInfoCard';

/** Tổng quan: info, description, site photos, assignees, confirmations. */
export const OverviewTab = () => {
  const { detail } = useRecordContext();
  const { record } = detail;
  const lastUpdateRequest = [...detail.confirmations].reverse().find((row) => row.outcome === 'NEEDS_UPDATE');
  return (
    <div className="space-y-4">
      <ReassignNotice />
      <EmergencyCard />
      <RecordAlerts alerts={detail.alerts} />
      {record.status === 'NEEDS_RECORD_UPDATE' && lastUpdateRequest ? (
        <Notice tone="warning" title="Người xác nhận yêu cầu bổ sung thông tin">
          <span className="whitespace-pre-line">{lastUpdateRequest.note}</span>
        </Notice>
      ) : null}
      {record.status === 'DRAFT' ? (
        <Notice title="Hồ sơ nháp">
          {IS_API_MODE
            ? 'Hoàn thiện thông tin, thêm ảnh hiện trường và lưu nháp; gửi xác nhận sẽ có ở bước tiếp theo.'
            : 'Hoàn thiện thông tin, thêm ít nhất 1 ảnh hiện trường rồi “Gửi xác nhận”.'}
        </Notice>
      ) : null}
      <ConfirmationActions />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RecordInfoCard />
          <Card>
            <CardHeader title="Ảnh hiện trường" />
            <CardBody>
              <RecordFiles ids={record.attachmentIds} emptyText="Chưa có ảnh hiện trường." />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <AssigneesCard />
          <ConfirmationHistory />
        </div>
      </div>
    </div>
  );
};
