# Module `tasks`: Công việc cá nhân (B02)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-28)**

**Nguồn đã đọc:**
- D1 tr. 16 "Mỗi người biết rõ việc và hạn xử lý" (đã xem hình).
- D2 nhóm 02: "Danh sách việc được giao, ưu tiên, hạn xử lý, trạng thái; chuyển đến đúng bước nghiệp vụ; phân công lại khi thay đổi nhân sự."
- Review 23/10 dòng 74: "Người giữ bước, hạn xử lý, giao lại và trường hợp người nhận ngừng hoạt động."
- Code (commit `0aff8ea`):
  - web `features/tasks/*` (khoảng 315 dòng), `services/tasks-service.ts`, `domain/task-rules.ts`, `services/command-context.ts` (`syncTasks`, `dueAtFor`);
  - API `modules/records/*` (`record-actions.ts`, `record-steps.ts`, `stage-holders.ts`, `records.service.ts` `summary`), `modules/audit/entities/audit-event.entity.ts`.
- Đã có: B04 B4G-05 (API không tính hạn xử lý theo bước), review 27/10 R-06 (giao lại người giữ bước → US-S2), MT-S3 (danh sách "Việc của tôi" cho lượt bảo trì).

**Ranh giới:** thông báo và nhắc hạn thuộc module `notifications`. Chủ dự án đã chốt làm module đó sau, một lần. Tài liệu này chỉ nêu chỗ hai module chạm nhau.

## 1. Khách yêu cầu gì

| Nguồn | Nội dung |
|---|---|
| D2 nhóm 02 | Danh sách việc được giao; **ưu tiên**; **hạn xử lý**; trạng thái; **chuyển đến đúng bước** nghiệp vụ; **phân công lại** khi thay đổi nhân sự |
| D1 tr. 16, web | Tiêu đề "KT01 · Việc ngày 23/11". 4 ô số: Việc được giao 3, Đang mở 2, Đến hạn 2, Hoàn tất 1. Hai kiểu xem: **"Bảng công việc"** (3 cột theo trạng thái: Đang kiểm tra, Đang sửa, Hoàn tất) và **"Danh sách"**. Mỗi thẻ ghi mã (BT-002, SC-003), tên, hạn "23/11 · 17:00", kết quả kiểm "2 đạt / 1 lỗi", người làm, trạng thái. Nút chính "Tiếp tục kiểm tra" |
| D1 tr. 16, mobile | Thẻ lớn **"Tiếp tục công việc"**: việc đang làm dở, gồm hạn, kết quả kiểm, gợi ý "Mở danh mục kiểm tra của B02". Bên dưới là danh sách "Việc khác của bạn" |
| Review 23/10 | Người giữ bước; hạn xử lý; giao lại; người nhận ngừng hoạt động |

## 2. Hiện trạng

### 2.1 Demo (IndexedDB)

- Mỗi khi hồ sơ hay lượt bảo trì đổi trạng thái, demo **tính lại** việc cần có (`desiredRepairTasks`, `desiredOccurrenceTasks`) và đồng bộ vào bảng `tasks`: mỗi (loại việc, người nhận) có đúng một việc đang mở, và việc cũ được đóng kèm lý do (Đã hoàn thành, Đã giao lại người khác, Đã hủy, Hồ sơ/lượt đã đóng).
- Có **18 loại việc**:
  - sửa chữa: xác nhận, cập nhật hồ sơ, soạn tờ trình, duyệt tờ trình, phát hành thông báo chưa xử lý, nộp hồ sơ khẩn cấp, bắt đầu thi công, cập nhật thi công, nghiệm thu, khắc phục, đề nghị thanh toán, duyệt thanh toán, ghi nhận chuyển khoản;
  - bảo trì: thực hiện, kiểm tra, làm lại, xem lại lịch đã đổi;
  - chung: cần phân công lại.
- **Người nhận** là người giữ vai trò tương ứng trên hồ sơ (BQL, KT, TVKT, BQT, hoặc người giữ bước tùy chỉnh), và phải còn hợp lệ: đang hoạt động, đúng vai trò, đúng phạm vi tòa và vị trí, có quyền.
  - Nếu không hợp lệ, việc chuyển thành **"Cần phân công lại"** và giao cho BQL của hồ sơ.
  - Lúc nghiệm thu, mỗi người còn phải quyết định có một việc riêng.
