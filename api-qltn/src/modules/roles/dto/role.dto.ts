import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';
import { CAPABILITIES, type Capability, type Role, ROLES } from '../../../domain/permissions';

export class CreateRoleDto {
  @ApiProperty({ example: 'Nhân viên BQL (không xử lý khẩn cấp)' })
  @Trim()
  @IsString()
  @Length(3, 80)
  name: string;

  @ApiPropertyOptional({ enum: ROLES, description: 'Bắt buộc khi không sao chép từ vai trò khác' })
  @IsOptional()
  @IsIn(ROLES)
  baseRole?: Role;

  @ApiPropertyOptional({ description: 'Sao chép quyền từ vai trò này' })
  @IsOptional()
  @IsUUID()
  sourceRoleId?: string;

  @ApiPropertyOptional({ enum: CAPABILITIES, isArray: true, description: 'Mặc định: quyền của vai trò gốc/nguồn' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CAPABILITIES, { each: true })
  capabilities?: Capability[];
}

export class UpdateRoleDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(3, 80)
  name: string;

  @ApiProperty({ enum: CAPABILITIES, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(CAPABILITIES, { each: true })
  capabilities: Capability[];

  @ApiProperty({ description: 'Phiên bản đang xem (khóa lạc quan)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
