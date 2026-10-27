import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Card, CardBody } from '@/components/ui/card';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getLocationSettings } from '@/services/building-service';
import { BuildingHistoryCard } from './components/BuildingHistoryCard';
import { BuildingPicker } from './components/BuildingPicker';
import { LocationsCard } from './components/LocationsCard';

const TITLE = 'Tầng, khu vực, vị trí';

/** Locations of one building in scope: search, filter by floor/status, add, edit, stop using; with the building history. */
const LocationsPage = () => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('b') ?? undefined;
  const query = useServiceQuery(['buildings', 'locations', selectedId ?? ''], () => getLocationSettings(selectedId));

  if (query.isLoading) return <LoadingState rows={6} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { buildings, building, locations, audit, canEdit } = query.data;

  return (
    <div className="space-y-5">
      <PageHeader title={TITLE} description="Danh mục vị trí dùng khi tạo hồ sơ sửa chữa và hạng mục bảo trì; vị trí ngừng dùng vẫn giữ trên dữ liệu cũ." />
      <Card className="shadow-none">
        <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <BuildingPicker buildings={buildings} value={building.id} onChange={(id) => setParams({ b: id }, { replace: true })} className="sm:w-96" />
          <p className="min-w-0 flex-1 text-sm text-ink-2 sm:pb-2">{building.address}</p>
        </CardBody>
      </Card>
      <LocationsCard key={building.id} buildingId={building.id} locations={locations} canEdit={canEdit} />
      <BuildingHistoryCard events={audit} />
    </div>
  );
};

export default LocationsPage;
