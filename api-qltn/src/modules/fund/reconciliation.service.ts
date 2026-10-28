import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflictWithReason, notFound } from '../../common/errors';
import { formatVnDate } from '../../common/utils/vn-date';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import {
  MATCH_DAYS_FREE,
  daysBetween,
  isCandidate,
  statementBalanceAt,
  statementBalanceBefore,
  suggestMatches,
  type MatchableLine,
} from '../../domain/bank-statement';
import { balanceAt, groupVnd, maskAccount, monthBounds } from '../../domain/fund-ledger';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { BankMatch } from './entities/bank-match.entity';
import { BankStatementImport } from './entities/bank-statement-import.entity';
import { BankStatementLine } from './entities/bank-statement-line.entity';
import type { FundLedgerEntry, LedgerCategory } from './entities/fund-ledger-entry.entity';
import { Fund } from './entities/fund.entity';
import { FundLedgerService } from './fund-ledger.service';
import { assertFundOperate, seesFullAccount, validateReason } from './fund-rules';
import { assertStatementView } from './statement-rules';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export type RecordKind = 'BANK_FEE' | 'INTEREST';
/** BR-F4-08: a fee goes out, interest comes in; nothing else is recorded from the statement. */
const RECORD_DIRECTION: Readonly<Record<RecordKind, 'IN' | 'OUT'>> = { BANK_FEE: 'OUT', INTEREST: 'IN' } as const;
const RECORD_LABEL: Readonly<Record<RecordKind, string>> = {
  BANK_FEE: 'Phí ngân hàng',
  INTEREST: 'Lãi không kỳ hạn',
} as const;
const TAKEN = 'Dòng này vừa được ghép bởi người khác. Tải lại.';

export interface LineView {
  id: string;
  code: string;
  txnDate: string;
  direction: 'IN' | 'OUT';
  amountVnd: string;
  description: string;
  reference: string | null;
  possibleDuplicate: boolean;
  status: BankStatementLine['status'];
  /** BR-F4-08: what this line may be recorded as, if anything. */
  recordAs: RecordKind;
}

export interface EntryView {
  id: string;
  entryDate: string;
  direction: 'IN' | 'OUT';
  amountVnd: string;
  category: LedgerCategory;
  sourceType: FundLedgerEntry['sourceType'];
  sourceId: string;
  sourceCode: string;
  description: string;
}

export interface ReconciliationMonth {
  fund: {
    id: string;
    buildingId: string;
    accountNo: string | null;
    accountMasked: string | null;
    openingDate: string | null;
  };
  month: string;
  /** BR-F4-09: by the statement; each null means "Chưa có sao kê", never 0. */
  statement: { openingVnd: string | null; inVnd: string | null; outVnd: string | null; closingVnd: string | null };
  /** The day the month is read on: its last day, or the last day a statement covers while the month runs. */
  asOf: string | null;
  /** On `asOf`: by the ledger, and ledger − statement (null without a statement). */
  ledgerClosingVnd: string | null;
  differenceVnd: string | null;
  /** BR-F4-10: k/n, gaps a (statement lines unmatched + ledger lines unreconciled), duplicates b. */
  counts: {
    lines: number;
    matched: number;
    unmatchedLines: number;
    unreconciledEntries: number;
    gaps: number;
    duplicates: number;
  };
  matchedMonth: boolean;
  /** BR-F4-09: the statement covering the ledger's first day starts from another balance. */
  openingWarning: { statementVnd: string; ledgerVnd: string; date: string } | null;
  pairs: Array<{ matchId: string; kind: BankMatch['kind']; reason: string | null; line: LineView; entry: EntryView }>;
  unmatchedLines: LineView[];
  unmatchedEntries: EntryView[];
  selfCancelled: EntryView[];
  suggestions: Array<{ line: LineView; entry: EntryView; days: number }>;
  imports: number;
}

export interface Candidate {
  days: number;
  /** D-F4-3: more than 5 days apart needs a reason. */
  needsReason: boolean;
  line?: LineView;
  entry?: EntryView;
}

const lineView = (line: BankStatementLine): LineView => ({
  id: line.id,
  code: line.code,
  txnDate: line.txnDate,
  direction: line.direction,
  amountVnd: line.amountVnd,
  description: line.description,
  reference: line.reference,
  possibleDuplicate: line.possibleDuplicate,
  status: line.status,
  recordAs: line.direction === 'OUT' ? 'BANK_FEE' : 'INTEREST',
});

