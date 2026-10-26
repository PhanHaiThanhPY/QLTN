import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConstructionService } from './construction.service';
import {
  AcceptanceDecisionDto,
  SaveRepairEvidenceDto,
  StartConstructionDto,
  SubmitAcceptanceDto,
  UpdateConstructionDto,
} from './dto/construction.dto';
import type { RepairRecordView } from './record-view';

/**
 * Construction and acceptance actions T10–T16 (SPEC B03–B09 v2 S3), `POST /records/:id/<action>`. No
 * @RequireCapabilities: the service checks scope (404) before the capability, as for the other record actions.
 */
@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}

  @Post(':id/start-construction')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL bắt đầu thi công; BQT và TVKT nhận thông báo kế hoạch' })
  startConstruction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartConstructionDto,
  ): Promise<RepairRecordView> {
    return this.construction.start(user, id, dto);
  }

  @Post(':id/update-construction')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL cập nhật tiến độ thi công' })
  updateConstruction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConstructionDto,
  ): Promise<RepairRecordView> {
    return this.construction.update(user, id, dto);
  }

  @Post(':id/submit-acceptance')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL gửi nghiệm thu (tạo biên bản lượt mới)' })
  submitAcceptance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAcceptanceDto,
  ): Promise<RepairRecordView> {
    return this.construction.submitAcceptance(user, id, 'submitAcceptance', dto);
  }

  @Post(':id/pass-acceptance')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thành phần nghiệm thu chọn ĐẠT, kèm chữ ký' })
  passAcceptance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptanceDecisionDto,
  ): Promise<RepairRecordView> {
    return this.construction.decide(user, id, 'PASSED', dto);
  }

  @Post(':id/fail-acceptance')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thành phần nghiệm thu chọn KHÔNG ĐẠT, kèm điểm cần khắc phục và chữ ký' })
  failAcceptance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptanceDecisionDto,
  ): Promise<RepairRecordView> {
    return this.construction.decide(user, id, 'FAILED', dto);
  }

  @Post(':id/save-repair-evidence')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL lưu nội dung khắc phục' })
  saveRepairEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveRepairEvidenceDto,
  ): Promise<RepairRecordView> {
    return this.construction.saveRepairEvidence(user, id, dto);
  }

  @Post(':id/resubmit-acceptance')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL gửi nghiệm thu lại sau khắc phục (lượt mới)' })
  resubmitAcceptance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAcceptanceDto,
  ): Promise<RepairRecordView> {
    return this.construction.submitAcceptance(user, id, 'resubmitAcceptance', dto);
  }
}
