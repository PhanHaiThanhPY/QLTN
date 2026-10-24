import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { FileStorage } from './file-storage';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, FileStorage],
  exports: [FileStorage],
})
export class AttachmentsModule {}
