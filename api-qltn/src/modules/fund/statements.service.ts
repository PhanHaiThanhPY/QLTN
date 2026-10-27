import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflictWithReason, notFound } from '../../common/errors';
import { formatVnDate, isIsoDate } from '../../common/utils/vn-date';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import {
  closureGap,
  dedupeKey,
  readRows,
  type Cell,
  type StatementRow,
  type StatementRowError,
} from '../../domain/bank-statement';
import { groupVnd } from '../../domain/fund-ledger';
import { Attachment } from '../attachments/entities/attachment.entity';
import { FileStorage } from '../attachments/file-storage';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { BankStatementImport } from './entities/bank-statement-import.entity';
import { BankStatementLine } from './entities/bank-statement-line.entity';
import { Fund } from './entities/fund.entity';
import { FundLedgerService } from './fund-ledger.service';
import { assertFundOperate, validateReason } from './fund-rules';
import { readStatementFile, StatementFileError } from './statement-file';
import { assertStatementView } from './statement-rules';

const SIGNED_VND = /^-?\d{1,15}$/;
const CODE_PREFIX = 'GD';
const CODE_WIDTH = 3;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** What a statement import is made of: the period and the bank's two balances, then a file or typed lines. */
export interface StatementInput {
  periodFrom: string;
  periodTo: string;
  openingBalanceVnd: string;
  closingBalanceVnd: string;
  file?: { buffer: Buffer; originalname: string; mimetype: string };
  /** Typed lines, in the template's columns ("dd/mm/yyyy", "Ghi có", "Ghi nợ", …). */
  lines?: ReadonlyArray<Record<string, unknown>>;
}

export type RowResult = 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';

export interface StatementPreview {
  rows: Array<StatementRow & { result: RowResult }>;
  errors: StatementRowError[];
  /** Bank closing − (opening + Σ lines); "0" when the statement closes (BR-F4-01). */
  closureGapVnd: string;
  sumVnd: string;
  newCount: number;
  duplicateCount: number;
  possibleDuplicateCount: number;
  /** True when anything blocks the import (D-F4-1). */
  blocked: boolean;
}

const MANUAL_COLUMNS = ['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung', 'Số tham chiếu'] as const;
const MANUAL_KEYS = ['date', 'credit', 'debit', 'description', 'reference'] as const;
const cellOf = (value: unknown): Cell => (typeof value === 'string' || typeof value === 'number' ? value : null);

/**
 * Bank statement imports of a fund's account (SPEC F-S4 BR-F4-01..04). Kind-neutral; one fund, one account (DF-26).
 * The preview and the import run the same checks; the import locks the fund so the duplicate check sees every line.
 */
