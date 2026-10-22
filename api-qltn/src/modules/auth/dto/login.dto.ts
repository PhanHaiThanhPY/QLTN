import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'bql-a', description: 'Tên đăng nhập hoặc email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  username: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
