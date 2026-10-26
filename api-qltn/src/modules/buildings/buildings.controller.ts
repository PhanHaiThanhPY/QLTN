import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope, hasCapability } from '../../common/auth/scope';
import { forbidden } from '../../common/errors';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { PaginationQueryDto } from '../../common/utils/pagination';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import {
  BuildingConfigService,
  type BuildingConfigView,
  type ConfigSaveResult,
  WORKFLOW_CATALOG,
} from './building-config.service';
import { BuildingsService, type BuildingView } from './buildings.service';
import { ApplyTemplateDto, BulkWorkflowUpdateDto, UpdateBuildingConfigDto } from './dto/building-config.dto';
import {
  CreateBuildingDto,
  CreateLocationDto,
  ListLocationsQueryDto,
  SetLocationActiveDto,
  UpdateBuildingDto,
  UpdateLocationDto,
} from './dto/building.dto';
import { LocationsService, type LocationView } from './locations.service';

@ApiTags('Buildings')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
  constructor(
    private readonly buildings: BuildingsService,
    private readonly locations: LocationsService,
    private readonly configs: BuildingConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Tòa nhà trong phạm vi' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<BuildingView[]> {
    return this.buildings.list(user);
  }

  @Post()
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Thêm tòa nhà (theo cấu hình mẫu)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBuildingDto): Promise<BuildingView> {
    return this.buildings.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<BuildingView> {
    return this.buildings.get(user, id);
  }

  @Patch(':id')
  @RequireCapabilities('ACCOUNT_MANAGE')
  @ApiOperation({ summary: 'Đổi tên / địa chỉ tòa nhà' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuildingDto,
  ): Promise<BuildingView> {
    return this.buildings.update(user, id, dto);
  }

  /**
   * Read-only history of configuration and locations: BUILDING_CONFIG (ADMIN) or LOCATION_MANAGE (BQL) since PD-13.
   * The capability guard requires every listed capability, so this either-or check is done here.
   */
  @Get(':id/audit')
  @ApiOperation({ summary: 'Lịch sử cấu hình tòa nhà, vị trí (chỉ xem)' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditEventView>> {
    if (!hasCapability(user, 'BUILDING_CONFIG') && !hasCapability(user, 'LOCATION_MANAGE')) {
      throw forbidden('Vai trò của bạn không xem được lịch sử tòa nhà.');
    }
    assertBuildingInScope(user, id);
    return this.audit.listForSubject(SUBJECT_TYPE.BUILDING, id, query);
  }

  // ── Locations ─────────────────────────────────────────────────────────

  @Get(':id/locations')
  listLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListLocationsQueryDto,
  ): Promise<LocationView[]> {
    return this.locations.list(user, id, query.includeInactive ?? true);
  }

  @Post(':id/locations')
  @RequireCapabilities('LOCATION_MANAGE')
  createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLocationDto,
  ): Promise<LocationView> {
    return this.locations.create(user, id, dto);
  }

  @Patch(':id/locations/:locationId')
  @RequireCapabilities('LOCATION_MANAGE')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationView> {
    return this.locations.update(user, id, locationId, dto);
  }

  @Patch(':id/locations/:locationId/status')
  @RequireCapabilities('LOCATION_MANAGE')
  @ApiOperation({ summary: 'Ngừng / mở lại sử dụng vị trí' })
  setLocationActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: SetLocationActiveDto,
  ): Promise<LocationView> {
    return this.locations.setActive(user, id, locationId, dto);
  }

  // ── Configuration ─────────────────────────────────────────────────────

  @Get(':id/config')
  @RequireCapabilities('BUILDING_CONFIG')
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuildingConfigView> {
    return this.configs.get(user, id);
  }

  @Put(':id/config')
  @RequireCapabilities('BUILDING_CONFIG')
  @ApiOperation({ summary: 'Lưu cấu hình (hồ sơ đang mở giữ cấu hình lúc tạo)' })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuildingConfigDto,
  ): Promise<ConfigSaveResult> {
    return this.configs.update(user, id, dto);
  }

  @Post(':id/config/apply-template')
  @RequireCapabilities('BUILDING_CONFIG')
  @ApiOperation({ summary: 'Áp dụng cấu hình mẫu hoặc sao chép từ tòa khác' })
  applyTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyTemplateDto,
  ): Promise<ConfigSaveResult> {
    return this.configs.applyTemplate(user, id, dto);
  }
}

@ApiTags('Buildings')
@ApiBearerAuth()
@Controller('building-configs')
export class BuildingConfigsController {
  constructor(private readonly configs: BuildingConfigService) {}

  @Get()
  @RequireCapabilities('BUILDING_CONFIG')
  @ApiOperation({ summary: 'Cấu hình của các tòa trong phạm vi' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<BuildingConfigView[]> {
    return this.configs.list(user);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Danh mục bước duyệt, bước nghiệp vụ, mẫu cấu hình và giới hạn' })
  catalog(): typeof WORKFLOW_CATALOG {
    return WORKFLOW_CATALOG;
  }

  @Put('workflow')
  @RequireCapabilities('BUILDING_CONFIG')
  @ApiOperation({ summary: 'Áp dụng workflow cho nhiều tòa cùng lúc (tất cả hoặc không)' })
  bulkUpdate(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkWorkflowUpdateDto): Promise<{ updated: number }> {
    return this.configs.bulkUpdate(user, dto);
  }
}
