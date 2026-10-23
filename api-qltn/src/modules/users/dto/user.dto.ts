import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
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
import { PaginationQueryDto } from '../../../common/utils/pagination';
import { ToBoolean, Trim, TrimToNull, TrimUpper } from '../../../common/validation/trim.decorator';
import { type Role, ROLES } from '../../../domain/permissions';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

class UserFieldsDto {
  @ApiProperty({ example: 'Nguyễn Thu Hà' })
  @Trim()
  @IsString()
  @Length(3, 80)
  fullName: string;

  @ApiProperty({ description: 'Vai trò hệ thống hoặc tùy chỉnh (role_definitions.id)' })
  @IsUUID()
  roleDefId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  buildingIds: string[];

  @ApiPropertyOptional({ type: [String], description: 'Giới hạn khu vực trong các tòa được giao; trống = toàn tòa' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  locationIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  jobTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[0-9+().\s-]{6,30}$/)
  phone?: string | null;
}

export class CreateUserDto extends UserFieldsDto {
  @ApiProperty({ example: 'KT-A3', description: 'Mã tài khoản (chữ in hoa, số, gạch ngang)' })
  @TrimUpper()
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,19}$/)
  code: string;

  @ApiPropertyOptional({ description: 'Mặc định: mã tài khoản viết thường' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9][a-z0-9._-]{1,49}$/)
  username?: string;

  @ApiProperty({ minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password: string;
}

export class UpdateUserDto extends UserFieldsDto {
  @ApiPropertyOptional({ description: 'Bỏ trống để giữ nguyên tên đăng nhập hiện tại' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9][a-z0-9._-]{1,49}$/)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã, họ tên, email' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
