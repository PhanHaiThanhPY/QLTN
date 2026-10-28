import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { formatVnDate, isIsoDate } from '../../common/utils/vn-date';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { groupVnd, monthBounds } from '../../domain/fund-ledger';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type { AdjustTaxDto, FundReasonDto, TaxObligationDto, TaxPaymentDto } from './dto/fund.dto';
import { FundLedgerEntry } from './entities/fund-ledger-entry.entity';
import { FundTaxObligation } from './entities/fund-tax-obligation.entity';
import { FundTaxPayment } from './entities/fund-tax-payment.entity';
import { Fund } from './entities/fund.entity';
import { checkFundFile } from './fund-files';
import { FundLedgerService } from './fund-ledger.service';
import { NOTE_MAX, assertFundOperate, assertFundView, isVnd, validateReason, vnd } from './fund-rules';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const OBLIGATION_PREFIX = 'TH';
/** FG-04: tax payment slips are GNT, never NT (NT is an acceptance record). */
const PAYMENT_PREFIX = 'GNT';
const CODE_WIDTH = 3;

export interface TaxMonth {
  fundId: string;
  month: string;
  obligation:
    | (FundTaxObligation & {
        paidVnd: string;
        remainingVnd: string;
        settled: boolean;
        /** F-S4 BR-F4-11: "Đã đối chiếu k/n" — slips matched with the bank / slips recorded. */
        reconciled: { matched: number; total: number };
      })
    | null;
  payments: Array<FundTaxPayment & { statementCode: string | null }>;
  /** BR-F3-10: contract receipts of the month (net of reversals), for reference only — never a computed tax. */
  contractIncomeVnd: string;
  files: Record<string, Attachment>;
}

