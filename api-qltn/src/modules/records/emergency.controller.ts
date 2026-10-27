import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClosePostReviewRejectedDto, StartEmergencyRepairDto } from './dto/emergency.dto';
import { EmergencyService } from './emergency.service';
import type { RepairRecordView } from './record-view';

/**
 * Emergency repair E-T1 and E-T2 (SPEC B06-S1), `POST /records/:id/<action>`. No @RequireCapabilities: the service
 * checks scope (404) before the capability, as for the other record actions.
 */
@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post(':id/start-emergency-repair')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL cho xử lý khẩn cấp trong hạn mức của tòa; người duyệt nhận thông báo' })
  startEmergencyRepair(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartEmergencyRepairDto,
  ): Promise<RepairRecordView> {
    return this.emergency.start(user, id, dto);
  }

  @Post(':id/close-post-review-rejected')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước BQT ghi quyết định xử lý chi phí và đóng hồ sơ không được duyệt hậu kiểm' })
  closePostReviewRejected(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClosePostReviewRejectedDto,
  ): Promise<RepairRecordView> {
    return this.emergency.closePostReviewRejected(user, id, dto);
  }
}
