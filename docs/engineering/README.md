# Tài liệu kỹ thuật

**Chủ sở hữu:** dev (`dev-build`, `dev-review`) · **Cập nhật:** 26/10/2026

Chi tiết cài đặt, chạy và endpoint nằm cạnh code: [api-qltn/README.md](../../api-qltn/README.md), [web/README.md](../../web/README.md). Thư mục này giữ những gì không thuộc riêng một ứng dụng:

- `adr/` — quyết định kỹ thuật (Architecture Decision Record), mỗi quyết định một file `ADR-xxxx-<tên>.md`, đánh số tăng dần, không sửa nội dung sau khi `Đã chấp nhận` (thay bằng ADR mới).
- `runbook/` — vận hành: chạy local, migration, sao lưu, xử lý sự cố.

Khi nào cần ADR: chọn thư viện/hạ tầng (ví dụ lưu file local hay MinIO), đổi mô hình dữ liệu dùng chung, quy ước bảo mật/phân quyền, đánh đổi có hệ quả lâu dài.

## Mẫu ADR

```markdown
# ADR-0001: <quyết định>

**Trạng thái:** Đề xuất | Đã chấp nhận | Thay thế bởi ADR-xxxx
**Ngày:** dd/mm/yyyy · **Người quyết:** <tên/vai trò>

## Bối cảnh
Vấn đề và ràng buộc.

## Quyết định
Chọn gì.

## Phương án đã cân nhắc
- A — ưu/nhược
- B — ưu/nhược

## Hệ quả
Điều trở nên dễ hơn, khó hơn, việc phải làm tiếp.
```
