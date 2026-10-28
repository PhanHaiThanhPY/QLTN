import { rankOffers, termInterest } from '../../domain/deposit';
import type { DepositBank } from './entities/deposit-bank.entity';
import type { DepositInvitation } from './entities/deposit-invitation.entity';
import type { DepositOffer } from './entities/deposit-offer.entity';
import type { OfferComparisonRow } from './entities/deposit-selection.entity';

/** BR-T1-08: the comparison of every offer of an invitation, on the invitation's amount and term. */
export interface Comparison {
  amountVnd: string;
  termDays: number;
  rows: OfferComparisonRow[];
  /** "Các bản chào dùng cơ sở tính ngày khác nhau". */
  mixedBasis: boolean;
  /** The highest interest among complete offers on time (or among all complete offers when none is on time). */
  highestOfferId: string | null;
}

/** BR-T1-08: offers ranked by interest of the term; incomplete and late ones stay, flagged. */
export const compareOffers = (
  invitation: Pick<DepositInvitation, 'amountVnd' | 'termDays'>,
  offers: readonly DepositOffer[],
  banks: readonly DepositBank[],
): Comparison => {
  const amount = BigInt(invitation.amountVnd);
  const ranked = rankOffers(
    offers.map((offer) => ({
      offer,
      id: offer.id,
      rateMilli: offer.rateMilli,
      receivedAt: offer.receivedAt,
      interestVnd: termInterest(amount, offer.rateMilli, invitation.termDays, offer.dayBasis),
    })),
  );
  const rows = ranked.map(({ offer, interestVnd }, index): OfferComparisonRow => {
    const bank = banks.find((row) => row.id === offer.bankId);
    return {
      rank: index + 1,
      offerId: offer.id,
      bankId: offer.bankId,
      bankCode: bank?.code ?? '',
      bankName: bank?.name ?? '',
      shortName: bank?.shortName ?? null,
      rateMilli: offer.rateMilli,
      dayBasis: offer.dayBasis,
      interestVnd: interestVnd.toString(),
      paymentKind: offer.paymentKind,
      paymentEvery: offer.paymentEvery,
      paymentUnit: offer.paymentUnit,
      completeness: offer.completeness,
      missingNote: offer.missingNote,
      isLate: offer.isLate,
      outside: offer.outside,
    };
  });
  const complete = rows.filter((row) => row.completeness === 'COMPLETE');
  const onTime = complete.filter((row) => !row.isLate);
  return {
    amountVnd: invitation.amountVnd,
    termDays: invitation.termDays,
    rows,
    mixedBasis: new Set(rows.map((row) => row.dayBasis)).size > 1,
    highestOfferId: (onTime[0] ?? complete[0])?.offerId ?? null,
  };
};

/** BR-T1-05: "k/n ngân hàng đã phản hồi" counts invited banks only; outside offers do not change n. */
export const progressOf = (
  invitation: Pick<DepositInvitation, 'inviteeIds'>,
  offers: readonly Pick<DepositOffer, 'bankId'>[],
): { responded: number; invited: number } => ({
  responded: invitation.inviteeIds.filter((bankId) => offers.some((offer) => offer.bankId === bankId)).length,
  invited: invitation.inviteeIds.length,
});
