import { useMemo } from 'react';
import { useParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getRecordDetail } from '@/services/records-service';
import { RecordDetailHeader } from './components/detail/RecordDetailHeader';
import { RecordTabs } from './components/detail/RecordTabs';
import { RecordContext } from './record-context';
import type { RecordContextValue } from './record-context';
import { isRecordFinal } from './record-utils';

const BREADCRUMBS = [{ label: 'Hồ sơ sửa chữa', to: '/records' }];

/** /records/:recordId – header card + business tabs. Final records are read-only. */
const RecordDetailPage = () => {
  const { recordId = '' } = useParams();
  const reference = useReferenceData();
  const query = useServiceQuery(['record', recordId], () => getRecordDetail(recordId));
  const viewer = reference.data?.viewer;
  const detail = query.data;
  const value = useMemo<RecordContextValue | null>(() => (detail && viewer ? { detail, viewer } : null), [detail, viewer]);

  if (query.isLoading || reference.isLoading) {
    return (
      <>
        <PageHeader isCompact title="Hồ sơ sửa chữa" breadcrumbs={BREADCRUMBS} />
        <LoadingState rows={6} />
      </>
    );
  }
  if (query.error) {
    return (
      <>
        <PageHeader isCompact title="Hồ sơ sửa chữa" breadcrumbs={BREADCRUMBS} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  if (!value) return <LoadingState rows={6} />;

  return (
    <RecordContext.Provider value={value}>
      <RecordDetailHeader />
      {isRecordFinal(value.detail.record) ? (
        <Notice className="mb-4" title={`Hồ sơ ${REPAIR_STATUS_LABEL[value.detail.record.status].toLowerCase()}`}>
          {value.detail.record.status === 'UNRESOLVED'
            ? 'Hồ sơ dừng sau 3 lần trình không được duyệt; chỉ còn bước BQL phát hành thông báo (tab Tờ trình và phê duyệt).'
            : 'Hồ sơ đã kết thúc nên chỉ được xem; chưa có lệnh mở lại.'}
        </Notice>
      ) : null}
      <RecordTabs />
    </RecordContext.Provider>
  );
};

export default RecordDetailPage;