/** Tax obligations as the accounting file says and their payment slips (SPEC F-S3 BR-F3-10, BR-F3-11). */
@Injectable()
export class TaxService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: FundLedgerService,
    private readonly codes: CodeCounterService,
    private readonly audit: AuditService,
  ) {}

  async month(actor: AuthenticatedUser, fundId: string, month: string): Promise<TaxMonth> {
    if (!MONTH.test(month)) throw fieldError('month', 'Tháng có dạng YYYY-MM.');
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id: fundId });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertFundView(actor);
    const manager = this.dataSource.manager;
    const obligation = await manager.getRepository(FundTaxObligation).findOneBy({ fundId, month });
    const payments = obligation
      ? await manager
          .getRepository(FundTaxPayment)
          .find({ where: { obligationId: obligation.id }, order: { paidOn: 'ASC', createdAt: 'ASC' } })
      : [];
    const paid = payments
      .filter((row) => row.status === 'RECORDED')
      .reduce((total, row) => total + BigInt(row.amountVnd), 0n);
    const ids = [obligation?.attachmentId, ...payments.map((row) => row.attachmentId)].filter((id): id is string =>
      Boolean(id),
    );
    const files = ids.length ? await manager.getRepository(Attachment).findBy(ids.map((id) => ({ id }))) : [];
    const recorded = payments.filter((row) => row.status === 'RECORDED');
    const codes = await this.ledger.statementCodes(
      manager,
      recorded.map((row) => row.ledgerEntryId),
    );
    return {
      fundId,
      month,
      obligation: obligation
        ? {
            ...obligation,
            paidVnd: paid.toString(),
            remainingVnd: (BigInt(obligation.amountVnd) - paid).toString(),
            settled: BigInt(obligation.amountVnd) - paid === 0n,
            reconciled: {
              matched: recorded.filter((row) => codes.has(row.ledgerEntryId)).length,
              total: recorded.length,
            },
          }
        : null,
      payments: payments.map((row) => ({ ...row, statementCode: codes.get(row.ledgerEntryId) ?? null })),
      contractIncomeVnd: await this.contractIncome(manager, fundId, month),
      files: Object.fromEntries(files.map((file) => [file.id, file])),
    };
  }

  /** BR-F3-10: one obligation per fund and month (FQ-07), the amount from the accounting file (≥ 0). */
  async create(actor: AuthenticatedUser, fundId: string, dto: TaxObligationDto): Promise<FundTaxObligation> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, fundId);
      assertFundOperate(actor);
      const errors = new FieldErrors();
      errors.when(!MONTH.test(dto.month), 'month', 'Tháng có dạng YYYY-MM.');
      errors.when(!isVnd(dto.amountVnd, true), 'amountVnd', 'Số thuế là số nguyên VND, không âm.');
      errors.when((dto.note ?? '').length > NOTE_MAX, 'note', `Ghi chú tối đa ${NOTE_MAX} ký tự.`);
      if (dto.attachmentId)
        await checkFundFile(manager, errors, fund.id, dto.attachmentId, 'TAX_FILING', 'attachmentId');
      errors.throwIfAny();
      if (await manager.getRepository(FundTaxObligation).exists({ where: { fundId, month: dto.month } }))
        throw fieldError('month', 'Tháng này đã có nghĩa vụ thuế; hãy điều chỉnh nghĩa vụ đó.');
      const repo = manager.getRepository(FundTaxObligation);
      const saved = await repo.save(
        repo.create({
          code: await this.codes.next(manager, OBLIGATION_PREFIX, CODE_WIDTH),
          fundId,
          buildingId: fund.buildingId,
          month: dto.month,
          amountVnd: vnd(dto.amountVnd),
          attachmentId: dto.attachmentId ?? null,
          note: dto.note ?? null,
          adjustments: [],
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.record(manager, actor, saved, 'createTaxObligation');
      return saved;
    });
  }

  /** BR-F3-10: an adjustment needs a reason, is kept in the history and never goes below what has been paid. */
  async adjust(actor: AuthenticatedUser, id: string, dto: AdjustTaxDto): Promise<FundTaxObligation> {
    return this.dataSource.transaction(async (manager) => {
      const obligation = await this.lockObligation(manager, actor, id, dto.version);
      const errors = new FieldErrors();
      errors.when(!isVnd(dto.amountVnd, true), 'amountVnd', 'Số thuế là số nguyên VND, không âm.');
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      const paid = await this.paidOf(manager, obligation.id);
      if (BigInt(dto.amountVnd) < paid)
        throw fieldError('amountVnd', `Không được thấp hơn số đã nộp (${groupVnd(paid.toString())} đ).`);
      const from = obligation.amountVnd;
      obligation.amountVnd = vnd(dto.amountVnd);
      obligation.adjustments = [
        ...obligation.adjustments,
        { fromVnd: from, toVnd: obligation.amountVnd, reason: dto.reason, by: actor.id, at: new Date().toISOString() },
      ];
      obligation.version += 1;
      await manager.getRepository(FundTaxObligation).save(obligation);
      await this.record(
        manager,
        actor,
        obligation,
        'adjustTaxObligation',
        `${groupVnd(from)} → ${groupVnd(obligation.amountVnd)} đ: ${dto.reason}`,
      );
      return obligation;
    });
  }

  /**
   * BR-F3-11: a GNT never pays more than is still owed (D-F3-3) and is one "Chi thuế" line that may not take the fund
   * below zero on its day or after (BR-F3-13).
   */
  async pay(actor: AuthenticatedUser, obligationId: string, dto: TaxPaymentDto): Promise<FundTaxPayment> {
    return this.dataSource.transaction(async (manager) => {
      const head = await manager.getRepository(FundTaxObligation).findOneBy({ id: obligationId });
      if (!head || !actor.buildingIds.includes(head.buildingId)) throw notFound('Không tìm thấy nghĩa vụ thuế.');
      assertFundOperate(actor);
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      const obligation = await manager.getRepository(FundTaxObligation).findOneByOrFail({ id: obligationId });
      const errors = new FieldErrors();
      errors.when(!isIsoDate(dto.paidOn), 'paidOn', 'Ngày nộp không hợp lệ.');
      errors.when(
        isIsoDate(dto.paidOn) && dto.paidOn > this.ledger.today(),
        'paidOn',
        'Ngày nộp không được sau hôm nay.',
      );
      errors.when(!isVnd(dto.amountVnd), 'amountVnd', 'Số tiền là số nguyên VND lớn hơn 0.');
      await checkFundFile(manager, errors, fund.id, dto.attachmentId, 'TAX_PAYMENT_SLIP', 'attachmentId');
      errors.throwIfAny();
      const remaining = BigInt(obligation.amountVnd) - (await this.paidOf(manager, obligation.id));
      if (BigInt(dto.amountVnd) > remaining)
        throw fieldError(
          'amountVnd',
          `Vượt số còn phải nộp (${groupVnd(remaining.toString())} đ). Điều chỉnh nghĩa vụ trước nếu cần nộp thêm.`,
        );
      const id = randomUUID();
      const code = await this.codes.next(manager, PAYMENT_PREFIX, CODE_WIDTH);
      const line = await this.ledger.post(
        manager,
        fund,
        {
          entryDate: dto.paidOn,
          direction: 'OUT',
          amountVnd: vnd(dto.amountVnd),
          category: 'TAX',
          sourceType: 'TAX_PAYMENT',
          sourceId: id,
          sourceCode: code,
          description: `Thuế tháng ${obligation.month.slice(5)}/${obligation.month.slice(0, 4)} · ${obligation.code}`,
        },
        actor.id,
        { date: 'paidOn', amount: 'amountVnd' },
      );
      const repo = manager.getRepository(FundTaxPayment);
      const saved = await repo.save(
        repo.create({
          id,
          code,
          obligationId: obligation.id,
          fundId: fund.id,
          buildingId: fund.buildingId,
          paidOn: dto.paidOn,
          amountVnd: vnd(dto.amountVnd),
          attachmentId: dto.attachmentId,
          status: 'RECORDED',
          ledgerEntryId: line.id,
          createdBy: actor.id,
          version: 1,
        }),
      );
      obligation.version += 1;
      await manager.getRepository(FundTaxObligation).save(obligation);
      await this.record(
        manager,
        actor,
        obligation,
        'recordTaxPayment',
        `${code} · ${groupVnd(saved.amountVnd)} đ · ${formatVnDate(dto.paidOn)}`,
      );
      return saved;
    });
  }

  /** BR-F3-04: cancelling a GNT adds a reversal line (money back in). */
  async cancelPayment(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundTaxPayment> {
    return this.dataSource.transaction(async (manager) => {
      const head = await manager.getRepository(FundTaxPayment).findOneBy({ id });
      if (!head || !actor.buildingIds.includes(head.buildingId)) throw notFound('Không tìm thấy giấy nộp thuế.');
      assertFundOperate(actor);
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      const payment = await manager.getRepository(FundTaxPayment).findOneByOrFail({ id });
      assertVersion(payment.version, dto.version);
      if (payment.status !== 'RECORDED') throw conflictWithReason('already_cancelled', 'Giấy nộp thuế đã hủy.');
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      await this.ledger.reverse(manager, fund, payment.ledgerEntryId, actor.id, dto.reason);
      Object.assign(payment, {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        cancelledBy: actor.id,
        cancelledAt: new Date(),
        version: payment.version + 1,
      });
      await manager.getRepository(FundTaxPayment).save(payment);
      const obligation = await manager.getRepository(FundTaxObligation).findOneByOrFail({ id: payment.obligationId });
      obligation.version += 1;
      await manager.getRepository(FundTaxObligation).save(obligation);
      await this.record(manager, actor, obligation, 'cancelTaxPayment', `${payment.code}: ${dto.reason}`);
      return payment;
    });
  }

  private async lockObligation(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<FundTaxObligation> {
    const obligation = await manager
      .getRepository(FundTaxObligation)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!obligation || !actor.buildingIds.includes(obligation.buildingId))
      throw notFound('Không tìm thấy nghĩa vụ thuế.');
    assertFundOperate(actor);
    assertVersion(obligation.version, version);
    return obligation;
  }

  private async paidOf(manager: EntityManager, obligationId: string): Promise<bigint> {
    const rows = await manager.query<Array<{ total: string | null }>>(
      `SELECT SUM(amount_vnd)::text AS total FROM fund_tax_payments WHERE obligation_id = $1 AND status = 'RECORDED'`,
      [obligationId],
    );
    return BigInt(rows[0]?.total ?? '0');
  }

  private async contractIncome(manager: EntityManager, fundId: string, month: string): Promise<string> {
    const { first, last } = monthBounds(month);
    const lines = await manager
      .getRepository(FundLedgerEntry)
      .createQueryBuilder('line')
      .where('line.fund_id = :fundId AND line.category = :category', { fundId, category: 'CONTRACT_RECEIPT' })
      .andWhere('line.entry_date BETWEEN :first AND :last', { first, last })
      .getMany();
    return lines
      .reduce((total, line) => total + (line.direction === 'IN' ? 1n : -1n) * BigInt(line.amountVnd), 0n)
      .toString();
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    obligation: FundTaxObligation,
    action: string,
    reason?: string,
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.FUND_TAX,
      subjectId: obligation.id,
      buildingId: obligation.buildingId,
      action,
      actorId: actor.id,
      entityVersion: obligation.version,
      reason,
    });
  }
}
