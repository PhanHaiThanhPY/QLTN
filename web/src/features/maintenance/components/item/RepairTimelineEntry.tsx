import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import type { EquipmentRepairEntry } from '@/services/equipment-report-service';
import { formatDate, formatDateTime, toVnDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { subjectPath } from '@/utils/subject-link';

interface Milestone {
  label: string;
  date?: string;
}

const milestonesOf = (entry: EquipmentRepairEntry): Milestone[] => {
  const rounds = entry.acceptanceRounds.filter((round) => round.result !== 'PENDING');
  const accepted = rounds.find((round) => round.result === 'PASSED');
  return [
    { label: 'Báo hỏng', date: formatDate(toVnDate(entry.record.createdAt)) },
    { label: 'Duyệt', date: entry.approvedAt ? formatDate(toVnDate(entry.approvedAt)) : undefined },
    { label: 'Thi công', date: entry.constructionStart ? formatDate(entry.constructionStart) : undefined },
    { label: accepted ? `Nghiệm thu đạt (vòng ${accepted.roundNo})` : 'Nghiệm thu', date: accepted ? formatDate(toVnDate(accepted.submittedAt)) : undefined },
    { label: 'Hoàn tất', date: entry.record.closedAt && entry.record.status === 'COMPLETED' ? formatDate(toVnDate(entry.record.closedAt)) : undefined },
  ].filter((step) => step.date);
};

/** One repair in the equipment timeline: symptom, approved fix, contractor, cost and milestones. */
export const RepairTimelineEntry = ({ entry }: { entry: EquipmentRepairEntry }) => {
  const { record } = entry;
  const failedRounds = entry.acceptanceRounds.filter((round) => round.result === 'FAILED');
  const details = [
    { label: 'Hiện tượng', value: record.description },
    { label: 'Phương án', value: entry.proposal },
    { label: 'Nhà thầu', value: entry.contractorName },
  ].filter((row) => row.value);
  return (
    <li className="relative pb-6 pl-7 last:pb-0">
      <span className="absolute left-[7px] top-5 h-[calc(100%-0.75rem)] w-px bg-line" aria-hidden />
      <span className="absolute left-0 top-1.5 size-[15px] rounded-full border-[3px] border-surface bg-accent ring-1 ring-accent/40" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-3">{formatDateTime(record.createdAt)}</p>
          <p className="mt-0.5 text-[0.9375rem] font-semibold text-ink">
            <Link to={subjectPath('REPAIR_RECORD', record.id)} className="mr-1.5 text-accent hover:underline">{record.code}</Link>
            {record.title}
          </p>
        </div>
        <RepairStatusBadge status={record.status} />
      </div>
      {details.length > 0 ? (
        <dl className="mt-2 space-y-1 text-[0.8125rem]">
          {details.map((row) => (
            <div key={row.label} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className="whitespace-pre-line text-ink">{row.value}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-ink-3">Chi phí</dt>
            <dd className="tnum font-semibold text-ink">{entry.approvedAmount === undefined ? 'Chưa duyệt' : formatVnd(entry.approvedAmount)}</dd>
          </div>
        </dl>
      ) : null}
      {failedRounds.length > 0 ? (
        <p className="mt-2 rounded-md bg-warn-soft px-2.5 py-1.5 text-xs text-ink">
          Nghiệm thu không đạt {failedRounds.length} lần{failedRounds[0].failNotes[0] ? `: ${failedRounds[0].failNotes[0]}` : ''}
        </p>
      ) : null}
      <ol className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-2" aria-label="Các mốc xử lý">
        {milestonesOf(entry).map((step, index) => (
          <li key={step.label} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-ink-3" aria-hidden>→</span> : null}
            <span>
              {step.label} <span className="tnum font-medium text-ink">{step.date}</span>
            </span>
          </li>
        ))}
        {entry.durationDays !== undefined ? <li className="ml-1 rounded-full bg-surface-3 px-2 py-px font-medium">Xử lý {entry.durationDays} ngày</li> : null}
      </ol>
    </li>
  );
};
