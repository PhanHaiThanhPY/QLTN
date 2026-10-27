import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import {
  ConfirmDto,
  ListOccurrencesQueryDto,
  ReassignOccurrenceDto,
  RepairFromItemDto,
  ReworkDto,
  WorkDto,
} from './dto/maintenance-execution.dto';
import { PlanVersionDto } from './dto/maintenance-plan.dto';
import { MaintenanceExecutionService } from './maintenance-execution.service';
import { OccurrenceQueriesService, type OccurrenceDetailView, type OccurrenceList } from './occurrence-queries.service';
import { RepairFromItemService, type RepairFromItemResult } from './repair-from-item.service';

/**
 * Running an occurrence (SPEC MT-S3). Writes carry no route-level capability: the services answer 404 out of scope,
 * then 403 for anyone but the step's person (BR-MT3-13). Each write answers the occurrence page as it now is.
 */
@ApiTags('Maintenance occurrences')
@ApiBearerAuth()
@Controller('maintenance-occurrences')
export class MaintenanceOccurrencesController {
  constructor(
    private readonly execution: MaintenanceExecutionService,
    private readonly queries: OccurrenceQueriesService,
    private readonly repairs: RepairFromItemService,
  ) {}

  @Get()
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Lượt bảo trì (Việc của tôi / Tất cả) kèm thẻ số tính ở máy chủ' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOccurrencesQueryDto): Promise<OccurrenceList> {
    return this.queries.list(user, query);
  }

  @Get(':id')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Trang lượt: kết quả đang điền, các lần gửi, hồ sơ sửa chữa liên kết, tệp, nhật ký' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<OccurrenceDetailView> {
    return this.queries.getDetail(user, id);
  }

  @Post(':id/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bắt đầu (người thực hiện, từ 3 ngày trước ngày lịch)' })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanVersionDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.start(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/save')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lưu kết quả đang điền' })
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.saveWork(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi kết quả (tạo một lần gửi không sửa được)' })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.submit(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/rework')
  @HttpCode(200)
  @ApiOperation({ summary: 'Yêu cầu làm lại từng mục (người xác nhận)' })
  async rework(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReworkDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.requestRework(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận hoàn thành (mỗi mục lỗi cần hồ sơ hoặc hướng xử lý)' })
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.confirm(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Giao lại người thực hiện hoặc người xác nhận (BQL quản lý kế hoạch)' })
  async reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignOccurrenceDto,
  ): Promise<OccurrenceDetailView> {
    await this.execution.reassign(user, id, dto);
    return this.queries.getDetail(user, id);
  }

  @Post(':id/repairs')
  @ApiOperation({ summary: 'Tạo hồ sơ sửa chữa (Nháp) từ một mục lỗi' })
  createRepair(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairFromItemDto,
  ): Promise<RepairFromItemResult> {
    return this.repairs.create(user, id, dto);
  }
}
