import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { SchedulePageQueryDto, ScheduleQueryDto } from './dto/schedule-query.dto';
import { ScheduleService, type AwaitingScheduleView, type ScheduleEntryView } from './schedule.service';

/**
 * Construction calendar (SPEC B4-S1). Registered before `RecordsController` in `RecordsModule`, so
 * `/records/schedule` is matched here and never reaches `GET /records/:id`.
 */
@ApiTags('Records')
@ApiBearerAuth()
@Controller('records/schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Lịch thi công: các đợt thi công giao với khoảng ngày, kèm khoảng ngày và cờ trễ' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ScheduleQueryDto,
  ): Promise<PaginatedResult<ScheduleEntryView>> {
    return this.schedule.list(user, query);
  }

  @Get('awaiting')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Chờ xếp lịch: hồ sơ đã duyệt, chưa bắt đầu thi công' })
  awaiting(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SchedulePageQueryDto,
  ): Promise<PaginatedResult<AwaitingScheduleView>> {
    return this.schedule.awaiting(user, query);
  }
}
