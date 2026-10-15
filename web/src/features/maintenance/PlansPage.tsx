import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, CalendarClock, CheckCircle2, PauseCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { PLAN_STATUS_LABEL } from '@/domain/constants';
import type { PlanStatus } from '@/domain/constants';
import { hasCapability } from '@/domain/permissions';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listPlans } from '@/services/maintenance-service';
import type { PlanFilters } from '@/services/maintenance-service';
import { PlanTable } from './components/PlanTable';
import { locationOptionLabel } from './components/MaintenanceLocationTrail';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';
import { addDays, formatDate } from '@/utils/date';
import { todayVn } from '@/services/runtime';

const STATUS_OPTIONS = Object.entries(PLAN_STATUS_LABEL) as [PlanStatus, string][];

const PlansPage = () => {
  const { data } = useMaintenanceScreen();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PlanFilters>({ buildingId: '', locationId: '', status: '', itemId: '' });
  const query = useServiceQuery(['maintenance', 'plans', filters], () => listPlans(filters));
  const canCreate = Boolean(data?.viewer && hasCapability(data.viewer, 'MAINTENANCE_MANAGE'));
  const today = todayVn();
  const summary = useMemo(() => {
    const rows = query.data ?? [];
    return {
      active: rows.filter(({ plan }) => plan.status === 'ACTIVE').length,
      dueSoon: rows.filter(({ plan, nextDueDate }) => plan.status === 'ACTIVE' && Boolean(nextDueDate) && (nextDueDate as string) <= addDays(today, 7)).length,
      paused: rows.filter(({ plan }) => plan.status === 'PAUSED').length,
      draft: rows.filter(({ plan }) => plan.status === 'DRAFT').length,
      attention: rows.filter(({ plan, nextDueDate }) => plan.status === 'ACTIVE' && Boolean(nextDueDate) && (nextDueDate as string) <= addDays(today, 7)).slice(0, 4),
    };
  }, [query.data, today]);
  const items = (data?.items ?? []).filter(
    (item) => (!filters.buildingId || item.buildingId === filters.buildingId) && (!filters.locationId || item.locationId === filters.locationId),
  );
  const locations = (data?.locations ?? []).filter((location) => !filters.buildingId || location.buildingId === filters.buildingId);

  const renderBody = () => {
    if (query.isLoading) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data || query.data.length === 0) {
      return <EmptyState title="Chưa có kế hoạch bảo trì phù hợp" description={canCreate ? 'Bấm “Tạo kế hoạch” để lập kế hoạch nháp.' : undefined} />;
    }
    return <PlanTable rows={query.data} />;
  };

  return (
    <div>
      <PageHeader
        title="Kế hoạch bảo trì"
        description="Chu kỳ, ngày gốc và người phụ trách; mỗi kế hoạch luôn đi kèm vị trí Block / Tòa → Tầng → Phòng."
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
        <StatCard compact icon={CheckCircle2} value={query.isLoading ? '—' : summary.active} label="Đang hoạt động" tone="good" hint="Đang phát sinh lịch" />
        <StatCard compact icon={CalendarClock} value={query.isLoading ? '—' : summary.dueSoon} label="Sắp đến hạn" tone="warn" hint="Trong 7 ngày tới" />
        <StatCard compact icon={PauseCircle} value={query.isLoading ? '—' : summary.paused} label="Tạm dừng" tone="neutral" hint="Chưa phát sinh lượt" />
        <StatCard compact icon={AlertTriangle} value={query.isLoading ? '—' : summary.draft} label="Cần cấu hình" tone="info" hint="Đang ở trạng thái nháp" />
      </StatCardRow>
      {summary.attention.length > 0 ? (
        <Card className="mb-4 border-warn/30 shadow-none">
          <CardHeader title={`Kế hoạch sắp đến hạn (${summary.dueSoon})`} description="Rà soát người phụ trách và hạng mục trước khi lượt bảo trì được tạo." />
          <CardBody className="grid gap-2 pt-0 md:grid-cols-2">
            {summary.attention.map(({ plan, nextDueDate }) => (
              <Link key={plan.id} to={`/maintenance/plans/${plan.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 hover:border-accent">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{plan.code} · {plan.title}</span>
                  <span className="block truncate text-xs text-ink-2">Kỳ tới {formatDate(nextDueDate)}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-warn">Sắp đến hạn</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}
      <Card className="mb-4 shadow-none">
        <CardBody className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tòa nhà" htmlFor="p-building">
            <NativeSelect
              id="p-building"
              value={filters.buildingId}
              onChange={(event) => setFilters({ ...filters, buildingId: event.target.value, locationId: '', itemId: '' })}
            >
              <option value="">Tất cả tòa nhà</option>
              {(data?.buildings ?? []).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tầng / vị trí" htmlFor="p-location">
            <NativeSelect id="p-location" value={filters.locationId} onChange={(event) => setFilters({ ...filters, locationId: event.target.value, itemId: '' })}>
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationOptionLabel(data, location.id)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Hạng mục" htmlFor="p-item">
            <NativeSelect id="p-item" value={filters.itemId} onChange={(event) => setFilters({ ...filters, itemId: event.target.value })}>
              <option value="">Tất cả hạng mục</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} – {item.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Trạng thái" htmlFor="p-status">
            <NativeSelect
              id="p-status"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value as PlanStatus | '' })}
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map(([status, label]) => (
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

export default PlansPage;
