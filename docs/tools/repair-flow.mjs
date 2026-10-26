// API steps that bring a repair record to a given point, for the browser evidence scripts (no UI, demo accounts).
// Passwords are never printed. Login goes through loginWithRetry (10/min/IP limit).
import { deflateSync } from 'node:zlib';
import { apiCall, loginWithRetry } from './seed-accounts.mjs';

/** 16x16 PNG built in memory (passes the API magic-byte check). */
export const pngBytes = () => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(48, 0x46)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const signatureDataUrl = () => `data:image/png;base64,${pngBytes().toString('base64')}`;
export const pdfBytes = (label) => Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`);

export const expectOk = (res, label) => {
  if (res.status < 200 || res.status >= 300) throw new Error(`${label} answered ${res.status}: ${JSON.stringify(res.body?.error ?? {})}`);
  return res.body.data;
};

export const uploadApi = async (webUrl, token, recordId, purpose, name, mime, bytes) => {
  const form = new FormData();
  form.set('subjectType', 'REPAIR_RECORD');
  form.set('subjectId', recordId);
  form.set('purpose', purpose);
  form.set('file', new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${webUrl}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status !== 201) throw new Error(`upload ${purpose} answered ${res.status}`);
  return (await res.json()).data.id;
};

export const applyTemplate = async (webUrl, token, buildingId, templateKey) => {
  const config = await apiCall(webUrl, 'GET', `/buildings/${buildingId}/config`, { token });
  return apiCall(webUrl, 'POST', `/buildings/${buildingId}/config/apply-template`, {
    token,
    body: { templateKey, version: config.body.data.version },
  });
};

/** Signs in the demo accounts the flow needs; returns their tokens. */
export const signInTokens = async (webUrl, password, usernames) => {
  const tokens = {};
  for (const username of usernames) tokens[username] = (await loginWithRetry(webUrl, username, password)).body.data.accessToken;
  return tokens;
};

const post = (webUrl, token, record, route, body = {}) =>
  apiCall(webUrl, 'POST', `/records/${record.id}/${route}`, { token, body: { version: record.version, ...body } });

/**
 * Building A on AQUA; a record created, confirmed by TVKT, its proposal (one item, 2 × `unitPriceVnd`, contractor
 * "Công ty Nam Phát") approved by TVKT then BQT with minutes: READY_FOR_CONSTRUCTION.
 */
export const readyForConstruction = async (webUrl, tokens, { title, unitPriceVnd = '500000' }) => {
  const buildingA = (await apiCall(webUrl, 'GET', '/buildings', { token: tokens['admin-demo'] })).body.data.find((row) => row.code === 'A');
  expectOk(await applyTemplate(webUrl, tokens['admin-demo'], buildingA.id, 'AQUA'), 'apply AQUA');
  const bql = tokens['bql-a'];
  const pdf = pdfBytes(title);
  const location = (await apiCall(webUrl, 'GET', '/reference', { token: bql })).body.data.locations.find((row) => row.buildingId === buildingA.id);
  let record = expectOk(
    await apiCall(webUrl, 'POST', '/records', {
      token: bql,
      body: { buildingId: buildingA.id, locationId: location.id, title, description: 'Ống cấp nước trần hành lang tầng 3 rò, cần thay đoạn ống.', noMaintenanceItem: true },
    }),
    'create record',
  );
  const photo = await uploadApi(webUrl, bql, record.id, 'SITE_PHOTO', 'hien-truong.png', 'image/png', pngBytes());
  record = expectOk(await post(webUrl, bql, record, 'submit', { attachmentIds: [photo] }), 'submit');
  record = expectOk(await post(webUrl, tokens.tvkt, record, 'confirm-repair', { note: 'Đúng hiện trạng, cần thay ống.' }), 'confirm');
  const incident = await uploadApi(webUrl, bql, record.id, 'INCIDENT_MINUTES', 'bien-ban.pdf', 'application/pdf', pdf);
  const quotation = await uploadApi(webUrl, bql, record.id, 'QUOTATION', 'bao-gia.pdf', 'application/pdf', pdf);
  record = expectOk(
    await post(webUrl, bql, record, 'submit-proposal', {
      proposalType: 'SUA_CHUA',
      budgetSource: 'KINH_PHI_BAO_TRI',
      requestContent: 'Thay đoạn ống cấp nước bị rò ở hành lang tầng 3.',
      assessment: 'Ống cũ đã mục, thay mới cả đoạn và van khóa.',
      items: [{ name: 'Ống cấp PPR D25 và van', unit: 'gói', quantity: '2' }],
      contractors: [{ name: 'Công ty Nam Phát', unitPricesVnd: [unitPriceVnd], otherCostVnd: '0', taxVnd: '0', quotationAttachmentIds: [quotation] }],
      proposedContractorIndex: 0,
      shortfallReason: 'Sự cố gấp, một nhà thầu nhận thi công ngay.',
      incidentAttachmentIds: [incident],
      signature: signatureDataUrl(),
    }),
    'submit proposal',
  );
  record = expectOk(await post(webUrl, tokens.tvkt, record, 'approve-proposal'), 'TVKT approve');
  const minutes = await uploadApi(webUrl, tokens.bqt, record.id, 'BOARD_MINUTES', 'bien-ban-bqt.pdf', 'application/pdf', pdf);
  record = expectOk(
    await post(webUrl, tokens.bqt, record, 'approve-proposal', { boardMinutesAttachmentIds: [minutes], signature: signatureDataUrl() }),
    'BQT approve',
  );
  return { record, buildingId: buildingA.id };
};

/** From IN_CONSTRUCTION: 100 %, minutes, BQL + BQT + TVKT pass → PENDING_PAYMENT_REQUEST. */
export const accepted = async (webUrl, tokens, record, today) => {
  let current = expectOk(await post(webUrl, tokens['bql-a'], record, 'update-construction', { progressPercent: 100, note: 'Hoàn thành khối lượng.' }), 'progress');
  const photo = await uploadApi(webUrl, tokens['bql-a'], current.id, 'ACCEPTANCE', 'nghiem-thu.png', 'image/png', pngBytes());
  current = expectOk(
    await post(webUrl, tokens['bql-a'], current, 'submit-acceptance', {
      completedDate: today,
      inspectedAt: new Date().toISOString(),
      inspectionLocation: 'Hành lang tầng 3',
      content: 'Kiểm tra hạng mục đã thay, chạy thử áp lực đạt.',
      photoAttachmentIds: [photo],
    }),
    'submit acceptance',
  );
  for (const member of ['bql-a', 'bqt', 'tvkt']) {
    current = expectOk(await post(webUrl, tokens[member], current, 'pass-acceptance', { signature: signatureDataUrl() }), `${member} pass`);
  }
  return current;
};

export { post as postRecordAction };
