import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
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

const STATUS_OPTIONS = Object.entries(PLAN_STATUS_LABEL) as [PlanStatus, string][];

const PlansPage = () => {
  const { data } = useMaintenanceScreen();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PlanFilters>({ buildingId: '', locationId: '', status: '', itemId: '' });
  const query = useServiceQuery(['maintenance', 'plans', filters], () => listPlans(filters));
  const canCreate = Boolean(data?.viewer && hasCapability(data.viewer, 'MAINTENANCE_MANAGE'));
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
          <Field label="Block / tòa nhà" htmlFor="p-location">
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
