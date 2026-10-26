import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const PAYMENT_KINDS = ['TAM_UNG', 'QUYET_TOAN'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export const PAYMENT_STATUSES = ['PENDING_APPROVAL', 'NEEDS_UPDATE', 'PENDING_TRANSFER', 'TRANSFERRED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One payment instalment (D5-TDN, SPEC §4.4): an advance or the settlement, approved then confirmed once. */
@Entity('repair_payments')
@Index('UQ_repair_payments_seq', ['recordId', 'seqNo'], { unique: true })
@Check('CHK_repair_payments_kind', `kind IN ('TAM_UNG', 'QUYET_TOAN')`)
@Check(
  'CHK_repair_payments_status',
  `status IN ('PENDING_APPROVAL', 'NEEDS_UPDATE', 'PENDING_TRANSFER', 'TRANSFERRED')`,
)
@Check('CHK_repair_payments_amount', 'amount_vnd > 0')
export class RepairPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: PaymentKind;

  @Column({ name: 'seq_no', type: 'integer' })
  seqNo: number;

  @Column({ type: 'varchar', length: 30 })
  status: PaymentStatus;

  @Column({ name: 'revision_no', type: 'integer', default: 1 })
  revisionNo: number;

  /** Settlement only: the settled total (integer VND as a string). */
  @Column({ name: 'settlement_amount_vnd', type: 'bigint', nullable: true })
  settlementAmountVnd: string | null;

  /** What this instalment pays (integer VND as a string). */
  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ name: 'payee_name', type: 'varchar', length: 200 })
  payeeName: string;

  @Column({ name: 'account_no', type: 'varchar', length: 20 })
  accountNo: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 200 })
  bankName: string;

  @Column({ name: 'transfer_content', type: 'varchar', length: 210 })
  transferContent: string;

  @Column({ name: 'request_attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  requestAttachmentIds: string[];

  @Column({ name: 'invoice_attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  invoiceAttachmentIds: string[];

  /** PAYMENT steps of the snapshot when last submitted. */
  @Column({ name: 'chain_step_keys', type: 'text', array: true })
  chainStepKeys: string[];

  @Column({ name: 'current_step_key', type: 'varchar', length: 60, nullable: true })
  currentStepKey: string | null;

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'transfer_date', type: 'date', nullable: true })
  transferDate: string | null;

  @Column({ name: 'transfer_reference', type: 'varchar', length: 100, nullable: true })
  transferReference: string | null;

  @Column({ name: 'proof_attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  proofAttachmentIds: string[];

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedBy: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
