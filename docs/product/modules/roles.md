# Module `roles`: Vai trò và ma trận quyền

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `641c8b5`):
- API: `api-qltn/src/modules/roles/*`, `src/domain/permissions.ts`, `src/common/guards/capabilities.guard.ts`.
- Web: `web/src/domain/permissions.ts`, `web/src/features/admin/{permission-rows.ts,capability-labels.ts}`, `components/{RolesCard,RoleDialog,PermissionMatrixCard}.tsx`.
- Test: `catalog-admin.e2e-spec.ts` (nhóm roles), `narrow-capabilities.spec.ts`, `capabilities.guard.spec.ts`.

**Liên quan nghiệp vụ:** B17. D2 nhóm 17 có "vai trò, ma trận quyền … sao chép vai trò". D1 tr. 31: "Mỗi vai trò truy cập đúng phạm vi". Review 23/10 H06: chưa có ma trận quyền thống nhất.

## 1. Mô hình quyền hiện tại

- **5 vai trò hệ thống, cố định trong code:**

  | Vai trò | Mã |
  |---|---|
  | Quản trị hệ thống | ADMIN |
  | Ban quản lý | BQL |
  | Kỹ thuật | KT (`TECH_CONFIRMER`) |
  | Tư vấn kỹ thuật | TVKT (`TECH_CONSULTANT`) |
  | Ban quản trị | BQT (`OWNERS_BOARD`) |

  Mỗi lần khởi động, API đồng bộ các dòng vai trò hệ thống theo ma trận trong code (`syncSystemRoles`).
- **18 capability.** Ma trận vai trò → capability ở API và web **giống hệt nhau**: mình đã so nguyên khối `ROLE_CAPABILITIES` ở hai file, chỉ khác khai báo kiểu `Readonly`. Ma trận hiện tại:

  | Vai trò | Capability |
  |---|---|
  | ADMIN | VIEW, REPLACE_MANAGER, REPORT_VIEW, ADMIN_VIEW, BUILDING_CONFIG, ACCOUNT_MANAGE |
  | BQL | VIEW, RECORD_EDIT, CONSTRUCTION, PAYMENT_RECORD, MAINTENANCE_MANAGE, ITEM_CONDITION, REASSIGN, REPORT_VIEW, BUILDING_CONFIG, EMERGENCY_START |
  | KT | VIEW, RECORD_CONFIRM, PROPOSAL_DECIDE, ACCEPTANCE_DECIDE, MAINTENANCE_REVIEW |
  | TVKT | VIEW, PROPOSAL_DECIDE, ACCEPTANCE_DECIDE, REPORT_VIEW |
  | BQT | VIEW, PROPOSAL_DECIDE, PAYMENT_DECIDE, REPORT_VIEW |

- **Vai trò tùy chỉnh (VT-NN):** dựa trên một vai trò gốc và **chỉ được bớt** quyền, không được thêm. Luôn giữ quyền `VIEW`.
- **Phạm vi tòa và khu vực gắn với từng tài khoản,** không gắn với vai trò. Ngoài vai trò, mỗi bước nghiệp vụ còn kiểm "đúng người được giao" (xem SPEC B03–B09 §4).
- **ADMIN không có quyền quyết định nghiệp vụ** (ghi chú trong code). Đây là cơ chế tách quản trị khỏi vận hành.

## 2. Tính năng và trạng thái

| # | Tính năng | API | Web chế độ `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| RO-01 | Danh sách vai trò kèm số người đang giữ | `GET /api/roles` (**mọi** người đã đăng nhập) | `RolesCard` | seed roles | Có |
| RO-02 | Tạo vai trò tùy chỉnh từ vai trò gốc, hoặc sao chép từ vai trò khác | `POST /api/roles` (ACCOUNT_MANAGE) | `RoleDialog` | `creates a narrowed custom role…`, `refuses to grant a capability outside the base role`, `rejects duplicate names…` | Có |
| RO-03 | Sửa tên và quyền của vai trò tùy chỉnh; người đang giữ vai trò nhận quyền mới ngay | `PATCH /api/roles/:id` + `version` | `RoleDialog` | `enforces the optimistic lock and protects system roles` | Có |
| RO-04 | Vai trò hệ thống không sửa được | API trả lỗi | — | như trên | Có |
| RO-05 | Bảng ma trận quyền (đọc trực tiếp từ code) | — | `PermissionMatrixCard` + `permission-rows.ts` | — | Có, có một nhãn sai (RG-03) |
| RO-06 | Xóa hoặc ngừng dùng vai trò tùy chỉnh | không có | không có | — | **Chưa có** |
| RO-07 | Lịch sử thay đổi vai trò | audit được ghi (subjectType `ACCOUNT`) nhưng không có endpoint đọc | không có | — | **Chỉ ghi, chưa xem được** |
| RO-08 | Đánh giá lại các bước đang mở khi bớt quyền của vai trò | `TODO(Đợt 2)` tại `roles.service.ts` dòng 107 | — | — | **Chưa có** (cùng vấn đề với users UG-03) |

## 3. Quy tắc đang chạy

