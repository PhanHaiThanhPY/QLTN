import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

@Entity('buildings')
@Index('UQ_buildings_code', ['code'], { unique: true })
export class Building extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
