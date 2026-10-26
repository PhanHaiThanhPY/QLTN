# Module `users`: Quản trị tài khoản nhân viên

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `641c8b5`):
- API: `api-qltn/src/modules/users/*` (`users.controller.ts`, `user-admin.service.ts`, `dto/user.dto.ts`).
- Web: `web/src/features/admin/*` (`AdminSectionPage`, `AccountsCard`, `UserDialog`, `ManagerGapsCard`, `ReplaceManagerDialog`), `web/src/services/admin-service.ts`.
- Test: `api-qltn/test/catalog-admin.e2e-spec.ts` (nhóm accounts, uniqueness).

**Liên quan nghiệp vụ:** B17 Nhân sự và phân quyền. D2 nhóm 17: "Quản lý nhân viên, phòng ban, vai trò, ma trận quyền và phạm vi tòa; sao chép vai trò, thay người phụ trách và chuyển giao công việc." D1 tr. 31. D2 nhóm 02 thêm: "phân công lại khi thay đổi nhân sự".

## 1. Tính năng và trạng thái

| # | Tính năng | API | Web chế độ `api` | Test e2e | Trạng thái |
|---|---|---|---|---|---|
| US-01 | Danh sách tài khoản trong phạm vi tòa; lọc theo từ khóa, vai trò, tòa, bộ phận, trạng thái; phân trang | `GET /api/users` (ADMIN_VIEW) | `AccountsCard`. Web tải **hết** các trang rồi lọc ở client (tối đa 100 trang × 100 dòng) | `lists accounts for administrators only`, `limits … to the viewer scope` | Có. Màn hình chưa phân trang phía server (nợ kỹ thuật ghi ngay trong code) |
| US-02 | Xem chi tiết tài khoản | `GET /api/users/:id` | trong dialog | gián tiếp | Có |
| US-03 | Tạo tài khoản (mã, tên đăng nhập, mật khẩu ban đầu, họ tên, vai trò, bộ phận, tòa, khu vực, chức danh, email, điện thoại) | `POST /api/users` (ACCOUNT_MANAGE) | `UserDialog` (chế độ `api` có ô mật khẩu) | `creates an account …`, `validates scope, department coverage and location ownership`, trùng tên đăng nhập hoặc email | Có |
| US-04 | Sửa tài khoản (tên đăng nhập không đổi được) | `PATCH /api/users/:id` + `version` | `UserDialog` | `rejects a username sent when updating`, trùng email | Có |
| US-05 | Ngừng hoạt động hoặc kích hoạt lại tài khoản | `PATCH … active` | `UserDialog` | `deactivation signs the account out immediately and blocks login`, `refuses … to deactivate oneself` | Có |
| US-06 | Đặt lại mật khẩu do quản trị | `POST /api/users/:id/reset-password` | **không có** (không file web nào gọi endpoint này) | không có e2e riêng | **Có**, qua US-S1 (`7577afe`, chưa merge) |
| US-07 | Lịch sử thay đổi của tài khoản | `GET /api/users/:id/audit` | **không có** | `AccountHistory` trong `UserDialog` | `users-reset-password.e2e-spec.ts` AC-4 | **Có**, qua US-S1 |
| US-08 | Thay người phụ trách (`replaceManager`) | không có | `ReplaceManagerDialog` và `ManagerGapsCard` có trong code nhưng **không màn hình nào import** (đã grep `features/`, `app/`). Ở chế độ `mock`, handler `replaceManager` có trong `link-and-assignment-handlers.ts` | — | **Chưa dùng được ở cả hai chế độ** (cần dev-build xác nhận) |
| US-09 | Tự động chuyển các bước đang mở sang "Cần phân công lại" khi khóa tài khoản hoặc thu hẹp phạm vi | không có (`TODO(Đợt 2)` tại `user-admin.service.ts` dòng 158) | — | — | **Chưa có** |

## 2. Quy tắc đang chạy (đọc từ code)

- **Mã và tên đăng nhập:**
  - Mã tài khoản theo mẫu `^[A-Z0-9][A-Z0-9-]{1,19}$` (tự đổi sang chữ in hoa), duy nhất.
  - Tên đăng nhập mặc định là mã viết thường, theo mẫu `^[a-z0-9][a-z0-9._-]{1,49}$`.
  - Tên đăng nhập và email duy nhất, không phân biệt hoa thường. Tên đăng nhập **không đổi được** sau khi tạo.
- **Thông tin khác:** họ tên 3–80 ký tự; điện thoại theo mẫu `^[0-9+().\s-]{6,30}$`; mật khẩu ban đầu 8–72 ký tự.
- **Vai trò:**
  - Chọn một vai trò hệ thống, hoặc một vai trò tùy chỉnh thuộc vai trò gốc đó.
  - Sau khi tạo **không đổi được vai trò gốc**: "muốn đổi vai trò gốc hãy tạo tài khoản mới". Chỉ đổi được sang vai trò tùy chỉnh cùng gốc.
