# Module `reference`, `audit`, `health`: Nền tảng dùng chung

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `eb3934d`):
- `api-qltn/src/modules/reference/*`, `modules/audit/*` (`audit.service.ts`, `entities/audit-event.entity.ts`), `modules/health/health.controller.ts`.
- Migration `2026-10-21b-catalog-admin.sql` (bảng `audit_events`).
- Nơi đọc audit: `users.controller.ts`, `buildings.controller.ts`, `records.service.ts`.

**Liên quan nghiệp vụ:**
- D1 tr. 39: "kiểm quyền, tách hai quỹ, **lưu vết thay đổi**".
- D2 nhóm 18: "xuất dữ liệu, lưu tệp và **nhật ký thao tác**".
- Review 23/10 M08: thời gian lưu trữ chưa chốt.

## 1. `reference`: Danh mục tra cứu

**Chức năng:** `GET /api/reference`, dành cho mọi người đã đăng nhập. Trả về tòa, bộ phận, vị trí và người dùng **trong phạm vi tòa của người hỏi**. Các ô chọn (picker) trên web dùng dữ liệu này.

**Quy tắc:**
- Người dùng chỉ gồm mã, họ tên, vai trò, vai trò tùy chỉnh, bộ phận, chức danh, tòa, khu vực, trạng thái. **Không có email, điện thoại hay thông tin bảo mật** (code ghi rõ "no contact or security details").
- Vị trí trả cả vị trí đã ngừng dùng, có cờ `isActive`.
- Bộ phận trả những bộ phận phụ trách ít nhất một tòa trong phạm vi.

**Đánh giá:** đúng mục đích, đã tối giản dữ liệu cá nhân. Không có khoảng trống nghiệp vụ.

**Ghi chú:** trả toàn bộ danh mục trong một lần gọi; với 4 tòa vẫn ổn. Đây là cùng loại nợ kỹ thuật với users UG-06, chưa cần xử lý.

## 2. `audit`: Nhật ký thay đổi

**Chức năng:**
- **Ghi:** mỗi thay đổi nghiệp vụ ghi một dòng **trong cùng transaction** với thay đổi đó. Mỗi dòng gồm loại đối tượng, mã đối tượng, tòa, hành động, người làm, phiên bản, trạng thái trước và sau, lý do, `correlationId`, thời điểm.
- **Đọc theo từng đối tượng**, mới nhất trước, có phân trang:
  - tài khoản: `GET /users/:id/audit`;
  - tòa: `GET /buildings/:id/audit`;
  - hồ sơ sửa chữa: trong chi tiết hồ sơ.

**Loại đối tượng hiện có:** `BUILDING`, `ACCOUNT`, `REPAIR_RECORD`, `MAINTENANCE_ITEM`, `MAINTENANCE_PLAN`, `MAINTENANCE_OCCURRENCE`.

| ID | Khoảng trống | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| AD-G1 | **Đã xử lý ở AD-S1 (26/10, chưa merge).** **Chưa có màn "Nhật ký thao tác" chung** để tra theo tòa, người làm, loại đối tượng, khoảng thời gian, và xuất ra file. Hiện chỉ xem được lịch sử của từng đối tượng | D2 nhóm 18 "nhật ký thao tác"; D1 tr. 39 | **Trung bình–Cao** với yêu cầu minh bạch, nhất là hai quỹ | Slice **AD-S1** |
| AD-G2 | **Đã xử lý ở AD-S1 (26/10, chưa merge).** Vai trò và bộ phận được ghi audit dưới loại `ACCOUNT`, lẫn với tài khoản, và **không có chỗ đọc** lịch sử của chúng | `roles.service.ts`, `departments.service.ts` | Thấp | Thêm loại `ROLE`, `DEPARTMENT` cùng route đọc (roles RG-06, organization OG-03); gộp vào AD-S1 |
| AD-G3 | Bảng audit "chỉ ghi thêm" mới là quy ước trong code; **không có ràng buộc ở DB** chặn sửa hoặc xóa (không trigger, không thu hồi quyền UPDATE/DELETE) | migration `2026-10-21b` | Thấp–Trung bình | Quyết định kỹ thuật: dev-build đề xuất bằng ADR (ví dụ trigger chặn UPDATE/DELETE) |
| AD-G4 | Chưa ghi sự kiện đăng nhập (thành công hoặc thất bại) | auth AG-09; DF-15 (5) | Trung bình | Làm cùng AU-S2 (DF-15) |
| AD-G5 | **Đã xử lý ở AD-S1 (26/10, chưa merge).** Chưa có quy định thời gian lưu nhật ký | review M08 | Thấp | Mặc định: **giữ vô thời hạn**, không xóa. **Giả định**, ghi khi viết AD-S1 |

## 3. `health`: Kiểm tra sống

**Chức năng:** `GET /api/public/health-check`, công khai, không giới hạn tần suất. Trả `{ status: 'ok', database: 'up' | 'down', uptimeSeconds }`.

| ID | Khoảng trống | Mức | Hướng xử lý |
|---|---|---|---|
| HE-G1 | **Đã xử lý ở AD-S1 (26/10, chưa merge).** Khi DB lỗi, API **vẫn trả HTTP 200** với `status: 'ok'` (chỉ trường `database` là `down`). Công cụ giám sát chỉ kiểm mã HTTP sẽ không phát hiện được sự cố | Thấp–Trung bình (vận hành) | Việc kỹ thuật: trả 503 khi `database: 'down'`. Không cần SPEC nghiệp vụ, nhưng vẫn cần chủ dự án duyệt trước khi giao (PD-08). Có thể gộp vào AD-S1 dưới dạng một AC nhỏ |

## 4. Đề xuất slice (chưa viết SPEC, chờ chủ dự án chọn)

| Slice | Nội dung | Ghi chú |
|---|---|---|
| **AD-S1** | Màn **Nhật ký thao tác** cho ADMIN, và cho BQL trong phạm vi tòa của mình: lọc theo tòa, người làm, loại đối tượng, hành động, khoảng thời gian; mở được đối tượng gốc; xuất CSV. Kèm thêm: loại `ROLE`, `DEPARTMENT` và lịch sử vai trò, bộ phận (AD-G2); health trả 503 khi DB lỗi (HE-G1) | Thuộc B18 (D2 nhóm 18). Định dạng Excel chờ module reports (OD-07, DF-18) |
| AU-S2 | Bắt đổi mật khẩu lần đầu, khóa tạm khi sai nhiều lần, lịch sử đăng nhập (DF-15, AD-G4) | Đã có mặc định DF-15 |
| ADR-0002 | Bảo vệ bảng audit ở mức DB (AD-G3) | Việc của dev-build |
