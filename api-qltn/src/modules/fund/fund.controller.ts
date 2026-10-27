import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Available } from '../../domain/fund-ledger';
import {
  AdjustTaxDto,
  AvailableQueryDto,
  FundReasonDto,
  FundSetupDto,
  FundVersionDto,
  LedgerQueryDto,
  MonthQueryDto,
  PayVoucherDto,
  TaxObligationDto,
  TaxPaymentDto,
  UpdateVoucherDto,
  VoucherFieldsDto,
} from './dto/fund.dto';
import type { FundTaxObligation } from './entities/fund-tax-obligation.entity';
import type { FundTaxPayment } from './entities/fund-tax-payment.entity';
import type { FundVoucher } from './entities/fund-voucher.entity';
import type { FundView, LedgerPage } from './fund-views';
import { FundsService } from './funds.service';
import { TaxService, type TaxMonth } from './tax.service';
import { VouchersService, type VoucherCounts, type VoucherDetail } from './vouchers.service';

/**
 * The fund: account and opening, ledger, taxes, payment vouchers (SPEC F-S3). No route-level capability: the services
 * answer 404 out of scope, then 403 for the wrong role (BR-F3-14). Literal paths come before `:id` ones.
 */
@ApiTags('Funds')
@ApiBearerAuth()
@Controller('funds')
export class FundController {
  constructor(
    private readonly funds: FundsService,
    private readonly taxes: TaxService,
    private readonly vouchers: VouchersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Quỹ khai thác của các tòa trong phạm vi' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FundView[]> {
    return this.funds.list(user);
  }

  @Post('taxes/:id/adjust')
  @ApiOperation({ summary: 'Điều chỉnh số thuế (có lý do)' })
  adjustTax(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustTaxDto,
  ): Promise<FundTaxObligation> {
    return this.taxes.adjust(user, id, dto);
  }

  @Post('taxes/:id/payments')
  @ApiOperation({ summary: 'Ghi giấy nộp thuế (GNT)' })
  payTax(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaxPaymentDto,
  ): Promise<FundTaxPayment> {
    return this.taxes.pay(user, id, dto);
  }

  @Post('tax-payments/:id/cancel')
  @ApiOperation({ summary: 'Hủy giấy nộp thuế (thêm dòng đảo)' })
  cancelTaxPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundTaxPayment> {
    return this.taxes.cancelPayment(user, id, dto);
  }

  @Get('vouchers/:id')
  @ApiOperation({ summary: 'Phiếu chi' })
  voucher(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<VoucherDetail> {
    return this.vouchers.detail(user, id);
  }

  @Patch('vouchers/:id')
  @ApiOperation({ summary: 'Sửa phiếu chi nháp hoặc cần sửa' })
  updateVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ): Promise<FundVoucher> {
    return this.vouchers.update(user, id, dto);
  }

  @Post('vouchers/:id/submit')
  @ApiOperation({ summary: 'Gửi duyệt phiếu chi' })
  submitVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundVersionDto,
  ): Promise<FundVoucher> {
    return this.vouchers.submit(user, id, dto);
  }

  @Post('vouchers/:id/approve')
  @ApiOperation({ summary: 'BQT duyệt phiếu chi' })
  approveVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundVersionDto,
  ): Promise<FundVoucher> {
    return this.vouchers.approve(user, id, dto);
  }

  @Post('vouchers/:id/request-changes')
  @ApiOperation({ summary: 'BQT yêu cầu sửa phiếu chi' })
  requestVoucherChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundVoucher> {
    return this.vouchers.requestChanges(user, id, dto);
  }

  @Post('vouchers/:id/reject')
  @ApiOperation({ summary: 'BQT từ chối phiếu chi' })
  rejectVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundVoucher> {
    return this.vouchers.reject(user, id, dto);
  }

  @Post('vouchers/:id/pay')
  @ApiOperation({ summary: 'Ghi đã chi (sinh dòng sổ)' })
  payVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayVoucherDto,
  ): Promise<FundVoucher> {
    return this.vouchers.pay(user, id, dto);
  }

  @Post('vouchers/:id/cancel')
  @ApiOperation({ summary: 'Hủy phiếu chi; phiếu đã chi thì gửi BQT duyệt' })
  cancelVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundVoucher> {
    return this.vouchers.cancel(user, id, dto);
  }

  @Post('vouchers/:id/approve-cancel')
  @ApiOperation({ summary: 'BQT duyệt hủy phiếu đã chi (thêm dòng đảo)' })
  approveVoucherCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundVersionDto,
  ): Promise<FundVoucher> {
    return this.vouchers.approveCancel(user, id, dto);
  }

  @Post('vouchers/:id/reject-cancel')
  @ApiOperation({ summary: 'BQT từ chối hủy phiếu đã chi' })
  rejectVoucherCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundVoucher> {
    return this.vouchers.rejectCancel(user, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Quỹ: tài khoản và số dư đầu' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<FundView> {
    return this.funds.get(user, id);
  }

  @Put(':id/setup')
  @ApiOperation({ summary: 'Kế toán nhập tài khoản và số dư đầu' })
  setup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundSetupDto,
  ): Promise<FundView> {
    return this.funds.setup(user, id, dto);
  }

  @Post(':id/opening/approve')
  @ApiOperation({ summary: 'BQT duyệt đổi số dư đầu' })
  approveOpening(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundVersionDto,
  ): Promise<FundView> {
    return this.funds.approveOpening(user, id, dto);
  }

  @Post(':id/opening/reject')
  @ApiOperation({ summary: 'BQT từ chối đổi số dư đầu' })
  rejectOpening(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FundReasonDto,
  ): Promise<FundView> {
    return this.funds.rejectOpening(user, id, dto);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: 'Sổ quỹ một tháng, số liệu theo sổ' })
  ledger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LedgerQueryDto,
  ): Promise<LedgerPage> {
    return this.funds.ledgerPage(user, id, query);
  }

  @Get(':id/available')
  @ApiOperation({ summary: 'Số có thể chi tại một ngày mà không làm quỹ âm' })
  available(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailableQueryDto,
  ): Promise<Available> {
    return this.funds.available(user, id, query.date);
  }

  @Get(':id/taxes')
  @ApiOperation({ summary: 'Nghĩa vụ thuế và giấy nộp của một tháng' })
  taxMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MonthQueryDto,
  ): Promise<TaxMonth> {
    return this.taxes.month(user, id, query.month);
  }

  @Post(':id/taxes')
  @ApiOperation({ summary: 'Ghi nghĩa vụ thuế của tháng' })
  createTax(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaxObligationDto,
  ): Promise<FundTaxObligation> {
    return this.taxes.create(user, id, dto);
  }

  @Get(':id/vouchers')
  @ApiOperation({ summary: 'Phiếu chi của quỹ' })
  listVouchers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MonthQueryDto,
  ): Promise<{ rows: FundVoucher[]; counts: VoucherCounts }> {
    return this.vouchers.list(user, id, query.month);
  }

  @Post(':id/vouchers')
  @ApiOperation({ summary: 'Lập phiếu chi (nháp)' })
  createVoucher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoucherFieldsDto,
  ): Promise<FundVoucher> {
    return this.vouchers.create(user, id, dto);
  }
}
