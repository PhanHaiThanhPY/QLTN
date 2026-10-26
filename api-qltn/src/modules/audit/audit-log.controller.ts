import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { AuditLogService, type AuditLogRow } from './audit-log.service';
import { AuditLogExportQueryDto, AuditLogQueryDto } from './dto/audit-log-query.dto';

/** Operation log (SPEC AD-S1 §5). Read only by design: no route changes or deletes an event. */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-events')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @RequireCapabilities('AUDIT_VIEW')
  @ApiOperation({ summary: 'Nhật ký thao tác trong phạm vi tòa (mặc định 7 ngày, mới nhất trước)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLogRow>> {
    return this.auditLog.list(user, query);
  }

  @Get('export')
  @RequireCapabilities('AUDIT_VIEW')
  @ApiOperation({ summary: 'Xuất CSV nhật ký thao tác theo bộ lọc (UTF-8 BOM, tối đa 10.000 dòng)' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditLogExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.auditLog.exportCsv(user, query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Content-Length', String(file.content.length));
    return new StreamableFile(file.content);
  }
}
