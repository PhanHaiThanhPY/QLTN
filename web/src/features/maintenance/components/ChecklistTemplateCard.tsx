import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { ChecklistTemplateItem } from '@/domain/types';

export const ChecklistTemplateCard = ({ items }: { items: ChecklistTemplateItem[] }) => (
  <Card>
    <CardHeader title="Checklist mẫu" description="Áp dụng cho các lượt sinh sau; lượt đã sinh giữ bản sao riêng." />
    <CardBody>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className="w-5 shrink-0 text-ink-2">{index + 1}.</span>
            <span className="flex-1 text-ink">{item.label}</span>
            {item.inputType === 'MEASUREMENT' ? <Badge tone="neutral">Số đo{item.unit ? ` · ${item.unit}` : ''}</Badge> : null}
            {item.required ? <Badge tone="accent">Bắt buộc</Badge> : <Badge tone="outline">Tùy chọn</Badge>}
          </li>
        ))}
      </ol>
    </CardBody>
  </Card>
);
