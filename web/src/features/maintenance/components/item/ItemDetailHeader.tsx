import type { ReactNode } from 'react';
import { Building2, Cog, MapPin, UserRound, Wrench } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Tag } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasCapability } from '@/domain/permissions';
import type { MaintenanceItem, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { ConditionBadge } from '../ConditionBadge';
import { ItemActions } from '../ItemActions';
import type { WarrantyInfo } from '../../utils/item-insights';
import { WarrantyBadge } from './WarrantyBadge';

interface ItemDetailHeaderProps {
  item: MaintenanceItem;
  viewer: User;
  warranty: WarrantyInfo;
  buildingLabel: string;
  locationLabel: string;
  ownerLabel: string;
  /** api mode (MT-S1) passes its own actions (with "Dùng lại") and wording; mock keeps the demo ones. */
  actions?: ReactNode;
  inactiveLabel?: string;
}

/** Identity of the equipment (what, where, who) with the main actions on the right. */
export const ItemDetailHeader = ({
  item,
  viewer,
  warranty,
  buildingLabel,
  locationLabel,
  ownerLabel,
  actions,
  inactiveLabel = 'Đã vô hiệu hóa',
}: ItemDetailHeaderProps) => {
  const canReport = item.active && hasCapability(viewer, 'RECORD_EDIT') && viewer.buildingIds.includes(item.buildingId);
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden>
            <Cog className="size-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag>{item.code}</Tag>
              <ConditionBadge condition={item.condition} />
              <WarrantyBadge warranty={warranty} />
              {item.active ? null : <Badge tone="neutral">{inactiveLabel}</Badge>}
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
              <span className="sr-only">{item.code} · </span>
              {item.name}
            </h1>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-ink-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Loại</dt>
                <Wrench className="size-3.5 text-ink-3" aria-hidden />
                <dd>{item.type}</dd>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="sr-only">Vị trí</dt>
                <MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                <dd className="min-w-0 truncate">{locationLabel}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Tòa nhà</dt>
                <Building2 className="size-3.5 text-ink-3" aria-hidden />
                <dd className="truncate">{buildingLabel}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Người phụ trách</dt>
                <UserRound className="size-3.5 text-ink-3" aria-hidden />
                <dd>Phụ trách: {ownerLabel}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {canReport ? (
            <Link to={`/records/new?itemId=${encodeURIComponent(item.id)}`} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
              <Wrench aria-hidden /> Báo sự cố
            </Link>
          ) : null}
          {actions ?? <ItemActions item={item} viewer={viewer} size="sm" />}
        </div>
      </div>
    </Card>
  );
};