const entryView = (entry: FundLedgerEntry): EntryView => ({
  id: entry.id,
  entryDate: entry.entryDate,
  direction: entry.direction,
  amountVnd: entry.amountVnd,
  category: entry.category,
  sourceType: entry.sourceType,
  sourceId: entry.sourceId,
  sourceCode: entry.sourceCode,
  description: entry.description,
});

const asMatchable = (line: BankStatementLine): MatchableLine => ({
  id: line.id,
  date: line.txnDate,
  direction: line.direction,
  amountVnd: line.amountVnd,
});
const entryMatchable = (entry: FundLedgerEntry): MatchableLine => ({
  id: entry.id,
  date: entry.entryDate,
  direction: entry.direction,
  amountVnd: entry.amountVnd,
});

/** A reversal and its original cancel out: no bank movement to match (BR-F4-05, "Tự khử"). */
const selfCancelledIds = (entries: readonly FundLedgerEntry[]): Set<string> => {
  const ids = new Set<string>();
  for (const entry of entries)
    if (entry.reversesId) {
      ids.add(entry.id);
      ids.add(entry.reversesId);
    }
  return ids;
};

interface Book {
  fund: Fund;
  entries: FundLedgerEntry[];
  lines: BankStatementLine[];
  matches: BankMatch[];
  imports: BankStatementImport[];
  selfCancelled: Set<string>;
}

