import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getBuildingSettings } from '@/services/building-service';
import { BuildingFormDialog } from './components/BuildingFormDialog';
import { ConfigCard } from './components/ConfigCard';
import { BuildingPicker } from './components/BuildingPicker';
import { LOCATION_ACTIONS } from './location-filters';

const TITLE = 'Tòa nhà và cấu hình';

/** Buildings in scope: per-building configuration with templates, and configuration history (locations have their own screen). */
const BuildingSettingsPage = () => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('b') ?? undefined;
  const query = useServiceQuery(['buildings', 'settings', selectedId ?? ''], () => getBuildingSettings(selectedId));
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const select = (id: string) => setParams({ b: id }, { replace: true });

  if (query.isLoading) return <LoadingState rows={6} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { buildings, building, config, locations, audit, canConfigure, canManage } = query.data;
  const activeLocations = locations.filter((row) => row.active !== false).length;

  return (
    <div className="space-y-5">
      <PageHeader title={TITLE} description="BQL cấu hình tòa được giao; quản trị viên chung thêm tòa và quản lý cấu hình mẫu." />
      <Card className="shadow-none">
        <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <BuildingPicker buildings={buildings} value={building.id} onChange={select} className="sm:w-96" />
          <div className="min-w-0 flex-1 text-sm text-ink-2 sm:px-4">
            <p>{building.address}</p>
            <Link to={`/settings/locations?b=${building.id}`} className="mt-1 inline-flex items-center gap-1 text-accent hover:underline">
              <MapPin className="h-3.5 w-3.5" />
              {activeLocations} vị trí đang dùng – quản lý vị trí
            </Link>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog('edit')}>
                <Pencil className="h-4 w-4" />
                Sửa thông tin
              </Button>
              <Button onClick={() => setDialog('create')}>
                <Plus className="h-4 w-4" />
                Thêm tòa nhà
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <ConfigCard key={`${building.id}-${config.version}`} building={building} buildings={buildings} config={config} canEdit={canConfigure} />
      <Card className="shadow-none">
        <CardHeader title="Lịch sử thay đổi cấu hình" description="Ai đổi cấu hình, khi nào và đổi những gì." />
        <CardBody>
          <AuditTimeline events={audit.filter((event) => !LOCATION_ACTIONS.includes(event.action))} />
        </CardBody>
      </Card>
      {dialog ? (
        <BuildingFormDialog
          building={dialog === 'edit' ? building : undefined}
          onClose={(createdId) => {
            setDialog(null);
            if (createdId) select(createdId);
          }}
        />
      ) : null}
    </div>
  );
};

export default BuildingSettingsPage;
