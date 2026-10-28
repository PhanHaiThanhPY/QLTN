import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, forbidden, notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { FieldErrors } from '../../common/validation/field-errors';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { validateReason } from '../exploitation/package-rules';
import { assertDepositApprove, assertDepositManage } from './deposit-access';
import { DepositInvitationsService, type AuditExtra } from './deposit-invitations.service';
import { compareOffers } from './deposit-views';
import type {
  ChangeDepositSelectionDto,
  DecideDepositSelectionDto,
  DepositSelectionFieldsDto,
  ReasonDto,
  ResubmitDepositSelectionDto,
} from './dto/deposit.dto';
import { DepositBank } from './entities/deposit-bank.entity';
import type { DepositInvitation } from './entities/deposit-invitation.entity';
import { DepositOffer } from './entities/deposit-offer.entity';
import {
  DepositSelection,
  LIVE_DEPOSIT_SELECTION_STATUSES,
  type DepositSelectionDecision,
} from './entities/deposit-selection.entity';

const CODE_PREFIX = 'KQ-TG';
const MINUTES_PREFIX = 'BB-TG';
const CODE_WIDTH = 2;
const BASIS_MIN = 20;
const NOT_HIGHEST_MIN = 20;
const CHANGE_REASON_MIN = 20;
const NOT_FOUND = 'Không tìm thấy kết quả chọn ngân hàng.';

/**
 * The selected bank of an invitation (SPEC T-S1 BR-T1-09..11), on the approval pattern of F-S2: BQL proposes with
 * minutes and basis, the comparison is frozen when sent, one BQT (never the proposer) decides.
 */
