import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class VersionedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

/**
 * Instalment fields (SPEC B03–B09 v2 §4.4). Shapes are checked here; bounds, completeness and money rules in the
 * service, so a draft (T17) may leave any of them out.
 */
export class PaymentFieldsDto extends VersionedDto {
  @ApiPropertyOptional({ description: 'Tạm ứng: số tiền đợt. Quyết toán: số quyết toán. Số nguyên VND dạng chuỗi.' })
  @IsOptional()
  @IsString()
  amountVnd?: string;

  @ApiPropertyOptional({ description: 'Tên tài khoản người hưởng.' })
  @IsOptional()
  @Trim()
  @IsString()
  payeeName?: string;

  @ApiPropertyOptional({ description: 'Số tài khoản (6–20 chữ số).' })
  @IsOptional()
  @Trim()
  @IsString()
  accountNo?: string;

  @ApiPropertyOptional({ description: 'Ngân hàng.' })
  @IsOptional()
  @Trim()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Nội dung chuyển khoản (≤ 210); mặc định "BQT «tòa» THANH TOAN CHI PHI «hồ sơ»".',
  })
  @IsOptional()
  @Trim()
  @IsString()
  transferContent?: string;

  @ApiPropertyOptional({ type: [String], description: 'Đề nghị của nhà thầu (PAYMENT_REQUEST).' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  requestAttachmentIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Quyết toán: hóa đơn GTGT (INVOICE).' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  invoiceAttachmentIds?: string[];
}

/** T18, A1, A1b: the fields plus the manager's signature (PNG data URL). */
export class SubmitPaymentDto extends PaymentFieldsDto {
  @ApiProperty({ description: 'Chữ ký BQL: data:image/png;base64,… (≤ 200 KB).' })
  @IsString()
  signature: string;
}

/** T19/T20, A2: a PAYMENT step decision; `reason` is required to ask for an update. */
export class PaymentDecisionDto extends VersionedDto {
  @ApiPropertyOptional({ description: 'Đợt màn hình đang xem; khác đợt đang chờ thì 409.' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Lý do (5–1000 ký tự) khi trả đề nghị.' })
  @IsOptional()
  @Trim()
  @IsString()
  reason?: string;
}

/** T21, A3: the transfer of the instalment waiting for it (BR-S4-06). */
export class ConfirmTransferDto extends VersionedDto {
  @ApiPropertyOptional({ description: 'Đợt màn hình đang xem; khác đợt đang chờ chuyển khoản thì 409.' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiProperty({ description: 'Số tiền đã chuyển, phải bằng số của đợt.' })
  @IsString()
  amountVnd: string;

  @ApiProperty({ example: '2026-10-26' })
  @IsISO8601({ strict: true })
  @Matches(ISO_DATE)
  transferDate: string;

  @ApiProperty({ description: 'Mã tham chiếu giao dịch (≤ 100 ký tự).' })
  @Trim()
  @IsString()
  reference: string;

  @ApiProperty({ type: [String], description: 'Chứng từ chuyển khoản (PAYMENT_PROOF), ít nhất 1.' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  proofAttachmentIds: string[];
}

/** T22. */
export class CompleteRecordDto extends VersionedDto {}
