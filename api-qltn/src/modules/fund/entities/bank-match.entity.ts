import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A statement line paired with one ledger line (SPEC F-S4 BR-F4-05); unmatching keeps the row (BR-F4-07). */
@Entity('bank_matches')
export class BankMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'line_id', type: 'uuid' })
  lineId: string;

  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @Column({ type: 'varchar', length: 10 })
  kind: 'MATCH' | 'RECORDED';

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'matched_by', type: 'uuid' })
  matchedBy: string;

  @Column({ name: 'matched_at', type: 'timestamptz', default: () => 'now()' })
  matchedAt: Date;

  @Column({ name: 'unmatched_at', type: 'timestamptz', nullable: true })
  unmatchedAt: Date | null;

  @Column({ name: 'unmatched_by', type: 'uuid', nullable: true })
  unmatchedBy: string | null;

  @Column({ name: 'unmatch_reason', type: 'text', nullable: true })
  unmatchReason: string | null;
}
