# Biên bản UAT – Bảo trì thiết bị và Sửa chữa

**Ngày kiểm thử:** 20/10/2026  
**Môi trường:** Local demo `http://localhost:5190`  
**Tài khoản UAT:** `BQL-A`, `KT-A2`, `ADMIN-DEMO`  
**Phạm vi:** Module Bảo trì thiết bị, Lịch bảo trì và Hồ sơ sửa chữa.

## Kết quả tổng hợp

**Đạt UAT kỹ thuật và smoke test theo vai trò – không ghi nhận lỗi chặn luồng.**

- Bộ test tự động đạt **157/157**.
- Đã kiểm tra trực tiếp trên trình duyệt với đủ 3 vai trò nghiệp vụ trong phạm vi yêu cầu.
- Luồng Nghiệm thu và Thanh toán hiển thị đúng theo trạng thái hiện tại của hồ sơ.
- Lịch sử hồ sơ và lịch sử lượt bảo trì hiển thị đúng thứ tự, người thực hiện, thời điểm, phiên bản và chuyển trạng thái.
- Không phát sinh thay đổi dữ liệu nghiệp vụ trong quá trình kiểm thử.

## Các kịch bản đã đạt

| Nhóm | Nội dung kiểm tra | Kết quả |
|---|---|---|
| Thiết bị | Danh sách thiết bị, lọc nhanh, tình trạng, hạn bảo trì, hồ sơ sửa chữa đang mở | Đạt |
| Lịch bảo trì | Lượt quá hạn, hôm nay, sắp đến hạn, chờ kiểm tra, trạng thái và chỉ báo | Đạt |
| Kế hoạch bảo trì | Tạo kế hoạch, lịch thực hiện, phát sinh lượt bảo trì và liên kết hồ sơ sửa chữa | Đạt |
| Hồ sơ sửa chữa | Danh sách, tìm kiếm/lọc, trạng thái, quá hạn, phân công và theo dõi tiến độ | Đạt |
| Thiết bị – sửa chữa | Hiển thị thiết bị/hạng mục liên quan và các hồ sơ đang mở | Đạt |
| Nghiệm thu | Tab, điều kiện đến bước, lượt nghiệm thu và trạng thái quyết định | Đạt |
| Thanh toán | Tab, điều kiện đến bước, đề nghị thanh toán và trạng thái quyết định | Đạt |
| Lịch sử | Lịch sử hồ sơ sửa chữa và lượt bảo trì, actor, thời gian, phiên bản, chuyển trạng thái và ghi chú | Đạt |
| Quyền và phạm vi | Phạm vi tòa nhà, vai trò xử lý và quyền thao tác theo hồ sơ | Đạt |
| Báo cáo/cảnh báo | Chỉ báo quá hạn, cảnh báo thiết bị và các mục cần xử lý | Đạt |

## UAT thực tế theo vai trò

| Vai trò | Kịch bản kiểm tra | Kết quả |
|---|---|---|
| BQL-A | Xem lịch trong phạm vi Tòa A, mở `BT-007`, nhập checklist, xem kết luận, ảnh bằng chứng, nút lưu/gửi và tạo hồ sơ sửa chữa | Đạt |
| KT-A2 | Mở `BT-010` là lượt được giao, xem từng mục checklist, chọn Đạt/Cần làm lại, xem lịch sử và hạn SLA review | Đạt |
| ADMIN-DEMO | Xem báo cáo toàn phạm vi 6 tòa, tổng hợp 21 hồ sơ + 13 lượt, danh sách cần chú ý và các màn hình quản trị | Đạt |
| Phân quyền | KT-A không được quyết định trên lượt giao cho KT-A2; nút thao tác bị khóa đúng quyền | Đạt |
| SLA tương thích | Dữ liệu cũ chưa có `reviewDueAt` được hiển thị hạn review mặc định 2 ngày từ thời điểm gửi | Đạt |

## Tài khoản demo phục vụ UAT

Màn hình truy cập demo hiện có 7 tài khoản để kiểm thử đúng người được giao:

```text
ADMIN-DEMO · BQL-A · KT-A · KT-A2 · KT-B · TVKT · BQT
```

Việc bổ sung `KT-A2`, `KT-B` và `TVKT` chỉ giúp chọn đúng người xử lý trong dữ liệu seed; không mở rộng quyền nghiệp vụ của tài khoản.

## Bộ test tự động đã chạy

```text
Test Files: 28 passed
Tests:      157 passed
Build:      production passed
Typecheck:  passed
```

## Kiểm tra trình duyệt

- `/maintenance/schedule`: hiển thị đầy đủ tổng quan quá hạn, cần làm hôm nay, 7 ngày tới, chờ kiểm tra và danh sách lượt bảo trì.
- `/maintenance/items`: hiển thị 16 thiết bị trong phạm vi lọc, các nhóm cần xử lý, quá hạn bảo trì và đang sửa chữa.
- `/records`: hiển thị danh sách 21 hồ sơ, bộ lọc, hồ sơ quá hạn và mục cần xử lý ngay.
- Hồ sơ `SC-016`: hiển thị đầy đủ tiến độ 5 giai đoạn, liên kết thiết bị, tab Nghiệm thu và Thanh toán.
- Tab `Lịch sử` của `SC-016`: hiển thị các mốc tạo hồ sơ, tải tệp, gửi xác nhận, xác nhận cần sửa, trình duyệt và duyệt tờ trình.
- Lượt bảo trì `BT-013`: hiển thị các mốc sinh lượt, bắt đầu bảo trì, tải kết quả, gửi kết quả và yêu cầu làm lại.

## Kết luận và bàn giao

Phần kỹ thuật và smoke UAT theo vai trò đã hoàn tất. Có thể bàn giao môi trường cho người dùng nghiệp vụ xác nhận lần cuối trên dữ liệu thực tế và ký nghiệm thu. Bước tiếp theo là chạy UAT nghiệp vụ có người dùng thật theo checklist, sau đó chốt các nội dung cần thay đổi trước khi phát hành production.
