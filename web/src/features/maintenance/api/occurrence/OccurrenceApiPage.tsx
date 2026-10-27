import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Badge, StatusPill } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ERROR_CODE, isAppError } from '@/domain/errors';
import { effectiveResult } from '@/domain/maintenance-execution';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getOccurrenceDetail } from '@/services/maintenance-occurrences-api';
import type { OccurrenceDetail } from '@/services/maintenance-occurrences-api';
import { formatDate } from '@/utils/date';
import { ItemResultView } from './ItemResultView';
import { OccurrenceManagerMenu } from './OccurrenceManagerMenu';
import { OCCURRENCE_STATUS_TEXT, OCCURRENCE_STATUS_TONE, isWorking, lateText, viewerSlots } from './occurrence-ui';
import { OccurrenceSideCard } from './OccurrenceSideCard';
import { RepairFromItemDialog } from './RepairFromItemDialog';
import { ReviewPanel } from './ReviewPanel';
import { SubmissionHistory } from './SubmissionHistory';
import { WorkEditor } from './WorkEditor';

const NotFound = () => (
  <EmptyState
    title="Không tìm thấy lượt bảo trì"
    description="Lượt không tồn tại hoặc nằm ngoài phạm vi của bạn."
    action={
      <Link to="/maintenance/schedule" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
        Về danh sách
      </Link>
    }
  />
);

/** Read-only items: what is filled now, or the latest submission (viewers, the manager). */
const ReadOnlyItems = ({ detail, onCreateRepair }: { detail: OccurrenceDetail; onCreateRepair?: (itemId: string) => void }) => {
  const { occurrence } = detail;
  const entries = detail.submissions[0] && !isWorking(occurrence.status) ? detail.submissions[0].entries : occurrence.work.entries;
  return (
    <div className="space-y-3">
      {occurrence.checklist.map((item, index) => {
        const entry = entries.find((row) => row.itemId === item.id);
        const repair = detail.repairs.find((row) => row.itemId === item.id && row.inForce);
        const failed = entry ? effectiveResult(item, entry) === 'FAIL' : false;
        return (
          <ItemResultView key={item.id} index={index} item={item} entry={entry} files={detail.files} repair={repair} highlight={Boolean(occurrence.rework[item.id])}>
            {occurrence.rework[item.id] ? <p className="mt-1 text-sm text-ink">Cần làm lại: {occurrence.rework[item.id]}</p> : null}
            {failed && !repair && onCreateRepair ? (
              <Button variant="secondary" size="sm" className="mt-2 min-h-11" onClick={() => onCreateRepair(item.id)}>
                Tạo hồ sơ sửa chữa từ mục này
              </Button>
            ) : null}
          </ItemResultView>
        );
      })}
    </div>
  );
};

/** Occurrence page on real data (SPEC MT-S3, ui-brief §2): phone first; two columns from 1024px. */
const OccurrenceApiPage = () => {
  const { occurrenceId = '' } = useParams();
  const { data, userName, buildingName, locationName } = useReferenceData();
  const query = useServiceQuery(['maintenance', 'occurrence', 'api', occurrenceId], () => getOccurrenceDetail(occurrenceId));
  const start = useCommand({ successMessage: 'Đã bắt đầu lượt bảo trì.' });
  const online = useOnline();
  const [repairItem, setRepairItem] = useState<string | null>(null);
  // A reload after a conflict remounts the form with the fresh occurrence (ui-brief §4).
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (query.data) document.title = `${query.data.occurrence.code} · ${query.data.item.name} · QLTN`;
  }, [query.data]);

  if (query.isLoading) return <LoadingState rows={4} />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.NOT_FOUND) return <NotFound />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState rows={4} />;

  const detail = query.data;
  const { occurrence, plan, item } = detail;
  const slots = viewerSlots(detail, data.viewer);
  const late = lateText(occurrence);
  const editing = slots.performer && isWorking(occurrence.status);
  const current = detail.submissions[0];
  const reviewing = slots.reviewer && occurrence.status === 'PENDING_REVIEW' && current && !current.decision;
  const canRepair = slots.manager && ['IN_PROGRESS', 'PENDING_REVIEW', 'REWORK'].includes(occurrence.status);
  const onCreateRepair = canRepair ? setRepairItem : undefined;
  const reload = async () => {
    await query.refetch();
  };

  const main = () => {
    if (editing) return <WorkEditor key={`${occurrence.id}-${occurrence.status}-${occurrence.round}-${reloads}`} detail={detail} onCreateRepair={onCreateRepair} onReload={() => void reload().then(() => setReloads((count) => count + 1))} />;
    if (reviewing && current) return <ReviewPanel key={`${occurrence.id}-${current.round}-${reloads}`} detail={detail} submission={current} userName={userName} onReload={() => void reload().then(() => setReloads((count) => count + 1))} />;
    if (occurrence.status === 'SCHEDULED') return <p className="text-sm text-ink-2">Lượt chưa bắt đầu.</p>;
    return <ReadOnlyItems detail={detail} onCreateRepair={onCreateRepair} />;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 lg:max-w-none">
      <Link to="/maintenance/schedule" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-3 hover:text-accent">
        ‹ Lượt bảo trì
      </Link>
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-ink">
            {occurrence.code} · {item.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={OCCURRENCE_STATUS_TONE[occurrence.status]}>{OCCURRENCE_STATUS_TEXT[occurrence.status]}</StatusPill>
            {occurrence.isMakeup ? <Badge tone="info">Lượt bù</Badge> : null}
            {slots.manager ? <OccurrenceManagerMenu detail={detail} users={data.users ?? []} online={online} /> : null}
          </div>
        </div>
        <p className="text-sm text-ink-2">
          {buildingName(occurrence.buildingId)} · {locationName(item.locationId)} · Hạn {formatDate(occurrence.scheduledDate)}{' '}
          {late ? <Badge tone="crit">{late}</Badge> : null}
        </p>
        <p className="text-sm text-ink-2">
          Kế hoạch {plan.code} · Xác nhận: {userName(occurrence.reviewerUserId)}
        </p>
      </header>
      {online ? null : <Notice tone="warning">Đang mất kết nối.</Notice>}
      {!slots.performer && !slots.reviewer && !slots.manager ? (
        <p className="text-sm text-ink-2">Bạn đang xem. Người thực hiện: {userName(occurrence.performerUserId)}.</p>
      ) : null}
      {slots.performer && occurrence.status === 'SCHEDULED' ? (
        <Button
          className="min-h-11 w-full sm:w-auto"
          isLoading={start.isPending}
          disabled={!online}
          onClick={() => void start.execute({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrence.id, expectedVersion: occurrence.version, action: 'startMaintenanceOccurrence', payload: {} })}
        >
          Bắt đầu
        </Button>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">{main()}</div>
        <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Thông tin lượt">
          <OccurrenceSideCard detail={detail} userName={userName} showResult={!editing} />
          <SubmissionHistory occurrence={occurrence} submissions={detail.submissions.filter((row) => row.decision)} files={detail.files} userName={userName} />
          <Card>
            <CardHeader title="Nhật ký" />
            <CardBody className="pt-0">
              <AuditTimeline events={detail.audit} />
            </CardBody>
          </Card>
        </aside>
      </div>
      {repairItem ? <RepairFromItemDialog detail={detail} itemId={repairItem} onClose={() => setRepairItem(null)} /> : null}
    </div>
  );
};

export default OccurrenceApiPage;
