import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { ApiScheduleVersion } from '@/services/maintenance-plans-api';
import { formatDate, toVnDate } from '@/utils/date';
import { ddmm } from './plan-api-ui';

interface ScheduleVersionsApiCardProps {
  versions: ApiScheduleVersion[];
  userName: (id?: string) => string;
}

/** "Lịch sử chu kỳ" (ui-brief §2.3): one line per change; a replaced change says by which. */
export const ScheduleVersionsApiCard = ({ versions, userName }: ScheduleVersionsApiCardProps) => {
  const byId = new Map(versions.map((row) => [row.id, row]));
  return (
    <Card>
      <CardHeader title="Lịch sử chu kỳ" />
      <CardBody className="pt-0">
        <ol className="divide-y divide-line">
          {[...versions].reverse().map((version) => {
            const replacedBy = version.supersededBy ? byId.get(version.supersededBy) : undefined;
            return (
              <li key={version.id} className="space-y-0.5 py-2 text-sm">
                <p className={replacedBy ? 'text-ink-3' : 'font-medium text-ink'}>
                  {version.label} · hiệu lực từ {formatDate(version.effectiveFrom)} · lượt đầu {formatDate(version.anchorDate)}
                </p>
                <p className="text-xs text-ink-2">
                  {userName(version.createdBy)} · {formatDate(toVnDate(version.createdAt))}
                  {version.reason ? ` · ${version.reason}` : ''}
                </p>
                {replacedBy ? <p className="text-xs text-ink-3">Bị thay bởi lần đổi {ddmm(toVnDate(replacedBy.createdAt))}</p> : null}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
};