- **Hạn** = thời điểm vào bước + số ngày hạn của loại việc, lấy từ cấu hình đã chụp vào hồ sơ. Không có cấu hình thì dùng giá trị mặc định.
- **Màn "Công việc của tôi":**
  - 4 ô số: Cần xử lý hôm nay, Quá hạn, Sắp tới, Tổng cộng;
  - tab Đang mở / Đã hoàn thành;
  - tìm kiếm; lọc theo loại (Sửa chữa/Bảo trì) và theo hạn (Quá hạn/Sắp tới);
  - bảng trên màn rộng, thẻ trên điện thoại;
  - bấm một việc thì mở đúng tab của hồ sơ (`TASK_KIND_TAB`).

### 2.2 API

- **Không có module việc.** Ở chế độ `api`, trang `/tasks` hiện "chưa nối API" (`router.tsx` dòng 57).
- **Đã có đủ nguyên liệu để tính "việc của tôi" ngay lúc đọc:**
  - trạng thái hồ sơ;
  - người giữ từng bước (`stepHolderOf`, `currentStepKeyOf`, `acceptanceStepsHeldBy`);
  - người quản lý hồ sơ và người xác nhận;
  - quyền theo vai trò;
  - luật "ai được làm gì ở trạng thái nào" (`record-actions.ts`, 33 thao tác, có `slot` và `capability`);
  - số ngày hạn của từng loại việc, chụp vào hồ sơ khi gửi (`taskDueDays`).
- **Chưa có** thời điểm hồ sơ vào bước hiện tại dưới dạng một cột riêng. Mốc này lấy được từ nhật ký: dòng gần nhất có `to_status` bằng trạng thái hiện tại.
- `GET /records` lọc được theo `assigneeId` (người quản lý, người xác nhận, TVKT, BQT). Đây **không phải** "đang đến lượt tôi": nó không xét bước hiện tại và không xét người giữ bước tùy chỉnh.

## 3. Khoảng trống

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **TG-01** | Không có "Công việc của tôi" ở chế độ `api`. Mỗi người phải tự mở danh sách hồ sơ và đoán xem hồ sơ nào đang chờ mình | `router.tsx` dòng 57; API không có module việc | **Cao**: D1 tr. 16, D2 nhóm 02; mọi vai trò đều dùng màn này | TK-S1 |
| **TG-02** | API không tính **hạn xử lý** của bước hiện tại, nên không có "quá hạn" cho hồ sơ sửa chữa. B04 cũng đang thiếu chỗ này (B4G-05) | `records-list` từ chối `overdue`; không có cột thời điểm vào bước | **Cao** | Tính hạn ở API: thời điểm vào bước (từ nhật ký) + số ngày hạn trong hồ sơ |
| TG-03 | Việc bảo trì trong demo giao cho **BQL** (`slot: 'manager'`). MT-S2 và MT-S3 đã đổi sang người thực hiện là tài khoản (MQ-01) | `task-rules.ts` `OCCURRENCE_TASK` | Trung bình | Việc bảo trì vào B02 **sau MT-S3**, theo người thực hiện và người xác nhận mới (TK-S2) |
| TG-04 | "Cần phân công lại": demo chỉ báo, còn thao tác giao lại người giữ bước ở API là US-S2 (R-06), đang mở | review 27/10 R-06; Q4 chưa trả lời | Trung bình | TK-S1 hiện việc "Cần phân công lại" cho BQL, kèm liên kết tới hồ sơ. Thao tác giao lại làm ở US-S2 |
| TG-05 | D1 có kiểu **"Bảng công việc"** (cột theo trạng thái) và thẻ **"Tiếp tục công việc"** trên điện thoại. Demo chỉ có danh sách | D1 tr. 16 | Thấp đến Trung bình | Hỏi TKQ-01. Mặc định: danh sách, cộng thẻ "Tiếp tục công việc"; không làm bảng cột |
| TG-06 | D2 ghi "**ưu tiên**". Việc trong demo không hiện mức ưu tiên của hồ sơ, và không xếp theo ưu tiên | `TaskTable.tsx`; D2 nhóm 02 | Trung bình | Hiện mức ưu tiên của hồ sơ. Xếp: quá hạn → khẩn cấp hoặc ưu tiên cao → hạn gần nhất |
| TG-07 | Demo lưu việc vào một bảng và đồng bộ mỗi khi có thao tác. Một chỗ quên gọi đồng bộ là việc bị sai, và demo đã từng có lỗi loại này (review-fixes "due time kept on deactivation") | `command-context.ts` `syncTasks` | Trung bình (rủi ro thiết kế) | **Đề xuất:** ở API, tính việc **ngay lúc đọc** từ trạng thái và người giữ bước, không lưu bảng việc. "Đã hoàn thành" lấy từ nhật ký thao tác của chính người đó |
| TG-08 | D1 có hạn theo **giờ** ("23/11 · 17:00") | D1 tr. 16 | Thấp | Hạn tính theo **thời điểm** (giờ vào bước + N ngày), như demo; hiện "dd/mm · HH:mm" |

