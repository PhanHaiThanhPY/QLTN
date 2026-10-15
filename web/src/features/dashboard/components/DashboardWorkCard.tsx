import { ArrowUpRight, ClipboardList } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { RepairRecord } from '@/domain/types';
import { formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

interface DashboardWorkCardProps {
  records: RepairRecord[];
  buildingName: (id?: string) => string;
}

const dueLabel = (record: RepairRecord): string => (record.dueAt ? formatDateTime(record.dueAt) : 'Chưa có hạn');

/** Dense, scannable work table for the dashboard. */
export const DashboardWorkCard = ({ records, buildingName }: DashboardWorkCardProps) => (
  <Card className="min-w-0">
    <CardHeader
      title="Việc cần xử lý"
      description="Ưu tiên theo hạn xử lý và trạng thái hiện tại"
      actions={<Link to="/records" className="text-sm font-semibold text-accent hover:underline">Xem tất cả <ArrowUpRight className="inline size-4" aria-hidden /></Link>}
    />
    <CardBody className="pt-0">
      {records.length === 0 ? (
        <EmptyState title="Chưa có việc cần xử lý" />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {records.slice(0, 5).map((record) => (
              <li key={record.id}>
                <Link
                  to={subjectPath('REPAIR_RECORD', record.id)}
                  className="block rounded-lg border border-line bg-surface-2/55 p-3 transition-colors active:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{record.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">{record.code}</span>
                    </span>
                    <RepairStatusBadge status={record.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                    <span>{buildingName(record.buildingId)}</span>
                    <span className={record.dueAt && new Date(record.dueAt) < new Date() ? 'font-semibold text-crit' : undefined}>
                      Hạn: {dueLabel(record)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-3 py-2.5">Công việc</th>
                <th className="px-3 py-2.5">Tòa nhà</th>
                <th className="px-3 py-2.5">Hạn xử lý</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.slice(0, 5).map((record) => (
                <tr key={record.id} className="group transition-colors hover:bg-surface-2">
                  <td className="max-w-[20rem] px-3 py-3">
                    <Link to={subjectPath('REPAIR_RECORD', record.id)} className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><ClipboardList className="size-4" aria-hidden /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink group-hover:text-accent">{record.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-3">{record.code}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-2">{buildingName(record.buildingId)}</td>
                  <td className={record.dueAt && new Date(record.dueAt) < new Date() ? 'whitespace-nowrap px-3 py-3 font-semibold text-crit' : 'whitespace-nowrap px-3 py-3 text-ink-2'}>{dueLabel(record)}</td>
                  <td className="px-3 py-3"><RepairStatusBadge status={record.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </CardBody>
  </Card>
);
