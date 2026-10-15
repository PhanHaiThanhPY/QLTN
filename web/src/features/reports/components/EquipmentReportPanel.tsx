import { useState } from 'react';
import { AlertTriangle, Boxes, Download, Receipt, Wrench } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getEquipmentReport } from '@/services/equipment-report-service';
import type { ReportFilters } from '@/services/report-service';
import { todayVn } from '@/services/runtime';
import { downloadCsv } from '@/utils/csv';
import { formatVnd } from '@/utils/money';
import { buildEquipmentCsv } from '../equipment-csv';
import { reportFileName } from '../report-csv';
import { EquipmentBuildingTable } from './EquipmentBuildingTable';
import { EquipmentHistorySheet } from './EquipmentHistorySheet';
import { EquipmentItemTable } from './EquipmentItemTable';

const ITEM_PARAM = 'item';

/** "Thiết bị" tab: equipment per building, repairs per item, and the repair history of one item. */
export const EquipmentReportPanel = ({ filters }: { filters: ReportFilters }) => {
  const lookup = useReferenceData();
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState('');
  const [buildingFocus, setBuildingFocus] = useState('');
  const query = useServiceQuery(['reports', 'equipment', filters, type], () => getEquipmentReport({ ...filters, type }));
  const openItemId = params.get(ITEM_PARAM);

  const setOpenItem = (itemId: string | null) => {
    const next = new URLSearchParams(params);
    if (itemId) next.set(ITEM_PARAM, itemId);
    else next.delete(ITEM_PARAM);
    setParams(next);
  };

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const report = query.data;
  const hasPeriod = Boolean(filters.dateFrom || filters.dateTo);
  const focus = filters.buildingId ? '' : buildingFocus;
  const items = focus ? report.items.filter((row) => row.item.buildingId === focus) : report.items;

  const handleExport = () => {
    try {
      downloadCsv(reportFileName('bao-cao-thiet-bi', todayVn()), buildEquipmentCsv({ ...report, items }, lookup));
      toast.success(`Đã xuất ${items.length} thiết bị ra CSV.`);
    } catch (error) {
      console.error('Export equipment CSV failed:', error);
      toast.error('Không xuất được tệp CSV. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-4">
      {report.unlinkedRecordCount > 0 ? (
        <Notice tone="warning" title={`${report.unlinkedRecordCount} hồ sơ sửa chữa chưa gắn thiết bị`}>
          Các hồ sơ này không được tính vào lịch sử thiết bị.{' '}
          <Link to="/records?itemLink=unlinked" className="font-semibold text-accent hover:underline">Xem danh sách</Link>
        </Notice>
      ) : null}
      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard compact icon={Boxes} value={report.itemCount} label="thiết bị" tone="accent" hint={`${report.buildings.length} tòa nhà`} />
        <StatCard compact icon={Wrench} value={report.repairCount} label="lượt sửa chữa" tone="info" hint={`${report.itemsWithRepairs} thiết bị có sửa`} />
        <StatCard compact icon={Receipt} value={formatVnd(report.cost)} label="chi phí sửa đã duyệt" tone="good" />
        <StatCard compact icon={AlertTriangle} value={report.repeatedCount} label="thiết bị hỏng lặp lại" tone={report.repeatedCount > 0 ? 'crit' : 'neutral'} hint="12 tháng gần nhất" />
      </StatCardRow>

      {filters.buildingId ? null : (
        <Card className="shadow-none">
          <CardHeader
            title="Theo tòa nhà"
            description="Bấm tên tòa để xem thiết bị của tòa đó."
            actions={focus ? <Button variant="ghost" size="sm" onClick={() => setBuildingFocus('')}>Xem tất cả tòa</Button> : null}
          />
          <CardBody className="pt-0">
            <EquipmentBuildingTable rows={report.buildings} selectedId={focus} buildingName={lookup.buildingName} onSelect={setBuildingFocus} />
          </CardBody>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader
          title={focus ? `Thiết bị — ${lookup.buildingName(focus)}` : 'Thiết bị'}
          description={`${items.length} thiết bị, nhiều lần sửa nhất trước. Bấm một thiết bị để xem lịch sử sửa chữa.`}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Loại thiết bị" htmlFor="eq-type" className="min-w-44">
                <NativeSelect id="eq-type" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">Tất cả loại</option>
                  {report.types.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={items.length === 0}>
                <Download className="h-4 w-4" />
                Xuất CSV
              </Button>
            </div>
          }
        />
        <CardBody className="pt-0">
          {items.length === 0 ? (
            <EmptyState title="Không có thiết bị phù hợp" />
          ) : (
            <EquipmentItemTable rows={items} hasPeriod={hasPeriod} locationName={lookup.locationName} buildingName={lookup.buildingName} onOpen={setOpenItem} />
          )}
        </CardBody>
      </Card>

      {openItemId ? (
        <EquipmentHistorySheet itemId={openItemId} onClose={() => setOpenItem(null)} locationName={lookup.locationName} buildingName={lookup.buildingName} />
      ) : null}
    </div>
  );
};
