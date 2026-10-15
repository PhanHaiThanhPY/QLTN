import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { RepairConfirmationOutcome } from '@/domain/types';
import { useRecordContext } from '../../record-context';
import { ActorLine } from '../shared/ActorLine';

const OUTCOME: Record<RepairConfirmationOutcome, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: 'Xác nhận cần sửa', tone: 'good' },
  NEEDS_UPDATE: { label: 'Trả bổ sung', tone: 'warn' },
  NO_REPAIR: { label: 'Không cần sửa', tone: 'outline' },
};

/** Every confirmation decision of the record (oldest first). */
export const ConfirmationHistory = () => {
  const { detail } = useRecordContext();
  return (
    <Card>
      <CardHeader title="Lịch sử xác nhận hiện trạng" />
      <CardBody>
        {detail.confirmations.length === 0 ? (
          <p className="text-sm text-ink-3">Chưa có quyết định xác nhận.</p>
        ) : (
          <ul className="space-y-3">
            {detail.confirmations.map((row) => (
              <li key={row.id} className="rounded-lg border border-line p-3">
                <Badge tone={OUTCOME[row.outcome].tone}>{OUTCOME[row.outcome].label}</Badge>
                <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{row.note}</p>
                <ActorLine actorId={row.actorId} at={row.createdAt} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
};
