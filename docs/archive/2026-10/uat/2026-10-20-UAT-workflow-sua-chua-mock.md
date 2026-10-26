# Biên bản UAT – Workflow sửa chữa end-to-end

**Ngày kiểm thử:** 20/10/2026  
**Môi trường:** Local demo `http://localhost:5190`  
**Phạm vi:** Tạo hồ sơ → xác nhận hiện trạng → tờ trình/chuỗi duyệt → thi công → nghiệm thu → thanh toán → hoàn tất.

## Kết quả tổng hợp

**Đạt kiểm thử kỹ thuật và smoke UAT giao diện; không ghi nhận lỗi chặn luồng.**

- 34/34 kịch bản workflow sửa chữa đạt.
- TypeScript typecheck đạt.
- Production build đạt.
- Kiểm tra trực tiếp hồ sơ `SC-016` trên giao diện đạt.
- Không thay đổi dữ liệu nghiệp vụ trong quá trình kiểm tra giao diện.

## Kịch bản end-to-end đã đạt

| Giai đoạn | Nội dung kiểm tra | Kết quả |
|---|---|---|
| Tiếp nhận | BQL tạo hồ sơ nháp, bắt buộc đủ vị trí, mô tả và ảnh trước khi gửi | Đạt |
| Xác nhận hiện trạng | KT được giao xác nhận; người không được giao bị từ chối | Đạt |
| Tờ trình | BQL lập tờ trình, nhập nhà thầu/giá trị, ký mô phỏng và đính kèm tài liệu | Đạt |
| Chuỗi duyệt | TVKT và BQT duyệt tuần tự theo cấu hình; người ngoài bước không được quyết định | Đạt |
| Trả hồ sơ | Yêu cầu bổ sung tạo bản trình mới, giữ nguyên lịch sử các lần trình trước | Đạt |
| Thi công | BQL bắt đầu, cập nhật tiến độ và gửi nghiệm thu khi đạt 100% | Đạt |
| Nghiệm thu | KT và TVKT cùng quyết định; không đạt tạo lượt khắc phục và cho phép nghiệm thu lại | Đạt |
| Thanh toán | BQL gửi đề nghị, BQT duyệt, BQL ghi nhận chứng từ thanh toán | Đạt |
| Hoàn tất | Chỉ đóng hồ sơ sau khi đã ghi nhận thanh toán; tác vụ mở được đóng hết | Đạt |
| Phân quyền | Tài khoản sai vai trò hoặc sai phạm vi tòa nhà không xem/thao tác được hồ sơ | Đạt |
| Khôi phục lỗi | Lệnh lỗi mô phỏng rollback dữ liệu và chạy lại thành công; lệnh lặp không tạo trùng | Đạt |
| Workflow tùy biến | Chuỗi nghiệm thu và thanh toán lấy theo cấu hình Workflow Designer | Đạt |

## Kiểm tra trực tiếp trên giao diện

### BQL / BQL-B

- Mở danh sách hồ sơ và theo dõi trạng thái, hạn xử lý, mức ưu tiên.
- Mở `SC-016`, xem người xử lý, thiết bị liên quan và tiến độ 5 giai đoạn.
- Tab Tờ trình hiển thị đúng nhà thầu, số tiền, lần trình và bước đang chờ.
- Các tab Nghiệm thu, Thanh toán hiển thị đúng điều kiện chuyển bước khi hồ sơ chưa đủ điều kiện.

### Kỹ thuật / TVKT

- Tài khoản TVKT được đưa vào danh sách demo để kiểm thử đúng người đang giữ bước duyệt.
- Trên `SC-005` đang chờ TVKT, các nút Yêu cầu bổ sung, Từ chối và Duyệt được mở đúng người được giao.
- Trên `SC-016` đang chờ BQT, TVKT bị khóa thao tác và hiển thị lý do không phải người giữ bước.

### BQT

- BQT là người giữ bước duyệt tiếp theo của `SC-016`; nút Yêu cầu bổ sung, Từ chối và Duyệt chỉ mở đúng ở bước hiện tại.

### Admin

- Xem toàn bộ phạm vi dữ liệu, trạng thái hồ sơ, cảnh báo quá hạn và báo cáo tổng hợp.
- Có thể truy cập Workflow Designer để kiểm tra cấu hình bước nghiệm thu/thanh toán.

### Lịch sử

Tab Lịch sử của `SC-016` hiển thị các mốc tạo hồ sơ, tải ảnh hiện trường, gửi xác nhận, xác nhận cần sửa, trình duyệt, duyệt tờ trình, actor, thời gian và phiên bản.

## Tài khoản demo phục vụ UAT

```text
ADMIN-DEMO · BQL-A · KT-A · KT-A2 · KT-B · TVKT · BQT
```

Các tài khoản bổ sung chỉ phục vụ kiểm thử đúng người được giao trong dữ liệu seed; không làm thay đổi ma trận quyền nghiệp vụ.

## Kết luận và bước tiếp theo

Workflow sửa chữa đã đủ điều kiện bàn giao cho người dùng nghiệp vụ chạy UAT cuối trên dữ liệu thật. Sau khi người dùng ký xác nhận, có thể chuyển sang checklist release production/Vercel: biến môi trường, build preview, smoke sau deploy và xác nhận rollback.
