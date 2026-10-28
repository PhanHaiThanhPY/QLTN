import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DepositBanksService, type BankView } from './deposit-banks.service';
import { DepositInvitationsService, type InvitationDetail, type InvitationRow } from './deposit-invitations.service';
import { DepositOffersService } from './deposit-offers.service';
import { DepositSelectionsService } from './deposit-selections.service';
import {
  BankFieldsDto,
  ChangeDepositSelectionDto,
  CreateInvitationDto,
  CreateOfferDto,
  DecideDepositSelectionDto,
  DepositSelectionFieldsDto,
  ExtendInvitationDto,
  ListBanksQueryDto,
  ListInvitationsQueryDto,
  ReasonDto,
  ResubmitDepositSelectionDto,
  SendInvitationDto,
  UpdateBankDto,
  UpdateInvitationDto,
  UpdateOfferDto,
  VersionDto,
} from './dto/deposit.dto';

/**
 * Maintenance fund deposits, T-S1 (SPEC T-chao-lai-chon-ngan-hang): banks, rate invitations, offers and the selected
 * bank. 404 out of building scope, then 403 for the wrong role (BR-T1-12). Writes on an invitation answer its page.
 */
@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('deposits')
export class DepositController {
  constructor(
    private readonly banks: DepositBanksService,
    private readonly invitations: DepositInvitationsService,
    private readonly offers: DepositOffersService,
    private readonly selections: DepositSelectionsService,
  ) {}

  @Get('banks')
  @ApiOperation({ summary: 'Danh mục ngân hàng' })
  listBanks(@CurrentUser() user: AuthenticatedUser, @Query() query: ListBanksQueryDto): Promise<BankView[]> {
    return this.banks.list(user, query);
  }

  @Post('banks')
  @ApiOperation({ summary: 'Thêm ngân hàng (NH-)' })
  createBank(@CurrentUser() user: AuthenticatedUser, @Body() dto: BankFieldsDto): Promise<BankView> {
    return this.banks.create(user, dto);
  }

  @Put('banks/:id')
  @ApiOperation({ summary: 'Sửa ngân hàng' })
  updateBank(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankDto,
  ): Promise<BankView> {
    return this.banks.update(user, id, dto);
  }

  @Post('banks/:id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ngừng dùng ngân hàng' })
  deactivateBank(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ): Promise<BankView> {
    return this.banks.deactivate(user, id, dto);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Thư mời chào lãi trong phạm vi tòa' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvitationsQueryDto): Promise<InvitationRow[]> {
    return this.invitations.list(user, query.buildingId);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Soạn thư mời chào lãi (MC-)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvitationDto): Promise<InvitationDetail> {
    const saved = await this.invitations.create(user, dto);
    return this.invitations.detail(user, saved.id);
  }

  @Get('invitations/:id')
  @ApiOperation({ summary: 'Trang thư mời: phản hồi, bản chào, so sánh, kết quả' })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<InvitationDetail> {
    return this.invitations.detail(user, id);
  }

  @Put('invitations/:id')
  @ApiOperation({ summary: 'Sửa thư mời' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvitationDto,
  ): Promise<InvitationDetail> {
    await this.invitations.update(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa thư nháp chưa từng gửi' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VersionDto,
  ): Promise<void> {
    return this.invitations.remove(user, id, query.version);
  }

  @Post('invitations/:id/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ghi nhận gửi thư mời' })
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendInvitationDto,
  ): Promise<InvitationDetail> {
    await this.invitations.send(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Post('invitations/:id/extend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gia hạn hạn phản hồi' })
  async extend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendInvitationDto,
  ): Promise<InvitationDetail> {
    await this.invitations.extend(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Post('invitations/:id/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đóng sớm khi mọi ngân hàng được mời đã có bản chào' })
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ): Promise<InvitationDetail> {
    await this.invitations.closeEarly(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Post('invitations/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy thư mời' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ): Promise<InvitationDetail> {
    await this.invitations.cancel(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Post('invitations/:id/offers')
  @ApiOperation({ summary: 'Ghi nhận bản chào' })
  async createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOfferDto,
  ): Promise<InvitationDetail> {
    await this.offers.create(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Put('offers/:id')
  @ApiOperation({ summary: 'Sửa bản chào' })
  async updateOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<InvitationDetail> {
    const offer = await this.offers.update(user, id, dto);
    return this.invitations.detail(user, offer.invitationId);
  }

  @Post('invitations/:id/selections')
  @ApiOperation({ summary: 'Đề xuất kết quả chọn ngân hàng (KQ-TG)' })
  async propose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositSelectionFieldsDto,
  ): Promise<InvitationDetail> {
    await this.selections.propose(user, id, dto);
    return this.invitations.detail(user, id);
  }

  @Post('selections/:id/resubmit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi lại kết quả cần sửa' })
  async resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResubmitDepositSelectionDto,
  ): Promise<InvitationDetail> {
    const selection = await this.selections.resubmit(user, id, dto);
    return this.invitations.detail(user, selection.invitationId);
  }

  @Post('selections/:id/change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đề xuất đổi kết quả đã duyệt' })
  async change(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDepositSelectionDto,
  ): Promise<InvitationDetail> {
    const selection = await this.selections.proposeChange(user, id, dto);
    return this.invitations.detail(user, selection.invitationId);
  }

  @Post('selections/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQT duyệt kết quả' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideDepositSelectionDto,
  ): Promise<InvitationDetail> {
    const selection = await this.selections.approve(user, id, dto);
    return this.invitations.detail(user, selection.invitationId);
  }

  @Post('selections/:id/request-changes')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQT yêu cầu sửa kết quả' })
  async requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ): Promise<InvitationDetail> {
    const selection = await this.selections.requestChanges(user, id, dto);
    return this.invitations.detail(user, selection.invitationId);
  }

  @Post('selections/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQT từ chối kết quả' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ): Promise<InvitationDetail> {
    const selection = await this.selections.reject(user, id, dto);
    return this.invitations.detail(user, selection.invitationId);
  }
}
