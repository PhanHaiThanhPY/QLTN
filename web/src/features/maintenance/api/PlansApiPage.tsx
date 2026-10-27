import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, CalendarClock, CheckCircle2, PauseCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listApiPlans } from '@/services/maintenance-plans-api';
import type { ApiPlanRow, ApiPlanStatus } from '@/services/maintenance-plans-api';
import { todayVn } from '@/services/runtime';
import { PLAN_STATUS_FILTERS, planKpis } from './plan-api-ui';
import { PlanApiTable } from './PlanApiTable';

interface PlanListFilters {
  buildingId: string;
  status: ApiPlanStatus | '';
}

const isPlanStatus = (value: string): value is ApiPlanStatus => PLAN_STATUS_FILTERS.some(([status]) => status === value);

/** Plans on real data (SPEC MT-S2, ui-brief §2.1): ended plans only when the filter asks for them. */
const PlansApiPage = () => {
  const { data, userName, buildingName, locationName } = useReferenceData();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PlanListFilters>({ buildingId: '', status: '' });
  const query = useServiceQuery(['maintenance', 'plans', 'api', filters], () =>
    listApiPlans({ buildingId: filters.buildingId, status: filters.status || undefined }),
  );
  const canCreate = Boolean(data?.viewer && hasCapability(data.viewer, 'MAINTENANCE_MANAGE'));
  const today = todayVn();
  const kpis = useMemo(() => planKpis(query.data ?? [], today), [query.data, today]);
  const placeName = (row: ApiPlanRow) => `${buildingName(row.buildingId)} · ${locationName(row.item.locationId)}`;
  const figure = (value: number) => (query.isLoading ? '—' : value);

  const renderBody = () => {
    if (query.isLoading) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data || query.data.length === 0) {
      return (
        <EmptyState
          title="Chưa có kế hoạch bảo trì."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => navigate('/maintenance/plans/new')}>
                Tạo kế hoạch
              </Button>
            ) : undefined
          }
        />
      );
    }
    return <PlanApiTable rows={query.data} placeName={placeName} userName={userName} />;
  };

  return (
    <div>
      <PageHeader
        title="Kế hoạch bảo trì"
        description="Hệ thống tự sinh lượt bảo trì trong 30 ngày tới cho các kế hoạch đang chạy."
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/maintenance/plans/new')}>
              <Plus className="h-4 w-4" />
              Tạo kế hoạch
            </Button>
          ) : null
        }
      />
      <StatCardRow className="mb-4 xl:grid-cols-4">
        <StatCard compact icon={CheckCircle2} value={figure(kpis.active)} label="Đang chạy" tone="good" hint="Đang sinh lượt" />
        <StatCard compact icon={CalendarClock} value={figure(kpis.dueSoon)} label="Sắp đến hạn" tone="warn" hint="Lượt kế tiếp trong 7 ngày" />
        <StatCard compact icon={PauseCircle} value={figure(kpis.paused)} label="Tạm dừng" tone="neutral" hint="Không sinh lượt" />
        <StatCard compact icon={AlertTriangle} value={figure(kpis.draft)} label="Cần cấu hình" tone="info" hint="Kế hoạch nháp" />
      </StatCardRow>
      <Card className="mb-4 shadow-none">
        <CardBody className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tòa nhà" htmlFor="p-building">
            <NativeSelect id="p-building" value={filters.buildingId} onChange={(event) => setFilters({ ...filters, buildingId: event.target.value })}>
              <option value="">Tất cả tòa nhà</option>
              {(data?.buildings ?? []).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Trạng thái" htmlFor="p-status">
            <NativeSelect
              id="p-status"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: isPlanStatus(event.target.value) ? event.target.value : '' })}
            >
              <option value="">Chưa kết thúc</option>
              {PLAN_STATUS_FILTERS.map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardBody>
      </Card>
      {renderBody()}
    </div>
  );
};

export default PlansApiPage;
