# Handoff: MT-S3 Thực hiện và xác nhận lượt bảo trì trên điện thoại

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-27) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-MT3.17, AC-MT3.18).

**Cách làm:**
- **MT-S2 đã đạt review nhưng chưa merge.** Tách nhánh từ `feature/mt-s2-plans` (`6e3b32c`). Gợi ý tên nhánh: `feature/mt-s3-maintenance-execution`. Khi MT-S2 vào `main`, rebase lên `main`.
- **Thứ tự:** làm **sau F-S1** (bạn đang làm F-S1). Nếu muốn đổi thứ tự thì báo PM/BA.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- MT-S2: kế hoạch, lượt (6 trạng thái), người thực hiện và người xác nhận, lần chạy hằng ngày 00:15 (dùng lại cho nhắc hạn, BR-MT3-10).
- MT-S1: thiết bị và thiết bị của hồ sơ sửa chữa; lịch sử tình trạng (BR-MT-04).
- API: `notifications/notify.ts` (ghi thông báo trong cùng giao dịch); cấu hình hạn `REVIEW_MAINTENANCE` của tòa (`domain/building-config.ts`); module tệp và AT-S1.
- Demo (tài liệu sống về hành vi):
  - `services/handlers/maintenance-occurrence-handlers.ts` (MD-01 ở dòng 168);
  - `link-and-assignment-handlers.ts` (`createRepairFromMaintenance`);
  - `domain/maintenance-rules.ts` (MD-07);
  - `features/maintenance/OccurrenceDetailPage.tsx` và `components/occurrence/*`.

**Những gì phải tạo mới:**
- Các lần gửi, quyết định xác nhận, nhắc hạn đã gửi (để không gửi lặp), lượt và mục nguồn của hồ sơ sửa chữa. Gộp vào **một** migration mới.
- Các thao tác của BR-MT3-01. Hướng xử lý xét **theo từng mục** (BR-MT3-09).
- Tạo hồ sơ sửa chữa từ **một mục lỗi** (BR-MT3-08), dùng luật tạo hồ sơ hiện có của API. Không viết một đường tạo hồ sơ thứ hai.
- Web: trang lượt (thiết kế cho điện thoại trước), danh sách "Lượt bảo trì" kiểu Danh sách với "Việc của tôi". Mở menu "Lịch bảo trì" ở chế độ `api`.

