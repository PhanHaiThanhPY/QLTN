import type { AcceptanceResult } from '@/domain/types';
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

const row = (label: string, value: unknown): string => `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;

const formatBytes = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

const list = (items: string[], empty = 'Chưa có dữ liệu'): string =>
  items.length > 0 ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;

/** Builds a printable bundle for the demo forms already represented by a repair record. */
export const buildRepairDocumentHtml = (detail: RecordDetail, lookup: RecordDocumentLookups): string => {
  const { record } = detail;
  const latestSubmission = detail.submissions.at(-1)?.submission;
  const latestAcceptance = detail.acceptances.at(-1);
  const latestPaymentRequest = detail.paymentRequests.at(-1);
  const signatureImages = detail.signatures.map((signature) => `<img class="signature" src="${escapeHtml(signature.imageDataUrl)}" alt="Chữ ký ${escapeHtml(lookup.userName(signature.actorId))}" />`);
  const constructionLogs = detail.construction?.logs.map((log) => `${escapeHtml(formatDateTime(log.createdAt))} · ${escapeHtml(log.progressPercent)}% · ${escapeHtml(log.note)}`) ?? [];
  const acceptanceChecks = latestAcceptance?.checks.map((check) => `${escapeHtml(lookup.userName(check.actorId))}: ${check.passed ? 'Đạt' : 'Không đạt'} · ${escapeHtml(check.note)}`) ?? [];
  const payments = detail.payments.map((payment) => `${escapeHtml(formatDate(payment.paidDate))} · ${escapeHtml(formatVnd(payment.amountVnd))} · Ref ${escapeHtml(payment.reference)}`);
  const proposalFiles = detail.attachments.filter((attachment) => latestSubmission?.attachmentIds.includes(attachment.id) || detail.proposalDraft?.attachmentIds.includes(attachment.id));
  const draftAmountVnd = detail.proposalDraft?.amountVnd;
  let budgetLabel = 'Chưa có';
  if (latestSubmission) budgetLabel = formatVnd(latestSubmission.amountVnd);
  else if (draftAmountVnd) budgetLabel = formatVnd(draftAmountVnd);
  const paymentFiles = detail.attachments.filter((attachment) => latestPaymentRequest?.attachmentIds.includes(attachment.id) || detail.payments.some((payment) => payment.attachmentIds.includes(attachment.id)));

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>Bộ biểu mẫu ${escapeHtml(record.code)}</title>
<style>
@page { size: A4; margin: 18mm; } body { font-family: Arial, sans-serif; color: #102a43; line-height: 1.45; margin: 0; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; border-bottom: 1px solid #d7e2ec; padding-bottom: 6px; margin: 24px 0 10px; }
.muted { color: #61758a; } .meta, .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
.field { border-bottom: 1px solid #edf2f7; padding: 5px 0; } .field span { display: block; color: #61758a; font-size: 11px; } .field strong { display: block; font-size: 13px; }
.description { white-space: pre-wrap; border: 1px solid #d7e2ec; border-radius: 6px; padding: 10px; } ul { margin: 6px 0; padding-left: 20px; }
.signature { max-width: 180px; max-height: 70px; object-fit: contain; border-bottom: 1px solid #102a43; margin: 8px 18px 0 0; }
.footer { margin-top: 28px; color: #61758a; font-size: 11px; border-top: 1px solid #d7e2ec; padding-top: 8px; }
@media print { .no-print { display: none; } }
</style></head><body>
<div class="no-print muted">Bản xem trước biểu mẫu · chọn In / Save as PDF để lưu bản phát hành.</div>
<h1>QLTN · Bộ biểu mẫu hồ sơ sửa chữa</h1>
<p class="muted">Mã hồ sơ ${escapeHtml(record.code)} · tạo lúc ${escapeHtml(formatDateTime(record.createdAt))}</p>
<div class="meta">${row('Tòa nhà', lookup.buildingName(record.buildingId))}${row('Vị trí', lookup.locationName(record.locationId))}${row('Trạng thái', record.status)}${row('Mức ưu tiên', record.priority)}</div>

<h2>1. Biên bản hiện trạng</h2>
<div class="fields">${row('Tên hồ sơ', record.title)}${row('Người quản lý', lookup.userName(record.managerUserId))}${row('Người xác nhận', lookup.userName(record.confirmationUserId))}</div>
<p class="description">${escapeHtml(record.description)}</p>
<p><strong>Kết luận xác nhận:</strong></p>${list(detail.confirmations.map((item) => `${escapeHtml(formatDateTime(item.createdAt))} · ${escapeHtml(lookup.userName(item.actorId))} · ${escapeHtml(item.note)}`))}

<h2>2. Tờ trình và quyết định</h2>
<div class="fields">${row('Số tờ trình', record.code)}${row('Kính gửi', 'Chuỗi phê duyệt theo cấu hình tòa nhà')}${row('Người trình', lookup.userName(latestSubmission?.submittedBy))}${row('Thẩm định nội dung', lookup.userName(record.consultantUserId))}${row('Loại tờ trình', 'Sửa chữa tài sản')}${row('Ngân sách', budgetLabel)}${row('Ngày trình', latestSubmission ? formatDateTime(latestSubmission.submittedAt) : 'Chưa trình')}${row('Lần trình', latestSubmission ? `Lần ${latestSubmission.attemptNo}` : 'Chưa trình')}${row('Nhà thầu thực hiện', latestSubmission?.contractorName ?? detail.proposalDraft?.contractorName)}</div>
<p><strong>Nội dung xin phê duyệt</strong></p>
<p class="description">${escapeHtml(latestSubmission?.proposal ?? detail.proposalDraft?.proposal ?? 'Chưa lập tờ trình')}</p>
<p><strong>Đề xuất và cơ sở xin phê duyệt</strong></p>
<p class="description">Căn cứ biên bản hiện trạng và các tài liệu đính kèm của hồ sơ. Người duyệt kiểm tra phương án, nhà thầu, ngân sách và lịch sử xử lý trước khi quyết định.</p>
<p><strong>Tài liệu tờ trình</strong></p>${list(proposalFiles.map((attachment) => `${escapeHtml(attachment.fileName)} · ${escapeHtml(formatBytes(attachment.sizeBytes))}`), 'Chưa có tài liệu tờ trình.')}
<p><strong>Chữ ký đã lưu:</strong></p>${signatureImages.length > 0 ? signatureImages.join('') : '<p class="muted">Chưa có chữ ký.</p>'}

<h2>3. Nhật ký thi công</h2>${list(constructionLogs)}

<h2>4. Biên bản nghiệm thu</h2>
<div class="fields">${row('Thời gian gửi nghiệm thu', latestAcceptance ? formatDateTime(latestAcceptance.submittedAt) : 'Chưa gửi')}${row('Địa điểm', `${lookup.buildingName(record.buildingId)} · ${lookup.locationName(record.locationId)}`)}${row('Đại diện Ban quản lý', lookup.userName(record.managerUserId))}${row('Đại diện Ban quản trị', lookup.userName(record.boardUserId))}${row('Đại diện TVKT', lookup.userName(record.consultantUserId))}${row('Đại diện kỹ thuật', lookup.userName(record.confirmationUserId))}${row('Lượt nghiệm thu', latestAcceptance ? `Lượt ${latestAcceptance.roundNo}` : 'Chưa gửi')}${row('Kết quả', latestAcceptance ? ACCEPTANCE_RESULT_LABEL[latestAcceptance.result] : undefined)}</div>
<p class="description">${escapeHtml(latestAcceptance?.submissionNote ?? 'Chưa có nội dung nghiệm thu.')}</p>
${list(acceptanceChecks)}

<h2>5. Đề nghị và chứng từ thanh toán</h2>
<div class="fields">${row('Kính gửi', 'Ban quản trị / người có thẩm quyền thanh toán')}${row('Lần đề nghị', latestPaymentRequest ? `Lần ${latestPaymentRequest.revisionNo}` : 'Chưa có')}${row('Người lập', lookup.userName(latestPaymentRequest?.submittedBy))}${row('Số tiền đề nghị', latestPaymentRequest ? formatVnd(latestPaymentRequest.amountVnd) : 'Chưa có')}${row('Nội dung', `Thanh toán chi phí ${record.title}`)}${row('Trạng thái', latestPaymentRequest?.decision ?? 'Chưa gửi')}</div>
${list(payments)}
<p><strong>Bộ hồ sơ đính kèm</strong></p>${list(paymentFiles.map((attachment) => escapeHtml(attachment.fileName)), 'Chưa có chứng từ thanh toán.')}
<div class="footer">Bản demo được tổng hợp từ dữ liệu hồ sơ hiện tại. Chữ ký trong demo là chữ ký vẽ; cần kiểm tra và phê duyệt trước khi phát hành chính thức.</div>
</body></html>`;
};
