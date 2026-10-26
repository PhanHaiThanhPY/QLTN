import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CompleteRecordDto,
  ConfirmTransferDto,
  PaymentDecisionDto,
  PaymentFieldsDto,
  SubmitPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';
import type { RepairRecordView } from './record-view';

/**
 * Payment actions of SPEC B03–B09 v2 S4 (T17–T22, A1–A3), `POST /records/:id/<action>`. No @RequireCapabilities: the
 * service checks scope (404) before the capability, as for the other record actions.
 */
@ApiTags('Records')
@ApiBearerAuth()
@Controller('records')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/save-payment-draft')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL lưu nháp đề nghị quyết toán' })
  savePaymentDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentFieldsDto,
  ): Promise<RepairRecordView> {
    return this.payments.saveDraft(user, id, dto);
  }

  @Post(':id/submit-payment-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL gửi đề nghị quyết toán (số đợt = quyết toán − tạm ứng đã chuyển), kèm chữ ký' })
  submitPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPaymentDto,
  ): Promise<RepairRecordView> {
    return this.payments.submitSettlement(user, id, dto);
  }

  @Post(':id/approve-payment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước PAYMENT duyệt quyết toán' })
  approvePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    return this.payments.decideSettlement(user, id, 'APPROVED', dto);
  }

  @Post(':id/request-payment-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước PAYMENT trả đề nghị quyết toán (lý do)' })
  requestPaymentUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    return this.payments.decideSettlement(user, id, 'NEEDS_UPDATE', dto);
  }

  @Post(':id/confirm-payment-transfer')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQT/Kế toán xác nhận đã chuyển khoản quyết toán (một lần)' })
  confirmPaymentTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTransferDto,
  ): Promise<RepairRecordView> {
    return this.payments.confirmSettlementTransfer(user, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL đóng hồ sơ khi đã chuyển đủ số quyết toán' })
  completeRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRecordDto,
  ): Promise<RepairRecordView> {
    return this.payments.complete(user, id, dto);
  }

  @Post(':id/submit-advance-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL gửi đề nghị tạm ứng (một đợt mở tại một thời điểm)' })
  submitAdvanceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPaymentDto,
  ): Promise<RepairRecordView> {
    return this.payments.submitAdvance(user, id, dto);
  }

  @Post(':id/resubmit-advance-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQL gửi lại đợt tạm ứng cần bổ sung' })
  resubmitAdvanceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPaymentDto,
  ): Promise<RepairRecordView> {
    return this.payments.resubmitAdvance(user, id, dto);
  }

  @Post(':id/approve-advance')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước PAYMENT duyệt tạm ứng' })
  approveAdvance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    return this.payments.decideAdvance(user, id, 'APPROVED', dto);
  }

  @Post(':id/request-advance-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Người giữ bước PAYMENT trả đề nghị tạm ứng (lý do)' })
  requestAdvanceUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    return this.payments.decideAdvance(user, id, 'NEEDS_UPDATE', dto);
  }

  @Post(':id/confirm-advance-transfer')
  @HttpCode(200)
  @ApiOperation({ summary: 'BQT/Kế toán xác nhận đã chuyển khoản tạm ứng (một lần)' })
  confirmAdvanceTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTransferDto,
  ): Promise<RepairRecordView> {
    return this.payments.confirmAdvanceTransfer(user, id, dto);
  }
}
