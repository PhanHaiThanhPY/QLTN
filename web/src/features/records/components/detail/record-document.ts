import type { AcceptanceResult } from '@/domain/types';
import { PRIORITY_LABEL, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { RecordDetail } from '@/services/records-service';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVnd } from '@/utils/money';

export interface RecordDocumentLookups {
  buildingName: (id?: string) => string;
  locationName: (id?: string) => string;
  userName: (id?: string) => string;
}

const ACCEPTANCE_RESULT_LABEL = {
  PENDING: 'CHỜ NGHIỆM THU',
  PASSED: 'ĐẠT',
  FAILED: 'KHÔNG ĐẠT',
} as const satisfies Record<AcceptanceResult, string>;

const escapeHtml = (value: unknown): string =>
  String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const row = (label: string, value: unknown): string => `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;

const formatBytes = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

const list = (items: string[], empty = 'Chưa có dữ liệu'): string =>
  items.length > 0 ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;

const table = (headers: string[], rows: string[][], empty = 'Chưa có dữ liệu'): string =>
  rows.length > 0
    ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    : `<p class="muted">${escapeHtml(empty)}</p>`;

const statusLabel = (status: string): string => REPAIR_STATUS_LABEL[status as keyof typeof REPAIR_STATUS_LABEL] ?? status;

/** Builds a printable bundle for the demo forms already represented by a repair record. */
export const buildRepairDocumentHtml = (detail: RecordDetail, lookup: RecordDocumentLookups): string => {
  const { record } = detail;
  const latestSubmission = detail.submissions.at(-1)?.submission;
  const latestAcceptance = detail.acceptances.at(-1);
  const latestPaymentRequest = detail.paymentRequests.at(-1);
  const signatureImages = detail.signatures.map((signature) => `<img class="signature" src="${escapeHtml(signature.imageDataUrl)}" alt="Chữ ký ${escapeHtml(lookup.userName(signature.actorId))}" />`);
  const approvalRows = detail.submissions.flatMap(({ submission, decisions }) =>
    decisions.map((decision) => [
      `Lần ${submission.attemptNo}`,
      decision.step,
      lookup.userName(decision.actorId),
      decision.outcome === 'APPROVED' ? 'Đã duyệt' : decision.outcome === 'NEEDS_UPDATE' ? 'Cần bổ sung' : 'Từ chối',
      formatDateTime(decision.createdAt),
      decision.reason ?? '—',
    ]),
  );
  const constructionRows = detail.construction?.logs.map((log) => [
    formatDateTime(log.createdAt),
    `${log.progressPercent}%`,
    lookup.userName(log.actorId),
    log.note,
  ]) ?? [];
  const acceptanceRows = latestAcceptance?.checks.map((check) => [
    check.reviewerLabel ?? check.reviewer,
    lookup.userName(check.actorId),
    check.passed ? 'Đạt' : 'Không đạt',
    formatDateTime(check.checkedAt),
    check.note,
  ]) ?? [];
  const paymentRows = detail.payments.map((payment) => [
    formatDate(payment.paidDate),
    formatVnd(payment.amountVnd),
    payment.reference,
    lookup.userName(payment.recordedBy),
  ]);
  const proposalFiles = detail.attachments.filter((attachment) => latestSubmission?.attachmentIds.includes(attachment.id) || detail.proposalDraft?.attachmentIds.includes(attachment.id));
  const draftAmountVnd = detail.proposalDraft?.amountVnd;
  let budgetLabel = 'Chưa có';
  if (latestSubmission) budgetLabel = formatVnd(latestSubmission.amountVnd);
  else if (draftAmountVnd) budgetLabel = formatVnd(draftAmountVnd);
  const paymentFiles = detail.attachments.filter((attachment) => latestPaymentRequest?.attachmentIds.includes(attachment.id) || detail.payments.some((payment) => payment.attachmentIds.includes(attachment.id)));

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>Bộ biểu mẫu ${escapeHtml(record.code)}</title>
<style>
:root { color-scheme: light; --ink: #172b4d; --muted: #64748b; --line: #dbe4ee; --soft: #f5f8fb; --brand: #0f766e; --brand-soft: #e6f5f3; }
@page { size: A4; margin: 14mm 16mm 16mm; }
* { box-sizing: border-box; }
body { background: #eef3f8; color: var(--ink); font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; margin: 0; }
.page { background: #fff; margin: 20px auto; max-width: 210mm; min-height: 297mm; padding: 16mm 17mm 14mm; box-shadow: 0 12px 34px rgba(23,43,77,.12); }
.no-print { color: var(--muted); font-size: 11px; margin: 0 auto 12px; max-width: 210mm; }
.brand { align-items: flex-start; border-bottom: 2px solid var(--brand); display: flex; gap: 14px; justify-content: space-between; padding-bottom: 14px; }
.brand-mark { align-items: center; background: var(--brand); border-radius: 10px; color: #fff; display: flex; font-size: 17px; font-weight: 800; height: 44px; justify-content: center; letter-spacing: .04em; width: 44px; }
.eyebrow { color: var(--brand); font-size: 10px; font-weight: 700; letter-spacing: .1em; margin: 0 0 4px; text-transform: uppercase; }
h1 { color: var(--ink); font-size: 21px; letter-spacing: -.02em; margin: 0 0 4px; }
.subtitle { color: var(--muted); margin: 0; }
.document-id { text-align: right; }
.code { color: var(--ink); font-size: 17px; font-weight: 800; }
.badge { background: var(--brand-soft); border: 1px solid #b8e1dc; border-radius: 999px; color: #0f5f59; display: inline-block; font-size: 10px; font-weight: 700; margin-top: 6px; padding: 3px 9px; }
.hero { background: linear-gradient(135deg, #f1fbfa 0%, #f8fafc 100%); border: 1px solid #cfe8e4; border-radius: 10px; margin: 16px 0 20px; padding: 14px 16px; }
.hero-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
.meta, .fields { display: grid; gap: 0 22px; grid-template-columns: 1fr 1fr; }
.field { border-bottom: 1px solid #edf2f7; padding: 8px 0; }
.field dt { color: var(--muted); font-size: 10px; margin-bottom: 2px; }
.field dd { font-size: 12px; font-weight: 700; margin: 0; }
.section { break-inside: avoid; border-top: 1px solid var(--line); margin-top: 24px; padding-top: 14px; }
.section-heading { align-items: baseline; display: flex; gap: 10px; margin-bottom: 10px; }
.section-number { color: var(--brand); font-size: 11px; font-weight: 800; }
h2 { color: var(--ink); font-size: 15px; margin: 0; }
.section-note { color: var(--muted); font-size: 11px; margin: -4px 0 12px; }
.description { background: var(--soft); border: 1px solid var(--line); border-radius: 7px; margin: 10px 0; padding: 11px 12px; white-space: pre-wrap; }
.label { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .04em; margin: 13px 0 5px; text-transform: uppercase; }
ul { margin: 7px 0; padding-left: 18px; } li { margin: 3px 0; } .muted { color: var(--muted); } .empty { background: var(--soft); border-radius: 6px; padding: 8px 10px; }
table { border-collapse: collapse; font-size: 11px; margin: 8px 0 12px; page-break-inside: avoid; width: 100%; }
th { background: #eef7f6; color: #245b57; font-size: 9px; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
th, td { border: 1px solid var(--line); padding: 7px 8px; vertical-align: top; } tbody tr:nth-child(even) { background: #fbfdff; }
.signatures { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin-top: 10px; }
.signature-card { border: 1px solid var(--line); border-radius: 7px; min-height: 112px; padding: 9px; text-align: center; }
.signature-card img { height: 54px; max-width: 100%; object-fit: contain; } .signature-card p { border-top: 1px solid #94a3b8; color: var(--muted); font-size: 10px; margin: 8px 0 0; padding-top: 4px; }
.footer { border-top: 1px solid var(--line); color: var(--muted); font-size: 10px; margin-top: 28px; padding-top: 10px; }
@media screen and (max-width: 760px) { .page { margin: 0; min-height: 100vh; padding: 20px; } .meta, .fields, .signatures { grid-template-columns: 1fr; } .brand { gap: 8px; } .document-id { min-width: 90px; } table { display: block; overflow-x: auto; } }
@media print { body { background: #fff; } .no-print { display: none; } .page { box-shadow: none; margin: 0; max-width: none; padding: 0; } .section { break-inside: avoid; } a { color: inherit; text-decoration: none; } }
</style></head><body>
<div class="no-print">Bản xem trước đã được dàn trang theo khổ A4 · dùng hộp thoại In để lưu PDF hoặc phát hành bản giấy.</div>
<main class="page">
<header class="brand">
  <div style="display:flex;gap:12px"><div class="brand-mark">QL</div><div><p class="eyebrow">AN SANA · QUẢN LÝ TÒA NHÀ</p><h1>Bộ biểu mẫu hồ sơ sửa chữa</h1><p class="subtitle">Hồ sơ được tổng hợp theo vòng đời xử lý và workflow đã cấu hình.</p></div></div>
  <div class="document-id"><div class="code">${escapeHtml(record.code)}</div><span class="badge">${escapeHtml(statusLabel(record.status))}</span></div>
</header>
<div class="hero"><p class="hero-title">${escapeHtml(record.title)}</p><div class="meta">${row('Tòa nhà', lookup.buildingName(record.buildingId))}${row('Vị trí', lookup.locationName(record.locationId))}${row('Mức ưu tiên', PRIORITY_LABEL[record.priority])}${row('Ngày tạo', formatDateTime(record.createdAt))}</div></div>

<section class="section"><div class="section-heading"><span class="section-number">01</span><h2>Biên bản hiện trạng</h2></div>
<p class="section-note">Thông tin nhận diện, vị trí và kết quả xác nhận hiện trạng ban đầu.</p>
<div class="fields">${row('Tên hồ sơ', record.title)}${row('Người quản lý', lookup.userName(record.managerUserId))}${row('Người xác nhận', lookup.userName(record.confirmationUserId))}</div>
<p class="label">Mô tả hư hỏng / yêu cầu xử lý</p><p class="description">${escapeHtml(record.description)}</p>
<p class="label">Lịch sử xác nhận</p>${list(detail.confirmations.map((item) => `${escapeHtml(formatDateTime(item.createdAt))} · ${escapeHtml(lookup.userName(item.actorId))} · ${escapeHtml(item.note)}`))}
</section>

<section class="section"><div class="section-heading"><span class="section-number">02</span><h2>Tờ trình và quyết định</h2></div>
<p class="section-note">Phương án, nhà thầu, ngân sách và kết quả phê duyệt theo workflow.</p>
<div class="fields">${row('Số tờ trình', record.code)}${row('Kính gửi', 'Chuỗi phê duyệt theo cấu hình tòa nhà')}${row('Người trình', lookup.userName(latestSubmission?.submittedBy))}${row('Thẩm định nội dung', lookup.userName(record.consultantUserId))}${row('Loại tờ trình', 'Sửa chữa tài sản')}${row('Ngân sách', budgetLabel)}${row('Ngày trình', latestSubmission ? formatDateTime(latestSubmission.submittedAt) : 'Chưa trình')}${row('Lần trình', latestSubmission ? `Lần ${latestSubmission.attemptNo}` : 'Chưa trình')}${row('Nhà thầu thực hiện', latestSubmission?.contractorName ?? detail.proposalDraft?.contractorName)}</div>
<p class="label">Nội dung xin phê duyệt</p>
<p class="description">${escapeHtml(latestSubmission?.proposal ?? detail.proposalDraft?.proposal ?? 'Chưa lập tờ trình')}</p>
<p class="label">Đề xuất và cơ sở xin phê duyệt</p>
<p class="description">Căn cứ biên bản hiện trạng và các tài liệu đính kèm của hồ sơ. Người duyệt kiểm tra phương án, nhà thầu, ngân sách và lịch sử xử lý trước khi quyết định.</p>
<p class="label">Tài liệu tờ trình</p>${list(proposalFiles.map((attachment) => `${escapeHtml(attachment.fileName)} · ${escapeHtml(formatBytes(attachment.sizeBytes))}`), 'Chưa có tài liệu tờ trình.')}
<p class="label">Lịch sử quyết định</p>${table(['Lần trình', 'Bước', 'Người xử lý', 'Kết quả', 'Thời gian', 'Ý kiến'], approvalRows)}
<p class="label">Chữ ký đã lưu</p><div class="signatures">${signatureImages.length > 0 ? detail.signatures.map((signature) => `<div class="signature-card">${signatureImages[detail.signatures.indexOf(signature)]}<p>${escapeHtml(lookup.userName(signature.actorId))}<br />${escapeHtml(formatDateTime(signature.signedAt))}</p></div>`).join('') : '<p class="muted">Chưa có chữ ký.</p>'}</div>
</section>

<section class="section"><div class="section-heading"><span class="section-number">03</span><h2>Nhật ký thi công</h2></div>
<p class="section-note">Các mốc cập nhật tiến độ và ghi nhận thực tế trong quá trình thực hiện.</p>
${table(['Thời gian', 'Tiến độ', 'Người cập nhật', 'Ghi chú'], constructionRows)}
</section>

<section class="section"><div class="section-heading"><span class="section-number">04</span><h2>Biên bản nghiệm thu</h2></div>
<p class="section-note">Kết quả kiểm tra sau thi công và ý kiến của các bên liên quan.</p>
<div class="fields">${row('Thời gian gửi nghiệm thu', latestAcceptance ? formatDateTime(latestAcceptance.submittedAt) : 'Chưa gửi')}${row('Địa điểm', `${lookup.buildingName(record.buildingId)} · ${lookup.locationName(record.locationId)}`)}${row('Đại diện Ban quản lý', lookup.userName(record.managerUserId))}${row('Đại diện Ban quản trị', lookup.userName(record.boardUserId))}${row('Đại diện TVKT', lookup.userName(record.consultantUserId))}${row('Đại diện kỹ thuật', lookup.userName(record.confirmationUserId))}${row('Lượt nghiệm thu', latestAcceptance ? `Lượt ${latestAcceptance.roundNo}` : 'Chưa gửi')}${row('Kết quả', latestAcceptance ? ACCEPTANCE_RESULT_LABEL[latestAcceptance.result] : undefined)}</div>
<p class="description">${escapeHtml(latestAcceptance?.submissionNote ?? 'Chưa có nội dung nghiệm thu.')}</p>
${table(['Vai trò', 'Người kiểm tra', 'Kết quả', 'Thời gian', 'Ghi chú'], acceptanceRows)}
</section>

<section class="section"><div class="section-heading"><span class="section-number">05</span><h2>Đề nghị và chứng từ thanh toán</h2></div>
<p class="section-note">Đề nghị thanh toán, lịch sử chi trả và chứng từ kèm theo.</p>
<div class="fields">${row('Kính gửi', 'Ban quản trị / người có thẩm quyền thanh toán')}${row('Lần đề nghị', latestPaymentRequest ? `Lần ${latestPaymentRequest.revisionNo}` : 'Chưa có')}${row('Người lập', lookup.userName(latestPaymentRequest?.submittedBy))}${row('Số tiền đề nghị', latestPaymentRequest ? formatVnd(latestPaymentRequest.amountVnd) : 'Chưa có')}${row('Nội dung', `Thanh toán chi phí ${record.title}`)}${row('Trạng thái', latestPaymentRequest?.decision ?? 'Chưa gửi')}</div>
${table(['Ngày thanh toán', 'Số tiền', 'Tham chiếu', 'Người ghi nhận'], paymentRows)}
<p class="label">Bộ hồ sơ đính kèm</p>${list(paymentFiles.map((attachment) => `${escapeHtml(attachment.fileName)} · ${escapeHtml(formatBytes(attachment.sizeBytes))}`), 'Chưa có chứng từ thanh toán.')}
</section>
<div class="footer">Bản xem trước được tổng hợp từ dữ liệu hồ sơ hiện tại · Tạo lúc ${escapeHtml(formatDateTime(record.updatedAt))} · Chữ ký trong demo là chữ ký vẽ; cần kiểm tra và phê duyệt trước khi phát hành chính thức.</div>
</main>
</body></html>`;
};
