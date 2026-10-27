import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflict, conflictWithReason, forbiddenWithReason } from '../../common/errors';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { settlementInstalment } from '../../domain/payment-settlement';
import { VND_PATTERN } from '../../domain/proposal-quote';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { Building } from '../buildings/entities/building.entity';
import type {
  CompleteRecordDto,
  ConfirmTransferDto,
  PaymentDecisionDto,
  PaymentFieldsDto,
  SubmitPaymentDto,
} from './dto/payment.dto';
import { RepairAcceptance } from './entities/repair-acceptance.entity';
import { RepairPaymentDecision, type PaymentDecisionOutcome } from './entities/repair-payment-decision.entity';
import { RepairPayment, type PaymentKind, type PaymentStatus } from './entities/repair-payment.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { RepairSignature } from './entities/repair-signature.entity';
import type { PaymentFields } from './payment.types';
import type { RecordAction } from './record-actions';
import { loadRecordForAction, validateText } from './record-loader';
import { stepHolderOf } from './record-steps';
import { toRecordView, type RepairRecordView } from './record-view';
import { checkSignature, signatureDataUrl } from './signature';

const ACCOUNT_PATTERN = /^\d{6,20}$/;
const NAME_MAX = 200;
const CONTENT_MAX = 210;
const REFERENCE_MAX = 100;
const REASON_MIN = 5;
const REASON_MAX = 1000;
/** Instalments that are neither transferred nor closed: at most one advance may be open (BR-S4-04). */
const OPEN_STATUSES: readonly PaymentStatus[] = ['PENDING_APPROVAL', 'NEEDS_UPDATE', 'PENDING_TRANSFER'];
/** A submission (new or resubmitted) waits on the first PAYMENT step. */
const SUBMITTED: PaymentStatus = 'PENDING_APPROVAL';
const vndFormatter = new Intl.NumberFormat('vi-VN');
const vnd = (value: bigint | string): string => `${vndFormatter.format(BigInt(value))} ₫`;
/** FX-S2 BR-FX2-04: audit reason when the last PAYMENT step approves a 0-đồng settlement instalment. */
const NO_TRANSFER_REASON = 'Không cần chuyển khoản: số của đợt bằng 0';

/** A well-formed positive amount, or null. */
const positiveAmount = (value: string | undefined): bigint | null =>
  value && VND_PATTERN.test(value) && BigInt(value) > 0n ? BigInt(value) : null;

export interface PaymentDecisionView {
  id: string;
  revisionNo: number;
  stepKey: string;
  actorId: string;
  outcome: PaymentDecisionOutcome;
  reason: string | null;
  createdAt: Date;
}

export interface PaymentView {
  id: string;
  kind: PaymentKind;
  seqNo: number;
  status: PaymentStatus;
  revisionNo: number;
  settlementAmountVnd: string | null;
  amountVnd: string;
  payeeName: string;
  accountNo: string;
  bankName: string;
  transferContent: string;
  requestAttachmentIds: string[];
  invoiceAttachmentIds: string[];
  chainStepKeys: string[];
  currentStepKey: string | null;
  submittedBy: string;
  submittedAt: Date;
  transferDate: string | null;
  transferReference: string | null;
  proofAttachmentIds: string[];
  confirmedBy: string | null;
  confirmedAt: Date | null;
  decisions: PaymentDecisionView[];
  /** The manager's signature of the latest revision. */
  signatureDataUrl: string | null;
}

export interface PaymentHistoryView {
  approvedAmountVnd: string | null;
  transferredTotalVnd: string;
  draft: PaymentFields | null;
  /** Oldest first. */
  payments: PaymentView[];
}

/** The instalment fields present in the body (version and signature left out). */
const fieldsOf = (dto: PaymentFieldsDto): PaymentFields => {
  const picked: PaymentFields = {
    amountVnd: dto.amountVnd,
    payeeName: dto.payeeName,
    accountNo: dto.accountNo,
    bankName: dto.bankName,
    transferContent: dto.transferContent,
    requestAttachmentIds: dto.requestAttachmentIds,
    invoiceAttachmentIds: dto.invoiceAttachmentIds,
  };
  return Object.fromEntries(Object.entries(picked).filter(([, value]) => value !== undefined));
};

const sum = (payments: readonly RepairPayment[]): bigint =>
  payments.reduce((total, row) => total + BigInt(row.amountVnd), 0n);

