import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Clock } from '../src/common/services/clock.service';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { DepositDeadlinesService } from '../src/modules/deposit/deposit-deadlines.service';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';

/**
 * SPEC T-S1 (docs/product/features/T-chao-lai-chon-ngan-hang/SPEC.md): banks, rate invitations, offers, the comparison
 * and the selected bank. "Now" is pinned per step; invitations are on tòa A's maintenance fund, banks are this suite's.
 */

interface Bank {
  id: string;
  code: string;
  name: string;
  version: number;
}
interface Row {
  rank: number;
  offerId: string;
  bankId: string;
  bankName: string;
  interestVnd: string;
  completeness: string;
  isLate: boolean;
  outside: boolean;
}
interface Selection {
  id: string;
  code: string;
  minutesCode: string;
  kind: string;
  bankId: string | null;
  status: string;
  version: number;
  notHighestReason: string | null;
  comparison: Row[];
}
interface Detail {
  invitation: { id: string; code: string; status: string; version: number; deadlineAt: string; amountVnd: string };
  progress: { responded: number; invited: number };
  invitees: Array<{ id: string; name: string; offerId: string | null }>;
  offers: Array<{ id: string; bankId: string; rateMilli: number; isLate: boolean; outside: boolean; version: number }>;
  comparison: { rows: Row[]; mixedBasis: boolean; highestOfferId: string | null };
  selections: Selection[];
  audit: Array<{ action: string }>;
}

const PDF = Buffer.from('%PDF-1.4\n% T-S1\n', 'utf8');
const at = (local: string): Date => new Date(`${local}+07:00`);
const DEADLINE = '2026-08-27T17:00:00+07:00';

