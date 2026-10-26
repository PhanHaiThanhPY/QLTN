import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/utils/pagination';
import { Trim } from '../../../common/validation/trim.decorator';
import { SUBJECT_TYPE } from '../entities/audit-event.entity';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SUBJECT_TYPES = Object.values(SUBJECT_TYPE);

/** Filters of `GET /audit-events` (SPEC AD-S1 §5); unknown parameters are rejected by the global whitelist. */
export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tòa nhà; ngoài phạm vi trả trang rỗng.' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD, giờ Việt Nam). Mặc định 7 ngày gần nhất.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD, giờ Việt Nam). Khoảng tối đa 366 ngày.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Người thực hiện.' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: SUBJECT_TYPES })
  @IsOptional()
  @IsIn(SUBJECT_TYPES)
  subjectType?: string;

  @ApiPropertyOptional({ description: 'Mã hành động, ví dụ confirmRepair.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  action?: string;

  @ApiPropertyOptional({ description: 'Mã đối tượng, ví dụ SC-001 (không phân biệt hoa thường, khớp một phần).' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  subjectCode?: string;
}

/** Same filters for the CSV export, without paging. */
export class AuditLogExportQueryDto extends OmitType(AuditLogQueryDto, ['page', 'limit'] as const) {}
