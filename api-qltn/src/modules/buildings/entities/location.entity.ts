import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Building } from './building.entity';

/** A place inside a building. Unique per (building, floor, lower(name)) — index UQ_locations_building_floor_name in SQL. */
@Entity('locations')
export class Location extends BaseEntity {
  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @ManyToOne(() => Building, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'building_id', foreignKeyConstraintName: 'FK_locations_building' })
  building: Building;

  @Column({ type: 'varchar', length: 20 })
  floor: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  zone: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Inactive locations stay on existing records but are hidden from new selections. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
