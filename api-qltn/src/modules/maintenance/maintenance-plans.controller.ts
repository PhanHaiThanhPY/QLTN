import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import {
  ChangePlanManagerDto,
  ChangeScheduleDto,
  CreateMaintenancePlanDto,
  ListMaintenancePlansQueryDto,
  MakeupOccurrenceDto,
  OccurrenceReasonDto,
  PlanReasonDto,
  PlanVersionDto,
  RescheduleOccurrenceDto,
  UpdateMaintenancePlanDto,
} from './dto/maintenance-plan.dto';
import type { MaintenancePlanView, OccurrenceView } from './maintenance-plan-views';
import { MaintenanceOccurrencesService } from './maintenance-occurrences.service';
import { MaintenancePlansService, type PlanDetailView, type PlanListRow } from './maintenance-plans.service';

/**
 * Maintenance plans and their scheduled occurrences (SPEC MT-S2). Writes carry no @RequireCapabilities: the services
 * check scope (404) before the capability and the plan manager (403).
 */
@ApiTags('Maintenance plans')
@ApiBearerAuth()
@Controller()
export class MaintenancePlansController {
  constructor(
    private readonly plans: MaintenancePlansService,
    private readonly occurrences: MaintenanceOccurrencesService,
  ) {}

  @Get('maintenance-plans')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Kế hoạch bảo trì trong phạm vi tòa (mặc định không gồm kế hoạch đã kết thúc)' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListMaintenancePlansQueryDto): Promise<PlanListRow[]> {
    return this.plans.list(user, query);
  }

  @Get('maintenance-plans/:id')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Trang kế hoạch: chu kỳ, lượt, kỳ bỏ qua, nhật ký' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<PlanDetailView> {
    return this.plans.getDetail(user, id);
  }

  @Post('maintenance-plans')
  @ApiOperation({ summary: 'Tạo kế hoạch (Nháp)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaintenancePlanDto): Promise<MaintenancePlanView> {
    return this.plans.create(user, dto);
  }

  @Patch('maintenance-plans/:id')
  @ApiOperation({ summary: 'Sửa kế hoạch (Nháp: mọi trường; Đang chạy/Tạm dừng: tên, danh mục, người, nhà thầu)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenancePlanDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.update(user, id, dto);
  }

  @Post('maintenance-plans/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kích hoạt kế hoạch nháp và sinh lượt' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanVersionDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.activate(user, id, dto);
  }

  @Post('maintenance-plans/:id/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tạm dừng (hủy các lượt đã lên lịch)' })
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanReasonDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.pause(user, id, dto);
  }

  @Post('maintenance-plans/:id/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chạy lại (ghi kỳ bỏ qua, sinh lượt từ hôm nay)' })
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanVersionDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.resume(user, id, dto);
  }

  @Post('maintenance-plans/:id/end')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kết thúc (hủy các lượt đã lên lịch, không chạy lại được)' })
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanReasonDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.end(user, id, dto);
  }

  @Post('maintenance-plans/:id/change-schedule')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi chu kỳ từ một ngày (đánh dấu lượt từ ngày đó)' })
  changeSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeScheduleDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.changeSchedule(user, id, dto);
  }

  @Post('maintenance-plans/:id/makeup')
  @ApiOperation({ summary: 'Tạo lượt bù' })
  makeup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MakeupOccurrenceDto,
  ): Promise<OccurrenceView> {
    return this.plans.makeup(user, id, dto);
  }

  @Post('maintenance-plans/:id/manager')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quản trị đổi người quản lý kế hoạch' })
  changeManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanManagerDto,
  ): Promise<MaintenancePlanView> {
    return this.plans.changeManager(user, id, dto);
  }

  @Post('maintenance-occurrences/:id/reschedule')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi lịch lượt (trước kỳ kế tiếp)' })
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleOccurrenceDto,
  ): Promise<OccurrenceView> {
    return this.occurrences.reschedule(user, id, dto);
  }

  @Post('maintenance-occurrences/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy lượt (lý do bắt buộc)' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OccurrenceReasonDto,
  ): Promise<OccurrenceView> {
    return this.occurrences.cancel(user, id, dto);
  }

  @Post('maintenance-occurrences/:id/keep')
  @HttpCode(200)
  @ApiOperation({ summary: 'Giữ lượt bị đánh dấu "Lịch đã đổi"' })
  keep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanVersionDto,
  ): Promise<OccurrenceView> {
    return this.occurrences.keep(user, id, dto);
  }
}
