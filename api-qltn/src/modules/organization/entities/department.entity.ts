import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Building } from '../../buildings/entities/building.entity';

@Entity('departments')
@Index('UQ_departments_code', ['code'], { unique: true })
export class Department extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToMany(() => Building)
  @JoinTable({
    name: 'department_buildings',
    joinColumn: { name: 'department_id', foreignKeyConstraintName: 'FK_department_buildings_department' },
    inverseJoinColumn: { name: 'building_id', foreignKeyConstraintName: 'FK_department_buildings_building' },
  })
  buildings: Building[];
}
