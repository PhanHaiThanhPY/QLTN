import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';
import { ITEM_CONDITIONS, type ItemCondition } from '../entities/maintenance-item.entity';

/**
 * Editable fields of an item. Lengths and formats are checked in the service so every refusal is a field error with
 * the screen's wording (BR-MT-01); the DTO only fixes the shape.
 */
export class MaintenanceItemFieldsDto {
  @ApiProperty({ maxLength: 120 })
  @Trim()
  @IsString()
  name: string;

  @ApiProperty({ maxLength: 60, example: 'Bơm nước' })
  @Trim()
  @IsString()
  type: string;

  @ApiProperty()
  @Trim()
  @IsUUID()
  locationId: string;

  @ApiProperty({ description: 'BQL phụ trách.' })
  @Trim()
  @IsUUID()
  ownerUserId: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  model?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2024-05-01' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  installDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2027-05-01' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  warrantyUntil?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Thông tin kỹ thuật.', maxLength: 2000 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  description?: string | null;
}

export class CreateMaintenanceItemDto extends MaintenanceItemFieldsDto {
  @ApiProperty()
  @Trim()
  @IsUUID()
  buildingId: string;

  @ApiProperty({ example: 'BOM-A09', description: 'Viết hoa, chữ, số và "-"; không đổi sau khi tạo.' })
  @Trim()
  @IsString()
  code: string;
}

export class UpdateMaintenanceItemDto extends MaintenanceItemFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  /** BR-MT-06: accepted so an edit form may send it, and ignored (the code never changes). */
  @ApiPropertyOptional({ description: 'Bị bỏ qua: mã không đổi sau khi tạo.' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class VersionedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

/** Deactivate / reactivate (BR-MT-03). */
export class ItemReasonDto extends VersionedDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @Trim()
  @IsString()
  reason: string;
}

/** Condition change with its note (BR-MT-04). */
export class ItemConditionDto extends VersionedDto {
  @ApiProperty({ enum: ITEM_CONDITIONS })
  @IsIn(ITEM_CONDITIONS, { message: 'Tình trạng không hợp lệ.' })
  condition: ItemCondition;

  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @Trim()
  @IsString()
  note: string;
}

/** Replaces the item's document list with ITEM_DOCUMENT files already uploaded to it (BR-MT-05). */
export class ItemDocumentsDto extends VersionedDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  documentIds: string[];
}

/** `GET /maintenance-items` filters; the search folds Vietnamese marks. */
export class ListMaintenanceItemsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Mã hoặc tên, không dấu, không phân biệt hoa thường.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  type?: string;

  @ApiPropertyOptional({ description: 'Gồm thiết bị đã ngừng dùng.', example: '1' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeInactive?: boolean;
}
