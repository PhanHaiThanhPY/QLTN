# Review lại toàn bộ tính năng đã làm (trên `main` = `fb4fd7a`)

**Người làm:** PM/BA · **Ngày:** 27/10/2026 · **Trạng thái:** Chủ dự án đồng ý Q1–Q3 (PD-16) → [SPEC FX](../../product/features/FX-sua-loi-review-27-10/SPEC.md), chờ duyệt. Q4 chưa quyết

**Cách làm:**
- Đối chiếu từng AC và BR của 5 SPEC với code và test trên `main`. Không dựa vào kết luận PASS của các lần review trước.
- Chỉ đọc code: không chạy test, không chạy trình duyệt. Các AC kiểm bằng trình duyệt chỉ đối chiếu được với ảnh trong `supporting/evidence/`.
- PM/BA tự đọc lại code của 3 phát hiện nặng nhất (R-01, R-02, R-03).

## 1. Kết luận theo slice

| Slice | Kết luận | Ghi chú chính |
|---|---|---|
| B03 S1 (xác nhận hiện trạng) | Đạt | Thứ tự kiểm tra: kiểm version trước quyền (R-12) |
| B03 S2 (tờ trình, báo giá, chuỗi duyệt) | Đạt, một điểm lệch §3 | R-03 |
| B03 S3 (thi công, nghiệm thu) | Đạt | Thiếu vài test AC-0.1 |
| B03 S4 (thanh toán nhiều đợt) | Đạt mọi AC, nhưng có lỗ kẹt nghiệp vụ | R-01; VT-01 và VT-02 vẫn mở |
| AU-S1 (đổi mật khẩu) | Đạt | R-10 (giới hạn 72 ký tự so với 72 byte) |
| US-S1 (đặt lại mật khẩu, lịch sử) | Đạt theo câu chữ, có lỗ leo thang quyền | R-02 |
| RM-S1, RM-S2 (ma trận quyền v2) | Đạt, web lệch PD-13 một phần | R-04 |
| AD-S1 (nhật ký thao tác) | Đạt | R-05 (chèn công thức vào CSV) |

Kiểm chung cho mọi slice:
- Tiền lưu `bigint`, gửi nhận dạng chuỗi, tính bằng BigInt; không dùng float.
- Mọi lệnh ghi đều kiểm `version`, khóa dòng và ghi audit trong cùng transaction.
- Không thấy lộ dữ liệu giữa các tòa.
- Web không gọi endpoint nào không tồn tại, và có xử lý lỗi.

## 2. Phát hiện

