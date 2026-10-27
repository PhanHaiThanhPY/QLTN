import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Trim } from '../../../common/validation/trim.decorator';

/**
 * Proposal fields of T04–T06 (SPEC B03–B09 v2 §4.1, §4.2). Shapes are checked here; contents, bounds and
 * completeness are checked in the service so errors carry indexed paths such as `items.0.quantity`.
 */
export class SaveProposalDraftDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ description: 'Kính gửi; mặc định "Ban quản trị tòa «tên tòa»".' })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({ description: 'Người lập; mặc định người trình.' })
  @IsOptional()
  @IsString()
  preparedByName?: string;

  @ApiPropertyOptional({ enum: ['SUA_CHUA', 'THAY_THE', 'KHAC'] })
  @IsOptional()
  @IsString()
  proposalType?: string;

  @ApiPropertyOptional({ enum: ['KINH_PHI_BAO_TRI', 'KINH_PHI_VAN_HANH', 'KHAC'] })
  @IsOptional()
  @IsString()
  budgetSource?: string;

  @ApiPropertyOptional({ description: 'Nội dung xin phê duyệt (10–2000 ký tự khi trình).' })
  @IsOptional()
  @IsString()
  requestContent?: string;

  @ApiPropertyOptional({ description: 'Đề xuất và đánh giá (10–2000 ký tự khi trình).' })
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-15' })
  @IsOptional()
  @IsString()
  desiredApprovalDate?: string | null;

  @ApiPropertyOptional({
    description: 'Hạng mục dùng chung: [{ name, unit, quantity: "1.5" }] (1–50).',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  items?: unknown[];

  @ApiPropertyOptional({
    description:
      'Nhà thầu (1–5): [{ name, unitPricesVnd: ["333333", …], otherCostVnd, taxVnd, quotationAttachmentIds }].',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  contractors?: unknown[];

  @ApiPropertyOptional({ description: 'Chỉ số (từ 0) của nhà thầu đề xuất.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proposedContractorIndex?: number;

  @ApiPropertyOptional({ description: 'Lý do không đủ 3 báo giá (10–1000 ký tự, bắt buộc khi dưới 3 nhà thầu).' })
  @IsOptional()
  @IsString()
  shortfallReason?: string;

  @ApiPropertyOptional({ type: [String], description: 'Biên bản ghi nhận sự việc (mục đích INCIDENT_MINUTES).' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  incidentAttachmentIds?: string[];
}

/** T05/T06: optional last edits plus the submitter's signature (PNG data URL). */
export class SubmitProposalDto extends SaveProposalDraftDto {
  @ApiProperty({ description: 'Chữ ký người trình: data:image/png;base64,… (≤ 200 KB).' })
  @IsString()
  signature: string;

  @ApiPropertyOptional({ description: 'Hồ sơ khẩn cấp nộp sau hạn bổ sung: lý do trễ (5–1000 ký tự), B06-S1 BR-E-05.' })
  @IsOptional()
  @Trim()
  @IsString()
  lateReason?: string;
}

/** Common body of T07–T09. */
class ProposalDecisionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ description: 'Lần trình màn hình đang xem; khác lần trình hiện hành thì 409.' })
  @IsOptional()
  @IsUUID()
  submissionId?: string;

  @ApiPropertyOptional({ description: 'Chữ ký người giữ bước BQT (bắt buộc khi duyệt/từ chối ở bước BQT).' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ type: [String], description: 'Biên bản họp BQT của lần trình hiện hành (BR-S2-05).' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  boardMinutesAttachmentIds?: string[];
}

export class ApproveProposalDto extends ProposalDecisionDto {
  @ApiPropertyOptional({ description: 'Bước cuối: chỉ số nhà thầu được chọn (mặc định nhà thầu đề xuất).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  selectedContractorIndex?: number;

  @ApiPropertyOptional({ description: 'Lý do chọn khác nhà thầu đề xuất (5–1000 ký tự).' })
  @IsOptional()
  @Trim()
  @IsString()
  selectionReason?: string;
}

export class ProposalReasonDto extends ProposalDecisionDto {
  @ApiProperty({ description: 'Lý do (5–1000 ký tự).' })
  @Trim()
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'T09 trên hồ sơ khẩn cấp: người giữ bước BQT không duyệt hậu kiểm (kết thúc), B06-S1 BR-E-07.',
  })
  @IsOptional()
  @IsBoolean()
  finalPostReview?: boolean;
}
