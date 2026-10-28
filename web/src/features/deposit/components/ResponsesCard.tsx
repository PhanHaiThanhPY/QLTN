import { ChevronRight } from 'lucide-react';
import { StatusPill } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { InvitationDetail } from '@/services/deposit-api';

interface ResponsesCardProps {
  detail: InvitationDetail;
  onOpenOffer: (offerId: string) => void;
}

/** "Phản hồi ngân hàng" (BR-T1-05, D1 p. 33): k/n with a two-part bar, each invited bank "Đã nhận" or "Còn chờ". */
export const ResponsesCard = ({ detail, onOpenOffer }: ResponsesCardProps) => {
  const { responded, invited } = detail.progress;
  const percent = invited ? Math.round((responded * 100) / invited) : 0;
  const outside = detail.offers.filter((offer) => offer.outside);
  return (
    <Card>
      <CardHeader title="Phản hồi ngân hàng" actions={<span className="text-sm font-semibold tabular-nums text-ink">{`${responded}/${invited}`}</span>} />
      <CardBody className="space-y-3 pt-0">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={invited}
          aria-valuenow={responded}
          aria-label={`${responded} trên ${invited} ngân hàng đã phản hồi`}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: 'var(--series-1)' }} />
        </div>
        <p className="text-xs text-ink-2">
          {responded} đã phản hồi · {invited - responded} chờ
        </p>
        {detail.invitees.length === 0 ? <p className="text-sm text-ink-2">Chưa mời ngân hàng nào.</p> : null}
        <ul className="divide-y divide-line">
          {detail.invitees.map((bank) => (
            <li key={bank.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 text-ink">{bank.name}</span>
              {bank.offerId ? <StatusPill tone="good">Đã nhận</StatusPill> : <StatusPill tone="warn">Còn chờ</StatusPill>}
              {bank.offerId ? (
                <button
                  type="button"
                  className="rounded p-1 text-ink-2 hover:bg-surface-3"
                  aria-label={`Xem bản chào của ${bank.name}`}
                  onClick={() => (bank.offerId ? onOpenOffer(bank.offerId) : undefined)}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {outside.length ? (
          <p className="text-xs text-ink-2">
            Ngoài danh sách mời: {outside.map((offer) => detail.banks[offer.bankId]?.name ?? '').join(', ')}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
};
