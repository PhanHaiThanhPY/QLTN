import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type VoucherDecisionKind =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REQUEST_CHANGES'
  | 'REJECT'
  | 'PAY'
  | 'CANCEL'
  | 'REQUEST_CANCEL'
  | 'APPROVE_CANCEL'
  | 'REJECT_CANCEL';

/** The decision history of a payment voucher (ui-brief §2.4). */
@Entity('fund_voucher_decisions')
export class FundVoucherDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voucher_id', type: 'uuid' })
  voucherId: string;

  @Column({ type: 'varchar', length: 20 })
  decision: VoucherDecisionKind;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'decided_by', type: 'uuid' })
  decidedBy: string;

  @Column({ name: 'decided_at', type: 'timestamptz', default: () => 'now()' })
  decidedAt: Date;
}
