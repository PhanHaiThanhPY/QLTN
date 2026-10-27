import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Badge, StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { listOccurrences } from '@/services/maintenance-occurrences-api';
import type { OccurrenceBucket, OccurrenceFilters, OccurrenceRow, OccurrenceStatus } from '@/services/maintenance-occurrences-api';
import { formatDate } from '@/utils/date';
import { OCCURRENCE_STATUS_TEXT, OCCURRENCE_STATUS_TONE, lateText } from './occurrence-ui';

const STATUSES = Object.entries(OCCURRENCE_STATUS_TEXT) as Array<[OccurrenceStatus, string]>;
const isStatus = (value: string): value is OccurrenceStatus => STATUSES.some(([status]) => status === value);
const BUCKETS: ReadonlyArray<readonly [OccurrenceBucket, string, 'overdue' | 'today' | 'next7' | 'pendingReview']> = [
  ['OVERDUE', 'Quá hạn', 'overdue'],
  ['TODAY', 'Hôm nay', 'today'],
  ['NEXT_7', '7 ngày tới', 'next7'],
  ['PENDING_REVIEW', 'Chờ xác nhận', 'pendingReview'],
] as const;

/** "Lượt bảo trì" (SPEC MT-S3 AC-MT3.16, ui-brief §2.5): list view only; week and month views come in MT-S4. */
const OccurrencesApiPage = () => {
  const { data, userName, locationName } = useReferenceData();
  const [filters, setFilters] = useState<OccurrenceFilters>({ scope: 'mine' });
  const [chosen, setChosen] = useState(false);
  const query = useServiceQuery(['maintenance', 'occurrences', 'api', filters], () => listOccurrences(filters));
  const rows = query.data?.rows ?? [];
  const counts = query.data?.counts;

  // Default to "Việc của tôi" only when the user has open occurrences (ui-brief §2.5).
  useEffect(() => {
    if (!chosen && filters.scope === 'mine' && query.data && query.data.rows.length === 0 && !filters.bucket && !filters.status) {
      setFilters((current) => ({ ...current, scope: 'all' }));
    }
  }, [chosen, filters, query.data]);

  const set = (change: Partial<OccurrenceFilters>) => {
    setChosen(true);
    setFilters((current) => ({ ...current, ...change }));
  };
  const filtered = Boolean(filters.bucket || filters.status || filters.buildingId || filters.from || filters.to);
  const clear = () => setFilters({ scope: filters.scope });
  const people = (row: OccurrenceRow) => `${userName(row.performerUserId)} → ${userName(row.reviewerUserId)}`;

  const body = () => {
    if (query.isLoading) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) {
      if (filtered) return <EmptyState title="Không có lượt phù hợp." action={<Button size="sm" variant="secondary" onClick={clear}>Xóa bộ lọc</Button>} />;
      return <EmptyState title={filters.scope === 'mine' ? 'Bạn không có lượt bảo trì nào đang mở.' : 'Chưa có lượt bảo trì.'} />;
    }
    return (
      <>
        <Table>
          <thead>
            <tr>
              <Th scope="col" className="w-24">Mã</Th>
              <Th scope="col">Ngày</Th>
              <Th scope="col" className="min-w-64">Thiết bị</Th>
              <Th scope="col">Trạng thái</Th>
              <Th scope="col" className="min-w-48">Người</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link to={`/maintenance/occurrences/${row.id}`} className="font-medium text-accent hover:underline">
                    {row.code}
                  </Link>
                </Td>
                <Td>{formatDate(row.scheduledDate)}</Td>
                <Td className="min-w-64">
                  {row.item.name} · {locationName(row.item.locationId)}
                  <div className="text-xs text-ink-3">{row.plan.code}</div>
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={OCCURRENCE_STATUS_TONE[row.status]}>{OCCURRENCE_STATUS_TEXT[row.status]}</StatusPill>
                    {lateText(row) ? <Badge tone="crit">{lateText(row)}</Badge> : null}
                  </div>
                </Td>
                <Td className="min-w-48 text-xs text-ink-2">{people(row)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/maintenance/occurrences/${row.id}`} className="block min-h-11 rounded-lg border border-line bg-surface p-3 hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-accent">
                    {row.code} · {formatDate(row.scheduledDate)}
                  </span>
                  <StatusPill tone={OCCURRENCE_STATUS_TONE[row.status]}>{OCCURRENCE_STATUS_TEXT[row.status]}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-ink">
                  {row.item.name} · {locationName(row.item.locationId)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                  {lateText(row) ? <Badge tone="crit">{lateText(row)}</Badge> : null}
                  {people(row)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lượt bảo trì"
        actions={
          <div role="group" aria-label="Phạm vi" className="flex gap-1.5">
            {(['mine', 'all'] as const).map((scope) => (
              <Button key={scope} size="sm" className="min-h-11" variant={filters.scope === scope ? 'primary' : 'secondary'} aria-pressed={filters.scope === scope} onClick={() => set({ scope })}>
                {scope === 'mine' ? 'Việc của tôi' : 'Tất cả'}
              </Button>
            ))}
          </div>
        }
      />
      <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {BUCKETS.map(([bucket, label, key]) => (
          <div key={bucket}>
            <button
              type="button"
              aria-pressed={filters.bucket === bucket}
              onClick={() => set({ bucket: filters.bucket === bucket ? undefined : bucket })}
              className={cn('block w-full rounded-xl border bg-surface p-3.5 text-left shadow-card hover:border-accent', filters.bucket === bucket ? 'border-accent ring-1 ring-accent' : 'border-line')}
            >
              <dt className="text-xs font-semibold text-ink-2">{label}</dt>
              <dd className={cn('mt-1 text-lg font-semibold tabular-nums', key === 'overdue' && counts?.overdue ? 'text-crit' : 'text-ink')}>{counts ? counts[key] : '—'}</dd>
            </button>
          </div>
        ))}
      </dl>
      <Card className="shadow-none">
        <CardBody className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tòa" htmlFor="occ-building">
            <NativeSelect id="occ-building" value={filters.buildingId ?? ''} onChange={(event) => set({ buildingId: event.target.value || undefined })}>
              <option value="">Tất cả tòa</option>
              {(data?.buildings ?? []).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Trạng thái" htmlFor="occ-status">
            <NativeSelect id="occ-status" value={filters.status ?? ''} onChange={(event) => set({ status: isStatus(event.target.value) ? event.target.value : undefined })}>
              <option value="">Tất cả trạng thái</option>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Từ ngày" htmlFor="occ-from">
            <Input id="occ-from" type="date" value={filters.from ?? ''} onChange={(event) => set({ from: event.target.value || undefined })} />
          </Field>
          <Field label="Đến ngày" htmlFor="occ-to">
            <Input id="occ-to" type="date" value={filters.to ?? ''} onChange={(event) => set({ to: event.target.value || undefined })} />
          </Field>
        </CardBody>
      </Card>
      {body()}
    </div>
  );
};

export default OccurrencesApiPage;
