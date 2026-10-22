import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation/trim.decorator';
import {
  CONFIG_LIMITS,
  CONFIG_TEMPLATES,
  WORKFLOW_STAGE_KEYS,
  type WorkflowStageKey,
} from '../../../domain/building-config';
import { type Role, ROLES } from '../../../domain/permissions';

const STEP_KEY = /^[A-Z][A-Z0-9_]{1,39}$/;
const DUE_MAX = CONFIG_LIMITS.DUE_DAYS_MAX;

class DueDayDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(DUE_MAX) CONFIRM_RECORD: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(DUE_MAX) APPROVE_PROPOSAL: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(DUE_MAX) REVIEW_ACCEPTANCE: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(DUE_MAX) APPROVE_PAYMENT: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(DUE_MAX) REVIEW_MAINTENANCE: number;
}

export class ApprovalStepDto {
  @ApiProperty({ example: 'TECH' })
  @Matches(STEP_KEY)
  key: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(2, 80)
  label: string;

  @ApiPropertyOptional({ description: 'Nhãn ngắn của người duyệt; mặc định theo vai trò' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  actor?: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleDefId?: string;
}

class StepBindingDto {
  @Matches(STEP_KEY)
  businessStepKey: string;

  @IsOptional()
  @Matches(STEP_KEY)
  approvalStepKey?: string;
}

export class WorkflowStageDto {
  @ApiProperty({ enum: WORKFLOW_STAGE_KEYS })
  @IsIn(WORKFLOW_STAGE_KEYS)
  key: WorkflowStageKey;

  @Trim()
  @IsString()
  @Length(2, 120)
  label: string;

  @Trim()
  @IsString()
  @MaxLength(500)
  description: string;

  @IsArray()
  @ArrayMaxSize(20)
  @Matches(STEP_KEY, { each: true })
  approvalStepKeys: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @Matches(STEP_KEY, { each: true })
  businessStepKeys: string[];

  @ApiPropertyOptional({ description: 'Mặc định: suy ra từ businessStepKeys' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StepBindingDto)
  stepBindings?: StepBindingDto[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AssignmentRuleDto {
  @IsUUID()
  departmentId: string;

  @IsIn(ROLES)
  role: Role;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  locationIds?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority: number;
}

/**
 * Configuration values. The workflow parts (steps, stages, rules, chain) are optional:
 * when omitted the building keeps its current ones.
 */
export class ConfigValuesDto {
  @ApiPropertyOptional({ nullable: true, enum: CONFIG_TEMPLATES.map((t) => t.key) })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30)
  templateKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  workflowName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  workflowDescription?: string | null;

  @ApiProperty({ type: DueDayDto })
  @ValidateNested()
  @Type(() => DueDayDto)
  taskDueDays: DueDayDto;

  @ApiPropertyOptional({ type: [String], example: ['TECH', 'BOARD'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(STEP_KEY, { each: true })
  approvalStepKeys?: string[];

  @ApiPropertyOptional({ type: [ApprovalStepDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  workflowApprovalSteps?: ApprovalStepDto[];

  @ApiPropertyOptional({ type: [WorkflowStageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(WORKFLOW_STAGE_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageDto)
  workflowStages?: WorkflowStageDto[];

  @ApiPropertyOptional({ type: [AssignmentRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AssignmentRuleDto)
  assignmentRules?: AssignmentRuleDto[];

  @ApiProperty({ example: '20000000', description: 'VND, số nguyên dương dạng chuỗi' })
  @Matches(/^[1-9]\d{0,14}$/)
  emergencyLimitVnd: string;

  @Type(() => Number)
  @IsInt()
  @Min(CONFIG_LIMITS.EMERGENCY_HOURS_MIN)
  @Max(CONFIG_LIMITS.EMERGENCY_HOURS_MAX)
  emergencyDocHours: number;

  @Type(() => Number)
  @IsInt()
  @Min(CONFIG_LIMITS.RECENT_DAYS_MIN)
  @Max(CONFIG_LIMITS.RECENT_DAYS_MAX)
  recentRepairDays: number;

  @Type(() => Number)
  @IsInt()
  @Min(CONFIG_LIMITS.REPEAT_MIN)
  @Max(CONFIG_LIMITS.REPEAT_MAX)
  repeatMinRecords: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(CONFIG_LIMITS.PRICE_RATIO_MIN)
  @Max(CONFIG_LIMITS.PRICE_RATIO_MAX)
  priceRatio: number;
}

export class UpdateBuildingConfigDto extends ConfigValuesDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

class WorkflowTargetDto {
  @IsUUID()
  buildingId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ValidateNested()
  @Type(() => ConfigValuesDto)
  values: ConfigValuesDto;
}

export class BulkWorkflowUpdateDto {
  @ApiProperty({ type: [WorkflowTargetDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTargetDto)
  targets: WorkflowTargetDto[];
}

export class ApplyTemplateDto {
  @ApiPropertyOptional({ enum: CONFIG_TEMPLATES.map((t) => t.key) })
  @IsOptional()
  @IsIn(CONFIG_TEMPLATES.map((t) => t.key))
  templateKey?: string;

  @ApiPropertyOptional({ description: 'Sao chép cấu hình từ tòa khác (trong phạm vi)' })
  @IsOptional()
  @IsUUID()
  sourceBuildingId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
