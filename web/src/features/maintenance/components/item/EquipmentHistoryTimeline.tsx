import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import type { EquipmentHistory } from '@/services/equipment-report-service';
import { formatDate } from '@/utils/date';
import { RepairTimelineEntry } from './RepairTimelineEntry';

/** Repair history of one item as a timeline, optionally with maintenance visits that found problems. */
export const EquipmentHistoryTimeline = ({ history }: { history: EquipmentHistory }) => {
  const [showIssues, setShowIssues] = useState(false);
  return (
    <div className="space-y-4">
      {history.repairs.length === 0 ? (
        <EmptyState title="Chưa có lần sửa chữa nào" description="Các hồ sơ sửa chữa gắn với thiết bị sẽ hiện tại đây." />
      ) : (
        <ol className="space-y-0">
          {history.repairs.map((entry) => (
            <RepairTimelineEntry key={entry.record.id} entry={entry} />
          ))}
        </ol>
      )}
      {history.issues.length > 0 ? (
        <div className="border-t border-line pt-3">
          <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
            <input type="checkbox" className="size-4 accent-accent" checked={showIssues} onChange={(event) => setShowIssues(event.target.checked)} />
            Hiện cả {history.issues.length} lượt bảo trì có ghi nhận vấn đề
          </label>
          {showIssues ? (
            <ul className="mt-3 space-y-2">
              {history.issues.map((entry) => (
                <li key={entry.occurrenceId} className="rounded-lg border border-line bg-surface-2 p-3 text-[0.8125rem]">
                  <p className="font-semibold text-ink">
                    <Link to={`/maintenance/occurrences/${entry.occurrenceId}`} className="mr-1.5 text-accent hover:underline">{entry.code}</Link>
                    Bảo trì ngày {formatDate(entry.date)}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                    {entry.issues.map((issue) => (
                      <li key={issue.label}>
                        {issue.label}
                        {issue.note ? `: ${issue.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
