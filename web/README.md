# Demo quản lý sửa chữa & bảo trì tòa nhà

Bản demo chỉ có frontend, dữ liệu mô phỏng lưu trong IndexedDB của trình duyệt. Đặc tả: `../Dac_ta_demo_web_quan_ly_sua_chua_toa_nha (1).md`.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5190
npm test           # domain + dịch vụ mock + seed (vitest, fake-indexeddb)
npm run typecheck
npm run build
```

Lần mở đầu tiên sẽ nạp dữ liệu mẫu (20 hồ sơ sửa chữa, 6 hạng mục, 6 kế hoạch, 13 lượt bảo trì), các ngày tính tương đối từ ngày mở. Trang Quản trị demo (tài khoản ADMIN-DEMO) có nút khôi phục dữ liệu, chỉnh độ trễ và giả lập lỗi lệnh tiếp theo.

## Kiến trúc

- `src/domain` — kiểu dữ liệu, ma trận quyền, định nghĩa thao tác/trạng thái nguồn, quy tắc giao việc, quy tắc lịch bảo trì (thuần TS, không phụ thuộc UI).
- `src/services` — `executeCommand` (chống gửi lặp bằng `commandId`, kiểm tra version, quyền, trạng thái, dữ liệu; ghi thay đổi + audit + task + thông báo trong một transaction IndexedDB), các handler theo nghiệp vụ, hàm đọc lọc theo tòa nhà, dịch vụ tệp, báo cáo.
- `src/mock` — seed chạy lại lịch sử bằng chính các lệnh nghiệp vụ với đồng hồ mô phỏng, nên audit/task/thông báo luôn nhất quán.
- `src/storage` — schema Dexie (`SCHEMA_VERSION`).
- `src/features` — màn hình; chỉ gọi services, không tự đổi trạng thái.

Đăng nhập và ký đều là mô phỏng. Phân quyền chỉ phục vụ trải nghiệm, không phải ranh giới bảo mật: backend thật phải kiểm tra lại mọi quyền.
