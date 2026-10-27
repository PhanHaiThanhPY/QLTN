import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { formatVnDate, isIsoDate } from '../../common/utils/vn-date';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { availableFrom, monthBounds, monthFigures, type Available } from '../../domain/fund-ledger';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type { FundReasonDto, FundSetupDto, FundVersionDto, LedgerQueryDto } from './dto/fund.dto';
import { FundLedgerEntry } from './entities/fund-ledger-entry.entity';
import { Fund, type FundKind } from './entities/fund.entity';
import { FundLedgerService } from './fund-ledger.service';
import { assertFundApprove, assertFundOperate, assertFundView, isVnd, validateReason, vnd } from './fund-rules';
import { fundView, ledgerRow, type FundView, type LedgerPage } from './fund-views';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const TEXT_MAX = 200;
const ACCOUNT = /^[0-9 ]{6,40}$/;

const sumSigned = (lines: readonly FundLedgerEntry[]): bigint =>
  lines.reduce((total, line) => total + (line.direction === 'IN' ? 1n : -1n) * BigInt(line.amountVnd), 0n);

/** Funds, their account and opening balance, and the ledger by month (SPEC F-S3 BR-F3-01..05). */
@Injectable()
export class FundsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: FundLedgerService,
    private readonly audit: AuditService,
  ) {}

  /** BR-F3-01: the funds of a kind in the actor's buildings (one per building, never summed). */
  async list(actor: AuthenticatedUser, kind: FundKind = 'KHAI_THAC'): Promise<FundView[]> {
    assertFundView(actor);
    const funds = await this.dataSource
      .getRepository(Fund)
      .find({ where: { buildingId: In(actor.buildingIds), kind } });
    const withLines = await this.fundsWithLines(
      this.dataSource.manager,
      funds.map((fund) => fund.id),
    );
    return funds.map((fund) => fundView(fund, withLines.has(fund.id)));
  }

  async get(actor: AuthenticatedUser, id: string): Promise<FundView> {
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertFundView(actor);
    const withLines = await this.fundsWithLines(this.dataSource.manager, [fund.id]);
    return fundView(fund, withLines.has(fund.id));
  }

  /**
   * BR-F3-02: Kế toán sets the account and the opening (balance per the statement at the start of the opening day).
   * Changing an opening once the ledger has lines waits for BQT (D-F3-5); before that it needs a reason.
   */
  async setup(actor: AuthenticatedUser, id: string, dto: FundSetupDto): Promise<FundView> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, id);
      assertFundOperate(actor);
      assertVersion(fund.version, dto.version);
      const errors = new FieldErrors();
      errors.when(
        !dto.bankName || dto.bankName.length > TEXT_MAX,
        'bankName',
        'Nhập tên ngân hàng (tối đa 200 ký tự).',
      );
      errors.when(!ACCOUNT.test(dto.accountNo), 'accountNo', 'Số tài khoản gồm 6–40 chữ số.');
      errors.when(
        !dto.accountHolder || dto.accountHolder.length > TEXT_MAX,
        'accountHolder',
        'Nhập chủ tài khoản (tối đa 200 ký tự).',
      );
      errors.when(!isIsoDate(dto.openingDate), 'openingDate', 'Ngày bắt đầu sổ không hợp lệ.');
      errors.when(
        isIsoDate(dto.openingDate) && dto.openingDate > this.ledger.today(),
        'openingDate',
        'Ngày bắt đầu sổ không được sau hôm nay.',
      );
      errors.when(!isVnd(dto.openingBalanceVnd, true), 'openingBalanceVnd', 'Số dư đầu là số nguyên VND, không âm.');
      errors.throwIfAny();
      const balance = vnd(dto.openingBalanceVnd);
      const changesOpening =
        fund.openingDate !== null && (fund.openingDate !== dto.openingDate || fund.openingBalanceVnd !== balance);
      if (changesOpening) {
        validateReason(errors, dto.reason ?? '');
        errors.throwIfAny();
      }
      Object.assign(fund, {
        bankName: dto.bankName,
        accountNo: dto.accountNo.replace(/\s/g, ''),
        accountHolder: dto.accountHolder,
      });
      const lines = await this.ledger.lines(manager, fund.id);
      let action = fund.openingDate === null ? 'openFund' : 'updateFundAccount';
      if (fund.openingDate === null || (changesOpening && lines.length === 0)) {
        if (changesOpening) action = 'changeFundOpening';
        Object.assign(fund, { openingDate: dto.openingDate, openingBalanceVnd: balance });
      } else if (changesOpening) {
        this.assertOpeningFits(lines, dto.openingDate, balance);
        action = 'requestFundOpeningChange';
        fund.pendingOpening = {
          openingDate: dto.openingDate,
          openingBalanceVnd: balance,
          reason: dto.reason ?? '',
          requestedBy: actor.id,
          requestedAt: new Date().toISOString(),
        };
      }
      await this.save(manager, actor, fund, action, dto.reason ?? undefined);
      return fundView(fund, lines.length > 0);
    });
  }

  /** D-F3-5: BQT applies the opening change waiting on the fund. */
  async approveOpening(actor: AuthenticatedUser, id: string, dto: FundVersionDto): Promise<FundView> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.lockPending(manager, actor, id, dto.version);
      const pending = fund.pendingOpening as NonNullable<Fund['pendingOpening']>;
      const lines = await this.ledger.lines(manager, fund.id);
      this.assertOpeningFits(lines, pending.openingDate, pending.openingBalanceVnd);
      Object.assign(fund, {
        openingDate: pending.openingDate,
        openingBalanceVnd: pending.openingBalanceVnd,
        pendingOpening: null,
      });
      await this.save(manager, actor, fund, 'approveFundOpeningChange', pending.reason);
      return fundView(fund, lines.length > 0);
    });
  }

  async rejectOpening(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundView> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.lockPending(manager, actor, id, dto.version);
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      fund.pendingOpening = null;
      await this.save(manager, actor, fund, 'rejectFundOpeningChange', dto.reason);
      return fundView(fund, true);
    });
  }

  /**
   * BR-F3-05: a month of the ledger with its figures — opening, in, out, closing, all "theo sổ" — plus the
   * exploitation income (contract receipts net of their reversals) and the deposits still held at the month's end.
   */
  async ledgerPage(actor: AuthenticatedUser, id: string, query: LedgerQueryDto): Promise<LedgerPage> {
    if (!MONTH.test(query.month)) throw fieldError('month', 'Tháng có dạng YYYY-MM.');
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertFundView(actor);
    const lines = await this.ledger.lines(this.dataSource.manager, fund.id);
    const view = fundView(fund, lines.length > 0);
    const { first, last } = monthBounds(query.month);
    if (fund.openingDate === null || fund.openingBalanceVnd === null || last < fund.openingDate)
      return { fund: view, month: query.month, figures: null, openingLine: null, rows: [] };
    const opening = { openingDate: fund.openingDate, openingBalanceVnd: fund.openingBalanceVnd };
    const inMonth = lines.filter((line) => line.entryDate >= first && line.entryDate <= last);
    const upToEnd = lines.filter((line) => line.entryDate <= last);
    const reversedBy = new Map(lines.filter((line) => line.reversesId).map((line) => [line.reversesId, line.id]));
    const shown = inMonth
      .filter((line) => !query.category || line.category === query.category)
      .filter((line) => !query.direction || line.direction === query.direction);
    const contracts = await this.contractsOf(shown);
    const rows = shown.map((line) =>
      ledgerRow(line, reversedBy.get(line.id) ?? null, contracts.get(line.sourceId) ?? null),
    );
    return {
      fund: view,
      month: query.month,
      figures: {
        ...monthFigures(opening, lines, query.month),
        incomeVnd: sumSigned(inMonth.filter((line) => line.category === 'CONTRACT_RECEIPT')).toString(),
        depositHeldVnd: sumSigned(upToEnd.filter((line) => line.category === 'DEPOSIT')).toString(),
      },
      openingLine: fund.openingDate >= first ? { date: fund.openingDate, amountVnd: fund.openingBalanceVnd } : null,
      rows,
    };
  }

  /** BR-F3-13 preview for the payout dialogs: what may still leave the fund on that day. */
  async available(actor: AuthenticatedUser, id: string, date: string): Promise<Available> {
    if (!isIsoDate(date)) throw fieldError('date', 'Ngày không hợp lệ.');
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertFundView(actor);
    return this.ledger.available(this.dataSource.manager, fund, date);
  }

  /** An opening may not start after a line, nor leave any day below zero. */
  private assertOpeningFits(lines: readonly FundLedgerEntry[], openingDate: string, balance: string): void {
    const first = lines[0]?.entryDate;
    if (first && openingDate > first)
      throw fieldError('openingDate', `Ngày bắt đầu sổ không được sau dòng sổ đầu tiên (${formatVnDate(first)}).`);
    const low = availableFrom({ openingDate, openingBalanceVnd: balance }, lines, openingDate);
    if (BigInt(low.amountVnd) < 0n)
      throw fieldError('openingBalanceVnd', `Số dư đầu này làm quỹ âm tại ${formatVnDate(low.date)}.`);
  }

  private async lockPending(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<Fund> {
    const fund = await this.ledger.lockFund(manager, actor.buildingIds, id);
    assertFundApprove(actor);
    assertVersion(fund.version, version);
    if (!fund.pendingOpening) throw conflictWithReason('no_pending_opening', 'Không có thay đổi số dư đầu chờ duyệt.');
    return fund;
  }

  /** Exploitation receipts and deposits name their contract (the ledger itself stays kind-neutral). */
  private async contractsOf(lines: readonly FundLedgerEntry[]): Promise<Map<string, string>> {
    const ids = lines
      .filter((line) => line.sourceType === 'RECEIPT' || line.sourceType === 'DEPOSIT')
      .map((line) => line.sourceId);
    if (!ids.length) return new Map();
    const rows = await this.dataSource.query<Array<{ id: string; contract_id: string }>>(
      `SELECT id, contract_id FROM exploitation_receipts WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id, contract_id FROM exploitation_deposits WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row.contract_id]));
  }

  private async fundsWithLines(manager: EntityManager, ids: readonly string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await manager.query<Array<{ fund_id: string }>>(
      'SELECT DISTINCT fund_id FROM fund_ledger_entries WHERE fund_id = ANY($1::uuid[])',
      [ids],
    );
    return new Set(rows.map((row) => row.fund_id));
  }

  private async save(
    manager: EntityManager,
    actor: AuthenticatedUser,
    fund: Fund,
    action: string,
    reason?: string,
  ): Promise<void> {
    fund.version += 1;
    await manager.getRepository(Fund).save(fund);
    await this.audit.record(manager, {
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