describe('Deposit rate invitations and the selected bank, T-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let clock: Clock;
  let dataSource: DataSource;
  let bql: Session;
  let bqlB: Session;
  let bqt: Session;
  let ktoan: Session;
  let kt: Session;
  let buildingA: string;
  let banks: Bank[];

  const upload = async (invitationId: string, purpose: string): Promise<string> =>
    dataOf<{ id: string }>(
      await bql
        .postMultipart(
          '/api/attachments',
          { subjectType: 'DEPOSIT_INVITATION', subjectId: invitationId, purpose },
          { content: PDF, filename: `${purpose}.pdf`, contentType: 'application/pdf' },
        )
        .expect(201),
    ).id;
  const detail = async (id: string, session: Session = bql): Promise<Detail> =>
    dataOf<Detail>(await session.get(`/api/deposits/invitations/${id}`).expect(200));
  const fields = { amountVnd: '1000000000', termDays: 90, deadlineAt: DEADLINE };
  /** A sent invitation on tòa A, sent 25/08 with the deadline 27/08 17:00, inviting the given banks. */
  const sent = async (invited: Bank[] = banks.slice(0, 3)): Promise<Detail> => {
    clock.set(at('2026-08-25T09:00:00'));
    const draft = dataOf<Detail>(
      await bql.post('/api/deposits/invitations', { ...fields, buildingId: buildingA }).expect(201),
    );
    const letter = await upload(draft.invitation.id, 'DEPOSIT_INVITATION_LETTER');
    const ready = dataOf<Detail>(
      await bql
        .put(`/api/deposits/invitations/${draft.invitation.id}`, {
          ...fields,
          version: draft.invitation.version,
          letterAttachmentId: letter,
          inviteeIds: invited.map((bank) => bank.id),
        })
        .expect(200),
    );
    return dataOf<Detail>(
      await bql
        .post(`/api/deposits/invitations/${draft.invitation.id}/send`, {
          version: ready.invitation.version,
          sentOn: '2026-08-25',
        })
        .expect(200),
    );
  };
  const offer = async (
    invitationId: string,
    bank: Bank,
    rate: string,
    extra: Record<string, unknown> = {},
    expected = 201,
  ) =>
    bql
      .post(`/api/deposits/invitations/${invitationId}/offers`, {
        bankId: bank.id,
        receivedAt: '2026-08-26T10:00:00+07:00',
        rate,
        dayBasis: 360,
        paymentKind: 'END',
        attachmentId: await upload(invitationId, 'DEPOSIT_OFFER'),
        completeness: 'COMPLETE',
        ...extra,
      })
      .expect(expected);
  /** D1 p. 34: A 5,8%, B 6,0%, C 5,9% on a 360-day basis, then the deadline passes. */
  const compared = async (patch: Record<number, Record<string, unknown>> = {}): Promise<Detail> => {
    const view = await sent();
    // Typed after the deadline, so a late time received (27/08 17:30) can be entered too.
    clock.set(at('2026-08-27T17:45:00'));
    for (const [index, rate] of ['5,8', '6,0', '5,9'].entries())
      await offer(view.invitation.id, banks[index], rate, patch[index] ?? {});
    await app.get(DepositDeadlinesService).run();
    return detail(view.invitation.id);
  };
  const minutes = (invitationId: string) => upload(invitationId, 'DEPOSIT_SELECTION_MINUTES');
  const propose = async (view: Detail, body: Record<string, unknown>, expected = 201) =>
    bql
      .post(`/api/deposits/invitations/${view.invitation.id}/selections`, {
        kind: 'BANK',
        minutesAttachmentId: await minutes(view.invitation.id),
        basis: 'Lãi cả kỳ tốt, đủ hồ sơ, ngân hàng uy tín.',
        ...body,
      })
      .expect(expected);
  const offerOf = (view: Detail, bank: Bank) =>
    view.offers.find((row) => row.bankId === bank.id) as Detail['offers'][0];
  const pending = (view: Detail) => view.selections.find((row) => row.status === 'PENDING') as Selection;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    clock = app.get(Clock);
    dataSource = app.get(DataSource);
    bql = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    bqt = await signIn(server, 'bqt');
    ktoan = await signIn(server, 'ktoan-a');
    kt = await signIn(server, 'kt-a');
    const me = dataOf<{ buildingIds: string[] }>(await bql.get('/api/auth/me').expect(200));
    buildingA = me.buildingIds[0];
    banks = [];
    for (const name of ['Ngân hàng E2E X', 'Ngân hàng E2E Y', 'Ngân hàng E2E Z', 'Ngân hàng E2E W'])
      banks.push(dataOf<Bank>(await bql.post('/api/deposits/banks', { name, branch: 'Chi nhánh 1' }).expect(201)));
    // Boot (migrations and the demo seed) plus five sign-ins outlast 30 s on a loaded machine.
  }, 120_000);

  afterAll(async () => {
    clock.set(null);
    await app.close();
  });

  it('AC-T1.1: the same name and branch as a bank in use is refused; another branch is fine', async () => {
    const refused = await bql
      .post('/api/deposits/banks', { name: 'ngân hàng e2e x', branch: 'chi nhánh 1' })
      .expect(400);
    expect(errorFields(refused)).toEqual(['branch']);
    const other = dataOf<Bank>(
      await bql.post('/api/deposits/banks', { name: 'Ngân hàng E2E X', branch: 'Chi nhánh 2' }).expect(201),
    );
    expect(other.code).toMatch(/^NH-\d{3}$/);
    await bql
      .post(`/api/deposits/banks/${other.id}/deactivate`, { version: other.version, reason: 'Gộp chi nhánh' })
      .expect(200);
  });

  it('AC-T1.2: "Ghi nhận gửi" names what is missing; complete, it takes offers and is audited', async () => {
    clock.set(at('2026-08-25T09:00:00'));
    const draft = dataOf<Detail>(
      await bql.post('/api/deposits/invitations', { ...fields, buildingId: buildingA }).expect(201),
    );
    expect(draft.invitation.code).toMatch(/^MC-\d{3}$/);
    expect(draft.invitation.status).toBe('DRAFT');
    const refused = await bql
      .post(`/api/deposits/invitations/${draft.invitation.id}/send`, {
        version: draft.invitation.version,
        sentOn: '2026-08-25',
      })
      .expect(400);
    expect(errorFields(refused).sort()).toEqual(['inviteeIds', 'letterAttachmentId']);
    const view = await sent();
    expect(view.invitation.status).toBe('OPEN');
    expect(view.audit.map((row) => row.action)).toContain('sendDepositInvitation');
  });

  it('AC-T1.3: amount and term are fixed once sent; the deadline only moves later, with a reason', async () => {
    const view = await sent();
    const id = view.invitation.id;
    const changed = await bql
      .put(`/api/deposits/invitations/${id}`, {
        ...fields,
        amountVnd: '2000000000',
        version: view.invitation.version,
        inviteeIds: view.invitees.map((row) => row.id),
      })
      .expect(409);
    expect(errorOf(changed).message).toContain('không đổi số tiền hoặc kỳ hạn');
    const shorter = await bql
      .post(`/api/deposits/invitations/${id}/extend`, {
        version: view.invitation.version,
        deadlineAt: '2026-08-26T17:00:00+07:00',
        reason: 'Rút ngắn cho kịp lịch gửi',
      })
      .expect(400);
    expect(errorFields(shorter)).toEqual(['deadlineAt']);
    const extended = dataOf<Detail>(
      await bql
        .post(`/api/deposits/invitations/${id}/extend`, {
          version: view.invitation.version,
          deadlineAt: '2026-08-29T17:00:00+07:00',
          reason: 'Ngân hàng C xin thêm hai ngày',
        })
        .expect(200),
    );
    expect(new Date(extended.invitation.deadlineAt).toISOString()).toBe('2026-08-29T10:00:00.000Z');
  });

  it('AC-T1.5 / AC-T1.6: "2/3 ngân hàng đã phản hồi"; a rate with 4 decimals is refused, 5,875 is stored as 5875', async () => {
    const view = await sent();
    clock.set(at('2026-08-26T12:00:00'));
    const fourDecimals = await offer(view.invitation.id, banks[0], '5,8755', {}, 400);
    expect(errorFields(fourDecimals)).toEqual(['rate']);
    await offer(view.invitation.id, banks[0], '5,875');
    await offer(view.invitation.id, banks[1], '6');
    const after = await detail(view.invitation.id);
    expect(after.progress).toEqual({ responded: 2, invited: 3 });
    expect(after.invitees.map((row) => row.offerId === null)).toEqual([false, false, true]);
    expect(offerOf(after, banks[0]).rateMilli).toBe(5875);
    await offer(view.invitation.id, banks[0], '5,9', {}, 409);
    const outside = await offer(view.invitation.id, banks[3], '5,5', {}, 400);
    expect(errorFields(outside)).toEqual(['outsideReason']);
    await offer(view.invitation.id, banks[3], '5,5', { outsideReason: 'Ngân hàng tự gửi bản chào qua email' });
    const withOutside = await detail(view.invitation.id);
    expect(withOutside.progress).toEqual({ responded: 2, invited: 3 });
    expect(offerOf(withOutside, banks[3]).outside).toBe(true);
  });

  it('AC-T1.9 / AC-T1.4: late is by the time received; the deadline closes the invitation with nobody on the web', async () => {
    const view = await sent();
    clock.set(at('2026-08-28T08:00:00'));
    await offer(view.invitation.id, banks[0], '5,8', { receivedAt: '2026-08-27T16:00:00+07:00' });
    await offer(view.invitation.id, banks[1], '6,0', { receivedAt: '2026-08-27T18:00:00+07:00' });
    const after = await detail(view.invitation.id);
    expect([offerOf(after, banks[0]).isLate, offerOf(after, banks[1]).isLate]).toEqual([false, true]);
    const closed = await app.get(DepositDeadlinesService).run(at('2026-08-28T08:00:00'));
    expect(closed).toContain(view.invitation.code);
    expect((await detail(view.invitation.id)).invitation.status).toBe('CLOSED');
  });

  it('AC-T1.7 / AC-T1.8: interest of the term 14,5 / 15 / 14,75 tr ranked B first; a 365 basis is flagged', async () => {
    const view = await compared();
    expect(view.comparison.rows.map((row) => [row.rank, row.bankName, row.interestVnd])).toEqual([
      [1, banks[1].name, '15000000'],
      [2, banks[2].name, '14750000'],
      [3, banks[0].name, '14500000'],
    ]);
    expect(view.comparison.mixedBasis).toBe(false);
    const mixed = await compared({ 0: { dayBasis: 365 } });
    expect(mixed.comparison.mixedBasis).toBe(true);
    expect(mixed.comparison.rows.find((row) => row.bankId === banks[0].id)?.interestVnd).toBe('14301370');
  });

  it('AC-T1.10: an incomplete offer cannot be chosen; B goes to approval with its comparison; BQL 403, BQT approves', async () => {
    const view = await compared({ 0: { completeness: 'INCOMPLETE', missingNote: 'Thiếu xác nhận lãi suất' } });
    const incomplete = await propose(view, { offerId: offerOf(view, banks[0]).id }, 400);
    expect(errorFields(incomplete)).toContain('offerId');
    const proposed = dataOf<Detail>(await propose(view, { offerId: offerOf(view, banks[1]).id }));
    const selection = pending(proposed);
    expect(selection).toMatchObject({ kind: 'BANK', bankId: banks[1].id });
    expect(selection.code).toMatch(/^KQ-TG\d{2}$/);
    expect(selection.minutesCode).toMatch(/^BB-TG\d{2}$/);
    expect(selection.comparison.map((row) => row.interestVnd)).toEqual(['15000000', '14750000', '14500000']);
    await bql.post(`/api/deposits/selections/${selection.id}/approve`, { version: selection.version }).expect(403);
    const approved = dataOf<Detail>(
      await bqt.post(`/api/deposits/selections/${selection.id}/approve`, { version: selection.version }).expect(200),
    );
    expect(approved.invitation.status).toBe('SELECTED');
  });

  it('AC-T1.11 / AC-T1.12: not the highest needs a reason; a late offer needs its own', async () => {
    const view = await compared({ 2: { receivedAt: '2026-08-27T17:30:00+07:00' } });
    const c = offerOf(view, banks[2]);
    expect(c.isLate).toBe(true);
    const noReasons = await propose(view, { offerId: c.id }, 400);
    expect(errorFields(noReasons).sort()).toEqual(['lateReason', 'notHighestReason']);
    const proposed = dataOf<Detail>(
      await propose(view, {
        offerId: c.id,
        lateReason: 'Bản chào gửi trễ 30 phút do lỗi email',
        notHighestReason: 'Ngân hàng C cho rút trước hạn không mất lãi',
      }),
    );
    expect(pending(proposed).notHighestReason).toBe('Ngân hàng C cho rút trước hạn không mất lãi');
    expect(proposed.comparison.highestOfferId).toBe(offerOf(view, banks[1]).id);
  });

  it('AC-T1.13 and decisions: "Không chọn được ngân hàng" approved ends with no result; send back, reject', async () => {
    const view = await compared({
      0: { completeness: 'INCOMPLETE', missingNote: 'Thiếu' },
      1: { completeness: 'INCOMPLETE', missingNote: 'Thiếu' },
      2: { completeness: 'INCOMPLETE', missingNote: 'Thiếu' },
    });
    let selection = pending(dataOf<Detail>(await propose(view, { kind: 'NONE' })));
    const returned = dataOf<Detail>(
      await bqt
        .post(`/api/deposits/selections/${selection.id}/request-changes`, {
          version: selection.version,
          reason: 'Bổ sung biên bản có chữ ký',
        })
        .expect(200),
    );
    selection = returned.selections[0];
    expect(selection.status).toBe('NEEDS_CHANGES');
    selection = pending(
      dataOf<Detail>(
        await bql
          .post(`/api/deposits/selections/${selection.id}/resubmit`, {
            version: selection.version,
            kind: 'NONE',
            minutesAttachmentId: await minutes(view.invitation.id),
            basis: 'Không ngân hàng nào đủ hồ sơ theo yêu cầu.',
          })
          .expect(200),
      ),
    );
    const done = dataOf<Detail>(
      await bqt.post(`/api/deposits/selections/${selection.id}/approve`, { version: selection.version }).expect(200),
    );
    expect(done.invitation.status).toBe('NO_RESULT');

    const other = await compared();
    const rejected = pending(dataOf<Detail>(await propose(other, { offerId: offerOf(other, banks[1]).id })));
    const after = dataOf<Detail>(
      await bqt
        .post(`/api/deposits/selections/${rejected.id}/reject`, {
          version: rejected.version,
          reason: 'Biên bản sai số tiền',
        })
        .expect(200),
    );
    expect(after.selections[0].status).toBe('REJECTED');
    expect(after.invitation.status).toBe('CLOSED');
  });

  it('AC-T1.14: an approved result is changed with a reason; the old one is "Đã thay thế" (contract block: T-S2)', async () => {
    const view = await compared();
    const first = pending(dataOf<Detail>(await propose(view, { offerId: offerOf(view, banks[1]).id })));
    await bqt.post(`/api/deposits/selections/${first.id}/approve`, { version: first.version }).expect(200);
    const approved = (await detail(view.invitation.id)).selections[0];
    const changed = dataOf<Detail>(
      await bql
        .post(`/api/deposits/selections/${approved.id}/change`, {
          version: approved.version,
          kind: 'BANK',
          offerId: offerOf(view, banks[2]).id,
          minutesAttachmentId: await minutes(view.invitation.id),
          basis: 'Ngân hàng B rút lại bản chào sau khi được chọn.',
          notHighestReason: 'Ngân hàng B rút lại bản chào sau khi được chọn',
          changeReason: 'Ngân hàng B không ký được hợp đồng tiền gửi',
        })
        .expect(200),
    );
    const next = pending(changed);
    await bqt.post(`/api/deposits/selections/${next.id}/approve`, { version: next.version }).expect(200);
    const after = await detail(view.invitation.id);
    expect(after.selections.find((row) => row.id === approved.id)?.status).toBe('SUPERSEDED');
    expect(after.selections.find((row) => row.id === next.id)).toMatchObject({
      status: 'APPROVED',
      bankId: banks[2].id,
    });
  });

  it('AC-T1.15: Kế toán and ADMIN read but cannot write; KT sees nothing; tòa B gets 404', async () => {
    const seeded = dataOf<Array<{ id: string; code: string }>>(
      await ktoan.get('/api/deposits/invitations').expect(200),
    );
    const mc001 = seeded.find((row) => row.code === 'MC-001') as { id: string };
    const view = await detail(mc001.id, ktoan);
    expect(view.comparison.rows).toHaveLength(3);
    expect(view.selections[0]).toMatchObject({ code: 'KQ-TG01', status: 'APPROVED' });
    await ktoan
      .post(`/api/deposits/invitations/${mc001.id}/extend`, {
        version: 1,
        deadlineAt: DEADLINE,
        reason: 'Thử ghi dữ liệu',
      })
      .expect(403);
    await kt.get('/api/deposits/invitations').expect(403);
    await kt.get('/api/deposits/banks').expect(403);
    await bqlB.get(`/api/deposits/invitations/${mc001.id}`).expect(404);
    // RM-S2 BR-RM2-02: ADMIN reads deposits too, and writes nothing.
    const admin = await signIn(server, 'admin-demo');
    await admin.get(`/api/deposits/invitations/${mc001.id}`).expect(200);
    await admin.post('/api/deposits/banks', { name: 'Ngân hàng của quản trị' }).expect(403);
  });

  it('AC-T1.16: one maintenance fund per building; the fund list stays the exploitation funds', async () => {
    const counts = await dataSource.query<Array<{ building_id: string; n: string }>>(
      `SELECT b.id AS building_id, count(f.id)::text AS n FROM buildings b
         LEFT JOIN funds f ON f.building_id = b.id AND f.kind = 'BAO_TRI' GROUP BY b.id`,
    );
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((row) => row.n === '1')).toBe(true);
    const funds = dataOf<Array<{ kind: string }>>(await bqt.get('/api/funds').expect(200));
    expect(funds.every((row) => row.kind === 'KHAI_THAC')).toBe(true);
  });

  it('AC-T1.17: the seed makes MC-001 (B approved, BB-TG01) and MC-002 (2/3 answered), once', async () => {
    const list = dataOf<Array<{ id: string; code: string; status: string; responded: number; invited: number }>>(
      await bql.get('/api/deposits/invitations').expect(200),
    );
    const mc001 = list.find((row) => row.code === 'MC-001');
    const mc002 = list.find((row) => row.code === 'MC-002');
    expect(mc001).toMatchObject({ status: 'SELECTED', responded: 3, invited: 3 });
    expect(mc002).toMatchObject({ status: 'OPEN', responded: 2, invited: 3 });
    const view = await detail((mc001 as { id: string }).id);
    expect(view.selections[0]).toMatchObject({ code: 'KQ-TG01', minutesCode: 'BB-TG01', status: 'APPROVED' });
    expect(view.comparison.rows.map((row) => [row.bankName, row.interestVnd])).toEqual([
      ['Ngân hàng B', '15000000'],
      ['Ngân hàng C', '14750000'],
      ['Ngân hàng A', '14500000'],
    ]);
    const before = await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM deposit_invitations');
    clock.set(null);
    await app.get(DatabaseSeedService).run();
    const after = await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM deposit_invitations');
    expect(after[0].n).toBe(before[0].n);
  });
});