/** Matching the statement with the ledger and the month's reconciliation (SPEC F-S4 BR-F4-05..10). */
@Injectable()
export class ReconciliationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: FundLedgerService,
    private readonly audit: AuditService,
  ) {}

  async month(actor: AuthenticatedUser, fundId: string, month: string): Promise<ReconciliationMonth> {
    if (!MONTH.test(month)) throw fieldError('month', 'Tháng có dạng YYYY-MM.');
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id: fundId });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertStatementView(actor);
    const book = await this.book(this.dataSource.manager, fund);
    const { first, last } = monthBounds(month);
    const inMonth =
      <T>(date: (row: T) => string) =>
      (row: T) =>
        date(row) >= first && date(row) <= last;
    const periods = book.imports.map((row) => ({
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      openingVnd: row.openingBalanceVnd,
    }));
    const matchable = book.lines.map(asMatchable);
    const monthLines = book.lines.filter(inMonth((row) => row.txnDate));
    const monthEntries = book.entries.filter(inMonth((row) => row.entryDate));
    const covered = periods.some((period) => period.periodFrom <= last && period.periodTo >= first);
    const sum = (direction: 'IN' | 'OUT') =>
      monthLines
        .filter((row) => row.direction === direction)
        .reduce((total, row) => total + BigInt(row.amountVnd), 0n)
        .toString();
    // The month is read on its last day; a month still running (its statement ends before) on the last day covered.
    const asOf =
      periods
        .filter((period) => period.periodFrom <= last && period.periodTo >= first)
        .map((period) => (period.periodTo < last ? period.periodTo : last))
        .sort()
        .at(-1) ?? null;
    const closing = asOf ? statementBalanceAt(periods, matchable, asOf) : null;
    const ledgerClosing =
      asOf && fund.openingDate && fund.openingBalanceVnd && fund.openingDate <= asOf
        ? balanceAt({ openingDate: fund.openingDate, openingBalanceVnd: fund.openingBalanceVnd }, book.entries, asOf)
        : null;
    const difference =
      closing !== null && ledgerClosing !== null ? (BigInt(ledgerClosing) - BigInt(closing)).toString() : null;

    const entriesById = new Map(book.entries.map((row) => [row.id, row]));
    const linesById = new Map(book.lines.map((row) => [row.id, row]));
    const live = book.matches.filter((row) => !row.unmatchedAt);
    const pairs = live
      .filter((row) => {
        const line = linesById.get(row.lineId);
        return line !== undefined && inMonth((item: BankStatementLine) => item.txnDate)(line);
      })
      .map((row) => ({
        matchId: row.id,
        kind: row.kind,
        reason: row.reason,
        line: lineView(linesById.get(row.lineId) as BankStatementLine),
        entry: entryView(entriesById.get(row.entryId) as FundLedgerEntry),
      }))
      .sort((a, b) => a.line.txnDate.localeCompare(b.line.txnDate) || a.line.code.localeCompare(b.line.code));
    const unmatchedLines = monthLines.filter((row) => row.status === 'UNMATCHED');
    const openEntries = book.entries.filter(
      (row) => row.reconciliation === 'UNRECONCILED' && !book.selfCancelled.has(row.id),
    );
    const unmatchedEntries = monthEntries.filter(
      (row) => row.reconciliation === 'UNRECONCILED' && !book.selfCancelled.has(row.id),
    );
    const suggestions = suggestMatches(unmatchedLines.map(asMatchable), openEntries.map(entryMatchable)).map((row) => ({
      line: lineView(linesById.get(row.lineId) as BankStatementLine),
      entry: entryView(entriesById.get(row.entryId) as FundLedgerEntry),
      days: row.days,
    }));
    const duplicates = monthLines.filter((row) => row.possibleDuplicate).length;
    const gaps = unmatchedLines.length + unmatchedEntries.length;

    let openingWarning: ReconciliationMonth['openingWarning'] = null;
    if (fund.openingDate && fund.openingBalanceVnd) {
      const atStart = statementBalanceBefore(periods, matchable, fund.openingDate);
      if (atStart !== null && atStart !== fund.openingBalanceVnd)
        openingWarning = { statementVnd: atStart, ledgerVnd: fund.openingBalanceVnd, date: fund.openingDate };
    }
    const full = seesFullAccount(actor);
    return {
      fund: {
        id: fund.id,
        buildingId: fund.buildingId,
        accountNo: full ? fund.accountNo : null,
        accountMasked: maskAccount(fund.accountNo),
        openingDate: fund.openingDate,
      },
      month,
      statement: {
        openingVnd: statementBalanceBefore(periods, matchable, first),
        inVnd: covered ? sum('IN') : null,
        outVnd: covered ? sum('OUT') : null,
        closingVnd: closing,
      },
      asOf,
      ledgerClosingVnd: ledgerClosing,
      differenceVnd: difference,
      counts: {
        lines: monthLines.length,
        matched: monthLines.length - unmatchedLines.length,
        unmatchedLines: unmatchedLines.length,
        unreconciledEntries: unmatchedEntries.length,
        gaps,
        duplicates,
      },
      matchedMonth: difference === '0' && gaps === 0 && duplicates === 0,
      openingWarning,
      pairs,
      unmatchedLines: unmatchedLines.map(lineView),
      unmatchedEntries: unmatchedEntries.map(entryView),
      selfCancelled: monthEntries.filter((row) => book.selfCancelled.has(row.id)).map(entryView),
      suggestions,
      imports: book.imports.length,
    };
  }

  /** "Ghép…" (ui-brief §2.1): the other side's candidates, nearest first, with whether a reason is needed. */
  async candidates(
    actor: AuthenticatedUser,
    fundId: string,
    side: { lineId?: string; entryId?: string },
  ): Promise<Candidate[]> {
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id: fundId });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertStatementView(actor);
    const book = await this.book(this.dataSource.manager, fund);
    const describe = (days: number) => ({ days, needsReason: days > MATCH_DAYS_FREE });
    if (side.lineId) {
      const line = book.lines.find((row) => row.id === side.lineId);
      if (!line) throw notFound('Không tìm thấy dòng sao kê.');
      return book.entries
        .filter((row) => row.reconciliation === 'UNRECONCILED' && !book.selfCancelled.has(row.id))
        .filter((row) => isCandidate(asMatchable(line), entryMatchable(row)))
        .map((row) => ({ ...describe(daysBetween(line.txnDate, row.entryDate)), entry: entryView(row) }))
        .sort((a, b) => a.days - b.days);
    }
    const entry = book.entries.find((row) => row.id === side.entryId);
    if (!entry) throw notFound('Không tìm thấy dòng sổ.');
    return book.lines
      .filter((row) => row.status === 'UNMATCHED' && isCandidate(asMatchable(row), entryMatchable(entry)))
      .map((row) => ({ ...describe(daysBetween(row.txnDate, entry.entryDate)), line: lineView(row) }))
      .sort((a, b) => a.days - b.days);
  }

  /** BR-F4-05: one statement line with one ledger line — same fund and direction, same amount; > 5 days needs a reason. */
  async match(actor: AuthenticatedUser, lineId: string, entryId: string, reason: string | null): Promise<BankMatch> {
    return this.dataSource.transaction(async (manager) => {
      const { fund, line } = await this.lockLine(manager, actor, lineId);
      const book = await this.book(manager, fund);
      return this.pair(manager, actor, book, line, entryId, reason);
    });
  }

  /** BR-F4-06, D-F4-4: Kế toán confirms every pending suggestion of the month at once. */
  async confirmSuggestions(actor: AuthenticatedUser, fundId: string, month: string): Promise<number> {
    if (!MONTH.test(month)) throw fieldError('month', 'Tháng có dạng YYYY-MM.');
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, fundId);
      assertFundOperate(actor);
      const book = await this.book(manager, fund);
      const { first, last } = monthBounds(month);
      const open = book.lines.filter(
        (row) => row.status === 'UNMATCHED' && row.txnDate >= first && row.txnDate <= last,
      );
      const entries = book.entries.filter(
        (row) => row.reconciliation === 'UNRECONCILED' && !book.selfCancelled.has(row.id),
      );
      const suggestions = suggestMatches(open.map(asMatchable), entries.map(entryMatchable));
      for (const row of suggestions) {
        const line = book.lines.find((item) => item.id === row.lineId) as BankStatementLine;
        await this.pair(manager, actor, book, line, row.entryId, null);
      }
      return suggestions.length;
    });
  }

  /** BR-F4-07: back to "Chưa ghép" / "Chưa đối soát", with a reason; the pair stays in history. */
  async unmatch(actor: AuthenticatedUser, matchId: string, reason: string): Promise<BankMatch> {
    return this.dataSource.transaction(async (manager) => {
      const head = await manager.getRepository(BankMatch).findOneBy({ id: matchId });
      const headFund = head ? await manager.getRepository(Fund).findOneBy({ id: head.fundId }) : null;
      if (!head || !headFund || !actor.buildingIds.includes(headFund.buildingId))
        throw notFound('Không tìm thấy cặp ghép.');
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      assertFundOperate(actor);
      const target = await manager.getRepository(BankMatch).findOneByOrFail({ id: matchId });
      if (target.unmatchedAt) throw conflictWithReason('already_unmatched', 'Cặp này đã được bỏ ghép.');
      if (target.kind === 'RECORDED')
        throw conflictWithReason('recorded_match', 'Dòng ghi nhận từ sao kê không bỏ ghép được.');
      const errors = new FieldErrors();
      validateReason(errors, reason);
      errors.throwIfAny();
      Object.assign(target, { unmatchedAt: new Date(), unmatchedBy: actor.id, unmatchReason: reason });
      await manager.getRepository(BankMatch).save(target);
      await manager.getRepository(BankStatementLine).update({ id: target.lineId }, { status: 'UNMATCHED' });
      await manager.query(`UPDATE fund_ledger_entries SET reconciliation = 'UNRECONCILED' WHERE id = $1`, [
        target.entryId,
      ]);
      const line = await manager.getRepository(BankStatementLine).findOneByOrFail({ id: target.lineId });
      await this.record(manager, actor, fund, 'unmatchStatementLine', `${line.code}: ${reason}`);
      return target;
    });
  }

  /**
   * BR-F4-08: a bank fee (out) or demand-deposit interest (in) with no document becomes a ledger line of the same day
   * and amount, already matched; it obeys the never-negative rule (BR-F3-13).
   */
  async recordFromStatement(actor: AuthenticatedUser, lineId: string, kind: RecordKind): Promise<BankMatch> {
    return this.dataSource.transaction(async (manager) => {
      const { fund, line } = await this.lockLine(manager, actor, lineId);
      if (line.status !== 'UNMATCHED') throw conflictWithReason('line_taken', TAKEN);
      if (RECORD_DIRECTION[kind] !== line.direction)
        throw fieldError(
          'kind',
          kind === 'BANK_FEE' ? 'Phí ngân hàng là khoản chi.' : 'Lãi không kỳ hạn là khoản thu.',
        );
      const entry = await this.ledger.post(
        manager,
        fund,
        {
          entryDate: line.txnDate,
          direction: line.direction,
          amountVnd: line.amountVnd,
          category: kind,
          sourceType: 'STATEMENT',
          sourceId: line.id,
          sourceCode: line.code,
          description: `${RECORD_LABEL[kind]}: ${line.description}`,
        },
        actor.id,
        { date: 'kind', amount: 'kind' },
      );
      await manager.query(`UPDATE fund_ledger_entries SET reconciliation = 'RECONCILED' WHERE id = $1`, [entry.id]);
      const saved = await this.insertMatch(manager, actor, fund, line, entry.id, 'RECORDED', null);
      await this.record(
        manager,
        actor,
        fund,
        'recordFromStatement',
        `${line.code} · ${RECORD_LABEL[kind]} · ${groupVnd(line.amountVnd)} đ`,
      );
      return saved;
    });
  }

  private async pair(
    manager: EntityManager,
    actor: AuthenticatedUser,
    book: Book,
    line: BankStatementLine,
    entryId: string,
    reason: string | null,
  ): Promise<BankMatch> {
    if (line.status !== 'UNMATCHED') throw conflictWithReason('line_taken', TAKEN);
    const entry = book.entries.find((row) => row.id === entryId);
    if (!entry) throw fieldError('entryId', 'Dòng sổ không thuộc quỹ này.');
    if (entry.reconciliation !== 'UNRECONCILED') throw conflictWithReason('entry_taken', TAKEN);
    if (book.selfCancelled.has(entry.id)) throw fieldError('entryId', 'Dòng đã tự khử với dòng đảo; không cần ghép.');
    if (entry.direction !== line.direction) throw fieldError('entryId', 'Khác chiều thu, chi.');
    if (BigInt(entry.amountVnd) !== BigInt(line.amountVnd)) throw fieldError('entryId', 'Khác số tiền.');
    const days = daysBetween(line.txnDate, entry.entryDate);
    const errors = new FieldErrors();
    if (days > MATCH_DAYS_FREE) validateReason(errors, reason ?? '');
    errors.throwIfAny();
    await manager.query(`UPDATE fund_ledger_entries SET reconciliation = 'RECONCILED' WHERE id = $1`, [entry.id]);
    entry.reconciliation = 'RECONCILED';
    const saved = await this.insertMatch(
      manager,
      actor,
      book.fund,
      line,
      entry.id,
      'MATCH',
      days > MATCH_DAYS_FREE ? reason : null,
    );
    line.status = 'MATCHED';
    await this.record(
      manager,
      actor,
      book.fund,
      'matchStatementLine',
      `${line.code} ↔ ${entry.sourceCode} (${formatVnDate(line.txnDate)} / ${formatVnDate(entry.entryDate)})${saved.reason ? `: ${saved.reason}` : ''}`,
    );
    return saved;
  }

  private async insertMatch(
    manager: EntityManager,
    actor: AuthenticatedUser,
    fund: Fund,
    line: BankStatementLine,
    entryId: string,
    kind: BankMatch['kind'],
    reason: string | null,
  ): Promise<BankMatch> {
    await manager
      .getRepository(BankStatementLine)
      .update({ id: line.id }, { status: kind === 'RECORDED' ? 'RECORDED' : 'MATCHED' });
    return manager
      .getRepository(BankMatch)
      .save(
        manager
          .getRepository(BankMatch)
          .create({ fundId: fund.id, lineId: line.id, entryId, kind, reason, matchedBy: actor.id }),
      );
  }

  private async lockLine(
    manager: EntityManager,
    actor: AuthenticatedUser,
    lineId: string,
  ): Promise<{ fund: Fund; line: BankStatementLine }> {
    const head = await manager.getRepository(BankStatementLine).findOneBy({ id: lineId });
    if (!head || !actor.buildingIds.includes(head.buildingId)) throw notFound('Không tìm thấy dòng sao kê.');
    const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
    assertFundOperate(actor);
    return { fund, line: await manager.getRepository(BankStatementLine).findOneByOrFail({ id: lineId }) };
  }

  private async book(manager: EntityManager, fund: Fund): Promise<Book> {
    const [entries, lines, matches, imports] = await Promise.all([
      this.ledger.lines(manager, fund.id),
      manager
        .getRepository(BankStatementLine)
        .find({ where: { fundId: fund.id }, order: { txnDate: 'ASC', code: 'ASC' } }),
      manager.getRepository(BankMatch).find({ where: { fundId: fund.id } }),
      manager.getRepository(BankStatementImport).find({ where: { fundId: fund.id, deletedAt: IsNull() } }),
    ]);
    return { fund, entries, lines, matches, imports, selfCancelled: selfCancelledIds(entries) };
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
