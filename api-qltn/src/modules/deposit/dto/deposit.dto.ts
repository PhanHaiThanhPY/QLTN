import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';
import { ReasonDto, VersionDto } from '../../exploitation/dto/exploitation.dto';

export { ReasonDto, VersionDto };

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/** BR-T1-01. */
export class BankFieldsDto {
  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  name: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 20, example: 'VCB' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  shortName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  branch?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  contactName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  email?: string | null;
}

export class UpdateBankDto extends BankFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

export class ListBanksQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}

/** BR-T1-03: the fund is the building's maintenance fund; it never changes after creation. */
export class InvitationFieldsDto {
  @ApiProperty({ example: '1000000000', description: 'Số nguyên VND.' })
  @Trim()
  @IsString()
  amountVnd: string;

  @ApiProperty({ example: 90, description: 'Kỳ hạn tính bằng ngày, 7–3.650 (D-T1-5).' })
  @Type(() => Number)
  @IsInt()
  termDays: number;

  @ApiPropertyOptional({ nullable: true, example: '2026-08-27T17:00:00+07:00' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  deadlineAt?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-01' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  expectedDepositOn?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  conditions?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsUUID()
  letterAttachmentId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  inviteeIds?: string[];
}

export class CreateInvitationDto extends InvitationFieldsDto {
  @ApiProperty()
  @IsUUID()
  buildingId: string;
}

export class UpdateInvitationDto extends InvitationFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

export class SendInvitationDto extends VersionDto {
  @ApiProperty({ example: '2026-08-25', description: 'Ngày BQL đã gửi thư, không sau hôm nay.' })
  @Trim()
  @IsString()
  sentOn: string;
}

export class ExtendInvitationDto extends ReasonDto {
  @ApiProperty({ example: '2026-08-29T17:00:00+07:00' })
  @Trim()
  @IsString()
  deadlineAt: string;
}

export class ListInvitationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;
}

/** BR-T1-06: the rate as typed ("5,875"), at most 3 decimals; stored in thousandths of a percent. */
export class OfferFieldsDto {
  @ApiProperty({ example: '2026-08-26T10:00:00+07:00' })
  @Trim()
  @IsString()
  receivedAt: string;

  @ApiProperty({ example: '5,875' })
  @Trim()
  @IsString()
  rate: string;

  @ApiProperty({ enum: [360, 365] })
  @Type(() => Number)
  @IsInt()
  dayBasis: number;

  @ApiProperty({ enum: ['END', 'PERIODIC'] })
  @IsIn(['END', 'PERIODIC'])
  paymentKind: 'END' | 'PERIODIC';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  paymentEvery?: number | null;

  @ApiPropertyOptional({ nullable: true, enum: ['MONTH', 'DAY'] })
  @IsOptional()
  @IsIn(['MONTH', 'DAY'])
  paymentUnit?: 'MONTH' | 'DAY' | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  conditions?: string | null;

  @ApiProperty()
  @IsUUID()
  attachmentId: string;

  @ApiProperty({ enum: ['COMPLETE', 'INCOMPLETE'] })
  @IsIn(['COMPLETE', 'INCOMPLETE'])
  completeness: 'COMPLETE' | 'INCOMPLETE';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  missingNote?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Bắt buộc khi ngân hàng không có trong danh sách mời.' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  outsideReason?: string | null;
}

export class CreateOfferDto extends OfferFieldsDto {
  @ApiProperty()
  @IsUUID()
  bankId: string;
}

export class UpdateOfferDto extends OfferFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

/** BR-T1-09: a bank (one complete offer) or "Không chọn được ngân hàng". */
export class DepositSelectionFieldsDto {
  @ApiProperty({ enum: ['BANK', 'NONE'] })
  @IsIn(['BANK', 'NONE'])
  kind: 'BANK' | 'NONE';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsUUID()
  offerId?: string | null;

  @ApiProperty()
  @IsUUID()
  minutesAttachmentId: string;

  @ApiProperty({ minLength: 20 })
  @Trim()
  @IsString()
  basis: string;

  @ApiPropertyOptional({ nullable: true, description: 'Bắt buộc khi không chọn bản có lãi cả kỳ cao nhất.' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  notHighestReason?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Bắt buộc khi chọn bản chào trễ hạn.' })
  @IsOptional()
  @TrimToNull()
  @IsString()
  lateReason?: string | null;
}

export class ResubmitDepositSelectionDto extends DepositSelectionFieldsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  version: number;
}

export class ChangeDepositSelectionDto extends ResubmitDepositSelectionDto {
  @ApiProperty({ minLength: 20 })
  @Trim()
  @IsString()
  changeReason: string;
}

export class DecideDepositSelectionDto extends VersionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  reason?: string | null;
}