@Injectable()
export class DepositSelectionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly invitations: DepositInvitationsService,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
    private readonly clock: Clock,
  ) {}

  /** BR-T1-09: from an invitation that stopped taking offers, with no result in force; it goes to approval. */
  async propose(
    actor: AuthenticatedUser,
    invitationId: string,
    dto: DepositSelectionFieldsDto,
  ): Promise<DepositSelection> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.invitations.lock(manager, actor, invitationId);
      if (invitation.status !== 'CLOSED')
        throw conflictWithReason('invitation_not_closed', 'Lập kết quả sau khi hết hạn nhận bản chào.');
      if (
        await manager
          .getRepository(DepositSelection)
          .exists({ where: { invitationId, status: In([...LIVE_DEPOSIT_SELECTION_STATUSES]) } })
      ) {
        throw conflictWithReason('selection_exists', 'Thư mời đã có kết quả chọn đang hiệu lực.');
      }
      return this.insert(manager, actor, invitation, await this.validate(manager, invitation, dto), null, null);
    });
  }

  /**
   * BR-T1-11 / DF-25(2): an approved result changes through a new proposal with a reason. Once T-S2 exists, a deposit
   * contract made from the result blocks this (AC-T1.14, left for T-S2).
   */
  async proposeChange(
    actor: AuthenticatedUser,
    selectionId: string,
    dto: ChangeDepositSelectionDto,
  ): Promise<DepositSelection> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const current = await this.lockSelection(manager, actor, selectionId, dto.version);
      if (current.status !== 'APPROVED')
        throw conflictWithReason('selection_not_approved', 'Chỉ đổi được kết quả đã duyệt.');
      const invitation = await this.invitations.lock(manager, actor, current.invitationId);
      if (
        await manager
          .getRepository(DepositSelection)
          .exists({ where: { replacesId: current.id, status: In(['PENDING', 'NEEDS_CHANGES']) } })
      ) {
        throw conflictWithReason('change_pending', 'Đã có đề xuất đổi kết quả đang chờ duyệt.');
      }
      const errors = new FieldErrors();
      validateReason(errors, dto.changeReason, 'changeReason', CHANGE_REASON_MIN);
      errors.throwIfAny();
      const fields = await this.validate(manager, invitation, dto);
      return this.insert(manager, actor, invitation, fields, current, dto.changeReason);
    });
  }

  /** BR-T1-10 "Cần sửa" → corrected and sent again, with a fresh comparison. */
  async resubmit(
    actor: AuthenticatedUser,
    selectionId: string,
    dto: ResubmitDepositSelectionDto,
  ): Promise<DepositSelection> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const selection = await this.lockSelection(manager, actor, selectionId, dto.version);
      if (selection.status !== 'NEEDS_CHANGES')
        throw conflictWithReason('selection_not_returned', 'Chỉ gửi lại kết quả đang "Cần sửa".');
      const invitation = await this.invitations.lock(manager, actor, selection.invitationId);
      Object.assign(selection, await this.validate(manager, invitation, dto), {
        status: 'PENDING',
        submittedAt: this.clock.now(),
      });
      await this.decide(manager, actor, selection, 'SUBMIT', null, 'resubmitDepositSelection', {
        fromStatus: 'NEEDS_CHANGES',
        toStatus: 'PENDING',
      });
      return selection;
    });
  }

  /** BR-T1-10: the invitation becomes "Đã chọn ngân hàng" (or "Không có kết quả"); a change replaces the old result. */
  async approve(
    actor: AuthenticatedUser,
    selectionId: string,
    dto: DecideDepositSelectionDto,
  ): Promise<DepositSelection> {
    return this.dataSource.transaction(async (manager) => {
      const selection = await this.lockForDecision(manager, actor, selectionId, dto.version);
      const invitation = await this.invitations.lock(manager, actor, selection.invitationId);
      if (selection.replacesId) {
        const old = await manager.getRepository(DepositSelection).findOneByOrFail({ id: selection.replacesId });
        Object.assign(old, { status: 'SUPERSEDED', version: old.version + 1 });
        await manager.getRepository(DepositSelection).save(old);
        await this.record(manager, actor, old, 'supersedeDepositSelection', {
          fromStatus: 'APPROVED',
          toStatus: 'SUPERSEDED',
          reason: `Thay bởi ${selection.code}`,
        });
      }
      selection.status = 'APPROVED';
      await this.decide(manager, actor, selection, 'APPROVE', dto.reason ?? null, 'approveDepositSelection', {
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
      });
      const next = selection.kind === 'BANK' ? 'SELECTED' : 'NO_RESULT';
      if (invitation.status !== next) {
        const from = invitation.status;
        invitation.status = next;
        await this.invitations.save(manager, actor, invitation, 'approveDepositSelection', {
          fromStatus: from,
          toStatus: next,
          reason: selection.code,
        });
      }
      return selection;
    });
  }

  requestChanges(actor: AuthenticatedUser, selectionId: string, dto: ReasonDto): Promise<DepositSelection> {
    return this.closeDecision(
      actor,
      selectionId,
      dto,
      'REQUEST_CHANGES',
      'NEEDS_CHANGES',
      'requestDepositSelectionChanges',
    );
  }

  reject(actor: AuthenticatedUser, selectionId: string, dto: ReasonDto): Promise<DepositSelection> {
    return this.closeDecision(actor, selectionId, dto, 'REJECT', 'REJECTED', 'rejectDepositSelection');
  }

  private async insert(
    manager: EntityManager,
    actor: AuthenticatedUser,
    invitation: DepositInvitation,
    fields: Partial<DepositSelection>,
    replaces: DepositSelection | null,
    changeReason: string | null,
  ): Promise<DepositSelection> {
    const repo = manager.getRepository(DepositSelection);
    const saved = await repo.save(
      repo.create({
        ...fields,
        code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH, ''),
        minutesCode: await this.codes.next(manager, MINUTES_PREFIX, CODE_WIDTH, ''),
        invitationId: invitation.id,
        buildingId: invitation.buildingId,
        status: 'PENDING',
        replacesId: replaces?.id ?? null,
        changeReason,
        decisions: [],
        submittedAt: this.clock.now(),
        createdBy: actor.id,
        version: 0,
      }),
    );
    await this.decide(
      manager,
      actor,
      saved,
      'SUBMIT',
      changeReason,
      replaces ? 'proposeDepositSelectionChange' : 'proposeDepositSelection',
      { toStatus: 'PENDING', ...(replaces ? { reason: `Đổi ${replaces.code}: ${changeReason}` } : {}) },
    );
    return saved;
  }

  private async closeDecision(
    actor: AuthenticatedUser,
    selectionId: string,
    dto: ReasonDto,
    decision: 'REQUEST_CHANGES' | 'REJECT',
    status: 'NEEDS_CHANGES' | 'REJECTED',
    action: string,
  ): Promise<DepositSelection> {
    return this.dataSource.transaction(async (manager) => {
      const selection = await this.lockForDecision(manager, actor, selectionId, dto.version);
      const errors = new FieldErrors();
      validateReason(errors, dto.reason);
      errors.throwIfAny();
      selection.status = status;
      await this.decide(manager, actor, selection, decision, dto.reason, action, {
        fromStatus: 'PENDING',
        toStatus: status,
        reason: dto.reason,
      });
      return selection;
    });
  }

  /**
   * BR-T1-09: one complete offer of this invitation; a late one needs its own reason; not the highest interest needs a
   * reason too (D-T1-2). The comparison is frozen with the proposal.
   */
  private async validate(
    manager: EntityManager,
    invitation: DepositInvitation,
    dto: DepositSelectionFieldsDto,
  ): Promise<Partial<DepositSelection>> {
    const errors = new FieldErrors();
    const minutes = await manager.getRepository(Attachment).findOneBy({ id: dto.minutesAttachmentId });
    errors.when(
      !minutes ||
        minutes.subjectType !== SUBJECT_TYPE.DEPOSIT_INVITATION ||
        minutes.subjectId !== invitation.id ||
        minutes.purpose !== 'DEPOSIT_SELECTION_MINUTES',
      'minutesAttachmentId',
      'Cần biên bản tải lên thư mời này.',
    );
    errors.when(dto.basis.trim().length < BASIS_MIN, 'basis', `Căn cứ cần tối thiểu ${BASIS_MIN} ký tự.`);
    const offers = await manager.getRepository(DepositOffer).findBy({ invitationId: invitation.id });
    const banks = offers.length
      ? await manager.getRepository(DepositBank).findBy({ id: In(offers.map((row) => row.bankId)) })
      : [];
    const comparison = compareOffers(invitation, offers, banks);
    const row = dto.kind === 'BANK' ? comparison.rows.find((line) => line.offerId === dto.offerId) : undefined;
    if (dto.kind === 'BANK') {
      errors.when(!row, 'offerId', 'Chọn một bản chào của thư mời này.');
      errors.when(Boolean(row && row.completeness !== 'COMPLETE'), 'offerId', 'Bản chào "Thiếu" không chọn được.');
      if (row?.isLate) validateReason(errors, dto.lateReason ?? '', 'lateReason');
      if (row && row.completeness === 'COMPLETE' && row.offerId !== comparison.highestOfferId)
        validateReason(errors, dto.notHighestReason ?? '', 'notHighestReason', NOT_HIGHEST_MIN);
    }
    errors.throwIfAny();
    const chosen = row && row.offerId !== comparison.highestOfferId;
    return {
      kind: dto.kind,
      offerId: row?.offerId ?? null,
      bankId: row?.bankId ?? null,
      minutesAttachmentId: dto.minutesAttachmentId,
      basis: dto.basis.trim(),
      notHighestReason: chosen ? (dto.notHighestReason ?? null) : null,
      lateReason: row?.isLate ? (dto.lateReason ?? null) : null,
      comparison: comparison.rows,
    };
  }

  private async lockSelection(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<DepositSelection> {
    const selection = await manager
      .getRepository(DepositSelection)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!selection || !actor.buildingIds.includes(selection.buildingId)) throw notFound(NOT_FOUND);
    assertVersion(selection.version, version);
    return selection;
  }

  /** BR-T1-10 / D-T1-1: one BQT of the building, never the proposer, on a result waiting for approval. */
  private async lockForDecision(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<DepositSelection> {
    const selection = await this.lockSelection(manager, actor, id, version);
    assertDepositApprove(actor);
    if (selection.createdBy === actor.id) throw forbidden('Người đề xuất không tự duyệt kết quả.');
    if (selection.status !== 'PENDING')
      throw conflictWithReason('selection_not_pending', 'Kết quả không ở trạng thái chờ duyệt.');
    return selection;
  }

  private async decide(
    manager: EntityManager,
    actor: AuthenticatedUser,
    selection: DepositSelection,
    decision: DepositSelectionDecision['decision'],
    reason: string | null,
    action: string,
    extra: AuditExtra,
  ): Promise<void> {
    selection.version += 1;
    selection.decisions = [
      ...selection.decisions,
      { decision, reason, by: actor.id, at: this.clock.now().toISOString() },
    ];
    await manager.getRepository(DepositSelection).save(selection);
    await this.record(manager, actor, selection, action, extra);
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    selection: DepositSelection,
    action: string,
    extra: AuditExtra,
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.DEPOSIT_SELECTION,
      subjectId: selection.id,
      buildingId: selection.buildingId,
      action,
      actorId: actor.id,
      entityVersion: selection.version,
      ...extra,
    });
  }
}
