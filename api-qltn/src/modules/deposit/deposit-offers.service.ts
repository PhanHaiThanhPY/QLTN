import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { FieldErrors } from '../../common/validation/field-errors';
import { formatRate, parseRate } from '../../domain/deposit';
import { Attachment } from '../attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { parseInstant, validateReason } from '../exploitation/package-rules';
import { assertDepositManage } from './deposit-access';
import { DepositInvitationsService } from './deposit-invitations.service';
import type { CreateOfferDto, OfferFieldsDto, UpdateOfferDto } from './dto/deposit.dto';
import { DepositBank } from './entities/deposit-bank.entity';
import type { DepositInvitation } from './entities/deposit-invitation.entity';
import { DepositOffer } from './entities/deposit-offer.entity';

const TEXT_MAX = 2000;
const PAYMENT_EVERY_MAX = 3650;
/** BR-T1-06: offers are recorded while the invitation takes them, and late ones after it closed. */
const RECORDING_STATUSES: readonly string[] = ['OPEN', 'CLOSED'];

/** Offers of the banks on an invitation (SPEC T-S1 BR-T1-06, BR-T1-07), audited on the invitation. */
@Injectable()
export class DepositOffersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly invitations: DepositInvitationsService,
    private readonly clock: Clock,
  ) {}

  /** One offer per bank and invitation; a bank not invited needs a reason and is flagged "Ngoài danh sách mời". */
  async create(actor: AuthenticatedUser, invitationId: string, dto: CreateOfferDto): Promise<DepositOffer> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.writable(manager, actor, invitationId);
      const bank = await manager.getRepository(DepositBank).findOneBy({ id: dto.bankId });
      const invited = invitation.inviteeIds.includes(dto.bankId);
      const errors = new FieldErrors();
      errors.when(!bank || (!invited && !bank.active), 'bankId', 'Chọn một ngân hàng đang dùng.');
      if (!invited) validateReason(errors, dto.outsideReason ?? '', 'outsideReason');
      errors.throwIfAny();
      if (await manager.getRepository(DepositOffer).exists({ where: { invitationId, bankId: dto.bankId } })) {
        throw conflictWithReason(
          'offer_exists',
          `${bank?.name ?? 'Ngân hàng'} đã có bản chào trong thư này; sửa bản đó.`,
        );
      }
      const repo = manager.getRepository(DepositOffer);
      const saved = await repo.save(
        repo.create({
          ...(await this.validate(manager, invitation, dto)),
          invitationId,
          bankId: dto.bankId,
          buildingId: invitation.buildingId,
          outside: !invited,
          outsideReason: invited ? null : (dto.outsideReason ?? null),
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.invitations.record(manager, actor, invitation, 'recordDepositOffer', {
        reason: `${bank?.name ?? ''} · ${formatRate(saved.rateMilli)}%`,
      });
      return saved;
    });
  }

  /** "Nộp lại thì cập nhật bản đó" (BR-T1-06): the same bank's offer, version-locked. */
  async update(actor: AuthenticatedUser, offerId: string, dto: UpdateOfferDto): Promise<DepositOffer> {
    return this.dataSource.transaction(async (manager) => {
      const offer = await manager
        .getRepository(DepositOffer)
        .findOne({ where: { id: offerId }, lock: { mode: 'pessimistic_write' } });
      if (!offer || !actor.buildingIds.includes(offer.buildingId)) throw notFound('Không tìm thấy bản chào.');
      const invitation = await this.writable(manager, actor, offer.invitationId);
      assertVersion(offer.version, dto.version);
      const errors = new FieldErrors();
      if (offer.outside) validateReason(errors, dto.outsideReason ?? '', 'outsideReason');
      errors.throwIfAny();
      Object.assign(offer, await this.validate(manager, invitation, dto), {
        outsideReason: offer.outside ? (dto.outsideReason ?? null) : null,
        version: offer.version + 1,
      });
      const saved = await manager.getRepository(DepositOffer).save(offer);
      const bank = await manager.getRepository(DepositBank).findOneBy({ id: offer.bankId });
      await this.invitations.record(manager, actor, invitation, 'updateDepositOffer', {
        reason: `${bank?.name ?? ''} · ${formatRate(saved.rateMilli)}%`,
      });
      return saved;
    });
  }

  private async writable(
    manager: EntityManager,
    actor: AuthenticatedUser,
    invitationId: string,
  ): Promise<DepositInvitation> {
    const invitation = await this.invitations.lock(manager, actor, invitationId);
    assertDepositManage(actor);
    if (!RECORDING_STATUSES.includes(invitation.status))
      throw conflictWithReason('invitation_not_receiving', 'Thư mời không nhận bản chào ở trạng thái này.');
    return invitation;
  }

  /** BR-T1-06 fields; "Trễ hạn" is decided by the time received, never by when it was typed (BR-T1-07). */
  private async validate(
    manager: EntityManager,
    invitation: DepositInvitation,
    dto: OfferFieldsDto,
  ): Promise<Partial<DepositOffer>> {
    const errors = new FieldErrors();
    const receivedAt = parseInstant(dto.receivedAt);
    errors.when(!receivedAt, 'receivedAt', 'Thời điểm nhận không hợp lệ.');
    errors.when(
      Boolean(receivedAt && receivedAt.getTime() > this.clock.now().getTime()),
      'receivedAt',
      'Thời điểm nhận không sau bây giờ.',
    );
    const rateMilli = parseRate(dto.rate);
    errors.when(rateMilli === null, 'rate', 'Lãi suất lớn hơn 0 và không quá 30 %/năm, tối đa 3 chữ số thập phân.');
    errors.when(dto.dayBasis !== 360 && dto.dayBasis !== 365, 'dayBasis', 'Chọn cơ sở tính ngày 360 hoặc 365.');
    const periodic = dto.paymentKind === 'PERIODIC';
    errors.when(
      periodic &&
        (!dto.paymentEvery || dto.paymentEvery < 1 || dto.paymentEvery > PAYMENT_EVERY_MAX || !dto.paymentUnit),
      'paymentEvery',
      'Trả lãi định kỳ cần số kỳ (mỗi N tháng hoặc N ngày).',
    );
    errors.when((dto.conditions ?? '').length > TEXT_MAX, 'conditions', 'Điều kiện kèm theo tối đa 2.000 ký tự.');
    errors.when(dto.completeness === 'INCOMPLETE' && !dto.missingNote, 'missingNote', 'Ghi rõ hồ sơ còn thiếu gì.');
    errors.when((dto.missingNote ?? '').length > TEXT_MAX, 'missingNote', 'Ghi chú tối đa 2.000 ký tự.');
    const file = await manager.getRepository(Attachment).findOneBy({ id: dto.attachmentId });
    errors.when(
      !file ||
        file.subjectType !== SUBJECT_TYPE.DEPOSIT_INVITATION ||
        file.subjectId !== invitation.id ||
        file.purpose !== 'DEPOSIT_OFFER',
      'attachmentId',
      'Tệp bản chào phải tải lên thư mời này.',
    );
    errors.throwIfAny();
    const at = receivedAt as Date;
    return {
      receivedAt: at,
      rateMilli: rateMilli as number,
      dayBasis: dto.dayBasis as 360 | 365,
      paymentKind: dto.paymentKind,
      paymentEvery: periodic ? (dto.paymentEvery ?? null) : null,
      paymentUnit: periodic ? (dto.paymentUnit ?? null) : null,
      conditions: dto.conditions ?? null,
      attachmentId: dto.attachmentId,
      completeness: dto.completeness,
      missingNote: dto.completeness === 'INCOMPLETE' ? (dto.missingNote ?? null) : null,
      isLate: Boolean(invitation.deadlineAt && at.getTime() > invitation.deadlineAt.getTime()),
    };
  }
}
