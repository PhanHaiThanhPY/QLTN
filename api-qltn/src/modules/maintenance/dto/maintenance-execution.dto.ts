import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';

/*
 * SPEC MT-S3. Entries, item marks and resolutions are plain objects checked item by item in the service, so each
 * refusal is a field error on its item (`entries.<itemId>`).
 */

export class WorkDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;

  @ApiProperty({
    description: '[{ itemId, result: PASS|FAIL|NA|null, value: number|null, note, attachmentIds }]',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  entries: unknown[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  contractorName?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Người làm thực tế' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  actualWorker?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Ảnh chung của lượt' })
  @IsOptional()
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}

/** A decision names the submission it answers; an older one is a conflict (BR-MT3-06, AC-MT3.6). */
export class RoundDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;

  @ApiProperty({ description: 'Lần gửi đang xét' })
  @Type(() => Number)
  @IsInt()
  round: number;
}

export class ReworkDto extends RoundDto {
  @ApiProperty()
  @Trim()
  @IsString()
  reason: string;

  @ApiProperty({ description: '[{ itemId, reason }]', type: 'array', items: { type: 'object' } })
  @IsArray()
  items: unknown[];
}

export class ConfirmDto extends RoundDto {
  @ApiPropertyOptional({
    description: 'Hướng xử lý của mục lỗi: [{ itemId, text }]',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  resolutions?: unknown[];

  @ApiPropertyOptional({
    enum: ['GOOD', 'NEEDS_ATTENTION'],
    nullable: true,
    description: 'Đổi tình trạng thiết bị; bỏ trống là giữ nguyên',
  })
  @IsOptional()
  @IsIn(['GOOD', 'NEEDS_ATTENTION', null])
  condition?: 'GOOD' | 'NEEDS_ATTENTION' | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  conditionNote?: string | null;
}

export class ReassignOccurrenceDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;

  @ApiProperty({ enum: ['PERFORMER', 'REVIEWER'] })
  @IsIn(['PERFORMER', 'REVIEWER'])
  slot: 'PERFORMER' | 'REVIEWER';

  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @Trim()
  @IsString()
  reason: string;
}

export class RepairFromItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;

  @ApiProperty()
  @Trim()
  @IsString()
  itemId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export class ListOccurrencesQueryDto {
  @ApiPropertyOptional({ enum: ['mine', 'all'] })
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['OVERDUE', 'TODAY', 'NEXT_7', 'PENDING_REVIEW'] })
  @IsOptional()
  @IsIn(['OVERDUE', 'TODAY', 'NEXT_7', 'PENDING_REVIEW'])
  bucket?: 'OVERDUE' | 'TODAY' | 'NEXT_7' | 'PENDING_REVIEW';

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  to?: string;
}
