import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { ListRecordsQueryDto } from './dto/list-records-query.dto';
import { RecordSummaryQueryDto } from './dto/record-summary-query.dto';
import {
  ConfirmRecordDto,
  CreateRecordDto,
  SubmitRecordDto,
  UpdateRecordDraftDto,
  WithdrawRecordDto,
} from './dto/record.dto';
import {
  RecordsService,
  type RecordDetailView,
  type RecordSummaryView,
  type RepairRecordView,
} from './records.service';

@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Danh sách hồ sơ trong phạm vi tòa (phân trang, tìm, lọc ở máy chủ)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRecordsQueryDto,
  ): Promise<PaginatedResult<RepairRecordView>> {
    return this.records.list(user, query);
  }

  @Get('summary')
  @RequireCapabilities('VIEW')
  @ApiOperation({ summary: 'Số đếm cho hàng thẻ đầu danh sách hồ sơ (một truy vấn, phạm vi tòa)' })
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: RecordSummaryQueryDto): Promise<RecordSummaryView> {
    return this.records.summary(user, query);
  }

  @Post()
  @RequireCapabilities('RECORD_EDIT')
  @ApiOperation({ summary: 'Tạo hồ sơ sửa chữa (nháp), chụp cấu hình tòa lúc tạo' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecordDto): Promise<RepairRecordView> {
    return this.records.create(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ kèm lịch sử thao tác' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecordDetailView> {
    return this.records.getDetail(user, id);
  }

  @Patch(':id')
  @RequireCapabilities('RECORD_EDIT')
  @ApiOperation({ summary: 'Lưu nháp hồ sơ (kèm version)' })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecordDraftDto,
  ): Promise<RepairRecordView> {
    return this.records.updateDraft(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequireCapabilities('RECORD_EDIT')
  @ApiOperation({ summary: 'Gửi hồ sơ nháp cho người xác nhận (kèm version)' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitRecordDto,
  ): Promise<RepairRecordView> {
    return this.records.submit(user, id, dto);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RequireCapabilities('RECORD_EDIT')
  @ApiOperation({ summary: 'Rút hồ sơ còn xử lý (lý do bắt buộc, kèm version)' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawRecordDto,
  ): Promise<RepairRecordView> {
    return this.records.withdraw(user, id, dto);
  }

  // The confirmer actions carry no @RequireCapabilities: the service checks scope (404) before the
  // capability, and a missing RECORD_CONFIRM answers 403 with `details.reason = missing_capability`.
  @Post(':id/request-record-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kỹ thuật trả hồ sơ để BQL bổ sung (ghi chú lý do, kèm version)' })
  requestRecordUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRecordDto,
  ): Promise<RepairRecordView> {
    return this.records.confirm(user, id, 'requestRecordUpdate', dto);
  }

  @Post(':id/confirm-repair')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kỹ thuật xác nhận cần sửa (kết luận hiện trạng, kèm version)' })
  confirmRepair(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRecordDto,
  ): Promise<RepairRecordView> {
    return this.records.confirm(user, id, 'confirmRepair', dto);
  }

  @Post(':id/close-no-repair')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kỹ thuật đóng hồ sơ vì không cần sửa (ghi chú lý do, kèm version)' })
  closeNoRepair(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRecordDto,
  ): Promise<RepairRecordView> {
    return this.records.confirm(user, id, 'closeNoRepair', dto);
  }
}
