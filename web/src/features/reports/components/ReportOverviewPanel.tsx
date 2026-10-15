import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, ListChecks, Wrench } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { Building, IsoDate, MaintenanceOccurrence } from '@/domain/types';
import { getMaintenanceReport, getRepairReport } from '@/services/report-service';
import type { ReportFilters, RepairReportRow } from '@/services/report-service';
import { now } from '@/services/runtime';
import { toVnDate, formatDate, formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

type ReportTab = 'repair' | 'maintenance' | 'equipment';

interface ReportOverviewPanelProps {
  filters: ReportFilters;
  buildings: Building[];
  onOpenTab: (tab: ReportTab) => void;
  onFilterByBuilding: (buildingId: string) => void;
}

interface TrendPoint {
  key: string;
  label: string;
  repair: number;
  maintenance: number;
}

interface BuildingPoint {
  buildingId: string;
  total: number;
  repair: number;
  maintenance: number;
}

type AttentionItem = {
  id: string;
  code: string;
  title: string;
  detail: string;
  kind: 'repair' | 'maintenance';
  to: string;
};

const isInPeriod = (date: IsoDate, filters: ReportFilters): boolean =>
  (!filters.dateFrom || date >= filters.dateFrom) && (!filters.dateTo || date <= filters.dateTo);

const statusCount = (rows: { status: string; count: number }[], status: string): number => rows.find((row) => row.status === status)?.count ?? 0;

const formatPeriod = (filters: ReportFilters): string => {
  if (filters.dateFrom && filters.dateTo) return `${formatDate(filters.dateFrom)} – ${formatDate(filters.dateTo)}`;
  if (filters.dateFrom) return `Từ ${formatDate(filters.dateFrom)}`;
  if (filters.dateTo) return `Đến ${formatDate(filters.dateTo)}`;
  return 'Toàn bộ dữ liệu được cấp quyền';
};

const buildTrend = (repairRows: RepairReportRow[], maintenanceRows: MaintenanceOccurrence[], filters: ReportFilters): TrendPoint[] => {
  const buckets = new Map<string, TrendPoint>();
  const ensure = (date: IsoDate): TrendPoint => {
    const key = date.slice(0, 7);
    const existing = buckets.get(key);
    if (existing) return existing;
    const point = { key, label: `T${Number(date.slice(5, 7))}/${date.slice(0, 4)}`, repair: 0, maintenance: 0 };
    buckets.set(key, point);
    return point;
  };
  repairRows.filter((row) => isInPeriod(toVnDate(row.record.createdAt), filters)).forEach((row) => { ensure(toVnDate(row.record.createdAt)).repair += 1; });
  maintenanceRows.forEach((row) => { ensure(row.scheduledDate).maintenance += 1; });
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
};

const buildBuildingPoints = (repairRows: RepairReportRow[], maintenanceRows: MaintenanceOccurrence[], filters: ReportFilters): BuildingPoint[] => {
  const points = new Map<string, BuildingPoint>();
  const ensure = (buildingId: string): BuildingPoint => {
    const existing = points.get(buildingId);
    if (existing) return existing;
    const point = { buildingId, total: 0, repair: 0, maintenance: 0 };
    points.set(buildingId, point);
    return point;
  };
  repairRows.filter((row) => isInPeriod(toVnDate(row.record.createdAt), filters)).forEach((row) => { const point = ensure(row.record.buildingId); point.repair += 1; point.total += 1; });
  maintenanceRows.forEach((row) => { const point = ensure(row.buildingId); point.maintenance += 1; point.total += 1; });
  return [...points.values()].sort((a, b) => b.total - a.total);
};

const TrendChart = ({ points }: { points: TrendPoint[] }) => {
  if (points.length === 0) return <EmptyState title="Chưa có dữ liệu xu hướng" description="Kỳ lọc này chưa phát sinh hồ sơ hoặc lượt bảo trì." />;
  const max = Math.max(1, ...points.map((point) => point.repair + point.maintenance));
  const width = 640;
  const height = 170;
  const chartPoints = points.map((point, index) => `${(index / Math.max(1, points.length - 1)) * width},${height - ((point.repair + point.maintenance) / max) * 130 - 12}`).join(' ');
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Xu hướng khối lượng hồ sơ và lượt bảo trì">
        <line x1="0" y1={height - 12} x2={width} y2={height - 12} stroke="currentColor" className="text-line" />
        <polyline fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-accent" points={chartPoints} />
        {points.map((point, index) => {
          const x = (index / Math.max(1, points.length - 1)) * width;
          const y = height - ((point.repair + point.maintenance) / max) * 130 - 12;
          return <circle key={point.key} cx={x} cy={y} r="5" fill="currentColor" className="text-accent" />;
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 text-xs text-ink-2 sm:grid-cols-3 lg:grid-cols-6">
        {points.map((point) => <div key={point.key} className="min-w-0"><p className="truncate font-medium text-ink">{point.label}</p><p>{point.repair + point.maintenance} phát sinh</p></div>)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2"><span><i className="mr-1 inline-block size-2 rounded-full bg-accent" />Hồ sơ sửa chữa + lượt bảo trì</span></div>
    </div>
  );
};

const BuildingBars = ({ points, buildingName, onSelect }: { points: BuildingPoint[]; buildingName: (id?: string) => string; onSelect: (buildingId: string) => void }) => {
  if (points.length === 0) return <EmptyState title="Chưa có dữ liệu theo tòa nhà" />;
  const max = Math.max(1, ...points.map((point) => point.total));
  return (
    <ul className="space-y-3">
      {points.map((point) => (
        <li key={point.buildingId}>
          <button type="button" className="block min-h-16 w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => onSelect(point.buildingId)}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium text-ink">{buildingName(point.buildingId)}</span><span className="tnum shrink-0 font-semibold text-ink">{point.total} <span className="text-xs font-normal text-ink-2">(hồ sơ + lượt)</span></span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${(point.total / max) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-ink-3">{point.repair} hồ sơ sửa chữa · {point.maintenance} lượt bảo trì</p>
          </button>
        </li>
      ))}
    </ul>
  );
};

const attentionFromReports = (
  repairRows: RepairReportRow[],
  maintenanceRows: MaintenanceOccurrence[],
  buildingName: (id?: string) => string,
  itemName: (id?: string) => string,
): AttentionItem[] => [
  ...repairRows.map((row) => ({ id: row.record.id, code: row.record.code, title: row.record.title, detail: `${buildingName(row.record.buildingId)} · ${REPAIR_STATUS_LABEL[row.record.status]}`, kind: 'repair' as const, to: subjectPath('REPAIR_RECORD', row.record.id) })),
  ...maintenanceRows.map((row) => ({ id: row.id, code: row.code, title: itemName(row.itemId), detail: `${buildingName(row.buildingId)} · Dự kiến ${formatDate(row.scheduledDate)}`, kind: 'maintenance' as const, to: subjectPath('MAINTENANCE_OCCURRENCE', row.id) })),
];

export const ReportOverviewPanel = ({ filters, buildings, onOpenTab, onFilterByBuilding }: ReportOverviewPanelProps) => {
  const lookup = useReferenceData();
  const query = useServiceQuery(['reports', 'overview', filters], async () => {
    const [repair, maintenance] = await Promise.all([getRepairReport(filters), getMaintenanceReport(filters)]);
    return { repair, maintenance };
  });

  const trend = useMemo(() => query.data ? buildTrend(query.data.repair.rows, query.data.maintenance.rows, filters) : [], [query.data, filters]);
  const buildingPoints = useMemo(() => query.data ? buildBuildingPoints(query.data.repair.rows, query.data.maintenance.rows, filters) : [], [query.data, filters]);
  const attentionItems = useMemo(() => query.data ? attentionFromReports(query.data.repair.attentionRows, query.data.maintenance.attentionRows, lookup.buildingName, lookup.itemName) : [], [query.data, lookup.buildingName, lookup.itemName]);

  if (query.isLoading) return <LoadingState rows={6} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { repair, maintenance } = query.data;
  const completedRepair = statusCount(repair.byStatus, 'COMPLETED');
  const workload = repair.createdCount + maintenance.dueCount;
  const completed = completedRepair + maintenance.completedCount;
  const remaining = repair.openCount + maintenance.openCount;
  const attentionCount = repair.attentionCount + maintenance.attentionCount;
  const scopeName = filters.buildingId ? lookup.buildingName(filters.buildingId) : `${buildings.length} tòa nhà trong phạm vi`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-xs text-ink-2">
        <span><strong className="text-ink">Tình hình vận hành</strong> · {scopeName} · {formatPeriod(filters)}</span>
        <span className="whitespace-nowrap">Cập nhật {formatDateTime(now().toISOString())}</span>
      </div>

      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard compact icon={ClipboardList} value={workload} label="tổng khối lượng" tone="accent" hint={`${repair.createdCount} hồ sơ · ${maintenance.dueCount} lượt`} onClick={() => onOpenTab('repair')} />
        <StatCard compact icon={CheckCircle2} value={completed} label="đã hoàn thành" tone="good" hint={`${completedRepair} hồ sơ · ${maintenance.completedCount} lượt`} onClick={() => onOpenTab('repair')} />
        <StatCard compact icon={ListChecks} value={remaining} label="còn tồn" tone={remaining > 0 ? 'warn' : 'good'} hint={`${repair.openCount} hồ sơ · ${maintenance.openCount} lượt`} onClick={() => onOpenTab('repair')} />
        <StatCard compact icon={AlertTriangle} value={attentionCount} label="cần xử lý ngay" tone={attentionCount > 0 ? 'crit' : 'good'} hint={`${repair.overdueCount} sửa chữa quá hạn · ${maintenance.overdueCount} bảo trì quá hạn`} onClick={() => onOpenTab(repair.attentionCount > 0 ? 'repair' : 'maintenance')} />
      </StatCardRow>

      <Card className={attentionCount > 0 ? 'border-crit/30 shadow-none' : 'shadow-none'}>
        <CardHeader title="Cần chú ý" description={attentionCount > 0 ? `${attentionCount} mục cần kiểm tra hoặc xử lý trong kỳ lọc.` : 'Không có mục quá hạn hoặc bất thường trong kỳ lọc.'} actions={<Button variant="ghost" size="sm" onClick={() => onOpenTab(repair.attentionCount > 0 ? 'repair' : 'maintenance')}>Xem danh sách</Button>} />
        <CardBody className="pt-0">
          {attentionItems.length === 0 ? <EmptyState title="Không có vấn đề cần xử lý ngay" description="Số 0 là không phát sinh cảnh báo trong kỳ lọc." /> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {attentionItems.slice(0, 4).map((item) => <li key={`${item.kind}-${item.id}`}><Link to={item.to} className="flex min-h-14 items-center gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-accent/40 hover:bg-accent-soft"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${item.kind === 'repair' ? 'bg-crit-soft text-crit' : 'bg-warn-soft text-warn'}`}><AlertTriangle className="size-4" aria-hidden /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.code} · {item.title}</span><span className="block truncate text-xs text-ink-2">{item.detail}</span></span></Link></li>)}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="shadow-none"><CardHeader title="Xu hướng theo thời gian" description="Hồ sơ sửa chữa và lượt bảo trì phát sinh trong kỳ lọc." /><CardBody className="pt-0"><TrendChart points={trend} /></CardBody></Card>
        <Card className="shadow-none"><CardHeader title="Phân bổ theo tòa nhà" description="Tách rõ hồ sơ và lượt để tránh cộng trùng." /><CardBody className="pt-0"><BuildingBars points={buildingPoints} buildingName={lookup.buildingName} onSelect={onFilterByBuilding} /></CardBody></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-xs text-ink-2"><Wrench className="size-4 text-accent" aria-hidden /><span><strong className="text-ink">Cách tính:</strong> “hồ sơ” là hồ sơ sửa chữa, “lượt” là một lần bảo trì theo lịch. Tỷ lệ hoàn thành của bảo trì nằm trong tab Bảo trì và tính trên lượt không bị hủy.</span></div>
    </div>
  );
};
