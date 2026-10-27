# Handoff: B06-S1 Xử lý khẩn cấp

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-19) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-E0.3).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/b06-s1-emergency`.
- Ưu tiên **sau FX-S1, FX-S2 và FX-S3**.
- B06-S1 sửa cùng các file với FX-S2 và FX-S3: `proposals.service.ts`, `records.service.ts`, `record-actions.ts`, `record-status-groups.ts` và migrations. Vì vậy nên rebase lên các nhánh FX sau khi chúng đạt review, để tránh xung đột.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §7.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- Trạng thái `EMERGENCY_IN_PROGRESS`: có nhãn, có nhóm `CONSTRUCTION`.
- Quyền `EMERGENCY_START` của BQL.
- Cấu hình tòa `emergencyLimitVnd` và `emergencyDocHours`.
- Module `notifications` (từ S3).
- Web demo: `features/records/components/emergency/*`, nút `startEmergencyRepair` trong `RecordDetailHeader`, cùng các handler mock `services/handlers/emergency-handlers.ts`. Hai file này là tài liệu sống về hành vi đang mong muốn.

**Những gì phải tạo mới:**
- Cột dữ liệu khẩn cấp (SPEC §3), qua một migration mới.
- Lệnh E-T1 và E-T2.
- Nới T04, T05 và T11 để chạy được ở `EMERGENCY_IN_PROGRESS`.
- Rẽ nhánh ở bước cuối của T07 (BR-E-06) và ở T09 (BR-E-07).
- Hai trạng thái mới; nhãn và nhóm của chúng phải khớp giữa API và web.
- Lệnh tương ứng trong `command-adapter` ở chế độ `api`.

**Cần lưu ý:**
- `finalPostReview=true` chỉ hợp lệ khi người gửi giữ bước BOARD. Thứ tự kiểm: 409 trước, rồi đến 403.
- `hoursLeft` và `docsOverdue` do API tính theo giờ máy chủ. Web không tự tính.
- Hồ sơ khẩn cấp không bao giờ vào `UNRESOLVED`. Có AC-E3.4 để giữ điều này.
- Quy tắc chặn thanh toán (BR-E-09) đã đúng nhờ máy trạng thái; việc cần làm chỉ là thêm test.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh** `feature/b06-s1-emergency` (worktree `../QLTN-b06-s1`), rebase lên `main` `2ddeba4` (đã có FX-S1..S3).

Commit:
- `b93c742`: API, migration, e2e, nhãn và nhóm trạng thái;
- `d0d41db`: web chế độ `api`;
- `b7e4a8c`: sửa chữ ở lần trình 3, thanh tiến độ, và bằng chứng.

Migration `2026-10-27b-emergency.sql` thêm cột `repair_records.emergency` (jsonb).
- Đã chạy thử trên `qltn_dev` (17 hồ sơ, có dữ liệu S4) trong transaction rồi rollback.
- Sau đó migration đã được áp thật vào `qltn_dev` khi chạy API để chụp ảnh.

| AC | Bằng chứng |
|---|---|
| AC-E1.1 + E1.5 | e2e `record-emergency` › AC-E1.1: hồ sơ sang `EMERGENCY_IN_PROGRESS`; thi công bắt đầu hôm nay, tiến độ 0; tờ trình nháp điền sẵn nhà thầu và lý do; `docsDueAt` = lúc bắt đầu + 24 giờ; `hoursLeft` 24; `emergencyPolicy` = 15 tr/24 giờ. TVKT và BQT mỗi người 1 thông báo `EMERGENCY_STARTED`, đúng nội dung BR-E-04; `bql-a` không có. |
| AC-E1.2 | 15.000.000 thì được. 15.000.001 trả 400 `estimatedAmountVnd` với đúng thông báo, trạng thái và số audit không đổi. |
| AC-E1.3 | Bắt đầu được từ DRAFT (phải có ảnh hiện trường như T01; thiếu ảnh trả 400 `attachmentIds`) và từ `PENDING_CONFIRMATION`. Audit ghi `fromStatus` cùng lý do "Từ «Nháp»; chi phí dự kiến …; hạn mức …; hạn bổ sung …". Từ `IN_CONSTRUCTION` trả 409. |
| AC-E1.4 | BQL khác (tạo tài khoản `BQL-A9` cho tòa A) trả 403 `not_record_manager`. `kt-a` trả 403 `missing_capability`. `version` cũ trả 409. |
| AC-E1.6 | ADMIN đổi hạn mức thành 10 tr và số giờ thành 48: chi tiết hồ sơ vẫn là 15 tr và `docsDueAt` cũ. |
| AC-E2.1 / E2.3 / E2.5 | Cập nhật tiến độ 40 % được ở `EMERGENCY_IN_PROGRESS`. Nộp đúng hạn: có `docsSubmittedAt`, không có `lateReason`. TVKT rồi BQT duyệt (kèm biên bản và chữ ký): hồ sơ sang `IN_CONSTRUCTION`, kết quả `APPROVED`, số được duyệt 10 tr. Sau đó tạm ứng 4 tr, nghiệm thu, quyết toán 10 tr (đợt 6 tr), đóng hồ sơ: `COMPLETED`. |
| AC-E2.2 | Đặt `docsDueAt` về 90 phút trước: `docsOverdue` true, `hoursLeft` −2. Thiếu lý do trễ trả 400 `lateReason`; có thì lưu. |
| AC-E2.4 | Báo giá 16 tr: `overEmergencyLimit` true lúc trình, duyệt được, số được duyệt 16 tr, cờ vẫn true. |
| AC-E3.1 | BQT từ chối ở lần 1, không có cờ: `REJECTED_RESUBMITTABLE`. Trình lại, duyệt đủ: `IN_CONSTRUCTION`. |
| AC-E3.2 / E3.3 / E3.5 | TVKT gửi `finalPostReview` trả 403 `final_post_review_denied`. BQT gửi cờ: `POST_REVIEW_REJECTED`, kết quả `REJECTED`, BQL nhận 1 thông báo `POST_REVIEW_REJECTED`. BQL gọi E-T2 trả 403. Lý do 4 ký tự trả 400. BQT đóng kèm tệp `BOARD_DECISION`: `CLOSED_POST_REVIEW_REJECTED`, `closeDecision` được lưu, có audit. |
| AC-E3.4 | Từ chối ở lần trình thứ 3 (không có cờ): `POST_REVIEW_REJECTED`, không sang `UNRESOLVED`. |
| AC-E4.1 | Ở `EMERGENCY_IN_PROGRESS`, ở trạng thái chờ TVKT và ở `POST_REVIEW_REJECTED`: A1, gửi quyết toán và gửi nghiệm thu đều trả 409 `invalid_status_transition`, không có audit. |
| AC-E0.1 | Hồi quy `record-proposals` (gồm AC-2.6 hồ sơ thường lần 3 sang `UNRESOLVED`), `record-construction`, `record-payments`, `record-transitions`, `record-confirmations`, `records`, `records-list`, `audit-log`, `attachments`: 9 suite, 73/73. Sau khi rebase lên `main` có FX: `record-emergency`, `record-payments`, `stage-holders`, `record-proposals`, `record-construction`: 43/43. |
| AC-E0.2 | Lọc `statusGroup=NEEDS_ACTION` có `POST_REVIEW_REJECTED`; lọc `CLOSED` có hồ sơ đã đóng. Nhãn hai hành động mới có ở `audit-labels`, hai phía giống nhau (test so khớp). Test mới `web/src/domain/record-status.parity.test.ts` so nhãn, nhóm và trạng thái đóng với API. |
| AC-E0.3 | Test component `EmergencyDialog.test.tsx` (4), `EmergencyDeadlineBadge.test.tsx` (4), `QuoteDecisionDialog.post-review.test.tsx` (4). Ảnh trong `supporting/evidence/B06-1..6-*.png` (script `supporting/b06-s1-ui-check.mjs`, hồ sơ SC-018 và SC-019). |

**Quyết định của dev-build:**
- **Lưu dữ liệu khẩn cấp.** Toàn bộ dữ liệu §3 nằm trong một cột jsonb `emergency`, tiền là chuỗi số nguyên VND. Hai trạng thái mới không cần đổi schema.
- **`overEmergencyLimit`.** Dùng số được duyệt; khi chưa duyệt thì dùng tổng đề xuất của lần trình mới nhất (lưu ở mỗi lần T05/T06), để người duyệt thấy cảnh báo trước khi duyệt.
- **`hoursLeft`.** Làm tròn lên khi còn hạn; khi đã quá hạn thì là số âm. Bằng `null` khi đã nộp tờ trình.
- **`finalPostReview`.** Chỉ hợp lệ khi bước hiện tại là `BOARD` và hồ sơ là hồ sơ khẩn cấp; ngoài ra trả 403 `final_post_review_denied`. Thứ tự kiểm: trạng thái và người giữ bước (409/403 có sẵn), rồi đến cờ.
- **E-T2.** Dùng slot mới `boardStep`: người giữ bước BOARD trong snapshot, kiểm sau trạng thái. Tệp mục đích `BOARD_DECISION` do người giữ BOARD tải lên khi hồ sơ ở `POST_REVIEW_REJECTED`.
- **Cấu hình tòa cho dialog.** BQL không đọc được `/buildings/:id/config` (DF-11), nên `GET /records/:id` trả thêm `emergencyPolicy` (hạn mức và số giờ hiện tại của tòa) cho dialog E-T1.
- **Tiền ở web.** `EmergencyInfo` của web giữ tiền dạng `number` như bản demo (mock dùng kiểu này). Số 15 chữ số vẫn chính xác khi lưu dạng double; khi gửi lên API thì đổi thành chuỗi số nguyên.
- **Ngoài brief.**
  - Câu cảnh báo ở lần trình 3 của hồ sơ khẩn cấp đổi thành "Không được duyệt hậu kiểm".
  - Thanh tiến độ dừng ở "Phê duyệt" cho hai trạng thái mới (trước đó tick nhầm Thi công và Nghiệm thu).
  - Nhãn tệp mới `BOARD_DECISION`.

**Test đã chạy:**
- API: unit `src/domain` 36/36; e2e như bảng; `format:check`, eslint, `tsc --noEmit`.
- Web: `tsc -b`; vitest toàn bộ 61 file, 412/412 (trước commit cuối); `src/features/records` + `src/domain` 62/62 (sau commit cuối).

**Còn để lại:**
- Chế độ `mock` giữ nguyên, nên §2.5 và §2.6 chỉ có ở `api`.
- Responsive và chế độ tối chưa có ảnh riêng; mọi màu dùng token có sẵn.
- Dữ liệu thử trong `qltn_dev`: SC-018 và SC-019 (`[TEST B06 UI]`, đều đã `CLOSED_POST_REVIEW_REJECTED`). Tòa A đã về STANDARD.
