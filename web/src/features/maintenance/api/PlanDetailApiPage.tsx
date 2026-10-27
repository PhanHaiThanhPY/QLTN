import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ERROR_CODE, isAppError } from '@/domain/errors';
import type { ChecklistTemplateItem } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getApiPlanDetail } from '@/services/maintenance-plans-api';
import type { ApiChecklistItem } from '@/services/maintenance-plans-api';
import { formatDate } from '@/utils/date';
import { ChecklistTemplateCard } from '../components/ChecklistTemplateCard';
import { DetailHeaderCard } from '../components/DetailHeaderCard';
import { PlanApiActions } from './PlanApiActions';
import { PlanApiStatusBadge } from './PlanApiStatusBadge';
import { PlanOccurrencesApiCard } from './PlanOccurrencesApiCard';
import { ScheduleVersionsApiCard } from './ScheduleVersionsApiCard';

const NotFound = () => (
  <EmptyState
    title="Không tìm thấy kế hoạch"
    description="Kế hoạch không tồn tại hoặc nằm ngoài phạm vi của bạn."
    action={
      <Link to="/maintenance/plans" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
        Về danh sách kế hoạch
      </Link>
    }
  />
);

const ACTIVATION_FIELDS = ['itemId', 'performerUserId', 'reviewerUserId', 'startDate'] as const;

const toTemplateItem = (item: ApiChecklistItem): ChecklistTemplateItem => ({
  id: item.id,
  label: item.photoRequired ? `${item.label} (cần ảnh)` : item.label,
  required: item.required,
  inputType: item.kind,
  unit: item.unit ?? undefined,
});

/** Plan page on real data (SPEC MT-S2, ui-brief §2.3). */
const PlanDetailApiPage = () => {
  const { planId = '' } = useParams();
  const { data, userName, buildingName, locationName } = useReferenceData();
  const query = useServiceQuery(['maintenance', 'plan', 'api', planId], () => getApiPlanDetail(planId));
  const command = useCommand({ successMessage: 'Đã cập nhật kế hoạch.' });
  const online = useOnline();

  useEffect(() => {
    if (query.data?.plan.code) document.title = `${query.data.plan.code} · ${query.data.plan.name} · QLTN`;
  }, [query.data?.plan.code, query.data?.plan.name]);

  if (query.isLoading) return <LoadingState rows={4} />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.NOT_FOUND) return <NotFound />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState rows={4} />;

  const detail = query.data;
  const { plan, item, versions, audit } = detail;
  const isManager = plan.managerUserId === data.viewer.id;
  // Activation errors name plan fields with no input on this page; dialog fields show inside their dialog.
  const issues = ACTIVATION_FIELDS.flatMap((field) => command.fieldErrors[field] ?? []);

  return (
    <div className="space-y-4">
      <PageHeader isCompact title={`${plan.code} · ${plan.name}`} breadcrumbs={[{ label: 'Kế hoạch bảo trì', to: '/maintenance/plans' }, { label: plan.code }]} />
      <DetailHeaderCard
        code={plan.code}
        title={plan.name}
        badges={
          <>
            <PlanApiStatusBadge status={plan.status} />
            {plan.needsReassignment ? <Badge tone="warn">Cần giao lại</Badge> : null}
          </>
        }
        meta={`${item.code} · ${buildingName(plan.buildingId)} · ${locationName(item.locationId)} · ${plan.schedule?.label ?? '—'} · Thực hiện: ${userName(plan.performerUserId)} · Xác nhận: ${userName(plan.reviewerUserId)}`}
        actions={isManager ? <PlanApiActions detail={detail} command={command} online={online} /> : null}
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa lưu được thay đổi.</Notice>}
      {command.errorCode === ERROR_CODE.CONFLICT ? (
        <Notice tone="warning">
          <span className="flex flex-wrap items-center gap-2">
            Kế hoạch vừa được người khác cập nhật. Tải lại để xem bản mới.
            <Button size="sm" variant="secondary" onClick={() => { command.reset(); void query.refetch(); }}>
              Tải lại
            </Button>
          </span>
        </Notice>
      ) : null}
      {issues.length > 0 ? <Notice tone="warning">{issues.join(' ')}</Notice> : null}
      {plan.status === 'PAUSED' ? (
        <Notice tone="warning" title="Kế hoạch đang tạm dừng">
          Từ {formatDate(plan.pausedOn ?? undefined)} không sinh lượt mới{plan.statusReason ? `. Lý do: ${plan.statusReason}` : ''}. Các kỳ trong thời gian tạm dừng được ghi
          “Bỏ qua do tạm dừng” khi chạy lại.
        </Notice>
      ) : null}
      {plan.status === 'ENDED' ? <Notice tone="info">Kế hoạch đã kết thúc{plan.statusReason ? `. Lý do: ${plan.statusReason}` : ''}.</Notice> : null}
      {item.active ? null : <Notice tone="warning">Thiết bị đã ngừng dùng; không tạo được lượt bù.</Notice>}
      <Card>
        <CardHeader title="Thông tin" />
        <CardBody>
          <InfoGrid
            items={[
              {
                label: 'Thiết bị',
                value: (
                  <Link to={`/maintenance/items/${item.id}?tab=maintenance`} className="text-accent hover:underline">
                    {item.code} – {item.name}
                  </Link>
                ),
              },
              { label: 'Chu kỳ', value: plan.schedule?.label ?? '—' },
              { label: 'Người quản lý', value: userName(plan.managerUserId) },
              { label: 'Nhà thầu', value: plan.contractorName ?? '—' },
            ]}
          />
        </CardBody>
      </Card>
      <PlanOccurrencesApiCard detail={detail} canAct={isManager && plan.status !== 'ENDED'} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScheduleVersionsApiCard versions={versions} userName={userName} />
        <ChecklistTemplateCard items={plan.checklist.map(toTemplateItem)} />
      </div>
      <Card>
        <CardHeader title="Nhật ký kế hoạch" />
        <CardBody>
          <AuditTimeline events={audit} />
        </CardBody>
      </Card>
    </div>
  );
};

export default PlanDetailApiPage;
