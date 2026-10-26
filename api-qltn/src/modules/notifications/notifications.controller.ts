import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { PaginationQueryDto } from '../../common/utils/pagination';
import { NotificationsService, type NotificationView } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Thông báo của tôi, mới nhất trước' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<NotificationView>> {
    return this.notifications.list(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc của tôi' })
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return this.notifications.unreadCount(user);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo của tôi' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<NotificationView> {
    return this.notifications.markRead(user, id);
  }
}