| ID | Mức | Slice | Nội dung | Kịch bản lỗi | Chỗ trong code |
|---|---|---|---|---|---|
| **R-01** | **Cao** | S4 | Quyết toán phải **lớn hơn** tổng tạm ứng đã chuyển | Duyệt 10 tr, tạm ứng 10 tr, chi thực 10 tr; hoặc tạm ứng 8 tr, chi thực 7 tr. Cả hai trường hợp đều không gửi được quyết toán, hồ sơ kẹt ở `PENDING_PAYMENT_REQUEST` và không có lối thoát. SPEC §4.4 không nói tới trường hợp này | `payments.service.ts:163-167` |
| **R-02** | **Cao** (khi có nhiều ADMIN theo tòa) | US-S1 | ADMIN chỉ cần chung **một** tòa với tài khoản đích là đặt lại được mật khẩu của tài khoản đó, kể cả ADMIN toàn hệ thống | ADMIN của tòa A đặt lại mật khẩu `admin-demo`, đăng nhập bằng tài khoản đó và có quyền toàn hệ thống. Lỗi tương tự ở `get`/`update` | `user-admin.service.ts:77`, `:182` |
| **R-03** | Trung bình | S2 (gốc), S3/S4 (hậu quả) | Bản đồ người giữ bước chỉ chụp các bước của chuỗi tờ trình (`approvalStepKeys`), trong khi §3 v2 yêu cầu chụp mọi bước | Cấu hình PAYMENT = `[CUSTOM_X, BOARD]` thì không có ai giữ bước `CUSTOM_X`, hồ sơ kẹt. Mẫu AQUA và STANDARD không bị | `records.service.ts:159-165`, `record-steps.ts:33-39` |
| R-04 | Trung bình | RM-S1 | PD-13: trên web, BQL chỉ thấy lịch sử **vị trí**, không thấy lịch sử **cấu hình** tòa (API thì đã mở) | BQL không xem được ai đã áp mẫu hoặc sửa workflow | `web/.../LocationsPage.tsx:36` |
| R-05 | Trung bình–Thấp | AD-S1 | Xuất CSV không vô hiệu các ô bắt đầu bằng `= + - @` | Lý do chứa `=HYPERLINK(...)`; ADMIN mở file bằng Excel thì công thức chạy | `audit-log.service.ts:111` |
| R-06 | Trung bình | S2–S4 | Không kiểm lại người giữ bước nghiệm thu và thanh toán khi người đó bị khóa tài khoản sau lúc trình | Hồ sơ kẹt. Việc giao lại thuộc DF-12 (US-S2), chưa làm | `construction.service.ts:198-200`, `payments.service.ts:432` |
| R-07 | Thấp | S1/S2 | Xem chi tiết hồ sơ và tải tệp chỉ kiểm tòa, không kiểm khu vực; các lệnh ghi thì có kiểm khu vực | Người bị giới hạn khu vực đọc được hồ sơ của khu vực khác trong cùng tòa. Đã ghi là điểm mở từ S1 | `records.service.ts:492-494`, `attachments.service.ts:164-166` |
| R-08 | Thấp | S2 | Đơn giá × số lượng có thể tràn `bigint`, trả 500 thay vì 400; tổng 0 đồng vẫn trình được | Nhập số rất lớn, hoặc mọi giá bằng 0 | `proposal-quote.ts:7-9` |
| R-09 | Thấp | S2 | Nháp tờ trình trả cho mọi người trong tòa. v1 §7 ghi "chỉ người quản lý thấy"; v2 không nhắc lại | Cần chủ dự án xác nhận | `proposals.service.ts:297,307` |
| R-10 | Thấp | AU/US | Giới hạn 72 tính theo ký tự, trong khi bcrypt cắt ở 72 **byte** | Mật khẩu tiếng Việt có dấu, dài, bị cắt ngầm | `ChangePasswordDialog`, DTO |
| R-11 | Thấp | S2–S4 | Lặt vặt: ngày `2026-02-31` vẫn qua; `PAYMENT_PROOF` tải được khi không có đợt nào chờ; ảnh kết quả nhận cả PDF; tạm ứng ở "Cần bổ sung" không rút được; dòng audit `exportAuditLog` lẫn vào lịch sử tài khoản | | |
| R-12 | Thấp | S1–S4 | Version kiểm trước quyền: người không có quyền gửi version cũ nhận 409 thay vì 403 | | `record-loader.ts:26` |
| R-13 | Thấp | test | Thiếu test: unit test số quyết toán (§8); `self_approval_denied`; chữ ký > 200 KB hoặc không phải PNG; tài khoản người giữ bước bị khóa; AC-0.1 của `start-construction`, A1b, A2, A3; AC-0.2 của S4; VT-02 | | |

**Thay đổi chưa commit ở màn đăng nhập** (không phải của PM/BA):
- Không làm hỏng AC nào; các id mà script trình duyệt dùng vẫn giữ nguyên.
- Checkbox "Ghi nhớ đăng nhập" chưa nối vào đâu.
- "Quên mật khẩu?" hiện ra nhưng không bấm được, trong khi chức năng này chưa có (chờ AQ-02, DF-15).

## 3. Cần chủ dự án quyết (PD-08)

| # | Câu hỏi | PM/BA đề xuất |
|---|---|---|
| Q1 (R-01) | Quyết toán khi tạm ứng đã đủ hoặc dư | Cho quyết toán **bằng** tổng tạm ứng: còn 0 đồng thì bỏ bước chuyển khoản, đóng hồ sơ sau khi BQT duyệt. Quyết toán **nhỏ hơn** tạm ứng (nhà thầu phải hoàn tiền): chặn ở mức hiện tại, ghi thành OD cho khách. Đổi SPEC v2 §4.4 và §5.3 |
| Q2 (R-02) | Phạm vi khi ADMIN sửa hoặc đặt lại mật khẩu tài khoản khác | Chỉ cho khi **mọi** tòa của tài khoản đích nằm trong phạm vi người làm. Sửa nóng, slice nhỏ |
| Q3 (R-03, R-04, R-05) | Gom thành một slice sửa lỗi | Có: snapshot mọi bước, PD-13 trên web, CSV an toàn, cộng thêm R-08 |
| Q4 (R-06, R-07, R-09) | Ghép vào slice sau | R-06 vào US-S2 (DF-12). R-07 và R-09 xin quyết riêng |
