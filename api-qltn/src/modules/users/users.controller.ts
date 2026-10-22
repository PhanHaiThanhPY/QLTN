import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { PaginationQueryDto } from '../../common/utils/pagination';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { CreateUserDto, ListUsersQueryDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { UserAdminService } from './user-admin.service';
import type { UserProfile } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly admin: UserAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireCapabilities('ADMIN_VIEW')
  @ApiOperation({ summary: 'Danh sách tài khoản trong phạm vi tòa nhà' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserProfile>> {
    return this.admin.list(user, query);
  }

  @Get(':id')
  @RequireCapabilities('ADMIN_VIEW')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserProfile> {
    return this.admin.get(user, id);
  }

  @Get(':id/audit')
  @RequireCapabilities('ADMIN_VIEW')
  @ApiOperation({ summary: 'Lịch sử thay đổi tài khoản' })
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditEventView>> {
    await this.admin.get(user, id);
    return this.audit.listForSubject(SUBJECT_TYPE.ACCOUNT, id, query);
  }

  @Post()
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Tạo tài khoản' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto): Promise<UserProfile> {
    return this.admin.create(user, dto);
  }

  @Patch(':id')
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Sửa tài khoản / ngừng hoạt động' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserProfile> {
    return this.admin.update(user, id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Đặt lại mật khẩu (đăng xuất mọi phiên của tài khoản)' })
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ reset: true }> {
    return this.admin.resetPassword(user, id, dto);
  }
}
