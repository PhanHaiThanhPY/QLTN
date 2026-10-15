import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Building2, ChevronRight, History, MapPin, Pencil, Plus, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getBuildingSettings } from '@/services/building-service';
import { BuildingFormDialog } from './components/BuildingFormDialog';
import { BuildingDetailDialog } from './components/BuildingDetailDialog';
import { BuildingHistoryDialog } from './components/BuildingHistoryDialog';

const TITLE = 'Tòa nhà và cấu hình';
const linkClass = 'inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-ink-2 hover:bg-accent-soft hover:text-accent';

/** Central building management screen: list first, selected building details below. */
const BuildingSettingsPage = () => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('b') ?? undefined;
  const query = useServiceQuery(['buildings', 'settings', selectedId ?? ''], () => getBuildingSettings(selectedId));
  const reference = useReferenceData();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const select = (id: string) => setParams({ b: id }, { replace: true });
  const openDetail = (id: string) => {
    select(id);
    setDetailId(id);
  };
  const openHistory = (id: string) => {
    select(id);
    setHistoryId(id);
  };

  if (query.isLoading || reference.isLoading) return <LoadingState rows={6} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { buildings, building, config, locations, audit, canConfigure, canManage } = query.data;
  const editingBuilding = buildings.find((row) => row.id === editingId);
  const detailBuilding = buildings.find((row) => row.id === detailId);
  const detailIsReady = detailBuilding?.id === building.id && detailBuilding ? { building: detailBuilding, config, locations } : undefined;
  const historyBuilding = buildings.find((row) => row.id === historyId);
  const historyIsReady = historyBuilding?.id === building.id && historyBuilding ? { building: historyBuilding, audit } : undefined;
  const locationCount = (id: string): number | undefined => {
    if (reference.data) return reference.data.locations.filter((row) => row.buildingId === id && row.active !== false).length;
    return id === building.id ? locations.filter((row) => row.active !== false).length : undefined;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={TITLE}
        description="Quản lý danh sách tòa nhà, vị trí, lịch sử thay đổi và cấu hình vận hành theo từng tòa."
        actions={canManage ? <Button onClick={() => setIsCreating(true)}><Plus className="h-4 w-4" />Thêm tòa nhà</Button> : null}
      />

      <Card className="shadow-none">
        <CardHeader
          title={`Danh sách tòa nhà (${buildings.length})`}
          description="Chọn một tòa để xem chi tiết hoặc thao tác trực tiếp ở từng dòng."
        />
        <CardBody className="pt-0">
          <Table>
            <thead>
              <tr>
                <Th className="min-w-64">Tòa nhà</Th>
                <Th className="min-w-72">Địa chỉ</Th>
                <Th>Vị trí đang dùng</Th>
                <Th>Trạng thái</Th>
                <Th className="min-w-64">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((row) => {
                const isSelected = row.id === building.id;
                return (
                  <Tr key={row.id} className={isSelected ? 'bg-accent-soft/45' : undefined}>
                    <Td>
                      <button type="button" className="flex min-h-10 items-center gap-2 text-left" onClick={() => openDetail(row.id)}>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Building2 className="size-4" aria-hidden /></span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink hover:text-accent">{row.name}</span>
                          <span className="block text-xs font-semibold uppercase tracking-wide text-accent">Tòa {row.code}</span>
                        </span>
                      </button>
                    </Td>
                    <Td className="text-sm text-ink-2">{row.address}</Td>
                    <Td className="text-sm text-ink-2">{locationCount(row.id) ?? '—'} vị trí</Td>
                    <Td><Badge tone="good">Đang hoạt động</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <button type="button" className={linkClass} onClick={() => openDetail(row.id)}><Settings2 className="size-3.5" aria-hidden />Chi tiết</button>
                        <Link to={`/settings/locations?b=${row.id}`} className={linkClass}><MapPin className="size-3.5" aria-hidden />Vị trí</Link>
                        <button type="button" className={linkClass} onClick={() => openHistory(row.id)}><History className="size-3.5" aria-hidden />Lịch sử</button>
                        {canManage ? <button type="button" className={linkClass} onClick={() => setEditingId(row.id)}><Pencil className="size-3.5" aria-hidden />Sửa</button> : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <ul className="space-y-2 md:hidden">
            {buildings.map((row) => {
              const isSelected = row.id === building.id;
              return (
                <li key={row.id} className={`rounded-xl border p-3 ${isSelected ? 'border-accent bg-accent-soft/35' : 'border-line bg-surface'}`}>
                  <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => openDetail(row.id)}>
                    <span className="flex min-w-0 items-start gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Building2 className="size-4" aria-hidden /></span>
                      <span className="min-w-0"><span className="block truncate font-semibold text-ink">{row.name}</span><span className="text-xs text-accent">Tòa {row.code}</span></span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
                  </button>
                  <p className="mt-2 text-xs text-ink-2">{row.address}</p>
                  <p className="mt-1 text-xs text-ink-3">{locationCount(row.id) ?? '—'} vị trí đang dùng</p>
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2">
                    <Link to={`/settings/locations?b=${row.id}`} className={linkClass}><MapPin className="size-3.5" aria-hidden />Vị trí</Link>
                    <button type="button" className={linkClass} onClick={() => openHistory(row.id)}><History className="size-3.5" aria-hidden />Lịch sử</button>
                    {canManage ? <button type="button" className={linkClass} onClick={() => setEditingId(row.id)}><Pencil className="size-3.5" aria-hidden />Sửa</button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {isCreating ? <BuildingFormDialog onClose={(createdId) => { setIsCreating(false); if (createdId) select(createdId); }} /> : null}
      {editingBuilding ? <BuildingFormDialog building={editingBuilding} onClose={() => setEditingId(null)} /> : null}
      {detailIsReady ? <BuildingDetailDialog {...detailIsReady} buildings={buildings} canConfigure={canConfigure} onClose={() => setDetailId(null)} /> : null}
      {historyIsReady ? <BuildingHistoryDialog {...historyIsReady} onClose={() => setHistoryId(null)} /> : null}
    </div>
  );
};

export default BuildingSettingsPage;
