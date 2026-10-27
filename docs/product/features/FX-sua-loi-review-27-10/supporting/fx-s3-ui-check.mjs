// AC-FX3.5 evidence for slice FX-S3 (R-04): ADMIN applies a configuration template to building A, and BQL of building
// A sees that row, with who and when, in "Lịch sử thay đổi tòa" on the locations screen (BR-FX3-04, PD-13).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190).
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/FX-sua-loi-review-27-10/supporting/fx-s3-ui-check.mjs
// Building A is re-applied to STANDARD (its usual template), so the configuration ends as it was. Passwords are
// never printed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { applyTemplate, expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const tokens = await signInTokens(WEB, PASSWORD, ['admin-demo']);
const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
expectOk(await applyTemplate(WEB, tokens['admin-demo'], buildingA.id, 'STANDARD'), 'apply STANDARD');
console.log('admin-demo applied the STANDARD template to building A');

const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${WEB}/settings/locations?b=${buildingA.id}`);
  await browser.waitFor(`document.body.innerText.includes('Lịch sử thay đổi tòa')`, 'building history card', 30000);
  await browser.waitFor(`document.body.innerText.includes('Áp dụng cấu hình mẫu')`, 'template row', 30000);
  await browser.evaluate(`[...document.querySelectorAll('h2, h3')].find((el) => el.textContent.includes('Lịch sử thay đổi tòa'))?.scrollIntoView({ block: 'start' }), true`);
  await sleep(300);
  await browser.screenshot('FX-S3-1-bql-sees-template-in-building-history');
  console.log('AC-FX3.5 BQL sees "Áp dụng cấu hình mẫu" in the building history: PASS');
} catch (error) {
  await browser.screenshot('FX-S3-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
}
