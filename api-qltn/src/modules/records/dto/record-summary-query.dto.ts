import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * `GET /records/summary` scope filters. Cards answer building scope, so only `buildingId` narrows the count;
 * status/search/assignee filters are deliberately left to the list (`GET /records`).
 */
export class RecordSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Tòa nhà; ngoài phạm vi trả số 0.' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;
}
