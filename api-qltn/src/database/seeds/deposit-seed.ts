import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { vnDate } from '../../common/utils/vn-date';
import { Attachment } from '../../modules/attachments/entities/attachment.entity';
import type { FileStorage } from '../../modules/attachments/file-storage';
import { SUBJECT_TYPE } from '../../modules/audit/entities/audit-event.entity';
import type { DepositBanksService } from '../../modules/deposit/deposit-banks.service';
import type { DepositFilePurpose } from '../../modules/deposit/deposit-files';
import type { DepositInvitationsService } from '../../modules/deposit/deposit-invitations.service';
import type { DepositOffersService } from '../../modules/deposit/deposit-offers.service';
import type { DepositSelectionsService } from '../../modules/deposit/deposit-selections.service';
import { DepositBank } from '../../modules/deposit/entities/deposit-bank.entity';
import { DepositInvitation } from '../../modules/deposit/entities/deposit-invitation.entity';
import { actorOf } from './exploitation-contract-seed';
import { samplePdf } from './exploitation-seed';

interface Deps {
  dataSource: DataSource;
  storage: FileStorage;
  banks: DepositBanksService;
  invitations: DepositInvitationsService;
  offers: DepositOffersService;
  selections: DepositSelectionsService;
}

const BANKS = [
  { name: 'Ngân hàng A', shortName: 'NHA', branch: 'Chi nhánh Trung tâm' },
  { name: 'Ngân hàng B', shortName: 'NHB', branch: 'Chi nhánh Trung tâm' },
  { name: 'Ngân hàng C', shortName: 'NHC', branch: 'Chi nhánh Trung tâm' },
] as const;
const AMOUNT_VND = '1000000000';
const TERM_DAYS = 90;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * SPEC T-S1 BR-T1-13, D1 pp. 33–34 on tòa A: banks A, B and C; MC-001 "Đã chọn ngân hàng" (1.000.000.000, 90 days,
 * three complete offers on a 360-day basis: A 5,8%, B 6,0%, C 5,9%; KQ-TG01 selects B, approved, BB-TG01) and MC-002
 * "Đang nhận bản chào" (deadline in 3 days at 17:00, 2/3 banks answered). Through the services, so dates are today's;
 * once, never in production (the caller guards it).
 */
export const ensureDepositDemo = async (deps: Deps): Promise<number> => {
  const { dataSource } = deps;
  const [bql, bqt] = await Promise.all([actorOf(dataSource, 'BQL-A'), actorOf(dataSource, 'BQT')]);
  const buildingId = bql?.buildingIds[0];
  if (!bql || !bqt || !buildingId) return 0;
  if (await dataSource.getRepository(DepositInvitation).exists({ where: { buildingId } })) return 0;
  const banks = await ensureBanks(deps, bql);
  const now = Date.now();
  const receivedAt = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  const selected = await openInvitation(deps, bql, buildingId, new Date(now + HOUR_MS).toISOString(), banks);
  const rates = [
    { bank: banks[0], rate: '5,8', minutesAgo: 30 },
    { bank: banks[1], rate: '6,0', minutesAgo: 20, every: 30 },
    { bank: banks[2], rate: '5,9', minutesAgo: 10 },
  ];
  for (const row of rates)
    await recordOffer(deps, bql, selected, row.bank, row.rate, receivedAt(row.minutesAgo), row.every);
  const closed = await deps.invitations.closeEarly(bql, selected.id, {
    version: (await reload(dataSource, selected.id)).version,
    reason: 'Cả ba ngân hàng đã gửi bản chào.',
  });
  const view = await deps.invitations.detail(bql, closed.id);
  const best = view.offers.find((offer) => offer.bankId === banks[1].id);
  if (!best) return 0;
  const selection = await deps.selections.propose(bql, closed.id, {
    kind: 'BANK',
    offerId: best.id,
    minutesAttachmentId: await file(
      deps,
      bql,
      closed,
      'DEPOSIT_SELECTION_MINUTES',
      'BB-TG01 Biên bản chọn ngân hàng.pdf',
    ),
    basis: 'Ngân hàng B có lãi cả kỳ cao nhất, đủ hồ sơ; trả lãi định kỳ mỗi 30 ngày.',
  });
  await deps.selections.approve(bqt, selection.id, { version: selection.version, reason: null });

  const deadline = new Date(`${vnDate(new Date(now + 3 * DAY_MS))}T17:00:00+07:00`).toISOString();
  const open = await openInvitation(deps, bql, buildingId, deadline, banks);
  await recordOffer(deps, bql, open, banks[0], '5,85', receivedAt(15));
  await recordOffer(deps, bql, open, banks[1], '5,95', receivedAt(5));
  return 2;
};