- **Tên và mã vai trò:** tên 3–80 ký tự, duy nhất không phân biệt hoa thường. Mã tự sinh `VT-01`, `VT-02`… qua bộ đếm.
- **Quyền khi tạo vai trò tùy chỉnh:**
  - Mặc định lấy toàn bộ quyền của vai trò gốc, hoặc của vai trò nguồn nếu sao chép.
  - Thêm quyền ngoài vai trò gốc thì trả 400 lỗi trường `capabilities`.
- **Vai trò gốc của tài khoản không đổi được** (xem [users.md](users.md) UG-05). Vai trò tùy chỉnh chỉ gán được cho tài khoản cùng gốc.
- **Hiệu lực ngay:** quyền tính lại ở mỗi request, nên sửa vai trò có hiệu lực ngay cho mọi người đang giữ.
- **Audit:** tạo hoặc sửa vai trò ghi audit, kèm số tài khoản bị ảnh hưởng.

## 4. Khoảng trống và rủi ro

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| RG-01 | **Đã xử lý ở RM-S1 (26/10, `072df32`, chưa merge).** **BQL có quyền `BUILDING_CONFIG`**: BQL tự sửa được cấu hình tòa, gồm chuỗi duyệt, hạn mức khẩn cấp và quy tắc phân công. Người lập hồ sơ vì vậy có thể bỏ bước duyệt cho các hồ sơ tạo sau đó. Đây là rủi ro tách bạch trách nhiệm | ma trận quyền; 9 route `RequireCapabilities('BUILDING_CONFIG')` trong `buildings` | **Cao** nếu BQL là người lập hồ sơ | Chờ khách chốt (RQ-01). Đề xuất: chỉ ADMIN, hoặc BQT duyệt cấu hình |
| RG-02 | **Đã xử lý ở RM-S1 (26/10, `072df32`, chưa merge).** Không thêm được vai trò mới như **Kế toán** hay **Người nghiệm thu** bằng cấu hình. Vai trò gốc cố định trong code, vai trò tùy chỉnh chỉ bớt quyền | `ROLE` trong `permissions.ts` | Cao nếu khách cần (OD-10) | Khi OD-10 chốt: dev-build thêm vai trò hệ thống mới, cần ADR |
| RG-03 | **Đã xử lý ở RM-S1 (26/10, `072df32`, chưa merge).** Bảng ma trận trên web ghi "Cập nhật thi công, **lập đề nghị thanh toán**" dưới quyền `CONSTRUCTION`. Code thực tế: `savePaymentDraft` và `submitPaymentRequest` cần `PAYMENT_RECORD`. Bảng đang mô tả sai người dùng | `permission-rows.ts` so với `web/src/domain/actions.ts` dòng 178–189 | Thấp (chỉ sai chữ, quyền thực tế vẫn đúng) | Sửa nhãn; gom vào slice nhỏ kế tiếp |
| RG-04 | Dòng ma trận "Ghi nhận nghiệm thu… (cần cả KT và TVKT đạt)" mô tả quy tắc demo, trong khi D1 có thể khác (OD-12) | `permission-rows.ts`; DG-02 | Thấp | Cập nhật khi OD-12 chốt |
| RG-05 | Không xóa hoặc ngừng dùng được vai trò tùy chỉnh; vai trò thừa cứ tích tụ trong danh sách | RO-06 | Thấp | Chờ khách chốt (RQ-02) |
| RG-06 | Không xem được lịch sử thay đổi vai trò. Audit của vai trò ghi chung loại `ACCOUNT` với tài khoản | `roles.service.ts` `SUBJECT_TYPE.ACCOUNT` | Thấp | Thêm endpoint và màn hình lịch sử vai trò; xem cách phân loại audit khi làm module `audit` |
| RG-07 | `GET /api/roles` mở cho mọi người đã đăng nhập, gồm danh sách capability và số người giữ | `roles.controller.ts` (không có `RequireCapabilities`) | Thấp (thông tin nội bộ) | Cần dev-build xác nhận màn hình nào ngoài admin đang cần endpoint này rồi mới thu hẹp |
| RG-08 | Bớt quyền của vai trò thì các bước đang mở của người giữ không được đánh giá lại | RO-08 | Cao, đi cùng users UG-03 | US-S2 |

## 5. Câu hỏi

| ID | Câu hỏi |
|---|---|
| RQ-01 | Ai được sửa cấu hình tòa (chuỗi duyệt, hạn mức khẩn cấp, phân công): chỉ Quản trị, BQL, hay BQL sửa nhưng BQT phải duyệt? (Bổ sung vào phiếu L0, phần B.) |
| RQ-02 | Có cần ngừng dùng hoặc xóa vai trò tùy chỉnh không? Nếu vai trò còn người đang giữ thì xử lý thế nào? |

## 6. Đề xuất slice

| Slice | Nội dung | Sẵn sàng? |
|---|---|---|
| RO-S1 | Sửa nhãn RG-03 | Sẵn sàng nhưng quá nhỏ: gom chung với slice nhỏ của module `organization` |
| RO-S2 | Thu hẹp quyền `BUILDING_CONFIG` | Chờ RQ-01 |
| RO-S3 | Vai trò Kế toán và Người nghiệm thu | Chờ OD-10 |
| RO-S4 | Lịch sử vai trò, ngừng dùng vai trò | Chờ RQ-02 |