/**
 * Payment instalments of a repair record (SPEC B03–B09 v2 slice S4): advances (A1, A1b, A2, A3) that never move the
 * record, and the settlement (T17–T22) that leads to COMPLETED. Every action locks the record (and its instalments),
 * checks version and the shared action rules, and writes rows plus audit in one transaction.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** T17: settlement draft; every field optional, a value that is sent must be well formed. */
  async saveDraft(actor: AuthenticatedUser, id: string, dto: PaymentFieldsDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'savePaymentDraft');
      const draft = { ...(record.paymentDraft ?? {}), ...fieldsOf(dto) };
      const errors = new FieldErrors();
      this.checkFormats(errors, draft);
      await this.checkFiles(
        manager,
        errors,
        record,
        draft.requestAttachmentIds,
        'requestAttachmentIds',
        'PAYMENT_REQUEST',
      );
      await this.checkFiles(manager, errors, record, draft.invoiceAttachmentIds, 'invoiceAttachmentIds', 'INVOICE');
      errors.throwIfAny();
      record.paymentDraft = { ...draft };
      return this.commit(manager, actor, record, 'savePaymentDraft', record.status);
    });
  }

  /**
   * T18: the settlement instalment = settled total − transferred advances (BR-S4-01…03), which may be 0 (FX-S2
   * BR-FX2-01). A 0-đồng instalment still needs both files, the signature and the PAYMENT chain, but no payee.
   */
  async submitSettlement(actor: AuthenticatedUser, id: string, dto: SubmitPaymentDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'submitPaymentRequest');
      const payments = await this.paymentsOf(manager, record);
      if (payments.some((row) => row.kind === 'TAM_UNG' && OPEN_STATUSES.includes(row.status))) {
        throw conflictWithReason(
          'open_advance_exists',
          'Còn đợt tạm ứng chưa chuyển khoản. Hoàn tất đợt tạm ứng trước khi gửi quyết toán.',
        );
      }
      const fields = { ...(record.paymentDraft ?? {}), ...fieldsOf(dto) };
      record.paymentDraft = { ...fields };
      const errors = new FieldErrors();
      const passed = await manager.getRepository(RepairAcceptance).existsBy({ recordId: record.id, outcome: 'PASSED' });
      errors.when(!passed, 'acceptance', 'Quyết toán chỉ gửi được khi đã có lượt nghiệm thu đạt.');
      const approved = BigInt(record.approvedAmountVnd ?? '0');
      const advances = sum(payments.filter((row) => row.kind === 'TAM_UNG' && row.status === 'TRANSFERRED'));
      const noTransfer = positiveAmount(fields.amountVnd) === advances;
      const settlement = this.checkSubmission(errors, fields, !noTransfer);
      const instalment = settlement === null ? null : settlementInstalment(settlement, advances);
      if (settlement !== null && instalment !== null) {
        errors.when(settlement > approved, 'amountVnd', 'Số quyết toán không được vượt số được duyệt.');
        errors.when(
          !instalment.ok,
          'amountVnd',
          `Số quyết toán nhỏ hơn tổng tạm ứng đã chuyển khoản (${vnd(advances)}). Hệ thống chưa hỗ trợ trường hợp nhà thầu hoàn lại tiền.`,
        );
      }
      await this.checkFiles(
        manager,
        errors,
        record,
        fields.requestAttachmentIds,
        'requestAttachmentIds',
        'PAYMENT_REQUEST',
        true,
      );
      await this.checkFiles(
        manager,
        errors,
        record,
        fields.invoiceAttachmentIds,
        'invoiceAttachmentIds',
        'INVOICE',
        true,
      );
      const signed = checkSignature(dto.signature);
      if (!signed.ok) errors.add('signature', signed.message);
      errors.throwIfAny();
      if (settlement === null || !instalment?.ok || !signed.ok) return toRecordView(record);

      const existing = payments.find((row) => row.kind === 'QUYET_TOAN');
      const payment = await this.savePayment(manager, actor, record, existing, payments.length, {
        kind: 'QUYET_TOAN',
        amountVnd: instalment.amount.toString(),
        settlementAmountVnd: settlement.toString(),
        fields,
        transferContent: fields.transferContent || (await this.defaultContent(manager, record)),
      });
      await this.sign(manager, record, actor, payment.id, signed.content);
      const reason = `Quyết toán ${vnd(settlement)} − tạm ứng đã chuyển ${vnd(advances)} = ${vnd(payment.amountVnd)}`;
      return this.commit(manager, actor, record, 'submitPaymentRequest', this.waitingStatus(payment), reason);
    });
  }

  /** T19/T20: a PAYMENT step holder decides the settlement. */
  async decideSettlement(
    actor: AuthenticatedUser,
    id: string,
    outcome: PaymentDecisionOutcome,
    dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    const action = outcome === 'APPROVED' ? 'approvePayment' : 'requestPaymentUpdate';
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const payment = this.pick(
        await this.paymentsOf(manager, record),
        'QUYET_TOAN',
        ['PENDING_APPROVAL'],
        dto.paymentId,
      );
      const next = await this.decide(manager, actor, record, payment, outcome, dto.reason);
      let toStatus = record.status;
      if (outcome === 'NEEDS_UPDATE') toStatus = 'NEEDS_PAYMENT_UPDATE';
      else if (!next) toStatus = 'PENDING_PAYMENT';
      const decided = this.decisionReason(payment, dto.reason);
      // BR-FX2-04: the 0-đồng instalment went straight to TRANSFERRED in decide().
      const reason =
        toStatus === 'PENDING_PAYMENT' && payment.amountVnd === '0' ? `${decided}. ${NO_TRANSFER_REASON}` : decided;
      return this.commit(manager, actor, record, action, toStatus, reason);
    });
  }

  /** T21: any PAYMENT_CONFIRM holder in scope confirms the settlement transfer once (BR-S4-06). */
  async confirmSettlementTransfer(
    actor: AuthenticatedUser,
    id: string,
    dto: ConfirmTransferDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'confirmPaymentTransfer');
      const payment = this.pick(
        await this.paymentsOf(manager, record),
        'QUYET_TOAN',
        ['PENDING_TRANSFER'],
        dto.paymentId,
      );
      await this.confirmTransfer(manager, actor, record, payment, dto);
      return this.commit(manager, actor, record, 'confirmPaymentTransfer', record.status, this.transferReason(payment));
    });
  }

  /** T22: the settlement is transferred and every transferred instalment adds up to the settled total (BR-S4-05). */
  async complete(actor: AuthenticatedUser, id: string, dto: CompleteRecordDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'completeRecord');
      const payments = await this.paymentsOf(manager, record);
      const settlement = payments.find((row) => row.kind === 'QUYET_TOAN');
      const transferred = sum(payments.filter((row) => row.status === 'TRANSFERRED'));
      const errors = new FieldErrors();
      errors.when(
        settlement?.status !== 'TRANSFERRED' || transferred !== BigInt(settlement.settlementAmountVnd ?? '0'),
        'payment',
        'Chưa đủ điều kiện đóng: quyết toán phải đã chuyển khoản và tổng các đợt đã chuyển bằng số quyết toán.',
      );
      errors.throwIfAny();
      return this.commit(manager, actor, record, 'completeRecord', 'COMPLETED', `Đã chuyển khoản ${vnd(transferred)}`);
    });
  }

  /** A1: a new advance; one open advance at a time, Σ advances ≤ approved (BR-S4-04). The record status stays. */
  async submitAdvance(actor: AuthenticatedUser, id: string, dto: SubmitPaymentDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'submitAdvanceRequest');
      const payments = await this.paymentsOf(manager, record);
      if (payments.some((row) => row.kind === 'TAM_UNG' && OPEN_STATUSES.includes(row.status))) {
        throw conflictWithReason('open_advance_exists', 'Hồ sơ đang có một đợt tạm ứng chưa hoàn tất.');
      }
      return this.submitAdvanceRevision(manager, actor, record, payments, undefined, dto, 'submitAdvanceRequest');
    });
  }

  /** A1b: the advance sent back for update is resubmitted (same instalment, next revision). */
  async resubmitAdvance(actor: AuthenticatedUser, id: string, dto: SubmitPaymentDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'resubmitAdvanceRequest');
      const payments = await this.paymentsOf(manager, record);
      const advance = payments.find((row) => row.kind === 'TAM_UNG' && row.status === 'NEEDS_UPDATE');
      if (!advance) throw conflictWithReason('invalid_status_transition', 'Không có đợt tạm ứng nào cần bổ sung.');
      return this.submitAdvanceRevision(manager, actor, record, payments, advance, dto, 'resubmitAdvanceRequest');
    });
  }

  /** A2: a PAYMENT step holder decides the open advance. */
  async decideAdvance(
    actor: AuthenticatedUser,
    id: string,
    outcome: PaymentDecisionOutcome,
    dto: PaymentDecisionDto,
  ): Promise<RepairRecordView> {
    const action = outcome === 'APPROVED' ? 'approveAdvance' : 'requestAdvanceUpdate';
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const payment = this.pick(await this.paymentsOf(manager, record), 'TAM_UNG', ['PENDING_APPROVAL'], dto.paymentId);
      await this.decide(manager, actor, record, payment, outcome, dto.reason);
      return this.commit(manager, actor, record, action, record.status, this.decisionReason(payment, dto.reason));
    });
  }

  /** A3: any PAYMENT_CONFIRM holder in scope confirms the advance transfer once. */
  async confirmAdvanceTransfer(
    actor: AuthenticatedUser,
    id: string,
    dto: ConfirmTransferDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'confirmAdvanceTransfer');
      const payment = this.pick(await this.paymentsOf(manager, record), 'TAM_UNG', ['PENDING_TRANSFER'], dto.paymentId);
      await this.confirmTransfer(manager, actor, record, payment, dto);
      return this.commit(manager, actor, record, 'confirmAdvanceTransfer', record.status, this.transferReason(payment));
    });
  }

  /** Instalments with decisions and signatures, the approved amount and what was transferred so far. */
  async historyOf(record: RepairRecord): Promise<PaymentHistoryView> {
    const [payments, decisions, signatures] = await Promise.all([
      this.dataSource.getRepository(RepairPayment).find({ where: { recordId: record.id }, order: { seqNo: 'ASC' } }),
      this.dataSource
        .getRepository(RepairPaymentDecision)
        .find({ where: { recordId: record.id }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.dataSource
        .getRepository(RepairSignature)
        .find({ where: { recordId: record.id, documentType: 'PAYMENT_REQUEST' }, order: { createdAt: 'ASC' } }),
    ]);
    const latestSignature = new Map(signatures.map((row) => [row.documentId, signatureDataUrl(row.content)]));
    return {
      approvedAmountVnd: record.approvedAmountVnd,
      transferredTotalVnd: sum(payments.filter((row) => row.status === 'TRANSFERRED')).toString(),
      draft: record.paymentDraft,
      payments: payments.map((row) => ({
        id: row.id,
        kind: row.kind,
        seqNo: row.seqNo,
        status: row.status,
        revisionNo: row.revisionNo,
        settlementAmountVnd: row.settlementAmountVnd,
        amountVnd: row.amountVnd,
        payeeName: row.payeeName,
        accountNo: row.accountNo,
        bankName: row.bankName,
        transferContent: row.transferContent,
        requestAttachmentIds: [...row.requestAttachmentIds],
        invoiceAttachmentIds: [...row.invoiceAttachmentIds],
        chainStepKeys: [...row.chainStepKeys],
        currentStepKey: row.currentStepKey,
        submittedBy: row.submittedBy,
        submittedAt: row.submittedAt,
        transferDate: row.transferDate,
        transferReference: row.transferReference,
        proofAttachmentIds: [...row.proofAttachmentIds],
        confirmedBy: row.confirmedBy,
        confirmedAt: row.confirmedAt,
        decisions: decisions
          .filter((decision) => decision.paymentId === row.id)
          .map((decision) => ({
            id: decision.id,
            revisionNo: decision.revisionNo,
            stepKey: decision.stepKey,
            actorId: decision.actorId,
            outcome: decision.outcome,
            reason: decision.reason,
            createdAt: decision.createdAt,
          })),
        signatureDataUrl: latestSignature.get(row.id) ?? null,
      })),
    };
  }

  private async submitAdvanceRevision(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    payments: readonly RepairPayment[],
    existing: RepairPayment | undefined,
    dto: SubmitPaymentDto,
    action: RecordAction,
  ): Promise<RepairRecordView> {
    const fields = fieldsOf(dto);
    const errors = new FieldErrors();
    const amount = this.checkSubmission(errors, fields);
    const others = sum(payments.filter((row) => row.kind === 'TAM_UNG' && row.id !== existing?.id));
    if (amount !== null) {
      errors.when(
        others + amount > BigInt(record.approvedAmountVnd ?? '0'),
        'amountVnd',
        `Tổng tạm ứng không được vượt số được duyệt (${vnd(record.approvedAmountVnd ?? '0')}).`,
      );
    }
    await this.checkFiles(
      manager,
      errors,
      record,
      fields.requestAttachmentIds,
      'requestAttachmentIds',
      'PAYMENT_REQUEST',
      true,
    );
    const signed = checkSignature(dto.signature);
    if (!signed.ok) errors.add('signature', signed.message);
    errors.throwIfAny();
    if (amount === null || !signed.ok) return toRecordView(record);
    const payment = await this.savePayment(manager, actor, record, existing, payments.length, {
      kind: 'TAM_UNG',
      amountVnd: amount.toString(),
      settlementAmountVnd: null,
      fields: { ...fields, invoiceAttachmentIds: [] },
      transferContent: fields.transferContent || (await this.defaultContent(manager, record)),
    });
    await this.sign(manager, record, actor, payment.id, signed.content);
    return this.commit(manager, actor, record, action, record.status, `Tạm ứng đợt ${payment.seqNo}: ${vnd(amount)}`);
  }

  /**
   * Status → holder of the instalment's current step (403 `not_step_assignee`) → stale id (409); records the decision
   * and moves the instalment. Returns the next step, if any.
   */
  private async decide(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    payment: RepairPayment,
    outcome: PaymentDecisionOutcome,
    reasonInput: string | undefined,
  ): Promise<string | undefined> {
    const stepKey = payment.currentStepKey ?? '';
    if (stepHolderOf(record, stepKey) !== actor.id) {
      throw forbiddenWithReason(
        'not_step_assignee',
        'Chỉ người được giao ở bước duyệt thanh toán hiện tại mới quyết định được.',
      );
    }
    const reason = (reasonInput ?? '').trim();
    if (outcome === 'NEEDS_UPDATE') {
      const errors = new FieldErrors();
      validateText(errors, 'reason', 'Lý do', reason, REASON_MIN, REASON_MAX);
      errors.throwIfAny();
    }
    const decisions = manager.getRepository(RepairPaymentDecision);
    await decisions.save(
      decisions.create({
        paymentId: payment.id,
        recordId: record.id,
        revisionNo: payment.revisionNo,
        stepKey,
        actorId: actor.id,
        outcome,
        reason: reason || null,
      }),
    );
    const next = payment.chainStepKeys[payment.chainStepKeys.indexOf(stepKey) + 1];
    if (outcome === 'NEEDS_UPDATE') {
      payment.status = 'NEEDS_UPDATE';
      payment.currentStepKey = null;
    } else if (next) {
      payment.currentStepKey = next;
    } else {
      // FX-S2 BR-FX2-04: nothing to transfer for a 0-đồng settlement instalment; confirmedBy/At stay empty.
      payment.status = payment.amountVnd === '0' ? 'TRANSFERRED' : 'PENDING_TRANSFER';
      payment.currentStepKey = null;
    }
    await manager.getRepository(RepairPayment).save(payment);
    return outcome === 'APPROVED' ? next : undefined;
  }

  /** Amount equal to the instalment, date not in the future, reference, at least one PAYMENT_PROOF (§4.4). */
  private async confirmTransfer(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    payment: RepairPayment,
    dto: ConfirmTransferDto,
  ): Promise<void> {
    const errors = new FieldErrors();
    errors.when(
      !VND_PATTERN.test(dto.amountVnd) || dto.amountVnd !== payment.amountVnd,
      'amountVnd',
      `Số tiền đã chuyển phải bằng số của đợt (${vnd(payment.amountVnd)}).`,
    );
    errors.when(dto.transferDate > vnDate(new Date()), 'transferDate', 'Ngày chuyển khoản không được ở tương lai.');
    validateText(errors, 'reference', 'Mã tham chiếu', dto.reference, 1, REFERENCE_MAX);
    await this.checkFiles(manager, errors, record, dto.proofAttachmentIds, 'proofAttachmentIds', 'PAYMENT_PROOF', true);
    errors.throwIfAny();
    payment.status = 'TRANSFERRED';
    payment.transferDate = dto.transferDate;
    payment.transferReference = dto.reference.trim();
    payment.proofAttachmentIds = [...new Set(dto.proofAttachmentIds)];
    payment.confirmedBy = actor.id;
    payment.confirmedAt = new Date();
    await manager.getRepository(RepairPayment).save(payment);
  }

  /**
   * The instalment of `kind` in one of `statuses`. A transferred one answers 409 `payment_already_confirmed`
   * (BR-S4-06); none answers 409; a stale `paymentId` answers 409.
   */
  private pick(
    payments: readonly RepairPayment[],
    kind: PaymentKind,
    statuses: readonly PaymentStatus[],
    paymentId: string | undefined,
  ): RepairPayment {
    const ofKind = payments.filter((row) => row.kind === kind);
    const payment = ofKind.find((row) => statuses.includes(row.status));
    if (!payment) {
      const transferred = ofKind.some((row) => row.status === 'TRANSFERRED') && statuses.includes('PENDING_TRANSFER');
      if (transferred) throw conflictWithReason('payment_already_confirmed', 'Đợt này đã được xác nhận chuyển khoản.');
      throw conflictWithReason(
        'invalid_status_transition',
        'Không có đợt thanh toán nào ở bước này. Vui lòng tải lại.',
      );
    }
    if (paymentId && paymentId !== payment.id) throw conflict('Đợt thanh toán đã thay đổi. Vui lòng tải lại.');
    return payment;
  }

  /** Format of the fields that are present (drafts and submissions). */
  private checkFormats(errors: FieldErrors, fields: PaymentFields): void {
    if (fields.amountVnd !== undefined && fields.amountVnd !== '') {
      errors.when(
        !VND_PATTERN.test(fields.amountVnd) || BigInt(fields.amountVnd) === 0n,
        'amountVnd',
        'Số tiền phải là số nguyên VND lớn hơn 0.',
      );
    }
    if (fields.accountNo)
      errors.when(!ACCOUNT_PATTERN.test(fields.accountNo), 'accountNo', 'Số tài khoản gồm 6–20 chữ số.');
    errors.when((fields.payeeName ?? '').length > NAME_MAX, 'payeeName', `Tên tài khoản tối đa ${NAME_MAX} ký tự.`);
    errors.when((fields.bankName ?? '').length > NAME_MAX, 'bankName', `Ngân hàng tối đa ${NAME_MAX} ký tự.`);
    errors.when(
      (fields.transferContent ?? '').length > CONTENT_MAX,
      'transferContent',
      `Nội dung chuyển khoản tối đa ${CONTENT_MAX} ký tự.`,
    );
  }

  /**
   * Completeness of a submission; returns the amount, or null when it is missing or invalid. The payee is optional
   * only for a 0-đồng settlement instalment (FX-S2 BR-FX2-03); a value that is sent is still checked.
   */
  private checkSubmission(errors: FieldErrors, fields: PaymentFields, requirePayee = true): bigint | null {
    this.checkFormats(errors, fields);
    errors.when(!fields.amountVnd, 'amountVnd', 'Cần số tiền.');
    if (requirePayee) {
      errors.when(!fields.payeeName, 'payeeName', 'Cần tên tài khoản người hưởng.');
      errors.when(!fields.accountNo, 'accountNo', 'Cần số tài khoản.');
      errors.when(!fields.bankName, 'bankName', 'Cần ngân hàng.');
    }
    return positiveAmount(fields.amountVnd);
  }

  /** Each id must be a file of this record with the purpose; `required` asks for at least one. */
  private async checkFiles(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    ids: readonly string[] | undefined,
    field: string,
    purpose: string,
    required = false,
  ): Promise<void> {
    const unique = [...new Set(ids ?? [])];
    if (unique.length === 0) {
      errors.when(required, field, 'Cần ít nhất 1 tệp.');
      return;
    }
    const rows = await manager.getRepository(Attachment).findBy({ id: In(unique) });
    const valid = rows.filter((row) => row.subjectId === record.id && row.purpose === purpose);
    errors.when(valid.length !== unique.length, field, 'Tệp đính kèm không hợp lệ hoặc không thuộc hồ sơ này.');
  }

  private async savePayment(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    existing: RepairPayment | undefined,
    count: number,
    input: {
      kind: PaymentKind;
      amountVnd: string;
      settlementAmountVnd: string | null;
      fields: PaymentFields;
      transferContent: string;
    },
  ): Promise<RepairPayment> {
    const repo = manager.getRepository(RepairPayment);
    const chain = record.workflowStageApprovalStepKeys?.PAYMENT?.length
      ? [...(record.workflowStageApprovalStepKeys.PAYMENT ?? [])]
      : ['BOARD'];
    const values = {
      kind: input.kind,
      status: SUBMITTED,
      amountVnd: input.amountVnd,
      settlementAmountVnd: input.settlementAmountVnd,
      payeeName: input.fields.payeeName ?? '',
      accountNo: input.fields.accountNo ?? '',
      bankName: input.fields.bankName ?? '',
      transferContent: input.transferContent,
      requestAttachmentIds: [...new Set(input.fields.requestAttachmentIds ?? [])],
      invoiceAttachmentIds: [...new Set(input.fields.invoiceAttachmentIds ?? [])],
      chainStepKeys: chain,
      currentStepKey: chain[0],
      submittedBy: actor.id,
      submittedAt: new Date(),
    };
    if (existing) {
      Object.assign(existing, values, { revisionNo: existing.revisionNo + 1 });
      return repo.save(existing);
    }
    return repo.save(repo.create({ ...values, recordId: record.id, seqNo: count + 1, revisionNo: 1 }));
  }

  private async sign(
    manager: EntityManager,
    record: RepairRecord,
    actor: AuthenticatedUser,
    paymentId: string,
    content: Buffer,
  ): Promise<void> {
    const repo = manager.getRepository(RepairSignature);
    await repo.save(
      repo.create({
        recordId: record.id,
        documentType: 'PAYMENT_REQUEST',
        documentId: paymentId,
        signerId: actor.id,
        mimeType: 'image/png',
        content,
      }),
    );
  }

  /** §4.4 default "BQT «mã tòa» THANH TOAN CHI PHI «mã hồ sơ»". */
  private async defaultContent(manager: EntityManager, record: RepairRecord): Promise<string> {
    const building = await manager.getRepository(Building).findOneBy({ id: record.buildingId });
    return `BQT ${building?.code ?? ''} THANH TOAN CHI PHI ${record.code}`;
  }

  /** v1 BR-11: one BOARD step waits as PENDING_PAYMENT_APPROVAL, any other chain as the custom status. */
  private waitingStatus(payment: RepairPayment): string {
    return payment.chainStepKeys.length === 1 && payment.chainStepKeys[0] === 'BOARD'
      ? 'PENDING_PAYMENT_APPROVAL'
      : 'PENDING_CUSTOM_PAYMENT_APPROVAL';
  }

  /** Instalments of the record, locked for the transaction (sums and "one open advance" stay consistent). */
  private async paymentsOf(manager: EntityManager, record: RepairRecord): Promise<RepairPayment[]> {
    return manager
      .getRepository(RepairPayment)
      .find({ where: { recordId: record.id }, order: { seqNo: 'ASC' }, lock: { mode: 'pessimistic_write' } });
  }

  private decisionReason(payment: RepairPayment, reason: string | undefined): string {
    const label = payment.kind === 'TAM_UNG' ? `Tạm ứng đợt ${payment.seqNo}` : 'Quyết toán';
    return reason?.trim() ? `${label}: ${reason.trim()}` : label;
  }

  private transferReason(payment: RepairPayment): string {
    const label = payment.kind === 'TAM_UNG' ? `Tạm ứng đợt ${payment.seqNo}` : 'Quyết toán';
    return `${label}: ${vnd(payment.amountVnd)}, mã ${payment.transferReference ?? ''}, ngày ${payment.transferDate ?? ''}`;
  }

  private async commit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    action: RecordAction,
    toStatus: string,
    reason?: string,
  ): Promise<RepairRecordView> {
    const fromStatus = record.status;
    record.status = toStatus;
    record.version += 1;
    const saved = await manager.getRepository(RepairRecord).save(record);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.REPAIR_RECORD,
      subjectId: saved.id,
      buildingId: saved.buildingId,
      action,
      actorId: actor.id,
      entityVersion: saved.version,
      fromStatus,
      toStatus: saved.status,
      ...(reason ? { reason } : {}),
    });
    return toRecordView(saved);
  }
}
