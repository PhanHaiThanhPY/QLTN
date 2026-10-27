import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EntityManager } from 'typeorm';
import { conflictWithReason, notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { formatVnDate, vnDate } from '../../common/utils/vn-date';
import { fieldError } from '../../common/validation/field-errors';
import { availableFrom, groupVnd, type Available, type FundOpening, type LedgerLine } from '../../domain/fund-ledger';
import { FundLedgerEntry, type LedgerCategory, type LedgerSourceType } from './entities/fund-ledger-entry.entity';
import { Fund, type FundKind } from './entities/fund.entity';

export const NO_OPENING = 'Nhập số dư đầu của quỹ trước.';

/** The request fields a refusal is reported on. */
export interface LineFields {
  date: string;
  amount: string;
}
const DEFAULT_FIELDS: LineFields = { date: 'date', amount: 'amountVnd' };

export interface NewLine {
  entryDate: string;
  direction: 'IN' | 'OUT';
  amountVnd: string;
  category: LedgerCategory;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceCode: string;
  description: string;
}

/**
 * The fund ledger (SPEC F-S3 §3.1), shared by every fund kind (group T reuses it). Writers lock the fund row first, so
 * two payouts of one fund run one after the other and the "never negative" check (BR-F3-13) sees the other's line.
 */
@Injectable()
export class FundLedgerService {
  constructor(private readonly clock: Clock) {}

  today(): string {
    return vnDate(this.clock.now());
  }

  /** The fund of a building and kind, locked for the rest of the transaction; 404 outside the actor's buildings. */
  async lockFund(manager: EntityManager, buildingIds: readonly string[], fundId: string): Promise<Fund> {
    const fund = await manager
      .getRepository(Fund)
      .findOne({ where: { id: fundId }, lock: { mode: 'pessimistic_write' } });
    if (!fund || !buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    return fund;
  }

  async lockFundOf(manager: EntityManager, buildingId: string, kind: FundKind): Promise<Fund> {
    const fund = await manager
      .getRepository(Fund)
      .findOne({ where: { buildingId, kind }, lock: { mode: 'pessimistic_write' } });
    if (!fund) throw notFound('Không tìm thấy quỹ.');
    return fund;
  }

  openingOf(fund: Fund): FundOpening {
    if (fund.openingDate === null || fund.openingBalanceVnd === null)
      throw conflictWithReason('fund_not_opened', NO_OPENING);
    return { openingDate: fund.openingDate, openingBalanceVnd: fund.openingBalanceVnd };
  }

  lines(manager: EntityManager, fundId: string): Promise<FundLedgerEntry[]> {
    return manager
      .getRepository(FundLedgerEntry)
      .find({ where: { fundId }, order: { entryDate: 'ASC', createdAt: 'ASC' } });
  }

  /** BR-F3-13: the most that may leave the fund on `date` without any day from then on going below zero. */
  async available(manager: EntityManager, fund: Fund, date: string): Promise<Available> {
    return availableFrom(this.openingOf(fund), await this.lines(manager, fund.id), date);
  }

  /**
   * Writes one line (BR-F3-03) on a locked fund. Money out is refused when it would take the balance of its day or of
   * any later day below zero (BR-F3-13), on `field` with the rule's wording.
   */
  async post(
    manager: EntityManager,
    fund: Fund,
    line: NewLine,
    actorId: string,
    fields: LineFields = DEFAULT_FIELDS,
    reversesId: string | null = null,
  ): Promise<FundLedgerEntry> {
    const opening = this.openingOf(fund);
    if (line.entryDate < opening.openingDate)
      throw fieldError(fields.date, `Ngày không được trước ngày bắt đầu sổ (${formatVnDate(opening.openingDate)}).`);
    if (line.direction === 'OUT')
      this.assertCovers(await this.available(manager, fund, line.entryDate), line.amountVnd, fields.amount);
    const repo = manager.getRepository(FundLedgerEntry);
    return repo.save(
      repo.create({
        ...line,
        id: randomUUID(),
        fundId: fund.id,
        buildingId: fund.buildingId,
        reversesId,
        reconciliation: 'UNRECONCILED',
        createdBy: actorId,
      }),
    );
  }

  /**
   * BR-F3-04: cancelling a document adds a reversal dated today — same amount, the other direction, linked to the
   * original. Reversing money in is money out, so it is checked like a payout (BR-F3-13).
   */
  async reverse(
    manager: EntityManager,
    fund: Fund,
    entryId: string,
    actorId: string,
    reason: string,
  ): Promise<FundLedgerEntry> {
    const original = await manager.getRepository(FundLedgerEntry).findOneByOrFail({ id: entryId });
    if (await manager.getRepository(FundLedgerEntry).exists({ where: { reversesId: original.id } }))
      throw conflictWithReason('already_reversed', 'Chứng từ đã được hủy.');
    return this.post(
      manager,
      fund,
      {
        entryDate: this.today(),
        direction: original.direction === 'IN' ? 'OUT' : 'IN',
        amountVnd: original.amountVnd,
        category: original.category,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        sourceCode: original.sourceCode,
        description: `Đảo của ${original.sourceCode}: ${reason}`,
      },
      actorId,
      { date: 'reason', amount: 'reason' },
      original.id,
    );
  }

  private assertCovers(available: Available, amountVnd: string, field: string): void {
    if (BigInt(amountVnd) <= BigInt(available.amountVnd)) return;
    throw fieldError(
      field,
      `Số dư quỹ không đủ: còn ${groupVnd(available.amountVnd)} đ tại ${formatVnDate(available.date)}.`,
    );
  }
}

export type { LedgerLine };
