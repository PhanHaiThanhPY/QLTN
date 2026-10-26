import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApproveProposalDto, ProposalReasonDto, SaveProposalDraftDto, SubmitProposalDto } from './dto/proposal.dto';
import { ProposalsService } from './proposals.service';
import type { RepairRecordView } from './record-view';

/**
 * Proposal actions T04–T09 (SPEC B03–B09 v2 S2), `POST /records/:id/<action>`. No @RequireCapabilities: the service
 * checks scope (404) before the capability, as for the confirmer actions.
 */
@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Post(':id/save-proposal-draft')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL lưu nháp tờ trình và bảng báo giá (giữ trạng thái)' })
  saveProposalDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveProposalDraftDto,
  ): Promise<RepairRecordView> {
    return this.proposals.saveDraft(user, id, dto);
  }

  @Post(':id/submit-proposal')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL trình tờ trình lần đầu, kèm chữ ký (bắt đầu chuỗi duyệt)' })
  submitProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitProposalDto,
  ): Promise<RepairRecordView> {
    return this.proposals.submit(user, id, 'submitProposal', dto);
  }

  @Post(':id/resubmit-proposal')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL trình lại sau khi bị yêu cầu bổ sung hoặc từ chối (tối đa 3 lần)' })
  resubmitProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitProposalDto,
  ): Promise<RepairRecordView> {
    return this.proposals.submit(user, id, 'resubmitProposal', dto);
  }

  @Post(':id/approve-proposal')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước duyệt tờ trình (BQT: kèm biên bản họp và chữ ký)' })
  approveProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveProposalDto,
  ): Promise<RepairRecordView> {
    return this.proposals.approve(user, id, dto);
  }

  @Post(':id/request-proposal-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước yêu cầu bổ sung tờ trình (không áp dụng ở lần trình thứ 3)' })
  requestProposalUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProposalReasonDto,
  ): Promise<RepairRecordView> {
    return this.proposals.requestUpdate(user, id, dto);
  }

  @Post(':id/reject-proposal')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước từ chối tờ trình (lần 3 → Chưa xử lý)' })
  rejectProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProposalReasonDto,
  ): Promise<RepairRecordView> {
    return this.proposals.reject(user, id, dto);
  }
}
