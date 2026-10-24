import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';

export const RECORD_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type RecordPriority = (typeof RECORD_PRIORITIES)[number];

class RecordDraftFieldsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsUUID()
  locationId?: string | null;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: RECORD_PRIORITIES, default: 'NORMAL' })
  @IsOptional()
  @IsIn(RECORD_PRIORITIES, { message: 'Mức ưu tiên không hợp lệ.' })
  priority?: RecordPriority;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Người xác nhận kỹ thuật; bỏ trống để lấy theo quy tắc giao việc.',
  })
  @IsOptional()
  @TrimToNull()
  @IsUUID()
  confirmationUserId?: string | null;

  @ApiPropertyOptional({ description: 'Cờ “Không thuộc thiết bị cụ thể”.' })
  @IsOptional()
  @IsBoolean()
  noMaintenanceItem?: boolean;
}

export class CreateRecordDto extends RecordDraftFieldsDto {
  @ApiProperty()
  @Trim()
  @IsUUID()
  buildingId: string;
}

export class UpdateRecordDraftDto extends RecordDraftFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách tệp của hồ sơ; gửi danh sách mới thay cho danh sách cũ (bỏ id là gỡ tệp).',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
