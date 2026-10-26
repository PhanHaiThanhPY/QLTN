import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class VersionedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

/** T10 (SPEC B03–B09 v2 §5.2): plan dates and the plan note sent to BQT and TVKT (BR-S3-01). */
export class StartConstructionDto extends VersionedDto {
  @ApiProperty({ example: '2026-10-27' })
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  startDate: string;

  @ApiProperty({ example: '2026-11-03' })
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  plannedEndDate: string;

  @ApiProperty({ description: 'Ghi chú kế hoạch (5–1000 ký tự).' })
  @Trim()
  @IsString()
  planNote: string;
}

/** T11: progress 0–100, note, optional CONSTRUCTION files. */
export class UpdateConstructionDto extends VersionedDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent: number;

  @ApiProperty({ description: 'Ghi chú (5–1000 ký tự).' })
  @Trim()
  @IsString()
  note: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}

/** T12/T16: the acceptance minutes of a new round (§4.3). */
export class SubmitAcceptanceDto extends VersionedDto {
  @ApiProperty({ description: 'Ngày hoàn thành, trong khoảng [ngày bắt đầu, hôm nay].', example: '2026-10-30' })
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  completedDate: string;

  @ApiProperty({ description: 'Thời gian nghiệm thu (ISO 8601).', example: '2026-10-30T09:00:00+07:00' })
  @IsISO8601({ strict: true })
  inspectedAt: string;

  @ApiProperty({ description: 'Địa điểm nghiệm thu (≤ 200 ký tự).' })
  @Trim()
  @IsString()
  inspectionLocation: string;

  @ApiProperty({ description: 'Nội dung nghiệm thu: công việc và hạng mục (10–2000 ký tự).' })
  @Trim()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Thành phần khác, chữ tự do (≤ 1000 ký tự).' })
  @IsOptional()
  @Trim()
  @IsString()
  otherMembers?: string;

  @ApiProperty({ type: [String], description: 'Ảnh kết quả (ACCEPTANCE hoặc CONSTRUCTION), ít nhất 1.' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  photoAttachmentIds: string[];
}

/** T13/T14: one member's decision, signed (BR-S3-03); ACCEPTANCE files are optional. */
export class AcceptanceDecisionDto extends VersionedDto {
  @ApiPropertyOptional({ description: 'Lượt màn hình đang xem; khác lượt hiện hành thì 409.' })
  @IsOptional()
  @IsUUID()
  acceptanceId?: string;

  @ApiPropertyOptional({ description: 'Đạt: điểm lưu ý (≤ 1000). Không đạt: điểm cần khắc phục (5–1000).' })
  @IsOptional()
  @Trim()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Chữ ký: data:image/png;base64,… (≤ 200 KB).' })
  @IsString()
  signature: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}

/** T15: repair work in progress; every field optional. */
export class SaveRepairEvidenceDto extends VersionedDto {
  @ApiPropertyOptional({ description: 'Nội dung khắc phục (≤ 1000 ký tự).' })
  @IsOptional()
  @Trim()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
