import { CheckCircle2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { IsoDate, MaintenancePlan, RepairRecord } from '@/domain/types';
import type { ItemInsights } from '../../utils/item-insights';
import { ItemPlanList } from './ItemPlanList';
import { ItemRepairTable } from './ItemRepairTable';
import { UpcomingMaintenanceList } from './UpcomingMaintenanceList';

interface ItemOverviewTabProps {
  insights: ItemInsights;
  plans: MaintenancePlan[];
  repairs: RepairRecord[];
  repairCosts: Record<string, number>;
  today: IsoDate;
  userName: (id?: string) => string;
  onOpenTab: (tab: string) => void;
}

const RECENT_REPAIRS = 3;

/** Overview: what is coming up, what was repaired lately and which plans drive the schedule. */
export const ItemOverviewTab = ({ insights, plans, repairs, repairCosts, today, userName, onOpenTab }: ItemOverviewTabProps) => (
  <div className="space-y-4">
    {insights.attention.length === 0 ? (
      <div className="flex items-center gap-2.5 rounded-xl border border-good/30 bg-good-soft/50 px-4 py-3 text-[0.8125rem] text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-good" aria-hidden />
        Thiết bị không có việc quá hạn hay sự cố đang mở.
      </div>
    ) : null}
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Lịch bảo trì sắp tới"
          description="Các lượt đang mở, sớm nhất trước."
          actions={<Button variant="ghost" size="sm" onClick={() => onOpenTab('maintenance')}>Tất cả lượt</Button>}
        />
        <CardBody className="pt-0">
          <UpcomingMaintenanceList rows={insights.upcoming} today={today} userName={userName} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Kế hoạch bảo trì" description="Kế hoạch sinh lịch định kỳ cho thiết bị." />
        <CardBody className="pt-0">
          <ItemPlanList plans={plans} />
        </CardBody>
      </Card>
    </div>
    <Card>
      <CardHeader
        title="Sửa chữa gần đây"
        description={repairs.length > 0 ? `${repairs.length} hồ sơ liên quan, mới nhất trước.` : undefined}
        actions={repairs.length > RECENT_REPAIRS ? <Button variant="ghost" size="sm" onClick={() => onOpenTab('repairs')}>Xem tất cả</Button> : null}
      />
      <CardBody className="pt-0">
        {repairs.length === 0 ? (
          <p className="text-sm text-ink-2">Thiết bị chưa phát sinh hồ sơ sửa chữa.</p>
        ) : (
          <ItemRepairTable repairs={repairs} repairCosts={repairCosts} limit={RECENT_REPAIRS} />
        )}
      </CardBody>
    </Card>
  </div>
);
