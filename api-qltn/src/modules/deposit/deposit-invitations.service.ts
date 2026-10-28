import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { TERM_MAX_DAYS, TERM_MIN_DAYS } from '../../domain/deposit';
import { Attachment } from '../attachments/entities/attachment.entity';
import { toAttachmentView, type AttachmentView } from '../attachments/attachment-view';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { isIsoDate, parseInstant, validateReason } from '../exploitation/package-rules';
import { Fund } from '../fund/entities/fund.entity';
import { assertDepositManage, assertDepositView } from './deposit-access';
import { bankView, type BankView } from './deposit-banks.service';
import { compareOffers, progressOf, type Comparison } from './deposit-views';
import type {
  CreateInvitationDto,
  ExtendInvitationDto,
  InvitationFieldsDto,
  ReasonDto,
  SendInvitationDto,
  UpdateInvitationDto,
} from './dto/deposit.dto';
import { DepositBank } from './entities/deposit-bank.entity';
import { DepositInvitation, type InvitationStatus } from './entities/deposit-invitation.entity';
import { DepositOffer } from './entities/deposit-offer.entity';
import { DepositSelection, LIVE_DEPOSIT_SELECTION_STATUSES } from './entities/deposit-selection.entity';

const CODE_PREFIX = 'MC';
const CODE_WIDTH = 3;
const CONDITIONS_MAX = 2000;
const AUDIT_LIMIT = 100;
const NOT_FOUND = 'Không tìm thấy thư mời.';
const DIGITS = /^\d{1,15}$/;

export type AuditExtra = { fromStatus?: string; toStatus?: string; reason?: string };

export interface InvitationRow {
  id: string;
  code: string;
  fundId: string;
  buildingId: string;
  amountVnd: string;
  termDays: number;
  deadlineAt: Date | null;
  status: InvitationStatus;
  sentOn: string | null;
  responded: number;
  invited: number;
  /** The live result's state, if any (list figure "Chờ duyệt kết quả"). */
  selectionStatus: string | null;
  /** When the selected bank was approved (list figure "Đã chọn trong năm"). */
  decidedAt: string | null;
  version: number;
}

export interface OfferView extends DepositOffer {
  interestVnd: string;
}

export interface InvitationDetail {
  invitation: DepositInvitation;
  progress: { responded: number; invited: number };
  invitees: Array<BankView & { offerId: string | null }>;
  offers: OfferView[];
  comparison: Comparison;
  selections: DepositSelection[];
  banks: Record<string, BankView>;
  files: Record<string, AttachmentView>;
  audit: AuditEventView[];
}

