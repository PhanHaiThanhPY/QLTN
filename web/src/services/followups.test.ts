import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePng } from '@/mock/placeholder-files';
import { getDb } from '@/storage/db';
import { asUser, occurrenceByCode, recordByCode, run, seedAt } from '@/test/helpers';
import type { ErrorCode } from '@/domain/errors';
import { uploadAttachment } from './file-service';
import { getItemDetail, getPlanDetail, listOccurrences } from './maintenance-service';

const png = () => makeSamplePng('#000000', '#ffffff');

const expectCode = async (promise: Promise<unknown>, code: ErrorCode): Promise<void> => {
  await expect(promise).rejects.toMatchObject({ code });
};

describe('follow-up features', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should record item condition changes as old → new in the audit', async () => {
    const bt5 = await occurrenceByCode('BT-005');
    asUser(USER_ID.BQL_A);
    const detail = await getItemDetail(bt5.itemId);
    const change = detail.audit.find((event) => event.action === 'confirmMaintenanceCondition');
    expect(change?.fromStatus).toBe('UNKNOWN');
    expect(change?.toStatus).toBe('NEEDS_ATTENTION');
    await run('updateItemCondition', 'MAINTENANCE_ITEM', bt5.itemId, { condition: 'GOOD', note: 'Đã thay phớt bơm số 1.' });
    const after = await getItemDetail(bt5.itemId);
    const latest = after.audit.find((event) => event.action === 'updateItemCondition');
    expect([latest?.fromStatus, latest?.toStatus]).toEqual(['NEEDS_ATTENTION', 'GOOD']);
  });

  it('should expose review waiting time and reassignment flags on list rows', async () => {
    asUser(USER_ID.ADMIN);
    const page = await listOccurrences({ status: 'PENDING_REVIEW' });
    expect(page.items[0].pendingSince).toBeDefined();
    const bt10 = await occurrenceByCode('BT-010');
    const plan = await getPlanDetail(bt10.planId);
    expect(plan.rows.find((row) => row.occurrence.id === bt10.id)?.pendingSince).toBeDefined();
  });

  it('should only accept the document kind of the current step', async () => {
    const sc5 = await recordByCode('SC-005');
    asUser(USER_ID.TVKT);
    await expectCode(uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: sc5.id, purpose: 'OTHER', file: png(), fileName: 'x.png' }), 'FORBIDDEN');
    const sc13 = await recordByCode('SC-013');
    asUser(USER_ID.BQL_A);
    await expectCode(uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: sc13.id, purpose: 'SITE_PHOTO', file: png(), fileName: 'x.png' }), 'FORBIDDEN');
    const proof = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: sc13.id, purpose: 'PAYMENT_PROOF', file: png(), fileName: 'unc.png' });
    expect(proof.purpose).toBe('PAYMENT_PROOF');
    const bt3 = await occurrenceByCode('BT-003');
    await expectCode(uploadAttachment({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: bt3.id, purpose: 'MAINTENANCE_RESULT', file: png(), fileName: 'x.png' }), 'FORBIDDEN');
    expect(await getDb().attachments.where('[subjectType+subjectId]').equals(['MAINTENANCE_OCCURRENCE', bt3.id]).count()).toBe(0);
  });

  it('should enforce upload capabilities even when the user is assigned', async () => {
    const record = await recordByCode('SC-013');
    const user = await getDb().users.get(USER_ID.BQL_A);
    if (!user) throw new Error('Missing BQL-A seed user');

    await getDb().users.put({ ...user, capabilities: ['VIEW'] });
    asUser(USER_ID.BQL_A);
    await expectCode(
      uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: record.id, purpose: 'PAYMENT_PROOF', file: png(), fileName: 'unc.png' }),
      'FORBIDDEN',
    );

    const occurrence = await occurrenceByCode('BT-003');
    await expectCode(
      uploadAttachment({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrence.id, purpose: 'MAINTENANCE_RESULT', file: png(), fileName: 'result.png' }),
      'FORBIDDEN',
    );
  });
});
