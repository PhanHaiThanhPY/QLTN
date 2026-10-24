import { useParams, useSearchParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { MaintenanceItem } from '@/domain/types';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getRecordDetail } from '@/services/records-service';
import { RecordForm } from './components/form/RecordForm';
import type { RecordItemPrefill } from './components/form/record-form-schema';
import { repairActionState } from './record-utils';

const EMPTY: never[] = [];

/** ?itemId= from the equipment page: only items inside the viewer's scope are accepted. */
const itemPrefill = (items: MaintenanceItem[], itemId: string | null): RecordItemPrefill | undefined => {
  const item = itemId ? items.find((row) => row.id === itemId && row.active) : undefined;
  return item ? { buildingId: item.buildingId, locationId: item.locationId, maintenanceItemId: item.id } : undefined;
};

/** /records/new and /records/:recordId/edit. Only the managing BQL may edit DRAFT / NEEDS_RECORD_UPDATE. */
const RecordFormPage = () => {
  const { recordId } = useParams();
  const [params] = useSearchParams();
  const reference = useReferenceData();
  const query = useServiceQuery(['record', recordId], () => getRecordDetail(recordId ?? ''), Boolean(recordId));
  const viewer = reference.data?.viewer;
  const isNew = !recordId;
  const record = query.data?.record;
  const header = (
    <PageHeader
      title={isNew ? 'Tạo hồ sơ sửa chữa' : `Sửa hồ sơ ${record?.code ?? ''}`}
      description={isNew ? 'Lưu nháp hoặc gửi ngay cho người xác nhận kỹ thuật.' : record?.title}
      breadcrumbs={
        isNew
          ? [{ label: 'Hồ sơ sửa chữa', to: '/records' }, { label: 'Tạo hồ sơ' }]
          : [{ label: 'Hồ sơ sửa chữa', to: '/records' }, { label: record?.code ?? '…', to: `/records/${recordId}` }, { label: 'Sửa' }]
      }
    />
  );

  if (reference.isLoading || (!isNew && query.isLoading)) return <>{header}<LoadingState rows={6} /></>;
  if (!isNew && query.error) return <>{header}<ErrorState error={query.error} onRetry={() => void query.refetch()} /></>;
  if (!reference.data || !viewer) return <>{header}<LoadingState rows={6} /></>;

  if (isNew) {
    if (!hasCapability(viewer, 'RECORD_EDIT')) {
      return (
        <>
          {header}
          <Notice tone="warning" title="Không có quyền tạo hồ sơ">Chỉ Ban quản lý (BQL) được tạo hồ sơ sửa chữa trong tòa nhà của mình.</Notice>
        </>
      );
    }
    const prefill = itemPrefill(reference.data.items, params.get('itemId'));
    return <>{header}<RecordForm reference={reference.data} attachments={EMPTY} prefill={prefill} /></>;
  }

  if (!record || !query.data) return <>{header}<LoadingState rows={6} /></>;
  const state = repairActionState('saveRecordDraft', viewer, record);
  if (!state.allowed) {
    return (
      <>
        {header}
        <Notice tone="warning" title="Không sửa được hồ sơ này">
          {state.reason} Hồ sơ đang ở trạng thái “{REPAIR_STATUS_LABEL[record.status]}”; chỉ BQL quản lý được sửa khi hồ sơ là Nháp hoặc Cần bổ sung thông tin.
        </Notice>
      </>
    );
  }
  return (
    <>
      {header}
      <RecordForm key={`${record.id}-${record.version}`} reference={reference.data} record={record} attachments={query.data.attachments} />
    </>
  );
};

export default RecordFormPage;
