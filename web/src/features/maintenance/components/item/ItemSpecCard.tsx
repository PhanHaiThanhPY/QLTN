import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { MaintenanceItem } from '@/domain/types';
import { formatDate, formatDateTime } from '@/utils/date';

interface ItemSpecCardProps {
  item: MaintenanceItem;
  ageLabel?: string;
  ownerLabel: string;
  updatedByLabel: string;
}

interface SpecRow {
  label: string;
  value: string;
  hint?: string;
}

/** Technical sheet of the equipment as label/value rows (scannable in the side column). */
export const ItemSpecCard = ({ item, ageLabel, ownerLabel, updatedByLabel }: ItemSpecCardProps) => {
  const rows: SpecRow[] = [
    { label: 'Loại thiết bị', value: item.type },
    { label: 'Model', value: item.model ?? '—' },
    { label: 'Nhà cung cấp', value: item.supplier ?? '—' },
    { label: 'Ngày lắp / thay', value: formatDate(item.installDate), hint: ageLabel ? `Đã sử dụng ${ageLabel}` : undefined },
    { label: 'Người phụ trách (BQL)', value: ownerLabel },
  ];
  return (
    <Card>
      <CardHeader title="Thông tin kỹ thuật" className="px-3.5 pb-2 pt-3.5 sm:px-4 sm:pt-4" />
      <CardBody className="px-3.5 pb-3 pt-0 sm:px-4 sm:pb-4">
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[6.75rem_1fr] gap-2.5 py-2 text-xs">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className="min-w-0 break-words font-medium text-ink">
                {row.value}
                {row.hint ? <span className="mt-0.5 block text-xs font-normal text-ink-2">{row.hint}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
        {item.description ? (
          <div className="mt-2 rounded-lg bg-surface-2 p-3 text-[0.8125rem] text-ink-2">
            <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Thông tin kỹ thuật</p>
            <p className="whitespace-pre-line text-xs leading-5">{item.description}</p>
          </div>
        ) : null}
        <p className="mt-2.5 text-[0.6875rem] text-ink-3">
          Cập nhật {formatDateTime(item.updatedAt)} · {updatedByLabel}
        </p>
      </CardBody>
    </Card>
  );
};
