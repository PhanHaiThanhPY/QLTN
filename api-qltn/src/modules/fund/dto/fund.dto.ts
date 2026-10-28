import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';
import { LEDGER_CATEGORIES, type LedgerCategory } from '../entities/fund-ledger-entry.entity';
import { VOUCHER_CATEGORIES, type VoucherCategory } from '../entities/fund-voucher.entity';

/*
 * Amounts, dates and lengths are checked in the services so each refusal is a field error with the screen's wording
 * (SPEC F-S3 §3); the DTOs only fix the types. Money travels as a string of digits (integer VND).
 */

export class FundVersionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

export class FundReasonDto extends FundVersionDto {
  @ApiProperty()
  @Trim()
  @IsString()
  reason: string;
}

export class FundSetupDto extends FundVersionDto {
  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  bankName: string;

  @ApiProperty({ maxLength: 40 })
  @Trim()
  @IsString()
  accountNo: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  accountHolder: string;

  @ApiProperty({ example: '2026-11-01' })
  @Trim()
  @IsString()
  openingDate: string;

  @ApiProperty({ example: '50000000', description: 'Số dư theo sao kê đầu ngày bắt đầu sổ' })
  @Trim()
  @IsString()
  openingBalanceVnd: string;

  @ApiPropertyOptional({ nullable: true, description: 'Bắt buộc khi đổi số dư đầu đã có' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  reason?: string | null;
}

export class LedgerQueryDto {
  @ApiProperty({ example: '2026-11' })
  @Trim()
  @IsString()
  month: string;

  @ApiPropertyOptional({ enum: LEDGER_CATEGORIES })
  @IsOptional()
  @IsIn(LEDGER_CATEGORIES)
  category?: LedgerCategory;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';
}

export class AvailableQueryDto {
  @ApiProperty({ example: '2026-11-23' })
  @Trim()
  @IsString()
  date: string;
}

export class MonthQueryDto {
  @ApiProperty({ example: '2026-11' })
  @Trim()
  @IsString()
  month: string;
}

export class TaxObligationDto {
  @ApiProperty({ example: '2026-11' })
  @Trim()
  @IsString()
  month: string;

  @ApiProperty({ example: '2000000' })
  @Trim()
  @IsString()
  amountVnd: string;

  @ApiPropertyOptional({ nullable: true, description: 'Hồ sơ kế toán (TAX_FILING của quỹ)' })
  @IsOptional()
  @IsUUID()
  attachmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  note?: string | null;
}

export class AdjustTaxDto extends FundReasonDto {
  @ApiProperty({ example: '2500000' })
  @Trim()
  @IsString()
  amountVnd: string;
}

export class TaxPaymentDto {
  @ApiProperty({ example: '2026-11-22' })
  @Trim()
  @IsString()
  paidOn: string;

  @ApiProperty({ example: '2000000' })
  @Trim()
  @IsString()
  amountVnd: string;

  @ApiProperty({ description: 'Giấy nộp tiền (TAX_PAYMENT_SLIP của quỹ)' })
  @IsUUID()
  attachmentId: string;
}

export class VoucherFieldsDto {
  @ApiProperty({ enum: VOUCHER_CATEGORIES })
  @IsIn(VOUCHER_CATEGORIES)
  category: VoucherCategory;

  @ApiPropertyOptional({ nullable: true, enum: ['BAO_TRI'], description: 'Quỹ nhận khi chuyển quỹ' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  targetFundKind?: string | null;

  @ApiProperty({ minLength: 10 })
  @Trim()
  @IsString()
  content: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  payeeName: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  payeeAccount?: string | null;

  @ApiProperty({ example: '3000000' })
  @Trim()
  @IsString()
  amountVnd: string;

  @ApiProperty({ description: 'Đề nghị chi (VOUCHER_REQUEST của quỹ)' })
  @IsUUID()
  requestAttachmentId: string;
}

export class UpdateVoucherDto extends VoucherFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

export class PayVoucherDto extends FundVersionDto {
  @ApiProperty({ example: '2026-11-23' })
  @Trim()
  @IsString()
  paidOn: string;

  @ApiProperty({ description: 'Chứng từ chuyển khoản (VOUCHER_PROOF của quỹ)' })
  @IsUUID()
  proofAttachmentId: string;
}

/** F-S4 BR-F4-01: multipart fields of an import (with `file`), or typed lines as JSON in `lines`. */
export class StatementImportDto {
  @ApiProperty({ example: '2026-11-01' })
  @Trim()
  @IsString()
  periodFrom: string;

  @ApiProperty({ example: '2026-11-30' })
  @Trim()
  @IsString()
  periodTo: string;

  @ApiProperty({ example: '50000000', description: 'Số dư đầu kỳ theo ngân hàng' })
  @Trim()
  @IsString()
  openingBalanceVnd: string;

  @ApiProperty({ example: '60000000', description: 'Số dư cuối kỳ theo ngân hàng' })
  @Trim()
  @IsString()
  closingBalanceVnd: string;

  @ApiPropertyOptional({ description: 'JSON: [{ date: "dd/mm/yyyy", credit, debit, description, reference }]' })
  @IsOptional()
  @IsString()
  lines?: string;
}

export class MatchDto {
  @ApiProperty()
  @IsUUID()
  entryId: string;

  @ApiPropertyOptional({ nullable: true, description: 'Bắt buộc khi lệch quá 5 ngày' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  reason?: string | null;
}

export class StatementReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  reason: string;
}

export class RecordFromStatementDto {
  @ApiProperty({ enum: ['BANK_FEE', 'INTEREST'] })
  @IsIn(['BANK_FEE', 'INTEREST'])
  kind: 'BANK_FEE' | 'INTEREST';
}

export class CandidatesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entryId?: string;
}
