// T-S1 evidence in a real browser (headless Chrome), api mode, demo accounts on tòa A: the invitation list, MC-002
// taking offers (2/3), MC-001's comparison (B first, 15.000.000) and approved KQ-TG01; then MC-002 gets its third offer,
// closes early and C (not the highest) is proposed — BQT's view of the waiting result with its warning; Kế toán reads
// without write buttons; 375px.
//
// Prerequisites: api-qltn with migration 2026-10-28c and the demo seed on a fresh database (the run changes MC-002),
// web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/T-chao-lai-chon-ngan-hang/supporting/t-s1-invitations-check.mjs
// Passwords are never printed. CDP_PORT (default 9344).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const text = (needle) => `document.body.innerText.includes(${JSON.stringify(needle)})`;
const shot = async (browser, name, url, ready) => {
  await browser.navigate(url);
  await browser.waitFor(ready, name, 30000);
  await sleep(600);
  await browser.screenshot(name);
};
const noOverflow = async (browser, name) => {
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`${name} horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
};
const upload = async (token, invitationId, purpose, name) => {
  const form = new FormData();
  form.set('subjectType', 'DEPOSIT_INVITATION');
  form.set('subjectId', invitationId);
  form.set('purpose', purpose);
  form.set('file', new Blob([Buffer.from('%PDF-1.4\n% T-S1 evidence\n')], { type: 'application/pdf' }), name);
  const res = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return (await res.json()).data.id;
};

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['bql-a', 'bqt', 'ktoan-a']);
  const bql = tokens['bql-a'];
  const list = expectOk(await apiCall(WEB, 'GET', '/deposits/invitations', { token: bql }), 'invitations');
  const mc001 = list.find((row) => row.code === 'MC-001');
  const mc002 = list.find((row) => row.code === 'MC-002');
  console.log(`AC-T1.17 MC-001 ${mc001.status} ${mc001.responded}/${mc001.invited}; MC-002 ${mc002.status} ${mc002.responded}/${mc002.invited}`);
  const page = (id, tab) => `${WEB}/deposits/invitations/${id}?tab=${tab}`;

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await shot(browser, 'T1-1-list', `${WEB}/deposits/invitations`, `${text('MC-002')} && ${text('Đang nhận bản chào')}`);
  await shot(browser, 'T1-2-mc002-responses', page(mc002.id, 'letter'), `${text('Còn chờ')} && document.querySelector('[role=progressbar]')`);
  await shot(browser, 'T1-3-mc001-comparison', page(mc001.id, 'compare'), `${text('#1 Ngân hàng B')} && ${text('15.000.000')}`);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await shot(browser, 'T1-4-mc002-375', page(mc002.id, 'letter'), text('Còn chờ'));
  await noOverflow(browser, 'T1-4-mc002-375');
  await shot(browser, 'T1-4b-list-375', `${WEB}/deposits/invitations`, text('MC-002'));
  await noOverflow(browser, 'T1-4b-list-375');
  await browser.send('Emulation.clearDeviceMetricsOverride');

  // MC-002: the third bank answers, the invitation closes early, BQL proposes C (5,95% is B; C is not the highest).
  const detail = expectOk(await apiCall(WEB, 'GET', `/deposits/invitations/${mc002.id}`, { token: bql }), 'MC-002');
  const c = detail.invitees.find((bank) => !bank.offerId);
  const received = new Date(Date.now() - 60_000).toISOString();
  const offer = await apiCall(WEB, 'POST', `/deposits/invitations/${mc002.id}/offers`, {
    token: bql,
    body: {
      bankId: c.id,
      receivedAt: received,
      rate: '5,9',
      dayBasis: 365,
      paymentKind: 'END',
      attachmentId: await upload(bql, mc002.id, 'DEPOSIT_OFFER', `Bản chào ${c.name}.pdf`),
      completeness: 'COMPLETE',
    },
  });
  const afterOffer = expectOk(offer, 'offer C');
  const closed = expectOk(
    await apiCall(WEB, 'POST', `/deposits/invitations/${mc002.id}/close`, {
      token: bql,
      body: { version: afterOffer.invitation.version, reason: 'Cả ba ngân hàng đã gửi bản chào.' },
    }),
    'close early',
  );
  console.log(`MC-002 closed early: ${closed.invitation.status}; mixed basis ${closed.comparison.mixedBasis}`);
  const cOffer = closed.offers.find((row) => row.bankId === c.id);
  expectOk(
    await apiCall(WEB, 'POST', `/deposits/invitations/${mc002.id}/selections`, {
      token: bql,
      body: {
        kind: 'BANK',
        offerId: cOffer.id,
        minutesAttachmentId: await upload(bql, mc002.id, 'DEPOSIT_SELECTION_MINUTES', 'Biên bản chọn ngân hàng.pdf'),
        basis: 'Ngân hàng C cho rút trước hạn không mất lãi; đủ hồ sơ.',
        notHighestReason: 'Điều kiện rút trước hạn tốt hơn bản có lãi cao nhất.',
      },
    }),
    'propose C',
  );

  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await shot(browser, 'T1-5-bqt-pending', page(mc002.id, 'result'), `${text('Chờ duyệt')} && ${text('Không phải bản chào có lãi cả kỳ cao nhất')}`);
  const decisions = await browser.evaluate(`['Duyệt', 'Yêu cầu sửa', 'Từ chối'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === name))`);
  console.log(`BQT decision buttons: ${JSON.stringify(decisions)}`);
  await shot(browser, 'T1-6-bqt-comparison-mixed', page(mc002.id, 'compare'), text('cơ sở tính ngày khác nhau'));

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await shot(browser, 'T1-7-ktoan-readonly', page(mc001.id, 'result'), `${text('KQ-TG01')} && ${text('Đã duyệt')}`);
  const writes = await browser.evaluate(
    `['Ghi nhận bản chào', 'Sửa', 'Gia hạn', 'Hủy thư', 'Duyệt', 'Đổi kết quả'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === name))`,
  );
  console.log(`Kế toán write buttons: ${JSON.stringify(writes)}`);
  if (writes.length) throw new Error('Kế toán has write buttons');
  console.log('T-S1 invitations flow: PASS');
} catch (error) {
  await browser.screenshot('T1-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