@Injectable()
export class StatementsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: FundLedgerService,
    private readonly storage: FileStorage,
    private readonly audit: AuditService,
  ) {}

  /** Newest first; `matchedCount` says whether the import can still be deleted (BR-F4-04). */
  async list(actor: AuthenticatedUser, fundId: string): Promise<Array<BankStatementImport & { matchedCount: number }>> {
    await this.fundInScope(this.dataSource.manager, actor, fundId);
    assertStatementView(actor);
    const imports = await this.dataSource
      .getRepository(BankStatementImport)
      .find({ where: { fundId }, order: { createdAt: 'DESC' } });
    const counts = await this.dataSource.query<Array<{ import_id: string; n: string }>>(
      `SELECT l.import_id, count(*)::text AS n FROM bank_matches m JOIN bank_statement_lines l ON l.id = m.line_id
        WHERE l.fund_id = $1 GROUP BY l.import_id`,
      [fundId],
    );
    const matched = new Map(counts.map((row) => [row.import_id, Number(row.n)]));
    return imports.map((row) => ({ ...row, matchedCount: matched.get(row.id) ?? 0 }));
  }

  async preview(actor: AuthenticatedUser, fundId: string, input: StatementInput): Promise<StatementPreview> {
    const fund = await this.fundInScope(this.dataSource.manager, actor, fundId);
    assertFundOperate(actor);
    return this.check(this.dataSource.manager, fund, input);
  }

  /** BR-F4-01..04: a statement that closes and has no error line is stored; duplicates of stored lines are skipped. */
  async import(
    actor: AuthenticatedUser,
    fundId: string,
    input: StatementInput,
  ): Promise<{ import: BankStatementImport; preview: StatementPreview }> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, fundId);
      assertFundOperate(actor);
      const preview = await this.check(manager, fund, input);
      if (preview.blocked) this.refuse(preview);
      let attachmentId: string | null = null;
      if (input.file) attachmentId = await this.keepFile(manager, actor, fund, input.file);
      const saved = await manager.getRepository(BankStatementImport).save(
        manager.getRepository(BankStatementImport).create({
          fundId: fund.id,
          buildingId: fund.buildingId,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          openingBalanceVnd: BigInt(input.openingBalanceVnd).toString(),
          closingBalanceVnd: BigInt(input.closingBalanceVnd).toString(),
          source: input.file ? 'FILE' : 'MANUAL',
          attachmentId,
          newCount: preview.newCount + preview.possibleDuplicateCount,
          duplicateCount: preview.duplicateCount,
          createdBy: actor.id,
        }),
      );
      for (const row of preview.rows.filter((item) => item.result !== 'DUPLICATE')) {
        await manager.getRepository(BankStatementLine).insert({
          importId: saved.id,
          fundId: fund.id,
          buildingId: fund.buildingId,
          code: await this.nextCode(manager, fund.id),
          txnDate: row.txnDate,
          direction: row.direction,
          amountVnd: row.amountVnd,
          description: row.description,
          reference: row.reference,
          dedupeKey: dedupeKey(row),
          possibleDuplicate: row.result === 'POSSIBLE_DUPLICATE',
          status: 'UNMATCHED',
        });
      }
      await this.record(
        manager,
        actor,
        fund,
        'importStatement',
        `${formatVnDate(input.periodFrom)}–${formatVnDate(input.periodTo)}: ${saved.newCount} dòng mới, bỏ qua ${saved.duplicateCount} dòng trùng`,
      );
      return { import: saved, preview };
    });
  }

  /** BR-F4-04: an import none of whose lines is matched is deleted (its lines go), with a reason. */
  async remove(actor: AuthenticatedUser, importId: string, reason: string): Promise<BankStatementImport> {
    return this.dataSource.transaction(async (manager) => {
      const head = await manager.getRepository(BankStatementImport).findOneBy({ id: importId });
      if (!head || !actor.buildingIds.includes(head.buildingId)) throw notFound('Không tìm thấy lần nhập sao kê.');
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      assertFundOperate(actor);
      const target = await manager.getRepository(BankStatementImport).findOneByOrFail({ id: importId });
      if (target.deletedAt) throw conflictWithReason('import_deleted', 'Lần nhập này đã bị xóa.');
      const errors = new FieldErrors();
      validateReason(errors, reason);
      errors.throwIfAny();
      const touched = await manager.query<Array<{ n: string }>>(
        `SELECT count(*)::text AS n FROM bank_matches m JOIN bank_statement_lines l ON l.id = m.line_id WHERE l.import_id = $1`,
        [target.id],
      );
      if (Number(touched[0]?.n ?? 0) > 0)
        throw conflictWithReason('import_matched', 'Lần nhập đã có dòng được ghép; không xóa được.');
      await manager.getRepository(BankStatementLine).delete({ importId: target.id });
      Object.assign(target, { deletedAt: new Date(), deletedBy: actor.id, deleteReason: reason });
      await manager.getRepository(BankStatementImport).save(target);
      await this.record(manager, actor, fund, 'deleteStatementImport', reason);
      return target;
    });
  }

  /** The import's checks: fields, rows, period, opening day, closure, duplicates against stored lines and in-file. */
  private async check(manager: EntityManager, fund: Fund, input: StatementInput): Promise<StatementPreview> {
    if (!fund.openingDate) throw conflictWithReason('fund_not_opened', 'Thiết lập quỹ trước khi nhập sao kê.');
    const errors = new FieldErrors();
    errors.when(!isIsoDate(input.periodFrom), 'periodFrom', 'Ngày bắt đầu kỳ không hợp lệ.');
    errors.when(!isIsoDate(input.periodTo), 'periodTo', 'Ngày kết thúc kỳ không hợp lệ.');
    errors.when(
      isIsoDate(input.periodFrom) && isIsoDate(input.periodTo) && input.periodTo < input.periodFrom,
      'periodTo',
      'Kỳ sao kê kết thúc trước khi bắt đầu.',
    );
    errors.when(!SIGNED_VND.test(input.openingBalanceVnd), 'openingBalanceVnd', 'Số dư đầu kỳ là số nguyên VND.');
    errors.when(!SIGNED_VND.test(input.closingBalanceVnd), 'closingBalanceVnd', 'Số dư cuối kỳ là số nguyên VND.');
    errors.when(!input.file && !input.lines?.length, 'file', 'Chọn tệp sao kê hoặc nhập ít nhất một dòng.');
    errors.throwIfAny();

    let table: Cell[][];
    try {
      table = input.file
        ? readStatementFile(input.file.buffer)
        : [[...MANUAL_COLUMNS], ...(input.lines ?? []).map((line) => MANUAL_KEYS.map((key) => cellOf(line[key])))];
    } catch (error) {
      if (error instanceof StatementFileError) throw fieldError('file', error.message);
      throw error;
    }
    const { rows, errors: rowErrors } = readRows(table, fund.accountNo);
    for (const row of rows) {
      if (row.txnDate < input.periodFrom || row.txnDate > input.periodTo)
        rowErrors.push({
          row: row.row,
          column: 'date',
          message: `Dòng ${row.row}: Ngày giao dịch nằm ngoài kỳ sao kê.`,
        });
      else if (row.txnDate < fund.openingDate)
        rowErrors.push({
          row: row.row,
          column: 'date',
          message: `Dòng ${row.row}: Ngày giao dịch trước ngày bắt đầu sổ (${formatVnDate(fund.openingDate)}).`,
        });
    }
    rowErrors.sort((a, b) => a.row - b.row);

    const stored = await manager.query<Array<{ dedupe_key: string; n: string }>>(
      `SELECT dedupe_key, count(*)::text AS n FROM bank_statement_lines WHERE fund_id = $1 GROUP BY dedupe_key`,
      [fund.id],
    );
    const known = new Map(stored.map((row) => [row.dedupe_key, Number(row.n)]));
    const inFile = new Map<string, number>();
    for (const row of rows) inFile.set(dedupeKey(row), (inFile.get(dedupeKey(row)) ?? 0) + 1);
    // A key already stored e times skips its first e lines here; two left with one key are "Có thể trùng".
    const seen = new Map<string, number>();
    const results = rows.map((row) => {
      const key = dedupeKey(row);
      const index = (seen.get(key) ?? 0) + 1;
      seen.set(key, index);
      const storedCount = known.get(key) ?? 0;
      let result: RowResult = 'NEW';
      if (index <= storedCount) result = 'DUPLICATE';
      else if ((inFile.get(key) ?? 0) - storedCount > 1) result = 'POSSIBLE_DUPLICATE';
      return { ...row, result };
    });
    const sum = rows.reduce((total, row) => total + (row.direction === 'IN' ? 1n : -1n) * BigInt(row.amountVnd), 0n);
    const gap = closureGap(input.openingBalanceVnd, input.closingBalanceVnd, rows);
    return {
      rows: results,
      errors: rowErrors,
      closureGapVnd: gap,
      sumVnd: sum.toString(),
      newCount: results.filter((row) => row.result === 'NEW').length,
      duplicateCount: results.filter((row) => row.result === 'DUPLICATE').length,
      possibleDuplicateCount: results.filter((row) => row.result === 'POSSIBLE_DUPLICATE').length,
      blocked: rowErrors.length > 0 || gap !== '0' || rows.length === 0,
    };
  }

  /** D-F4-1: nothing is imported; line errors first, else the closure gap. */
  private refuse(preview: StatementPreview): never {
    const errors = new FieldErrors();
    for (const row of preview.errors) errors.add(`rows.${row.row}`, row.message);
    if (preview.closureGapVnd !== '0')
      errors.add(
        'closingBalanceVnd',
        `Sao kê không khép: lệch ${groupVnd(preview.closureGapVnd.replace(/^-/, ''))} đ.`,
      );
    if (!preview.rows.length && !preview.errors.length) errors.add('file', 'Sao kê không có giao dịch nào.');
    errors.throwIfAny();
    throw fieldError('file', 'Sao kê chưa nhập được.');
  }

  /** BR-F4-01: the original file is kept on the fund and can be downloaded. */
  private async keepFile(
    manager: EntityManager,
    actor: AuthenticatedUser,
    fund: Fund,
    file: NonNullable<StatementInput['file']>,
  ): Promise<string> {
    const key = randomUUID();
    await this.storage.save(key, file.buffer);
    const isXlsx = file.buffer.length >= 4 && file.buffer.readUInt32LE(0) === 0x04034b50;
    const saved = await manager.getRepository(Attachment).save(
      manager.getRepository(Attachment).create({
        subjectType: SUBJECT_TYPE.FUND,
        subjectId: fund.id,
        buildingId: fund.buildingId,
        purpose: 'STATEMENT_FILE',
        fileName: file.originalname || (isXlsx ? 'sao-ke.xlsx' : 'sao-ke.csv'),
        mimeType: isXlsx ? XLSX_MIME : 'text/csv',
        sizeBytes: file.buffer.length,
        contentRef: key,
        uploadedBy: actor.id,
      }),
    );
    return saved.id;
  }

  /** GD-NNN numbered per account (BR-F4-04). */
  private async nextCode(manager: EntityManager, fundId: string): Promise<string> {
    const rows = await manager.query<Array<{ value: number }>>(
      `INSERT INTO code_counters (key, value) VALUES ($1, 1)
       ON CONFLICT (key) DO UPDATE SET value = code_counters.value + 1 RETURNING value`,
      [`${CODE_PREFIX}:${fundId}`],
    );
    return `${CODE_PREFIX}-${String(rows[0].value).padStart(CODE_WIDTH, '0')}`;
  }

  private async fundInScope(manager: EntityManager, actor: AuthenticatedUser, fundId: string): Promise<Fund> {
    const fund = await manager.getRepository(Fund).findOneBy({ id: fundId });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    return fund;
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    fund: Fund,
    action: string,
    reason: string,
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.FUND,
      subjectId: fund.id,
      buildingId: fund.buildingId,
      action,
      actorId: actor.id,
      entityVersion: fund.version,
      reason,
    });
  }
}
