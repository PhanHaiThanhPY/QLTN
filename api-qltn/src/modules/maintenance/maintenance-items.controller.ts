import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import {
  CreateMaintenanceItemDto,
  ItemConditionDto,
  ItemDocumentsDto,
  ItemReasonDto,
  ListMaintenanceItemsQueryDto,
  UpdateMaintenanceItemDto,
} from './dto/maintenance-item.dto';
import type { ItemListRowView } from './maintenance-item-reads';
import type { MaintenanceItemView } from './maintenance-item-view';
import { MaintenanceItemsService, type ItemDetailWithAudit } from './maintenance-items.service';

/**
 * Equipment (SPEC MT-S1). Writes carry no @RequireCapabilities: the service checks scope (404) before the capability
 * (403), as the repair record actions do.
 */
@ApiTags('Maintenance items')
@ApiBearerAuth()
@Controller('maintenance-items')
export class MaintenanceItemsController {
  constructor(private readonly items: MaintenanceItemsService) {}

  @Get()
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Thiết bị trong phạm vi tòa, kèm số hồ sơ sửa chữa, chi phí đã duyệt và cờ cần xử lý' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMaintenanceItemsQueryDto,
  ): Promise<ItemListRowView[]> {
    return this.items.list(user, query);
  }

  @Get(':id')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Trang thiết bị: thông tin, số liệu sửa chữa, hồ sơ gắn thiết bị, tài liệu, lịch sử' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<ItemDetailWithAudit> {
    return this.items.getDetail(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo thiết bị (mã duy nhất trong tòa)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaintenanceItemDto): Promise<MaintenanceItemView> {
    return this.items.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa thiết bị (mã và tòa không đổi; kèm version)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceItemDto,
  ): Promise<MaintenanceItemView> {
    return this.items.update(user, id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ngừng dùng thiết bị (lý do bắt buộc, kèm version)' })
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItemReasonDto,
  ): Promise<MaintenanceItemView> {
    return this.items.deactivate(user, id, dto);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dùng lại thiết bị đã ngừng (lý do bắt buộc, kèm version)' })
  reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItemReasonDto,
  ): Promise<MaintenanceItemView> {
    return this.items.reactivate(user, id, dto);
  }

  @Post(':id/condition')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi tình trạng thiết bị (ghi chú bắt buộc, kèm version)' })
  updateCondition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItemConditionDto,
  ): Promise<MaintenanceItemView> {
    return this.items.updateCondition(user, id, dto);
  }

  @Put(':id/documents')
  @ApiOperation({ summary: 'Đặt danh sách tài liệu của thiết bị (gỡ = bỏ id, tệp không bị xóa; kèm version)' })
  setDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItemDocumentsDto,
  ): Promise<MaintenanceItemView> {
    return this.items.setDocuments(user, id, dto);
  }
}