**Cần lưu ý:**
- Hạn xác nhận lấy từ cấu hình của **tòa** (MD-01).
- Số đo ngoài ngưỡng tự thành Lỗi và bị khóa ở Lỗi.
- Lỗi mạng không được làm mất dữ liệu đang nhập (AC-MT3.17).
- Khi merge cùng TK-S1: giữ đủ các mục của `API_READY_PATHS` (`navigation.ts`).
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/mt-s3-occurrences` (worktree `../QLTN-mt-s3`).
- Tách từ `feature/mt-s2-plans`. Theo yêu cầu của PM/BA, nhánh đã merge `feature/f-s1-exploitation-invitations` (`a572cbe`, để dùng JobScheduler) và `integration/tk-mt2-f1` (`d6ebda4`, có TK-S1).
- Như vậy nhánh nằm trên bản tích hợp TK-S1 → MT-S2 → F-S1. Phần mới của MT-S3 là các commit từ `c0e8540`.

**Migration:** `api-qltn/src/database/migrations/2026-10-27g-maintenance-execution.sql`.
- Cột mới trên `maintenance_occurrences`: `work`, `round`, `rework`, `started_at`, `submitted_at`, `review_due_at`, `completed_at`, `cancelled_at`.
- Bảng mới `maintenance_submissions`: mỗi lần gửi một dòng không sửa được, kèm quyết định xác nhận.
- Bảng mới `maintenance_reminders`: nhắc hạn đã gửi, khóa chính `(occurrence_id, kind)`.
- Trên `repair_records` thêm `source_occurrence_id` và `source_checklist_item_id`, kèm chỉ mục duy nhất từng phần: một hồ sơ còn hiệu lực cho mỗi mục; hồ sơ `CLOSED_WITHDRAWN` hoặc `CLOSED_NO_REPAIR` không tính.
- Chạy thử hai lần liền trong `BEGIN … ROLLBACK` trên qltn_dev: OK.
- Đã áp thật lên qltn_dev khi API của worktree khởi động để chụp ảnh. Seed thêm BT-0008…0012 ở 5 trạng thái; lượt "Đã lên lịch" do lần sinh tạo.

### Quyết định (SPEC giao cho dev-build hoặc chưa nói rõ)

- **Một đường tạo hồ sơ** (handoff): thân của `RecordsService.create` tách thành `createDraft(manager, actor, dto, origin?)`.
  - `POST /records`, "tạo từ mục lỗi" và seed đều đi qua hàm này.
  - Ảnh của mục được chép sang hồ sơ thành dòng tệp `SITE_PHOTO` mới, dùng chung tệp lưu trữ, không sao chép nội dung.
- **Gửi lặp khi tạo hồ sơ** (AC-MT3.12): lượt được khóa dòng khi tạo hồ sơ, nên yêu cầu thứ hai thấy hồ sơ còn hiệu lực và nhận 409 "Mục này đã có hồ sơ … còn hiệu lực". Chỉ mục duy nhất ở DB là lớp chặn thứ hai.
- **Lúc "Bắt đầu":** khóa luôn danh mục, người và nhà thầu. MT-S2 chỉ đồng bộ sửa kế hoạch vào lượt "Đã lên lịch", nên từ khi bắt đầu, lượt giữ nguyên bản đang có.
- **Số đo ngoài ngưỡng** được lưu thành Lỗi ngay khi lưu. Màn hình khóa nhóm nút ở "Lỗi".
- **Nhắc hạn:**
  - Chạy trên `JobScheduler`: lần chạy 00:15 VN cộng một lần mỗi 10 phút (cho hạn xác nhận, vốn là một thời điểm).
  - "Đến hạn hôm nay" và "Quá hạn" chỉ gửi từ 00:15. "Quá hạn" gửi khi lượt trễ ≥ 1 ngày.
  - Mỗi loại nhận nhắc được giành bằng một dòng `maintenance_reminders` (`ON CONFLICT DO NOTHING`), nên chạy lặp hay chạy song song đều không gửi lại.
- **Mâu thuẫn trong SPEC:**
  - AC-MT3.14 nói `bql-a` tự giao lại người thực hiện cho chính mình thì "nhận thông báo".
  - BR-MT3-10 lại nói "không gửi thông báo cho chính người vừa làm thao tác".
  - Tôi theo BR-MT3-10, nên tự giao cho mình thì không có thông báo; e2e kiểm đúng như vậy. Nếu PM/BA muốn khác thì báo, đây là sửa một dòng.
- **"Việc của tôi"** (AC-MT3.16) gồm: lượt chưa kết thúc mà mình là người thực hiện, cộng lượt "Chờ xác nhận" mà mình là người xác nhận. Lượt đã kết thúc không phải "việc", nên không tính.
- **Thẻ số:**
  - "Quá hạn" gồm cả lượt quá hạn làm lẫn quá hạn xác nhận.
  - "Hôm nay" và "7 ngày tới" chỉ tính lượt còn phải làm.
- **Danh sách:** tối đa 500 dòng, xếp quá hạn trước rồi theo ngày.
- **Đổi tình trạng lúc xác nhận:** ghi vào nhật ký của thiết bị với thao tác `confirmMaintenanceCondition` (lịch sử tình trạng đọc theo `toStatus`). Thiết bị đã ngừng dùng thì không đổi được.
- **Mục đích tệp:** `MAINTENANCE_RESULT` trên `MAINTENANCE_OCCURRENCE`. Chỉ người thực hiện tải được, khi lượt đang làm hoặc làm lại, và trong vị trí của thiết bị.
- **Web:**
  - Viết mới trong `features/maintenance/api/occurrence/`, vì component lượt của demo gắn với kiểu dữ liệu demo (`OK/ISSUE`, `templateItemId`, `repairRecordIds`).
  - Luật thuần có bản sao ở `web/src/domain/maintenance-execution.ts` để kiểm tại mục trước khi gửi; máy chủ vẫn là nơi quyết định.
  - Rời trang khi còn thay đổi chưa lưu thì hỏi bằng `useBlocker` cộng hộp thoại của ứng dụng.
  - Menu "Lịch bảo trì" mở ở chế độ api; trang có tên "Lượt bảo trì" (chỉ kiểu Danh sách).

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| MT3.1 | e2e "starting opens 3 days before the day, for the performer only" (409 với đúng câu của SPEC; KT-A2 và BQL-A nhận 403) |
| MT3.2 | e2e "a measurement outside the threshold is stored as failed and survives a reload"; web `WorkEditor.test` (khóa ở Lỗi, có dòng "Ngoài ngưỡng 2–6 bar"); ảnh MT3-1 |
| MT3.3, MT3.4 | e2e "submission problems are named per item; …the building days" (PDF không tính là ảnh; hạn 3 ngày theo cấu hình tòa; KT-A2 nhận thông báo); web `WorkEditor.test`; ảnh MT3-2 |
| MT3.5, MT3.6 | e2e "rework marks items; a second round keeps the first; an old round is a conflict" (409) |
| MT3.7, MT3.8, MT3.10, MT3.11 | e2e "each failed item needs its record or resolution; condition change kept" (báo ở cả hai mục; hồ sơ Nháp có tên, mô tả, ảnh, nguồn; BQL nhận thông báo; tình trạng "Cần chú ý" vào lịch sử); ảnh MT3-4, MT3-5 |
| MT3.9 | e2e "a record of item A never answers for item B, even after a withdrawn one" |
| MT3.12 | e2e: tạo lần hai → 409; KT-A → 403 |
| MT3.13, MT3.14 | e2e "cancel while in progress, never while pending review; reassign keeps the work" |
| MT3.15 | e2e "due-today and overdue reminders go out once each, however many runs" (chạy 2 lần, rồi chạy song song) |
| MT3.16 | e2e "Việc của tôi and the server counts; another building answers 404"; web `OccurrencesApiPage.test`; ảnh MT3-6, MT3-7 |
| MT3.17 | ảnh MT3-1, MT3-3, MT3-7: không cuộn ngang ở 375px. Mọi ô bấm của trang lượt ≥ 44px (script đo). Lỗi mạng giữ dữ liệu và hiện Notice: có trong mã (`WorkEditor`), chưa giả lập mất mạng trong trình duyệt |
| MT3.18 | test component: `WorkEditor`, `ReviewPanel`, `OccurrencesApiPage`, `occurrence-ui`; chế độ mock: web toàn bộ 580/580 |
| BR-MT3-12 | e2e "the demo seed holds every state once, and a completed occurrence with a repair record"; seed kiểm thật trên qltn_dev (5 trạng thái) |

### Ảnh (`supporting/evidence/`, chế độ api)

Script: `supporting/mt-s3-execution-check.mjs`. Kết quả: PASS; ở 375px không cuộn ngang.

| Ảnh | Nội dung |
|---|---|
| MT3-1-work-375 | KT-A đang làm ở 375px: Áp suất 7 → "Ngoài ngưỡng 2–6 bar → Lỗi", nhóm nút khóa ở Lỗi; thanh nút dính đáy màn |
| MT3-2-submit-errors-375 | bấm Gửi khi còn thiếu: tóm tắt "Còn … mục chưa đủ", viền đỏ và lỗi tại mục |
| MT3-3-review-375 | KT-A2 xác nhận ở 375px: ô "Hướng xử lý", "Cần làm lại", hai nút ở đáy màn |
| MT3-4-occurrence-wide-linked-record | BQL-A ở màn rộng: mục Rò rỉ có "SC-… · Nháp"; mục Áp suất có nút tạo hồ sơ; cột phải gồm thông tin lượt và nhật ký |
| MT3-5-record-from-item | trang hồ sơ: "Từ lượt bảo trì BT-… · mục Rò rỉ" |
| MT3-6-my-occurrences, MT3-7-my-occurrences-375 | "Việc của tôi" của KT-A2: thẻ số và lượt chờ xác nhận |

Dữ liệu thử để lại trên qltn_dev: kế hoạch `[TEST MT LƯỢT] …` trên BOM-A09 (KH-008…011), lượt BT-0013…0016, hồ sơ SC-073…075 (Nháp).

### Test đã chạy

- **api:**
  - `format:check`, `tsc` và eslint: OK.
  - unit 131/131.
  - e2e trên `qltn_build_e2e`: `maintenance-execution` 10/10; `maintenance-plans`, `maintenance-items`, `records`, `attachments`, `exploitation`, `my-tasks` 67/67.
- **web:** `tsc -b` OK; vitest toàn bộ 580/580 (96 tệp).

### Còn tồn / ghi chú cho review

- **Vùng bấm 32px ngoài phạm vi MT-S3:** hai nút "Hỏi thêm trợ lý" và "Mở rộng nhận xét" của khung trợ lý AI chung của ứng dụng.
- **Kiểm mất mạng:** chưa giả lập mất mạng lúc bấm Lưu trong trình duyệt. Mã đã giữ dữ liệu đang nhập và hiện Notice khi mã lỗi là `NETWORK_ERROR`.
- **Khi merge:** nhánh chứa TK-S1, MT-S2 và F-S1. Merge theo thứ tự PM/BA đã nêu thì chỉ còn các commit MT-S3.
