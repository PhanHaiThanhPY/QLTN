import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { fieldError } from '../../common/validation/field-errors';
import type { UploadedFileLike } from '../attachments/uploaded-file';
import {
  CandidatesQueryDto,
  MatchDto,
  MonthQueryDto,
  RecordFromStatementDto,
  StatementImportDto,
  StatementReasonDto,
} from './dto/fund.dto';
import type { BankMatch } from './entities/bank-match.entity';
import type { BankStatementImport } from './entities/bank-statement-import.entity';
import { ReconciliationService, type Candidate, type ReconciliationMonth } from './reconciliation.service';
import { STATEMENT_FILE_MAX_BYTES, statementTemplateCsv } from './statement-file';
import { StatementsService, type StatementInput, type StatementPreview } from './statements.service';

/** Above the 5 MB statement limit so the refusal stays a 400 on `file`. */
const MEMORY_FILE_LIMIT = 2 * STATEMENT_FILE_MAX_BYTES;

const inputOf = (dto: StatementImportDto, file: UploadedFileLike | undefined): StatementInput => {
  let lines: StatementInput['lines'];
  if (dto.lines) {
    try {
      const parsed: unknown = JSON.parse(dto.lines);
      if (!Array.isArray(parsed)) throw new Error('not a list');
      lines = parsed.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
    } catch {
      throw fieldError('lines', 'Danh sách dòng nhập tay không hợp lệ.');
    }
  }
  return {
    ...dto,
    lines,
    file: file ? { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype } : undefined,
  };
};

/**
 * Bank statements and reconciliation of a fund's account (SPEC F-S4). Kind-neutral routes under /funds (DF-26). The
 * services answer 404 out of scope, then 403 for the wrong role (BR-F4-12).
 */
@ApiTags('Fund statements')
@ApiBearerAuth()
@Controller('funds')
export class StatementsController {
  constructor(
    private readonly statements: StatementsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Get('statements/template')
  @ApiOperation({ summary: 'Mẫu tệp sao kê (CSV, 2 dòng ví dụ)' })
  template(@Res({ passthrough: true }) response: Response): StreamableFile {
    const content = statementTemplateCsv();
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('mau-sao-ke.csv')}`);
    return new StreamableFile(content);
  }

  @Post('statement-imports/:id/delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa một lần nhập chưa có dòng nào được ghép' })
  removeImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatementReasonDto,
  ): Promise<BankStatementImport> {
    return this.statements.remove(user, id, dto.reason);
  }

  @Post('statement-lines/:id/match')
  @ApiOperation({ summary: 'Ghép một dòng sao kê với một dòng sổ' })
  match(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MatchDto,
  ): Promise<BankMatch> {
    return this.reconciliation.match(user, id, dto.entryId, dto.reason ?? null);
  }

  @Post('statement-lines/:id/record')
  @ApiOperation({ summary: 'Ghi nhận từ sao kê: phí ngân hàng hoặc lãi không kỳ hạn' })
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordFromStatementDto,
  ): Promise<BankMatch> {
    return this.reconciliation.recordFromStatement(user, id, dto.kind);
  }

  @Post('matches/:id/unmatch')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bỏ ghép (có lý do)' })
  unmatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatementReasonDto,
  ): Promise<BankMatch> {
    return this.reconciliation.unmatch(user, id, dto.reason);
  }

  @Get(':id/statements')
  @ApiOperation({ summary: 'Các lần nhập sao kê của tài khoản quỹ' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Array<BankStatementImport & { matchedCount: number }>> {
    return this.statements.list(user, id);
  }

  @Post(':id/statements/preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEMORY_FILE_LIMIT }, defParamCharset: 'utf8' }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Xem trước một lần nhập: dòng đọc được, lỗi theo dòng, sao kê có khép không' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatementImportDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<StatementPreview> {
    return this.statements.preview(user, id, inputOf(dto, file));
  }

  @Post(':id/statements')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEMORY_FILE_LIMIT }, defParamCharset: 'utf8' }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Nhập sao kê (tệp mẫu hoặc nhập tay)' })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatementImportDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<{ import: BankStatementImport; preview: StatementPreview; suggestions: number }> {
    const result = await this.statements.import(user, id, inputOf(dto, file));
    const months = new Set(result.preview.rows.map((row) => row.txnDate.slice(0, 7)));
    let suggestions = 0;
    for (const month of months) suggestions += (await this.reconciliation.month(user, id, month)).suggestions.length;
    return { ...result, suggestions };
  }

  @Get(':id/reconciliation')
  @ApiOperation({ summary: 'Đối soát một tháng: số theo sao kê, chênh lệch, cặp ghép, dòng lệch, đề xuất' })
  month(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MonthQueryDto,
  ): Promise<ReconciliationMonth> {
    return this.reconciliation.month(user, id, query.month);
  }

  @Get(':id/reconciliation/candidates')
  @ApiOperation({ summary: 'Ứng viên ghép của một dòng sao kê hoặc một dòng sổ' })
  candidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CandidatesQueryDto,
  ): Promise<Candidate[]> {
    if (!query.lineId && !query.entryId) throw fieldError('lineId', 'Chọn dòng cần ghép.');
    return this.reconciliation.candidates(user, id, query);
  }

  @Post(':id/reconciliation/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận tất cả đề xuất ghép của tháng' })
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MonthQueryDto,
  ): Promise<{ confirmed: number }> {
    return { confirmed: await this.reconciliation.confirmSuggestions(user, id, dto.month) };
  }
}