- **Phạm vi:**
  - Phải có ít nhất 1 tòa. Người quản trị chỉ gán được tòa trong phạm vi của mình; khi sửa, các tòa ngoài phạm vi mà tài khoản đang có thì được **giữ nguyên**.
  - Khu vực (`locationIds`) phải thuộc các tòa đã giao; để trống nghĩa là toàn tòa.
  - Quản trị chỉ xem, sửa được tài khoản có chung ít nhất 1 tòa với mình; ngoài ra trả 404.
- **Bộ phận:**
  - Bắt buộc khi tạo.
  - Bộ phận phải phụ trách **toàn bộ** các tòa đã chọn.
  - Khi sửa, không bỏ trống được bộ phận (giữ giá trị cũ).
- **Ngừng hoạt động:**
  - Không tự ngừng hoạt động tài khoản đang dùng.
  - Ngừng hoạt động thì thu hồi mọi phiên ngay; mọi request sau đó bị từ chối (xem [auth.md](auth.md) AU-06).
- **Khóa phiên bản và audit:** mọi lần sửa phải gửi `version`. Mọi thao tác ghi audit (`createUser`, `updateUser`, `deactivateUser`, `resetPassword`).
- **Không xóa tài khoản:** chỉ ngừng hoạt động, để giữ lịch sử.

## 3. Khoảng trống và rủi ro

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| UG-01 | ~~Quản trị không đặt lại được mật khẩu trên web~~ **Đã xử lý ở US-S1** | US-06 | Cao cho vận hành thật: nhân viên quên mật khẩu thì không ai cứu được | SPEC US-S1 (mục 5) |
| UG-02 | ~~Không xem được lịch sử tài khoản trên web~~ **Đã xử lý ở US-S1** | US-07; D1 tr. 39 yêu cầu "lưu vết thay đổi" | Trung bình | SPEC US-S1 |
| UG-03 | Khóa tài khoản hoặc thu hẹp phạm vi/khu vực thì **các bước đang giao cho người đó không ai làm được**. Ví dụ người xác nhận đã nghỉ thì hồ sơ kẹt ở "Chờ xác nhận". Với tờ trình, SPEC B03–B09 BR-05 chỉ chặn ở bước trình | `TODO(Đợt 2)`; D2 nhóm 02 và 17 yêu cầu "phân công lại", "chuyển giao công việc" | **Cao**: dữ liệu thật sẽ kẹt | SPEC riêng (US-S2), cần chốt quy tắc (UQ-01, UQ-02) |
| UG-04 | Không có chức năng thay người phụ trách (US-08) | D2 nhóm 17 "thay người phụ trách" | Cao, đi cùng UG-03 | Gộp vào US-S2 |
| UG-05 | Không đổi được vai trò gốc. Người được thăng chức (ví dụ Kỹ thuật lên BQL) phải có tài khoản mới; lịch sử của họ nằm ở hai tài khoản | `user-admin.service.ts` dòng 137–141 | Trung bình | Chờ khách chốt (UQ-03) |
| UG-06 | Màn hình nhân viên tải toàn bộ tài khoản về client, tối đa 10.000 dòng. Vượt mức đó thì danh sách **bị cắt mà không báo** | `admin-service.ts` `MAX_USER_PAGES = 100` | Thấp với 4 tòa | Ghi nợ kỹ thuật; làm phân trang phía server khi cần |
| UG-07 | ~~Chưa có e2e cho reset-password~~ **Đã xử lý ở US-S1** | danh sách test | Thấp | Thêm vào US-S1 |
| UG-08 | Chưa có vai trò Kế toán và Người nghiệm thu như hình D1 | OD-10 | Chờ khách | Phiếu L0 câu B1 |

## 4. Câu hỏi

| ID | Câu hỏi | Gửi |
|---|---|---|
| UQ-01 | Khi một nhân viên nghỉ việc hoặc bị khóa, việc đang giao cho họ xử lý thế nào: tự chuyển cho người cùng vai trò theo quy tắc phân công của tòa; đưa vào danh sách "Cần phân công lại" để quản trị chọn người; hay chặn không cho khóa khi còn việc mở? | Khách (bổ sung phiếu L0 phần B) |
| UQ-02 | Ai được thay người phụ trách: Quản trị, BQL của tòa, hay cả hai? Có cần ghi lý do không? | Khách |
| UQ-03 | Khi nhân viên đổi vị trí (ví dụ Kỹ thuật lên BQL), tạo tài khoản mới hay đổi vai trò trên tài khoản cũ? | Khách |

## 5. Đề xuất slice

| Slice | Nội dung | Sẵn sàng? |
|---|---|---|
| **US-S1** | Web: nút "Đặt lại mật khẩu" trong dialog nhân viên; tab "Lịch sử" của tài khoản; e2e cho reset-password | **Sẵn sàng.** API đã có, không có OD mở. Đã giao ([SPEC](../features/US-quan-tri-tai-khoan/SPEC.md)) |
| US-S2 | Phân công lại khi khóa hoặc thu hẹp phạm vi, kèm thay người phụ trách | Chờ UQ-01, UQ-02 và OD-03/OD-10 |
| US-S3 | Phân trang phía server cho màn hình nhân viên | Chưa cần với quy mô 4 tòa |
