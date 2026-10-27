import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { RECORD_STATUS_GROUPS, type RecordStatusGroup } from '../record-status-groups';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Largest page of the schedule: the week and month grids ask for it and say "n trên m" beyond (BR-B4-06). */
export const SCHEDULE_MAX_LIMIT = 200;
const SCHEDULE_DEFAULT_LIMIT = 20;

/** Paging of the schedule endpoints; own bounds because a grid page is larger than a list page. */
export class SchedulePageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: SCHEDULE_DEFAULT_LIMIT, minimum: 1, maximum: SCHEDULE_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SCHEDULE_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({ description: 'Tòa nhà; ngoài phạm vi trả danh sách rỗng.' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

/** `GET /records/schedule`: started constructions whose span shares a day with `from`–`to` (BR-B4-02). */
export class ScheduleQueryDto extends SchedulePageQueryDto {
  @ApiPropertyOptional({ enum: RECORD_STATUS_GROUPS })
  @IsOptional()
  @IsIn(RECORD_STATUS_GROUPS)
  statusGroup?: RecordStatusGroup;

  @ApiPropertyOptional({ description: 'Ngày đầu khoảng xem (YYYY-MM-DD, giờ Việt Nam); trống thì không giới hạn.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  from?: string;

  @ApiPropertyOptional({ description: 'Ngày cuối khoảng xem (YYYY-MM-DD, giờ Việt Nam); trống thì không giới hạn.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  to?: string;
}
