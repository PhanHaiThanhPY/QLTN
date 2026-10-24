import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/utils/pagination';
import { Trim } from '../../../common/validation/trim.decorator';
import { RECORD_STATUS_LABEL } from '../record-actions';
import { RECORD_STATUS_GROUPS, type RecordStatusGroup } from '../record-status-groups';

const RECORD_STATUSES = Object.keys(RECORD_STATUS_LABEL);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `GET /records` filters; unknown parameters (e.g. `overdue`) are rejected by the global whitelist. */
export class ListRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Mã hoặc tên hồ sơ; so khớp không dấu, không phân biệt hoa thường.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Tòa nhà; ngoài phạm vi trả danh sách rỗng.' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ enum: RECORD_STATUS_GROUPS })
  @IsOptional()
  @IsIn(RECORD_STATUS_GROUPS)
  statusGroup?: RecordStatusGroup;

  @ApiPropertyOptional({ enum: RECORD_STATUSES })
  @IsOptional()
  @IsIn(RECORD_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Quản lý, người xác nhận, tư vấn hoặc BQT của hồ sơ.' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Ngày tạo từ (YYYY-MM-DD, giờ Việt Nam).' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Ngày tạo đến (YYYY-MM-DD, giờ Việt Nam).' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  dateTo?: string;
}
