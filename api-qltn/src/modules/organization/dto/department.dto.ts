import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim, TrimToNull, TrimUpper } from '../../../common/validation/trim.decorator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'KT' })
  @TrimUpper()
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,19}$/)
  code: string;

  @ApiProperty({ example: 'Kỹ thuật' })
  @Trim()
  @IsString()
  @Length(3, 80)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  buildingIds: string[];
}

export class UpdateDepartmentDto extends CreateDepartmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
