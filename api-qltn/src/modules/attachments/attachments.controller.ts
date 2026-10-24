import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import { AttachmentsService } from './attachments.service';
import type { AttachmentView } from './attachment-view';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import type { UploadedFileLike } from './uploaded-file';

/** Above the 10 MB business limit so the refusal stays a 400 with the `file` field. */
const MEMORY_FILE_LIMIT = 20 * 1024 * 1024;

@ApiTags('Attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @RequireCapabilities('RECORD_EDIT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEMORY_FILE_LIMIT } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Tải ảnh hiện trường của hồ sơ sửa chữa (multipart: file + subjectType + subjectId + purpose)',
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<AttachmentView> {
    return this.attachments.upload(user, dto, file);
  }

  @Get(':id/content')
  @ApiOperation({ summary: 'Nội dung tệp; chỉ người trong phạm vi tòa của tệp' })
  async content(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { attachment, content } = await this.attachments.readContent(user, id);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    response.setHeader('Content-Length', String(content.length));
    return new StreamableFile(content);
  }
}
