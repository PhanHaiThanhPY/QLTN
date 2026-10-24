import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';

/**
 * Multipart text fields of `POST /attachments`. Values are checked against the supported
 * combinations in the service so the refusal can carry `details.reason`.
 */
export class UploadAttachmentDto {
  @ApiProperty({ example: 'REPAIR_RECORD' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  subjectType: string;

  @ApiProperty()
  @Trim()
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: 'SITE_PHOTO' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  purpose: string;
}
