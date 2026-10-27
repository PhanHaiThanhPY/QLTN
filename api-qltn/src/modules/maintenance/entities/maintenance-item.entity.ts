import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const ITEM_CONDITIONS = ['UNKNOWN', 'GOOD', 'NEEDS_ATTENTION'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

/** Equipment of a building (SPEC MT-S1 BR-MT-01). Code unique per building; building and code never change. */
@Entity('maintenance_items')
@Index('UQ_maintenance_items_building_code', ['buildingId', 'code'], { unique: true })
export class MaintenanceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  type: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  supplier: string | null;

  @Column({ name: 'install_date', type: 'date', nullable: true })
  installDate: string | null;

  @Column({ name: 'warranty_until', type: 'date', nullable: true })
  warrantyUntil: string | null;

  /** "Thông tin kỹ thuật". */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'document_ids', type: 'uuid', array: true, default: () => "'{}'" })
  documentIds: string[];

  @Column({ type: 'varchar', length: 20, default: 'UNKNOWN' })
  condition: ItemCondition;

  @Column({ name: 'condition_note', type: 'text', nullable: true })
  conditionNote: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  @Column({ name: 'deactivation_reason', type: 'text', nullable: true })
  deactivationReason: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  /** Optimistic lock, raised by the service on every write. */
  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
