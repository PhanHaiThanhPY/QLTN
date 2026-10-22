import { OCCURRENCE_STATUS_LABEL } from '@/domain/constants';
import type { MaintenanceReview, MaintenanceSubmission } from '@/domain/types';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { formatDate, formatDateTime } from '@/utils/date';

export interface MaintenanceDocumentLookups {
  buildingName: (id?: string) => string;
  locationName: (id?: string) => string;
  userName: (id?: string) => string;
}

const escapeHtml = (value: unknown): string => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const row = (label: string, value: unknown): string => `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;

const table = (headers: string[], rows: string[][]): string =>
  rows.length > 0
    ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty">Chưa có dữ liệu.</p>';

const attachmentNames = (detail: OccurrenceDetail, ids: string[]): string[] => {
  const byId = new Map(detail.attachments.map((attachment) => [attachment.id, attachment.fileName]));
  return ids.map((id) => byId.get(id) ?? id);
};

const checklistRows = (submission: MaintenanceSubmission): string[][] =>
  submission.checklistSnapshot.map((entry, index) => [
    String(index + 1),
    entry.label,
    entry.inputType === 'MEASUREMENT' ? 'Số đo' : 'Đạt / không đạt',
    entry.measurementValue === undefined ? '—' : `${entry.measurementValue} ${entry.unit ?? ''}`.trim(),
    entry.result === 'OK' ? 'Đạt' : entry.result === 'ISSUE' ? 'Có vấn đề' : entry.result === 'NOT_APPLICABLE' ? 'Không áp dụng' : 'Chưa kiểm tra',
    entry.note ?? '—',
  ]);

const reviewRows = (submission: MaintenanceSubmission, review: MaintenanceReview): string[][] =>
  (review.itemReviews ?? []).map((item) => {
    const entry = submission.checklistSnapshot.find((rowValue) => rowValue.templateItemId === item.templateItemId);
    return [entry?.label ?? item.templateItemId, item.outcome === 'APPROVED' ? 'Đạt' : 'Cần làm lại', item.reason ?? '—'];
  });

/** Creates the A4 checklist report used for preview, printing and saving as PDF. */
export const buildMaintenanceChecklistHtml = (detail: OccurrenceDetail, lookup: MaintenanceDocumentLookups): string => {
  const { occurrence, plan, item } = detail;
  const latest = detail.submissions.at(-1);
  const submissionRows = detail.submissions.map((submission) => [
    `Lần ${submission.roundNo}`,
    formatDateTime(submission.submittedAt),
    lookup.userName(submission.submittedBy),
    submission.performerName,
    submission.resultNote,
  ]);
  const reviewRowsByRound = detail.reviews.flatMap((review) => {
    const submission = detail.submissions.find((rowValue) => rowValue.id === review.submissionId);
    return submission ? reviewRows(submission, review).map((rowValue) => [`Lần ${review.roundNo}`, review.outcome === 'CONFIRMED' ? 'Đã xác nhận' : 'Yêu cầu làm lại', ...rowValue]) : [];
  });
  const latestAttachments = latest ? attachmentNames(detail, [...latest.attachmentIds, ...latest.checklistSnapshot.flatMap((entry) => entry.attachmentIds)]) : [];
  const statusLabel = OCCURRENCE_STATUS_LABEL[occurrence.status] ?? occurrence.status;

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>Biên bản checklist ${escapeHtml(occurrence.code)}</title>
<style>
:root{--ink:#172b4d;--muted:#64748b;--line:#dbe4ee;--brand:#0f766e;--soft:#f5f8fb}*{box-sizing:border-box}@page{size:A4;margin:14mm 16mm 16mm}body{margin:0;background:#eef3f8;color:var(--ink);font:12px/1.5 Arial,Helvetica,sans-serif}.page{background:#fff;margin:20px auto;max-width:210mm;min-height:297mm;padding:16mm 17mm 14mm;box-shadow:0 12px 34px #172b4d1f}.no-print{color:var(--muted);font-size:11px;margin:0 auto 12px;max-width:210mm}.brand{align-items:flex-start;border-bottom:2px solid var(--brand);display:flex;gap:14px;justify-content:space-between;padding-bottom:14px}.mark{align-items:center;background:var(--brand);border-radius:10px;color:#fff;display:flex;font-size:17px;font-weight:800;height:44px;justify-content:center;width:44px}.eyebrow{color:var(--brand);font-size:10px;font-weight:700;letter-spacing:.1em;margin:0 0 4px;text-transform:uppercase}h1{font-size:21px;letter-spacing:-.02em;margin:0 0 4px}.subtitle,.muted{color:var(--muted)}.doc-id{text-align:right}.code{font-size:17px;font-weight:800}.badge{background:#e6f5f3;border:1px solid #b8e1dc;border-radius:999px;color:#0f5f59;display:inline-block;font-size:10px;font-weight:700;margin-top:6px;padding:3px 9px}.hero{background:linear-gradient(135deg,#f1fbfa,#f8fafc);border:1px solid #cfe8e4;border-radius:10px;margin:16px 0 20px;padding:14px 16px}.hero-title{font-size:16px;font-weight:700;margin:0 0 8px}.fields{display:grid;gap:0 22px;grid-template-columns:1fr 1fr}.field{border-bottom:1px solid #edf2f7;padding:8px 0}.field dt{color:var(--muted);font-size:10px;margin-bottom:2px}.field dd{font-weight:700;margin:0}.section{break-inside:avoid;border-top:1px solid var(--line);margin-top:24px;padding-top:14px}.heading{align-items:baseline;display:flex;gap:10px;margin-bottom:10px}.number{color:var(--brand);font-size:11px;font-weight:800}h2{font-size:15px;margin:0}.note{color:var(--muted);font-size:11px;margin:-4px 0 12px}.description{background:var(--soft);border:1px solid var(--line);border-radius:7px;margin:10px 0;padding:11px 12px;white-space:pre-wrap}table{border-collapse:collapse;font-size:10.5px;margin:8px 0 12px;page-break-inside:avoid;width:100%}th{background:#eef7f6;color:#245b57;font-size:9px;text-align:left;text-transform:uppercase}th,td{border:1px solid var(--line);padding:7px 8px;vertical-align:top}tbody tr:nth-child(even){background:#fbfdff}.attachments{margin:8px 0;padding-left:18px}.signatures{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);margin-top:10px}.signature{border:1px solid var(--line);border-radius:7px;min-height:92px;padding:12px;text-align:center}.signature p{border-top:1px solid #94a3b8;color:var(--muted);font-size:10px;margin:34px 0 0;padding-top:5px}.footer{border-top:1px solid var(--line);color:var(--muted);font-size:10px;margin-top:28px;padding-top:10px}@media screen and (max-width:760px){.page{margin:0;min-height:100vh;padding:20px}.fields,.signatures{grid-template-columns:1fr}.brand{gap:8px}table{display:block;overflow-x:auto}}@media print{body{background:#fff}.no-print{display:none}.page{box-shadow:none;margin:0;max-width:none;padding:0}}
</style></head><body><div class="no-print">Bản xem trước khổ A4 · dùng hộp thoại In để lưu thành PDF hoặc phát hành bản giấy.</div><main class="page">
<header class="brand"><div style="display:flex;gap:12px"><div class="mark">QL</div><div><p class="eyebrow">AN SANA · QUẢN LÝ TÒA NHÀ</p><h1>Biên bản checklist bảo trì</h1><p class="subtitle">Tổng hợp kết quả thực hiện, bằng chứng và lịch sử kiểm tra.</p></div></div><div class="doc-id"><div class="code">${escapeHtml(occurrence.code)}</div><span class="badge">${escapeHtml(statusLabel)}</span></div></header>
<div class="hero"><p class="hero-title">${escapeHtml(item ? `${item.code} – ${item.name}` : occurrence.code)}</p><div class="fields">${row('Tòa nhà', lookup.buildingName(occurrence.buildingId))}${row('Vị trí', item ? lookup.locationName(item.locationId) : '—')}${row('Kế hoạch', plan ? `${plan.code} · ${plan.title}` : '—')}${row('Ngày dự kiến', formatDate(occurrence.scheduledDate))}${row('Người quản lý', lookup.userName(occurrence.managerUserId))}${row('Người xác nhận', lookup.userName(occurrence.confirmationUserId))}</div></div>
<section class="section"><div class="heading"><span class="number">01</span><h2>Thông tin thực hiện</h2></div><p class="note">Thông tin nhận diện và kết quả chung của lượt bảo trì.</p><div class="fields">${row('Đơn vị thực hiện', latest?.performerName ?? occurrence.performerName)}${row('Nhà thầu', latest?.contractorName ?? occurrence.contractorName)}${row('Bắt đầu', formatDateTime(occurrence.startedAt))}${row('Hoàn tất', formatDateTime(occurrence.completedAt))}</div><p class="description">${escapeHtml(latest?.resultNote ?? occurrence.resultNote ?? 'Chưa có kết luận.')}</p></section>
<section class="section"><div class="heading"><span class="number">02</span><h2>Checklist và số đo</h2></div><p class="note">Bản chụp của lần gửi kết quả gần nhất; các mục đo hiển thị đơn vị và khoảng chuẩn.</p>${latest ? table(['STT','Hạng mục','Kiểu nhập','Số đo','Kết quả','Ghi chú'], checklistRows(latest)) : '<p class="empty">Chưa có lần gửi kết quả.</p>'}</section>
<section class="section"><div class="heading"><span class="number">03</span><h2>Lịch sử gửi kết quả</h2></div>${table(['Lần gửi','Thời gian','Người gửi','Đơn vị thực hiện','Kết luận'], submissionRows)}</section>
<section class="section"><div class="heading"><span class="number">04</span><h2>Review theo từng mục</h2></div>${table(['Lần','Kết luận','Hạng mục','Kết quả review','Lý do'], reviewRowsByRound)}</section>
<section class="section"><div class="heading"><span class="number">05</span><h2>Bằng chứng và xác nhận</h2></div><p class="note">Tên tệp được lưu cùng hồ sơ; ảnh/tệp gốc vẫn được truy xuất từ hệ thống.</p>${latestAttachments.length > 0 ? `<ul class="attachments">${latestAttachments.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>` : '<p class="empty">Chưa có tệp bằng chứng.</p>'}<div class="signatures"><div class="signature"><p>Người thực hiện</p></div><div class="signature"><p>Người quản lý bảo trì</p></div><div class="signature"><p>Người xác nhận kiểm tra</p></div></div></section>
<div class="footer">Tạo lúc ${escapeHtml(formatDateTime(occurrence.updatedAt))} · Biên bản được tổng hợp từ dữ liệu hiện tại; cần kiểm tra trước khi phát hành chính thức.</div></main></body></html>`;
};
