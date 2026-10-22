import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { Location } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { EMPTY_LOCATION_FILTERS, filterLocations, floorsOf } from '../location-filters';
import type { LocationFilters, LocationStatusFilter } from '../location-filters';
import { LocationDialog } from './LocationDialog';

interface LocationsCardProps {
  buildingId: string;
  locations: Location[];
  canEdit: boolean;
}

/** Floors, zones and locations of a building; inactive ones stay on old records but cannot be picked for new ones. */
export const LocationsCard = ({ buildingId, locations, canEdit }: LocationsCardProps) => {
  const [editing, setEditing] = useState<Location | 'new' | null>(null);
  const [filters, setFilters] = useState<LocationFilters>(EMPTY_LOCATION_FILTERS);
  const shown = filterLocations(locations, filters);
  const setFilter = <K extends keyof LocationFilters>(key: K, value: LocationFilters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));
  const toggle = useCommand({ successMessage: 'Đã cập nhật trạng thái vị trí.' });
  const setActive = (location: Location, active: boolean) =>
    void toggle.execute({ subjectType: 'BUILDING', subjectId: buildingId, expectedVersion: location.version, action: 'setLocationActive', payload: { locationId: location.id, active } });
  return (
    <Card>
      <CardHeader
        title={`Danh sách vị trí (${shown.length}/${locations.length})`}
        description="Dùng khi tạo hồ sơ sửa chữa và hạng mục bảo trì."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              Thêm vị trí
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Tìm kiếm" htmlFor="loc-q" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input id="loc-q" className="pl-9" placeholder="Tên vị trí, khu vực, tầng" value={filters.q} onChange={(event) => setFilter('q', event.target.value)} />
            </div>
          </Field>
          <Field label="Tầng" htmlFor="loc-floor-filter">
            <NativeSelect id="loc-floor-filter" value={filters.floor} onChange={(event) => setFilter('floor', event.target.value)}>
              <option value="">Tất cả tầng</option>
              {floorsOf(locations).map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Trạng thái" htmlFor="loc-status-filter">
            <NativeSelect
              id="loc-status-filter"
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value as LocationStatusFilter)}
            >
              <option value="">Tất cả</option>
              <option value="active">Đang dùng</option>
              <option value="inactive">Ngừng dùng</option>
            </NativeSelect>
          </Field>
        </div>
        {shown.length === 0 ? <p className="text-sm text-ink-3">Không có vị trí phù hợp bộ lọc.</p> : null}
        <Table>
          <thead>
            <tr>
              <Th>Tầng</Th>
              <Th>Khu vực</Th>
              <Th>Tên vị trí</Th>
              <Th>Trạng thái</Th>
              {canEdit ? <Th className="text-right">Thao tác</Th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((location) => {
              const isActive = location.active !== false;
              return (
                <Tr key={location.id}>
                  <Td className="font-medium">{location.floor}</Td>
                  <Td>{location.zone ?? '—'}</Td>
                  <Td>{location.name}</Td>
                  <Td>{isActive ? <Badge tone="good">Đang dùng</Badge> : <Badge tone="neutral">Ngừng dùng</Badge>}</Td>
                  {canEdit ? (
                    <Td className="text-right">
                      <span className="inline-flex gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setEditing(location)}>
                          Sửa
                        </Button>
                        <Button size="xs" variant="ghost" disabled={toggle.isPending} onClick={() => setActive(location, !isActive)}>
                          {isActive ? 'Ngừng dùng' : 'Dùng lại'}
                        </Button>
                      </span>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {shown.map((location) => (
            <li key={location.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3.5 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{location.name}</span>
                <span className="block text-xs text-ink-2">
                  Tầng {location.floor}
                  {location.zone ? ` · ${location.zone}` : ''}
                  {location.active === false ? ' · Ngừng dùng' : ''}
                </span>
              </span>
              {canEdit ? (
                <Button size="xs" variant="ghost" onClick={() => setEditing(location)}>
                  Sửa
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
      {editing ? <LocationDialog buildingId={buildingId} location={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
};