/** Rate invitations of a maintenance fund (SPEC T-S1 BR-T1-03..05); every write is audited and version-locked. */
@Injectable()
export class DepositInvitationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
    private readonly clock: Clock,
  ) {}

  async list(actor: AuthenticatedUser, buildingId?: string): Promise<InvitationRow[]> {
    assertDepositView(actor);
    const scope = buildingId ? actor.buildingIds.filter((id) => id === buildingId) : actor.buildingIds;
    if (scope.length === 0) return [];
    const manager = this.dataSource.manager;
    const invitations = await manager
      .getRepository(DepositInvitation)
      .find({ where: { buildingId: In(scope) }, order: { createdAt: 'DESC' } });
    const ids = invitations.map((row) => row.id);
    const [offers, selections] = ids.length
      ? await Promise.all([
          manager
            .getRepository(DepositOffer)
            .find({ where: { invitationId: In(ids) }, select: { invitationId: true, bankId: true } }),
          manager.getRepository(DepositSelection).find({
            where: { invitationId: In(ids), status: In([...LIVE_DEPOSIT_SELECTION_STATUSES]) },
            order: { createdAt: 'DESC' },
          }),
        ])
      : [[], []];
    return invitations.map((row) => {
      const own = offers.filter((offer) => offer.invitationId === row.id);
      const live = selections.find((selection) => selection.invitationId === row.id);
      const approved = live?.decisions.filter((decision) => decision.decision === 'APPROVE').at(-1);
      return {
        id: row.id,
        code: row.code,
        fundId: row.fundId,
        buildingId: row.buildingId,
        amountVnd: row.amountVnd,
        termDays: row.termDays,
        deadlineAt: row.deadlineAt,
        status: row.status,
        sentOn: row.sentOn,
        ...progressOf(row, own),
        selectionStatus: live?.status ?? null,
        decidedAt: live?.status === 'APPROVED' ? (approved?.at ?? null) : null,
        version: row.version,
      };
    });
  }

  async detail(actor: AuthenticatedUser, id: string): Promise<InvitationDetail> {
    assertDepositView(actor);
    const manager = this.dataSource.manager;
    const invitation = await manager.getRepository(DepositInvitation).findOneBy({ id });
    if (!invitation || !actor.buildingIds.includes(invitation.buildingId)) throw notFound(NOT_FOUND);
    const [offers, selections] = await Promise.all([
      manager.getRepository(DepositOffer).find({ where: { invitationId: id }, order: { receivedAt: 'ASC' } }),
      manager.getRepository(DepositSelection).find({ where: { invitationId: id }, order: { createdAt: 'DESC' } }),
    ]);
    const bankIds = [
      ...new Set([
        ...invitation.inviteeIds,
        ...offers.map((row) => row.bankId),
        ...selections.flatMap((row) => row.comparison.map((line) => line.bankId)),
      ]),
    ];
    const banks = bankIds.length ? await manager.getRepository(DepositBank).findBy({ id: In(bankIds) }) : [];
    const comparison = compareOffers(invitation, offers, banks);
    const fileIds = [
      invitation.letterAttachmentId,
      ...offers.map((row) => row.attachmentId),
      ...selections.map((row) => row.minutesAttachmentId),
    ].filter((value): value is string => Boolean(value));
    const files = fileIds.length
      ? await manager.getRepository(Attachment).findBy({ id: In([...new Set(fileIds)]) })
      : [];
    const audits = await Promise.all([
      this.audit.listForSubject(SUBJECT_TYPE.DEPOSIT_INVITATION, id, { page: 1, limit: AUDIT_LIMIT }),
      ...selections.map((row) =>
        this.audit.listForSubject(SUBJECT_TYPE.DEPOSIT_SELECTION, row.id, { page: 1, limit: AUDIT_LIMIT }),
      ),
    ]);
    const audit = audits
      .flatMap((page) => page.data)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      invitation,
      progress: progressOf(invitation, offers),
      invitees: invitation.inviteeIds
        .map((bankId) => banks.find((bank) => bank.id === bankId))
        .filter((bank): bank is DepositBank => Boolean(bank))
        .map((bank) => ({ ...bankView(bank), offerId: offers.find((offer) => offer.bankId === bank.id)?.id ?? null })),
      offers: offers.map((offer) => ({
        ...offer,
        interestVnd: comparison.rows.find((row) => row.offerId === offer.id)?.interestVnd ?? '0',
      })),
      comparison,
      selections,
      banks: Object.fromEntries(banks.map((bank) => [bank.id, bankView(bank)])),
      files: Object.fromEntries(files.map((file) => [file.id, toAttachmentView(file)])),
      audit,
    };
  }

  /** BR-T1-03: a draft on the building's maintenance fund; what "Ghi nhận gửi" needs may still be missing. */
  async create(actor: AuthenticatedUser, dto: CreateInvitationDto): Promise<DepositInvitation> {
    assertDepositManage(actor);
    if (!actor.buildingIds.includes(dto.buildingId)) throw notFound('Không tìm thấy quỹ bảo trì.');
    return this.dataSource.transaction(async (manager) => {
      const fund = await manager.getRepository(Fund).findOneBy({ buildingId: dto.buildingId, kind: 'BAO_TRI' });
      if (!fund) throw notFound('Không tìm thấy quỹ bảo trì.');
      const values = await this.validate(manager, dto, null);
      const repo = manager.getRepository(DepositInvitation);
      const saved = await repo.save(
        repo.create({
          ...values,
          code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH),
          fundId: fund.id,
          buildingId: fund.buildingId,
          status: 'DRAFT',
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.record(manager, actor, saved, 'createDepositInvitation', { toStatus: 'DRAFT' });
      return saved;
    });
  }

  /**
   * BR-T1-04: a draft changes freely; once sent the amount and term are fixed (D-T1-4) and the deadline moves only
   * through "Gia hạn"; banks can still be added.
   */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateInvitationDto): Promise<DepositInvitation> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, dto.version);
      if (invitation.status !== 'DRAFT' && invitation.status !== 'OPEN')
        throw conflictWithReason('invitation_locked', 'Thư mời không còn sửa được.');
      if (invitation.status === 'OPEN') this.assertSentTermsKept(invitation, dto);
      Object.assign(invitation, await this.validate(manager, dto, invitation));
      await this.save(manager, actor, invitation, 'updateDepositInvitation');
      return invitation;
    });
  }

  /** BR-T1-04: a draft that was never sent can be deleted. */
  async remove(actor: AuthenticatedUser, id: string, version: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, version);
      if (invitation.status !== 'DRAFT' || invitation.sentOn)
        throw conflictWithReason('invitation_not_draft', 'Chỉ xóa được thư nháp chưa từng gửi.');
      await this.record(manager, actor, invitation, 'deleteDepositInvitation', { fromStatus: 'DRAFT' });
      await manager.getRepository(DepositInvitation).delete({ id: invitation.id });
    });
  }

  /** BR-T1-04 "Ghi nhận gửi" (AC-T1.2): the letter, at least one bank in use, a deadline after now, sent ≤ today. */
  async send(actor: AuthenticatedUser, id: string, dto: SendInvitationDto): Promise<DepositInvitation> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, dto.version);
      if (invitation.status !== 'DRAFT') throw conflictWithReason('invitation_not_draft', 'Thư mời đã được gửi.');
      const now = this.clock.now();
      const active = invitation.inviteeIds.length
        ? await manager.getRepository(DepositBank).countBy({ id: In(invitation.inviteeIds), active: true })
        : 0;
      const errors = new FieldErrors();
      errors.when(!invitation.letterAttachmentId, 'letterAttachmentId', 'Cần tệp thư mời.');
      errors.when(active === 0, 'inviteeIds', 'Cần ít nhất một ngân hàng đang dùng được mời.');
      errors.when(!invitation.deadlineAt, 'deadlineAt', 'Cần hạn phản hồi.');
      errors.when(
        Boolean(invitation.deadlineAt && invitation.deadlineAt.getTime() <= now.getTime()),
        'deadlineAt',
        'Hạn phản hồi phải sau thời điểm ghi nhận gửi.',
      );
      errors.when(!isIsoDate(dto.sentOn), 'sentOn', 'Ngày gửi không hợp lệ.');
      errors.when(isIsoDate(dto.sentOn) && dto.sentOn > vnDate(now), 'sentOn', 'Ngày gửi không sau hôm nay.');
      errors.throwIfAny();
      invitation.status = 'OPEN';
      invitation.sentOn = dto.sentOn;
      await this.save(manager, actor, invitation, 'sendDepositInvitation', { fromStatus: 'DRAFT', toStatus: 'OPEN' });
      return invitation;
    });
  }

  /** BR-T1-04: the deadline only moves later, with a reason (AC-T1.3). */
  async extend(actor: AuthenticatedUser, id: string, dto: ExtendInvitationDto): Promise<DepositInvitation> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, dto.version);
      if (invitation.status !== 'OPEN')
        throw conflictWithReason('invitation_not_open', 'Chỉ gia hạn khi thư đang nhận bản chào.');
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      const next = parseInstant(dto.deadlineAt);
      const previous = invitation.deadlineAt as Date;
      errors.when(!next, 'deadlineAt', 'Hạn phản hồi không hợp lệ.');
      errors.when(
        Boolean(next && next.getTime() <= previous.getTime()),
        'deadlineAt',
        'Hạn mới phải sau hạn cũ; không rút ngắn hạn phản hồi.',
      );
      errors.when(
        Boolean(next && next.getTime() <= this.clock.now().getTime()),
        'deadlineAt',
        'Hạn mới phải sau bây giờ.',
      );
      errors.throwIfAny();
      invitation.deadlineAt = next;
      await this.save(manager, actor, invitation, 'extendDepositInvitation', {
        reason: `${previous.toISOString()} → ${(next as Date).toISOString()}: ${dto.reason}`,
      });
      return invitation;
    });
  }

  /** BR-T1-04: closed early once every invited bank has an offer, with a reason. */
  async closeEarly(actor: AuthenticatedUser, id: string, dto: ReasonDto): Promise<DepositInvitation> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, dto.version);
      if (invitation.status !== 'OPEN')
        throw conflictWithReason('invitation_not_open', 'Thư mời không ở trạng thái đang nhận bản chào.');
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      const offers = await manager.getRepository(DepositOffer).findBy({ invitationId: invitation.id });
      const missing = invitation.inviteeIds.filter((bankId) => !offers.some((offer) => offer.bankId === bankId));
      if (missing.length) {
        const banks = await manager.getRepository(DepositBank).findBy({ id: In(missing) });
        throw conflictWithReason(
          'invitees_without_offer',
          `Chưa đóng sớm được: ${banks
            .map((row) => row.name)
            .sort()
            .join(', ')} chưa có bản chào.`,
        );
      }
      await this.close(manager, actor, invitation, 'EARLY', dto.reason);
      return invitation;
    });
  }

  /** BR-T1-04: before a result is decided, with a reason of 10+ characters; a result waiting for BQT blocks it. */
  async cancel(actor: AuthenticatedUser, id: string, dto: ReasonDto): Promise<DepositInvitation> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.loadForWrite(manager, actor, id, dto.version);
      if (!['DRAFT', 'OPEN', 'CLOSED'].includes(invitation.status))
        throw conflictWithReason('invitation_not_cancellable', 'Thư mời không hủy được ở trạng thái này.');
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      if (
        await manager
          .getRepository(DepositSelection)
          .exists({ where: { invitationId: invitation.id, status: In(['PENDING', 'NEEDS_CHANGES']) } })
      ) {
        throw conflictWithReason('selection_pending', 'Thư mời đang có kết quả chọn chờ xử lý.');
      }
      const from = invitation.status;
      invitation.status = 'CANCELLED';
      invitation.statusReason = dto.reason;
      await this.save(manager, actor, invitation, 'cancelDepositInvitation', {
        fromStatus: from,
        toStatus: 'CANCELLED',
        reason: dto.reason,
      });
      return invitation;
    });
  }

  /** BR-T1-04 / AC-T1.4: the server closes open invitations whose deadline has come (shared scheduler). */
  async closeDue(now: Date = this.clock.now()): Promise<string[]> {
    const due = await this.dataSource.getRepository(DepositInvitation).find({
      where: { status: 'OPEN', deadlineAt: LessThanOrEqual(now) },
      select: { id: true },
    });
    const closed: string[] = [];
    for (const { id } of due) {
      await this.dataSource.transaction(async (manager) => {
        const invitation = await manager
          .getRepository(DepositInvitation)
          .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!invitation || invitation.status !== 'OPEN' || !invitation.deadlineAt) return;
        if (invitation.deadlineAt.getTime() > now.getTime()) return;
        await this.close(manager, null, invitation, 'DEADLINE', 'Đến hạn phản hồi.');
        closed.push(invitation.code);
      });
    }
    return closed;
  }

  async loadForWrite(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<DepositInvitation> {
    const invitation = await this.lock(manager, actor, id);
    assertDepositManage(actor);
    assertVersion(invitation.version, version);
    return invitation;
  }

  async lock(manager: EntityManager, actor: AuthenticatedUser, id: string): Promise<DepositInvitation> {
    const invitation = await manager
      .getRepository(DepositInvitation)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!invitation || !actor.buildingIds.includes(invitation.buildingId)) throw notFound(NOT_FOUND);
    return invitation;
  }

  /** Bumps the version and writes the audit line of an invitation change (offers included). */
  async save(
    manager: EntityManager,
    actor: AuthenticatedUser | null,
    invitation: DepositInvitation,
    action: string,
    extra: AuditExtra = {},
  ): Promise<void> {
    invitation.version += 1;
    await manager.getRepository(DepositInvitation).save(invitation);
    await this.record(manager, actor, invitation, action, extra);
  }

  private async close(
    manager: EntityManager,
    actor: AuthenticatedUser | null,
    invitation: DepositInvitation,
    kind: 'DEADLINE' | 'EARLY',
    reason: string,
  ): Promise<void> {
    invitation.status = 'CLOSED';
    invitation.closedAt = this.clock.now();
    invitation.closeKind = kind;
    invitation.statusReason = kind === 'EARLY' ? reason : null;
    await this.save(
      manager,
      actor,
      invitation,
      kind === 'EARLY' ? 'closeDepositInvitationEarly' : 'closeDepositInvitation',
      { fromStatus: 'OPEN', toStatus: 'CLOSED', reason },
    );
  }

  /** D-T1-4: every offer must answer the same amount and term. */
  private assertSentTermsKept(invitation: DepositInvitation, dto: InvitationFieldsDto): void {
    if (dto.amountVnd !== invitation.amountVnd || dto.termDays !== invitation.termDays) {
      throw conflictWithReason(
        'invitation_terms_locked',
        'Thư đã gửi: không đổi số tiền hoặc kỳ hạn. Hủy thư này và lập thư mới để mọi bản chào cùng điều kiện.',
      );
    }
    const deadline = parseInstant(dto.deadlineAt);
    if (deadline?.getTime() !== invitation.deadlineAt?.getTime())
      new FieldErrors().add('deadlineAt', 'Đổi hạn phản hồi bằng "Gia hạn".').throwIfAny();
    const removed = invitation.inviteeIds.filter((bankId) => !(dto.inviteeIds ?? []).includes(bankId));
    if (removed.length)
      new FieldErrors().add('inviteeIds', 'Thư đã gửi: chỉ thêm được ngân hàng, không bớt.').throwIfAny();
  }

  /** BR-T1-03 fields; the letter must be a letter file of this invitation, the banks in use (new ones). */
  private async validate(
    manager: EntityManager,
    dto: InvitationFieldsDto,
    current: DepositInvitation | null,
  ): Promise<Partial<DepositInvitation>> {
    const errors = new FieldErrors();
    errors.when(
      !DIGITS.test(dto.amountVnd) || BigInt(dto.amountVnd) <= 0n,
      'amountVnd',
      'Số tiền là số nguyên VND lớn hơn 0.',
    );
    errors.when(
      !Number.isInteger(dto.termDays) || dto.termDays < TERM_MIN_DAYS || dto.termDays > TERM_MAX_DAYS,
      'termDays',
      `Kỳ hạn từ ${TERM_MIN_DAYS} đến ${TERM_MAX_DAYS.toLocaleString('vi-VN')} ngày.`,
    );
    const deadline = dto.deadlineAt ? parseInstant(dto.deadlineAt) : null;
    errors.when(Boolean(dto.deadlineAt) && !deadline, 'deadlineAt', 'Hạn phản hồi không hợp lệ.');
    errors.when(
      Boolean(dto.expectedDepositOn) && !isIsoDate(dto.expectedDepositOn ?? ''),
      'expectedDepositOn',
      'Ngày dự kiến gửi tiền không hợp lệ.',
    );
    errors.when((dto.conditions ?? '').length > CONDITIONS_MAX, 'conditions', 'Ghi chú điều kiện tối đa 2.000 ký tự.');
    const inviteeIds = [...new Set(dto.inviteeIds ?? [])];
    const added = inviteeIds.filter((bankId) => !(current?.inviteeIds ?? []).includes(bankId));
    if (added.length) {
      const usable = await manager.getRepository(DepositBank).countBy({ id: In(added), active: true });
      errors.when(usable !== added.length, 'inviteeIds', 'Chỉ mời được ngân hàng đang dùng.');
    }
    if (dto.letterAttachmentId && dto.letterAttachmentId !== current?.letterAttachmentId) {
      const file = await manager.getRepository(Attachment).findOneBy({ id: dto.letterAttachmentId });
      errors.when(
        !file ||
          file.subjectType !== SUBJECT_TYPE.DEPOSIT_INVITATION ||
          file.subjectId !== current?.id ||
          file.purpose !== 'DEPOSIT_INVITATION_LETTER',
        'letterAttachmentId',
        'Tệp thư mời phải tải lên thư mời này.',
      );
    }
    errors.throwIfAny();
    return {
      amountVnd: dto.amountVnd,
      termDays: dto.termDays,
      deadlineAt: deadline,
      expectedDepositOn: dto.expectedDepositOn ?? null,
      conditions: dto.conditions ?? null,
      letterAttachmentId: dto.letterAttachmentId ?? null,
      inviteeIds,
    };
  }

  /** An audit line on the invitation without a new version (offers are their own rows). */
  record(
    manager: EntityManager,
    actor: AuthenticatedUser | null,
    invitation: DepositInvitation,
    action: string,
    extra: AuditExtra,
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.DEPOSIT_INVITATION,
      subjectId: invitation.id,
      buildingId: invitation.buildingId,
      action,
      actorId: actor?.id ?? null,
      entityVersion: invitation.version,
      ...extra,
    });
  }
}
