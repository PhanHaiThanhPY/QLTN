import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';
import { ToBoolean, Trim, TrimToNull, TrimUpper } from '../../../common/validation/trim.decorator';
import { CONFIG_TEMPLATES } from '../../../domain/building-config';

const TEMPLATE_KEYS = CONFIG_TEMPLATES.map((t) => t.key);

class BuildingFieldsDto {
  @ApiProperty({ example: 'Tòa E – Đông Á Tower' })
  @Trim()
  @IsString()
  @Length(3, 120)
  name: string;

  @ApiProperty({ example: '1 Lê Duẩn, Quận 1, TP.HCM' })
  @Trim()
  @IsString()
  @Length(5, 200)
  address: string;
}

export class CreateBuildingDto extends BuildingFieldsDto {
  @ApiProperty({ example: 'E' })
  @TrimUpper()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,9}$/)
  code: string;

  @ApiPropertyOptional({ enum: TEMPLATE_KEYS, default: 'STANDARD' })
  @IsOptional()
  @IsIn(TEMPLATE_KEYS)
  templateKey?: string;
}

export class UpdateBuildingDto extends BuildingFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

class LocationFieldsDto {
  @ApiProperty({ example: 'B1' })
  @Trim()
  @IsString()
  @Length(1, 20)
  floor: string;

  @ApiProperty({ example: 'Phòng bơm & bể nước ngầm' })
  @Trim()
  @IsString()
  @Length(3, 120)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 60)
  zone?: string | null;
}

export class CreateLocationDto extends LocationFieldsDto {}

export class UpdateLocationDto extends LocationFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class SetLocationActiveDto {
  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class ListLocationsQueryDto {
  @ApiPropertyOptional({ default: true, description: 'Kèm vị trí đã ngừng sử dụng' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}
