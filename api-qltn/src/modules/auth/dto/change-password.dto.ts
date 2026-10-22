import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from '../../users/dto/user.dto';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword: string;
}
