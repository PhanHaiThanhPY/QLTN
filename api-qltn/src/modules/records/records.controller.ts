import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import { CreateRecordDto, SubmitRecordDto, UpdateRecordDraftDto, WithdrawRecordDto } from './dto/record.dto';
import { RecordsService, type RecordDetailView, type RepairRecordView } from './records.service';

@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

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
}