const ensureBanks = async (deps: Deps, bql: AuthenticatedUser): Promise<DepositBank[]> => {
  const repo = deps.dataSource.getRepository(DepositBank);
  const banks: DepositBank[] = [];
  for (const row of BANKS) {
    const existing = await repo.findOneBy({ name: row.name, branch: row.branch, active: true });
    if (existing) {
      banks.push(existing);
      continue;
    }
    const created = await deps.banks.create(bql, { ...row, contactName: 'Phòng khách hàng doanh nghiệp' });
    banks.push(await repo.findOneByOrFail({ id: created.id }));
  }
  return banks;
};

/** A draft with its letter and the three banks, then "Ghi nhận gửi" today. */
const openInvitation = async (
  deps: Deps,
  bql: AuthenticatedUser,
  buildingId: string,
  deadlineAt: string,
  banks: readonly DepositBank[],
): Promise<DepositInvitation> => {
  const fields = {
    amountVnd: AMOUNT_VND,
    termDays: TERM_DAYS,
    deadlineAt,
    conditions: 'Lãi suất cố định cả kỳ; không rút trước hạn.',
  };
  const draft = await deps.invitations.create(bql, { ...fields, buildingId });
  const letter = await file(deps, bql, draft, 'DEPOSIT_INVITATION_LETTER', `Thư mời ${draft.code}.pdf`);
  const ready = await deps.invitations.update(bql, draft.id, {
    ...fields,
    version: draft.version,
    letterAttachmentId: letter,
    inviteeIds: banks.map((bank) => bank.id),
  });
  return deps.invitations.send(bql, draft.id, { version: ready.version, sentOn: vnDate(new Date()) });
};

const recordOffer = async (
  deps: Deps,
  bql: AuthenticatedUser,
  invitation: DepositInvitation,
  bank: DepositBank,
  rate: string,
  receivedAt: string,
  every?: number,
): Promise<void> => {
  await deps.offers.create(bql, invitation.id, {
    bankId: bank.id,
    receivedAt,
    rate,
    dayBasis: 360,
    paymentKind: every ? 'PERIODIC' : 'END',
    paymentEvery: every ?? null,
    paymentUnit: every ? 'DAY' : null,
    attachmentId: await file(deps, bql, invitation, 'DEPOSIT_OFFER', `Bản chào ${bank.name} ${invitation.code}.pdf`),
    completeness: 'COMPLETE',
  });
};

const reload = (dataSource: DataSource, id: string) =>
  dataSource.getRepository(DepositInvitation).findOneByOrFail({ id });

const file = async (
  deps: Deps,
  bql: AuthenticatedUser,
  invitation: DepositInvitation,
  purpose: DepositFilePurpose,
  name: string,
): Promise<string> => {
  const key = randomUUID();
  const content = samplePdf(name);
  await deps.storage.save(key, content);
  const repo = deps.dataSource.getRepository(Attachment);
  const saved = await repo.save(
    repo.create({
      subjectType: SUBJECT_TYPE.DEPOSIT_INVITATION,
      subjectId: invitation.id,
      buildingId: invitation.buildingId,
      purpose,
      fileName: name,
      mimeType: 'application/pdf',
      sizeBytes: content.length,
      contentRef: key,
      uploadedBy: bql.id,
    }),
  );
  return saved.id;
};
