import { Link } from 'react-router';
import { PlanStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { FREQUENCY_LABEL } from '@/domain/constants';
import { currentScheduleVersion } from '@/domain/schedule';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { PlanListItem } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { MaintenanceLocationTrail } from './MaintenanceLocationTrail';

/** Plans: table on desktop, cards on phones. */
export const PlanTable = ({ rows }: { rows: PlanListItem[] }) => {
  const { data, itemName, userName } = useReferenceData();
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th className="w-20">Mã</Th>
            <Th>Nơi bảo trì</Th>
            <Th className="min-w-64">Kế hoạch</Th>
            <Th className="min-w-56">Phụ trách</Th>
            <Th>Chu kỳ</Th>
            <Th>Ngày gốc hiện hành</Th>
            <Th>Kỳ tới</Th>
            <Th>Trạng thái</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ plan, nextDueDate }) => {
            const version = currentScheduleVersion(plan);
            return (
              <Tr key={plan.id}>
                <Td className="w-20">
                  <Link to={`/maintenance/plans/${plan.id}`} className="font-medium text-accent hover:underline">
                    {plan.code}
                  </Link>
                </Td>
                <Td>
                  <MaintenanceLocationTrail data={data} buildingId={plan.buildingId} itemId={plan.itemId} />
                </Td>
                <Td className="min-w-64">
                  <div className="font-medium text-ink">{plan.title}</div>
                  <div className="text-xs text-ink-2">{itemName(plan.itemId)}</div>
                </Td>
                <Td className="min-w-56 text-xs text-ink-2">
                  <div>BQL: {userName(plan.managerUserId)}</div>
                  <div>KT: {userName(plan.confirmationUserId)}</div>
                </Td>
                <Td>{FREQUENCY_LABEL[version.frequency]}</Td>
                <Td>
                  {formatDate(version.anchorDate)}
                  {version.revision > 1 ? <div className="text-xs text-ink-2">Phiên bản lịch {version.revision}</div> : null}
                </Td>
                <Td>{formatDate(nextDueDate)}</Td>
                <Td>
                  <PlanStatusBadge status={plan.status} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {rows.map(({ plan, nextDueDate }) => (
          <li key={plan.id}>
            <Link to={`/maintenance/plans/${plan.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-accent">{plan.code}</span>
                <PlanStatusBadge status={plan.status} />
              </div>
              <div className="mt-2 rounded-md bg-accent-soft/45 px-2.5 py-2">
                <MaintenanceLocationTrail data={data} buildingId={plan.buildingId} itemId={plan.itemId} />
              </div>
              <p className="mt-1 text-sm font-medium text-ink">{plan.title}</p>
              <p className="text-xs text-ink-2">{itemName(plan.itemId)}</p>
              <p className="mt-1 text-sm text-ink-2">
                {FREQUENCY_LABEL[currentScheduleVersion(plan).frequency]} · Kỳ tới {formatDate(nextDueDate)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
