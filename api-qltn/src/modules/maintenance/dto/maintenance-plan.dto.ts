import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';
import { PLAN_STATUSES, type PlanStatus } from '../entities/maintenance-plan.entity';

const UNITS = ['WEEK', 'MONTH'] as const;

/**
 * Fields of a plan. Ranges, people and the checklist are checked in the service so each refusal is a field error with
 * the screen's wording (BR-MT2-01..03); the checklist rows are plain objects validated item by item there.
 */
export class MaintenancePlanFieldsDto {
  @ApiProperty({ maxLength: 120 })
  @Trim()
  @IsString()
  name: string;

  @ApiProperty()
  @IsUUID()
  performerUserId: string;

  @ApiProperty()
  @IsUUID()
  reviewerUserId: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  contractorName?: string | null;

  @ApiProperty({
    description: 'Danh mục kiểm: [{ id?, label, required, kind: CHECK|MEASUREMENT, unit?, min?, max?, photoRequired }]',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  checklist: unknown[];
}

/** Schedule fields of a draft (later changes go through "Đổi chu kỳ"). */
export class ScheduleFieldsDto extends MaintenancePlanFieldsDto {
  @ApiProperty({ enum: UNITS })
  @IsIn(UNITS, { message: 'Đơn vị chu kỳ không hợp lệ.' })
  unit: 'WEEK' | 'MONTH';

  @ApiProperty({ description: 'Tuần: 1–8; tháng: 1–24.' })
  @Type(() => Number)
  @IsInt()
  every: number;

  @ApiProperty({ example: '2026-11-12', description: 'Ngày của lượt đầu tiên.' })
  @Trim()
  @IsString()
  startDate: string;
}

export class CreateMaintenancePlanDto extends ScheduleFieldsDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;
}

/** Draft: every field; active or paused: name, checklist, people and contractor only (schedule fields refused). */
export class UpdateMaintenancePlanDto extends MaintenancePlanFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ description: 'Chỉ khi Nháp.' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ enum: UNITS, description: 'Chỉ khi Nháp.' })
  @IsOptional()
  @IsIn(UNITS)
  unit?: 'WEEK' | 'MONTH';

  @ApiPropertyOptional({ description: 'Chỉ khi Nháp.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  every?: number;

  @ApiPropertyOptional({ description: 'Chỉ khi Nháp.' })
  @IsOptional()
  @Trim()
  @IsString()
  startDate?: string;
}

export class PlanVersionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class PlanReasonDto extends PlanVersionDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @Trim()
  @IsString()
  reason: string;
}

/** BR-MT2-05. */
export class ChangeScheduleDto extends PlanReasonDto {
  @ApiProperty({ enum: UNITS })
  @IsIn(UNITS, { message: 'Đơn vị chu kỳ không hợp lệ.' })
  unit: 'WEEK' | 'MONTH';

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  every: number;

  @ApiProperty({ description: 'Ngày hiệu lực, không trước hôm nay.' })
  @Trim()
  @IsString()
  effectiveFrom: string;

  @ApiProperty({ description: 'Ngày của lượt đầu tiên theo chu kỳ mới, không trước ngày hiệu lực.' })
  @Trim()
  @IsString()
  anchorDate: string;
}

/** BR-MT2-08: a make-up occurrence (version of the plan). */
export class MakeupOccurrenceDto extends PlanReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  date: string;
}

/** ADMIN hands the plan to another BQL when its manager can no longer act (BR-MT2-11). */
export class ChangePlanManagerDto extends PlanVersionDto {
  @ApiProperty()
  @IsUUID()
  managerUserId: string;
}

/** Occurrence actions carry the occurrence version. */
export class OccurrenceReasonDto extends PlanReasonDto {}

export class RescheduleOccurrenceDto extends PlanReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  date: string;
}

export class ListMaintenancePlansQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ enum: PLAN_STATUSES })
  @IsOptional()
  @IsIn(PLAN_STATUSES)
  status?: PlanStatus;

  @ApiPropertyOptional({ description: 'Gồm kế hoạch đã kết thúc (mặc định không).', example: '1' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeEnded?: boolean;
}
