import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { PaginationQueryDto } from '../../common/utils/pagination';
import type { AuditEventView } from '../audit/audit.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService, type RoleView } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách vai trò (hệ thống + tùy chỉnh)' })
  list(): Promise<RoleView[]> {
    return this.roles.list();
  }

  @Post()
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Tạo vai trò tùy chỉnh (từ vai trò gốc hoặc sao chép)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto): Promise<RoleView> {
    return this.roles.create(user, dto);
  }

  @Patch(':id')
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Sửa vai trò tùy chỉnh (chỉ thu hẹp quyền của vai trò gốc)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleView> {
    return this.roles.update(user, id, dto);
  }

  @Get(':id/audit')
  @RequireCapabilities('ADMIN_VIEW')
  @ApiOperation({ summary: 'Lịch sử thay đổi vai trò' })
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditEventView>> {
    return this.roles.history(id, query);
  }
}
