import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { isIsoDate, vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { groupVnd, monthBounds } from '../../domain/fund-ledger';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type { FundReasonDto, FundVersionDto, PayVoucherDto, UpdateVoucherDto, VoucherFieldsDto } from './dto/fund.dto';
import type { LedgerCategory } from './entities/fund-ledger-entry.entity';
import { FundVoucherDecision, type VoucherDecisionKind } from './entities/fund-voucher-decision.entity';
import { FundVoucher, type VoucherCategory, type VoucherStatus } from './entities/fund-voucher.entity';
import { Fund } from './entities/fund.entity';
import { depositPosition } from './deposit-held';
import { checkFundFile } from './fund-files';
import { FundLedgerService } from './fund-ledger.service';
import { assertFundApprove, assertFundOperate, assertFundView, isVnd, validateReason, vnd } from './fund-rules';

const CODE_PREFIX = 'PC';
const CODE_WIDTH = 3;
const AUDIT_LIMIT = 100;
const CONTENT_MIN = 10;
const CONTENT_MAX = 1000;
const PAYEE_MAX = 200;
/** D-F3-4: until group T exists, the maintenance fund is the only receiving fund. */
const TARGET_FUNDS = ['BAO_TRI'] as const;

export const VOUCHER_CATEGORY_LEDGER: Readonly<Record<VoucherCategory, LedgerCategory>> = {
  SERVICE: 'SERVICE',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
  DEPOSIT_REFUND: 'DEPOSIT_REFUND',
} as const;
const EDITABLE: readonly VoucherStatus[] = ['DRAFT', 'NEEDS_CHANGES'];
const CANCELLABLE: readonly VoucherStatus[] = ['DRAFT', 'NEEDS_CHANGES', 'APPROVED'];

export interface VoucherCounts {
  pending: number;
  approved: number;
  /** Σ of vouchers paid in the month (net: a cancelled one leaves). */
  paidThisMonthVnd: string;
  rejected: number;
}

/** F-S4 BR-F4-11: a paid voucher shows the bank line it is matched with. */
export type VoucherRow = FundVoucher & { statementCode: string | null };

export interface VoucherDetail {
  voucher: VoucherRow;
  decisions: FundVoucherDecision[];
  files: Record<string, Attachment>;
  audit: AuditEventView[];
}

/** Payment vouchers (SPEC F-S3 BR-F3-12, BR-F3-13); only a paid one is on the ledger. */
@Injectable()
export class VouchersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: FundLedgerService,
    private readonly codes: CodeCounterService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    actor: AuthenticatedUser,
    fundId: string,
    month: string,
  ): Promise<{ rows: VoucherRow[]; counts: VoucherCounts }> {
    const fund = await this.dataSource.getRepository(Fund).findOneBy({ id: fundId });
    if (!fund || !actor.buildingIds.includes(fund.buildingId)) throw notFound('Không tìm thấy quỹ.');
    assertFundView(actor);
    const rows = await this.dataSource
      .getRepository(FundVoucher)
      .find({ where: { fundId }, order: { createdAt: 'DESC' } });
    const { first, last } = /^\d{4}-\d{2}$/.test(month)
      ? monthBounds(month)
      : monthBounds(vnDate(this.clock.now()).slice(0, 7));
    const paid = rows.filter((row) => row.status === 'PAID' && row.paidOn && row.paidOn >= first && row.paidOn <= last);
    const codes = await this.ledger.statementCodes(
      this.dataSource.manager,
      rows.flatMap((row) => (row.ledgerEntryId ? [row.ledgerEntryId] : [])),
    );
    return {
      rows: rows.map((row) => ({
        ...row,
        statementCode: row.ledgerEntryId ? (codes.get(row.ledgerEntryId) ?? null) : null,
      })),
      counts: {
        pending: rows.filter((row) => row.status === 'PENDING').length,
        approved: rows.filter((row) => row.status === 'APPROVED').length,
        paidThisMonthVnd: paid.reduce((total, row) => total + BigInt(row.amountVnd), 0n).toString(),
        rejected: rows.filter((row) => row.status === 'REJECTED').length,
      },
    };
  }

  async detail(actor: AuthenticatedUser, id: string): Promise<VoucherDetail> {
    const voucher = await this.dataSource.getRepository(FundVoucher).findOneBy({ id });
    if (!voucher || !actor.buildingIds.includes(voucher.buildingId)) throw notFound('Không tìm thấy phiếu chi.');
    assertFundView(actor);
    const ids = [voucher.requestAttachmentId, voucher.proofAttachmentId].filter((value): value is string =>
      Boolean(value),
    );
    const [decisions, files, audit] = await Promise.all([
      this.dataSource
        .getRepository(FundVoucherDecision)
        .find({ where: { voucherId: id }, order: { decidedAt: 'ASC' } }),
      this.dataSource.getRepository(Attachment).findBy({ id: In(ids) }),
      this.audit.listForSubject(SUBJECT_TYPE.FUND_VOUCHER, id, { page: 1, limit: AUDIT_LIMIT }),
    ]);
    const codes = voucher.ledgerEntryId
      ? await this.ledger.statementCodes(this.dataSource.manager, [voucher.ledgerEntryId])
      : new Map<string, string>();
    return {
      voucher: { ...voucher, statementCode: voucher.ledgerEntryId ? (codes.get(voucher.ledgerEntryId) ?? null) : null },
      decisions,
      files: Object.fromEntries(files.map((file) => [file.id, file])),
      audit: audit.data,
    };
  }

  /** BR-F3-12: Kế toán drafts a voucher. */
  async create(actor: AuthenticatedUser, fundId: string, dto: VoucherFieldsDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, fundId);
      assertFundOperate(actor);
      const fields = await this.validate(manager, fund.id, dto);
      const repo = manager.getRepository(FundVoucher);
      const saved = await repo.save(
        repo.create({
          ...fields,
          code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH),
          fundId: fund.id,
          buildingId: fund.buildingId,
          status: 'DRAFT',
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.record(manager, actor, saved, 'createFundVoucher', { toStatus: 'DRAFT' });
      return saved;
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateVoucherDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const voucher = await this.lock(manager, actor, id, dto.version, assertFundOperate);
      if (!EDITABLE.includes(voucher.status))
        throw conflictWithReason('voucher_locked', 'Chỉ sửa được phiếu nháp hoặc cần sửa.');
      Object.assign(voucher, await this.validate(manager, voucher.fundId, dto, voucher.id));
      await this.save(manager, actor, voucher, 'updateFundVoucher');
      return voucher;
    });
  }

  async submit(actor: AuthenticatedUser, id: string, dto: FundVersionDto): Promise<FundVoucher> {
    return this.move(actor, id, dto.version, assertFundOperate, EDITABLE, 'PENDING', 'SUBMIT', 'submitFundVoucher');
  }

  /** BR-F3-12, BR-F3-14: BQT decides; Kế toán gets 403 even when it drafted the voucher (AC-F3.13). */
  async approve(actor: AuthenticatedUser, id: string, dto: FundVersionDto): Promise<FundVoucher> {
    return this.move(
      actor,
      id,
      dto.version,
      assertFundApprove,
      ['PENDING'],
      'APPROVED',
      'APPROVE',
      'approveFundVoucher',
    );
  }

  async requestChanges(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundVoucher> {
    return this.move(
      actor,
      id,
      dto.version,
      assertFundApprove,
      ['PENDING'],
      'NEEDS_CHANGES',
      'REQUEST_CHANGES',
      'requestFundVoucherChanges',
      dto.reason,
    );
  }

  async reject(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundVoucher> {
    return this.move(
      actor,
      id,
      dto.version,
      assertFundApprove,
      ['PENDING'],
      'REJECTED',
      'REJECT',
      'rejectFundVoucher',
      dto.reason,
    );
  }

  /**
   * BR-F3-12, BR-F3-13: an approved voucher is paid on a day between its approval and today, with the transfer proof;
   * that is its one ledger line, refused when the fund would go below zero that day or any day after.
   */
  async pay(actor: AuthenticatedUser, id: string, dto: PayVoucherDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const head = await this.headOf(manager, actor, id);
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      const voucher = await this.lock(manager, actor, id, dto.version, assertFundOperate);
      if (voucher.status !== 'APPROVED')
        throw conflictWithReason('voucher_not_approved', 'Chỉ ghi đã chi phiếu đã duyệt.');
      const errors = new FieldErrors();
      const approvedOn = voucher.approvedAt ? vnDate(voucher.approvedAt) : '';
      errors.when(!isIsoDate(dto.paidOn), 'paidOn', 'Ngày chi không hợp lệ.');
      errors.when(isIsoDate(dto.paidOn) && dto.paidOn < approvedOn, 'paidOn', 'Ngày chi không được trước ngày duyệt.');
      errors.when(
        isIsoDate(dto.paidOn) && dto.paidOn > this.ledger.today(),
        'paidOn',
        'Ngày chi không được sau hôm nay.',
      );
      await checkFundFile(manager, errors, fund.id, dto.proofAttachmentId, 'VOUCHER_PROOF', 'proofAttachmentId');
      if (voucher.contractId) {
        const { heldVnd } = await depositPosition(manager, voucher.contractId);
        errors.when(
          BigInt(voucher.amountVnd) > heldVnd,
          'paidOn',
          `Vượt tiền cọc đang giữ (${groupVnd(heldVnd.toString())} ₫).`,
        );
      }
      errors.throwIfAny();
      const line = await this.ledger.post(
        manager,
        fund,
        {
          entryDate: dto.paidOn,
          direction: 'OUT',
          amountVnd: voucher.amountVnd,
          category: VOUCHER_CATEGORY_LEDGER[voucher.category],
          sourceType: 'VOUCHER',
          sourceId: voucher.id,
          sourceCode: voucher.code,
          description: voucher.content,
        },
        actor.id,
        { date: 'paidOn', amount: 'paidOn' },
      );
      Object.assign(voucher, {
        status: 'PAID',
        paidOn: dto.paidOn,
        proofAttachmentId: dto.proofAttachmentId,
        ledgerEntryId: line.id,
      });
      await this.decide(manager, actor, voucher, 'PAY');
      await this.save(manager, actor, voucher, 'payFundVoucher', { fromStatus: 'APPROVED', toStatus: 'PAID' });
      return voucher;
    });
  }

  /**
   * BR-F3-12: Kế toán cancels a voucher not yet paid; a PAID one (recorded by mistake) only asks, and BQT's approval
   * adds the reversal line (BR-F3-04).
   */
  async cancel(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const voucher = await this.lock(manager, actor, id, dto.version, assertFundOperate);
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      if (voucher.status === 'PAID') {
        if (voucher.cancelRequest) throw conflictWithReason('cancel_pending', 'Đã có yêu cầu hủy chờ BQT duyệt.');
        voucher.cancelRequest = {
          reason: dto.reason,
          requestedBy: actor.id,
          requestedAt: this.clock.now().toISOString(),
        };
        await this.decide(manager, actor, voucher, 'REQUEST_CANCEL', dto.reason);
        await this.save(manager, actor, voucher, 'requestFundVoucherCancel', { reason: dto.reason });
        return voucher;
      }
      if (!CANCELLABLE.includes(voucher.status))
        throw conflictWithReason('voucher_closed', 'Phiếu chi không hủy được ở trạng thái này.');
      const from = voucher.status;
      Object.assign(voucher, { status: 'CANCELLED', cancelReason: dto.reason, cancelledAt: this.clock.now() });
      await this.decide(manager, actor, voucher, 'CANCEL', dto.reason);
      await this.save(manager, actor, voucher, 'cancelFundVoucher', {
        fromStatus: from,
        toStatus: 'CANCELLED',
        reason: dto.reason,
      });
      return voucher;
    });
  }

  async approveCancel(actor: AuthenticatedUser, id: string, dto: FundVersionDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const head = await this.headOf(manager, actor, id);
      const fund = await this.ledger.lockFund(manager, actor.buildingIds, head.fundId);
      const voucher = await this.lock(manager, actor, id, dto.version, assertFundApprove);
      const request = voucher.cancelRequest;
      if (voucher.status !== 'PAID' || !request || !voucher.ledgerEntryId)
        throw conflictWithReason('no_cancel_request', 'Không có yêu cầu hủy chờ duyệt.');
      await this.ledger.reverse(manager, fund, voucher.ledgerEntryId, actor.id, request.reason);
      Object.assign(voucher, {
        status: 'CANCELLED',
        cancelReason: request.reason,
        cancelRequest: null,
        cancelledAt: this.clock.now(),
      });
      await this.decide(manager, actor, voucher, 'APPROVE_CANCEL');
      await this.save(manager, actor, voucher, 'approveFundVoucherCancel', {
        fromStatus: 'PAID',
        toStatus: 'CANCELLED',
        reason: request.reason,
      });
      return voucher;
    });
  }

  async rejectCancel(actor: AuthenticatedUser, id: string, dto: FundReasonDto): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const voucher = await this.lock(manager, actor, id, dto.version, assertFundApprove);
      if (!voucher.cancelRequest) throw conflictWithReason('no_cancel_request', 'Không có yêu cầu hủy chờ duyệt.');
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      voucher.cancelRequest = null;
      await this.decide(manager, actor, voucher, 'REJECT_CANCEL', dto.reason);
      await this.save(manager, actor, voucher, 'rejectFundVoucherCancel', { reason: dto.reason });
      return voucher;
    });
  }

  private async move(
    actor: AuthenticatedUser,
    id: string,
    version: number,
    allowed: (actor: AuthenticatedUser) => void,
    from: readonly VoucherStatus[],
    to: VoucherStatus,
    decision: VoucherDecisionKind,
    action: string,
    reason?: string,
  ): Promise<FundVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const voucher = await this.lock(manager, actor, id, version, allowed);
      if (!from.includes(voucher.status))
        throw conflictWithReason('voucher_wrong_status', 'Phiếu chi không ở trạng thái cho thao tác này.');
      if (reason !== undefined) {
        const errors = new FieldErrors();
        validateReason(errors, reason);
        errors.throwIfAny();
      }
      const fromStatus = voucher.status;
      voucher.status = to;
      if (to === 'APPROVED') Object.assign(voucher, { approvedBy: actor.id, approvedAt: this.clock.now() });
      await this.decide(manager, actor, voucher, decision, reason);
      await this.save(manager, actor, voucher, action, { fromStatus, toStatus: to, reason });
      return voucher;
    });
  }

  /** BR-F3-12 fields: a transfer names the receiving fund (D-F3-4). */
  private async validate(
    manager: EntityManager,
    fundId: string,
    dto: VoucherFieldsDto,
    voucherId: string | null = null,
  ): Promise<Partial<FundVoucher>> {
    const errors = new FieldErrors();
    const refund = dto.category === 'DEPOSIT_REFUND';
    const transfer = dto.category === 'TRANSFER';
    const target = dto.targetFundKind ?? null;
    errors.when(transfer && !TARGET_FUNDS.some((kind) => kind === target), 'targetFundKind', 'Chọn quỹ nhận.');
    errors.when(
      dto.content.length < CONTENT_MIN || dto.content.length > CONTENT_MAX,
      'content',
      `Nội dung từ ${CONTENT_MIN} đến ${CONTENT_MAX} ký tự.`,
    );
    errors.when(
      !dto.payeeName || dto.payeeName.length > PAYEE_MAX,
      'payeeName',
      'Nhập người nhận tiền (tối đa 200 ký tự).',
    );
    errors.when((dto.payeeAccount ?? '').length > 60, 'payeeAccount', 'Số tài khoản tối đa 60 ký tự.');
    errors.when(!isVnd(dto.amountVnd), 'amountVnd', 'Số tiền là số nguyên VND lớn hơn 0.');
    await checkFundFile(manager, errors, fundId, dto.requestAttachmentId, 'VOUCHER_REQUEST', 'requestAttachmentId');
    if (refund) await this.checkRefund(manager, errors, fundId, dto, voucherId);
    errors.throwIfAny();
    return {
      category: dto.category,
      targetFundKind: transfer ? 'BAO_TRI' : null,
      content: dto.content,
      payeeName: dto.payeeName,
      payeeAccount: dto.payeeAccount ?? null,
      amountVnd: vnd(dto.amountVnd),
      requestAttachmentId: dto.requestAttachmentId,
      contractId: refund ? (dto.contractId ?? null) : null,
    };
  }

  /** BR-F5-12: a refund names a contract being terminated in this fund's building, within the deposit it still holds. */
  private async checkRefund(
    manager: EntityManager,
    errors: FieldErrors,
    fundId: string,
    dto: VoucherFieldsDto,
    voucherId: string | null,
  ): Promise<void> {
    const [contract] = dto.contractId
      ? await manager.query<Array<{ status: string; building_id: string; code: string }>>(
          `SELECT c.status, c.building_id, c.code FROM exploitation_contracts c JOIN funds f ON f.building_id = c.building_id
            WHERE c.id = $1 AND f.id = $2`,
          [dto.contractId, fundId],
        )
      : [];
    if (!contract) {
      errors.add('contractId', 'Chọn hợp đồng hoàn cọc.');
      return;
    }
    if (contract.status !== 'TERMINATING') errors.add('contractId', 'Chỉ hoàn cọc cho hợp đồng đang thanh lý.');
    const { heldVnd, reservedVnd } = await depositPosition(manager, dto.contractId as string, voucherId);
    const free = heldVnd - reservedVnd;
    if (isVnd(dto.amountVnd) && BigInt(dto.amountVnd) > free)
      errors.add('amountVnd', `Vượt tiền cọc đang giữ của ${contract.code} (${groupVnd(free.toString())} ₫).`);
  }

  private async headOf(manager: EntityManager, actor: AuthenticatedUser, id: string): Promise<FundVoucher> {
    const voucher = await manager.getRepository(FundVoucher).findOneBy({ id });
    if (!voucher || !actor.buildingIds.includes(voucher.buildingId)) throw notFound('Không tìm thấy phiếu chi.');
    return voucher;
  }

  private async lock(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
    allowed: (actor: AuthenticatedUser) => void,
  ): Promise<FundVoucher> {
    const voucher = await manager
      .getRepository(FundVoucher)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!voucher || !actor.buildingIds.includes(voucher.buildingId)) throw notFound('Không tìm thấy phiếu chi.');
    allowed(actor);
    assertVersion(voucher.version, version);
    return voucher;
  }

  private async decide(
    manager: EntityManager,
    actor: AuthenticatedUser,
    voucher: FundVoucher,
    decision: VoucherDecisionKind,
    reason?: string,
  ): Promise<void> {
    await manager.getRepository(FundVoucherDecision).insert({
      voucherId: voucher.id,
      decision,
      reason: reason ?? null,
      decidedBy: actor.id,
      decidedAt: this.clock.now(),
    });
  }

  private async save(
    manager: EntityManager,
    actor: AuthenticatedUser,
    voucher: FundVoucher,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    voucher.version += 1;
    await manager.getRepository(FundVoucher).save(voucher);
    await this.record(manager, actor, voucher, action, extra);
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    voucher: FundVoucher,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.FUND_VOUCHER,
      subjectId: voucher.id,
      buildingId: voucher.buildingId,
      action,
      actorId: actor.id,
      entityVersion: voucher.version,
      ...extra,
    });
  }
}