**Lỗi trong demo (không mang sang API):**

| ID | Lỗi | Căn cứ | Mức |
|---|---|---|---|
| TD-01 | Đầu trang ghi cứng "Tháng 10, 2026" | `features/tasks/index.tsx` (`PageHeader actions`) | Thấp |
| TD-02 | Ô "Cần xử lý hôm nay" thực ra là "đang mở trừ quá hạn", không phải việc đến hạn hôm nay | `index.tsx` (`openCount - overdueCount`) | Trung bình (sai nghĩa với người dùng) |
| TD-03 | Tìm kiếm chỉ so chữ thường, không bỏ dấu. Gõ "bom" không ra "Bơm" | `matchesSearch` | Thấp |

## 4. Câu hỏi cho khách

Đã ghi thành **OD-24** trong `DECISIONS.md`.

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| TKQ-01 | Có cần kiểu "Bảng công việc" chia cột theo trạng thái như D1 tr. 16 không? | Không ở giai đoạn này. Có danh sách và thẻ "Tiếp tục công việc" |
| TKQ-02 | Hạn xử lý tính theo ngày lịch hay ngày làm việc (bỏ thứ Bảy, Chủ nhật, ngày lễ)? | Ngày lịch, như cấu hình hạn hiện có của tòa |
| TKQ-03 | Trưởng BQL hoặc quản trị có cần xem việc của từng nhân viên không? | Không ở B02. Số việc quá hạn theo tòa nằm ở Tổng quan (B01) |

## 5. Đề xuất slice

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **TK-S1 Việc sửa chữa của tôi** ([SPEC](../features/TK-cong-viec-ca-nhan/SPEC.md), đã duyệt PD-29, đang build) | Phần chính:<br>• API đọc "việc của tôi" cho hồ sơ sửa chữa, tính ngay lúc đọc (TG-07): đúng người giữ bước hiện tại, mỗi người nghiệm thu một việc, "Cần phân công lại" cho BQL;<br>• hạn xử lý và quá hạn (TG-02);<br>• "Đã hoàn thành" lấy từ nhật ký;<br>• web `api`: 4 ô số đúng nghĩa (sửa TD-02), mức ưu tiên (TG-06), tìm kiếm bỏ dấu (TD-03), thẻ "Tiếp tục công việc" trên điện thoại.<br>Hạn xử lý tính ở API được trả kèm trong danh sách hồ sơ, để B04 và B01 dùng lại | Không |
| TK-S2 Việc bảo trì | Gộp lượt bảo trì vào B02, theo người thực hiện và người xác nhận của MT-S2/S3 | MT-S3 |
| — | Giao lại người giữ bước (TG-04) | US-S2 (R-06) |
| — | Nhắc hạn bằng thông báo | module `notifications` |

**AC nháp cho TK-S1:**
- **AC-1** Hồ sơ ở "Chờ xác nhận", người xác nhận là KT01: KT01 thấy một việc "Xác nhận hồ sơ", bấm vào thì mở đúng hồ sơ. BQL của hồ sơ không thấy việc này.
- **AC-2** Tờ trình đang chờ bước tùy chỉnh do X giữ: chỉ X có việc "Duyệt tờ trình".
- **AC-3** Hồ sơ "Chờ nghiệm thu" có 3 người nghiệm thu, 1 người đã quyết định: 2 người còn lại mỗi người có một việc; người đã quyết định không còn việc.
- **AC-4** Hồ sơ vào "Chờ xác nhận" lúc 09:00 ngày 10/11, cấu hình đã chụp ghi hạn xác nhận là 2 ngày: việc có hạn "12/11 · 09:00". Lúc 09:01 ngày 12/11 thì việc có cờ "Quá hạn".
- **AC-5** Người giữ bước bị khóa tài khoản: việc của bước đó biến mất khỏi người đó, và BQL của hồ sơ có việc "Cần phân công lại", ghi rõ bước nào.
- **AC-6** Sau khi KT01 xác nhận hồ sơ, việc rời tab "Đang mở" và có trong tab "Đã hoàn thành" của KT01, kèm thời điểm.
- **AC-7** Người ngoài phạm vi tòa không bao giờ thấy việc của tòa đó.
- **AC-8** Ô "Đến hạn hôm nay" chỉ đếm việc có hạn trong ngày hôm nay (giờ VN), không tính việc quá hạn.
