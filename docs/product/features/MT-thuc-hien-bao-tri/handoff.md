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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
