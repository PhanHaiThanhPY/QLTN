import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { FREQUENCY_LABEL } from '@/domain/constants';
import type { MaintenancePlan } from '@/domain/types';
import { formatDate, formatDateTime } from '@/utils/date';

/** Schedule versions (the only schedule source) and periods skipped during pauses. */
export const ScheduleVersionsCard = ({ plan }: { plan: MaintenancePlan }) => {
  const versions = [...plan.scheduleVersions].sort((a, b) => b.revision - a.revision);
  return (
    <Card>
      <CardHeader title="Phiên bản lịch" description="Mỗi phiên bản chỉ sinh ngày trong khoảng hiệu lực của nó." />
      <CardBody className="space-y-4">
        <Table>
          <thead>
            <tr>
              <Th>Phiên bản</Th>
              <Th>Hiệu lực từ</Th>
              <Th>Ngày gốc</Th>
              <Th>Chu kỳ</Th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <Tr key={version.revision}>
                <Td>#{version.revision}</Td>
                <Td>{formatDate(version.effectiveFrom)}</Td>
                <Td>{formatDate(version.anchorDate)}</Td>
                <Td>
                  {FREQUENCY_LABEL[version.frequency]} ({version.intervalMonths} tháng)
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {versions.map((version) => (
            <li key={version.revision} className="rounded-lg border border-line p-3 text-sm">
              <div className="font-medium text-ink">
                Phiên bản #{version.revision} · {FREQUENCY_LABEL[version.frequency]}
              </div>
              <div className="text-ink-2">
                Hiệu lực {formatDate(version.effectiveFrom)} · Ngày gốc {formatDate(version.anchorDate)}
              </div>
            </li>
          ))}
        </ul>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Kỳ bỏ qua khi tạm dừng</h4>
          {plan.skippedPeriods.length === 0 ? (
            <p className="text-sm text-ink-2">Không có kỳ nào bị bỏ qua.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {plan.skippedPeriods.map((period) => (
                <li key={period.originalScheduledDate} className="flex flex-wrap gap-x-2">
                  <span className="font-medium text-ink">{formatDate(period.originalScheduledDate)}</span>
                  <span className="text-ink-2">Tạm dừng · ghi nhận {formatDateTime(period.recordedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
