import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';

class VersionedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

/** E-T1 (SPEC B06-S1 §3): what the manager states to start the work now. Bounds are checked by the service. */
export class StartEmergencyRepairDto extends VersionedDto {
  @ApiProperty({ description: 'Lý do phải xử lý ngay (5–1000 ký tự).' })
  @Trim()
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Nhà thầu thực hiện (2–200 ký tự).' })
  @Trim()
  @IsString()
  contractorName: string;

  @ApiProperty({ description: 'Chi phí dự kiến, số nguyên VND > 0 dạng chuỗi; ≤ hạn mức khẩn cấp của tòa.' })
  @IsString()
  estimatedAmountVnd: string;

  @ApiProperty({ example: '2026-10-28', description: 'Ngày dự kiến xong, từ hôm nay (giờ Việt Nam).' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  plannedEndDate: string;
}

/** E-T2 (BR-E-08): the board's decision on the cost, with optional BOARD_DECISION files. */
export class ClosePostReviewRejectedDto extends VersionedDto {
  @ApiProperty({ description: 'Quyết định xử lý chi phí (5–1000 ký tự).' })
  @Trim()
  @IsString()
  reason: string;

  @ApiPropertyOptional({ type: [String], description: 'Tệp quyết định (purpose BOARD_DECISION).' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
