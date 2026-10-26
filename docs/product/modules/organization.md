# Module `organization`: Bộ phận (phòng ban)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `641c8b5`):
- API: `api-qltn/src/modules/organization/*` (`departments.controller.ts`, `departments.service.ts`, `dto/department.dto.ts`).
- Nơi dùng bộ phận: `src/domain/building-config.ts` (`assignmentRules`), `src/modules/records/records.service.ts` dòng 223, 253 (tự giao việc khi tạo hồ sơ).
- Web: `web/src/features/admin/components/{DepartmentsCard,DepartmentDialog}.tsx`.
- Test: `catalog-admin.e2e-spec.ts` (nhóm departments; `requires assignment-rule departments to cover the building`).

**Liên quan nghiệp vụ:** B17 (D2 nhóm 17: "Quản lý nhân viên, phòng ban…"), B15 (D2 nhóm 15: "quy tắc giao việc").

## 1. Vai trò của bộ phận trong hệ thống

Bộ phận có hai việc:
1. **Nhóm nhân viên:** mỗi nhân viên thuộc đúng một bộ phận. Bộ phận phải phụ trách **toàn bộ** các tòa của nhân viên đó (xem [users.md](users.md)).
2. **Căn cứ tự giao việc:** cấu hình mỗi tòa có `assignmentRules`, mỗi quy tắc gồm bộ phận, vai trò, khu vực (tùy chọn) và độ ưu tiên. Khi tạo hồ sơ, hệ thống chọn người theo quy tắc khớp đầu tiên, là người thuộc đúng bộ phận và vai trò, còn hoạt động, có phạm vi khu vực phù hợp.

## 2. Tính năng và trạng thái

| # | Tính năng | API | Web `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| OR-01 | Danh sách bộ phận trong phạm vi tòa, kèm số nhân viên | `GET /api/departments` (mọi người đã đăng nhập) | `DepartmentsCard` | gián tiếp | Có |
| OR-02 | Tạo bộ phận (mã, tên, mô tả, các tòa phụ trách) | `POST` (ACCOUNT_MANAGE) | `DepartmentDialog` | `creates a department in scope` | Có |
| OR-03 | Sửa bộ phận, kể cả đổi mã | `PATCH /:id` + `version` | `DepartmentDialog` | `cannot shrink below the buildings of its members` | Có |
| OR-04 | Ngừng dùng hoặc xóa bộ phận | không có | không có | — | **Chưa có** |
| OR-05 | Xem lịch sử bộ phận | audit được ghi (subjectType `ACCOUNT`), không có endpoint đọc | không có | — | Chỉ ghi |

## 3. Quy tắc đang chạy

- **Mã và tên:** mã theo mẫu `^[A-Z0-9][A-Z0-9-]{1,19}$`, duy nhất; tên 3–80 ký tự; mô tả tối đa 1000 ký tự.
- **Phạm vi tòa:**
  - Phải phụ trách ít nhất 1 tòa. Người quản trị chỉ gán được tòa trong phạm vi của mình.
  - Không thu hẹp được phạm vi khi còn nhân viên ở tòa bị bỏ. Thông báo lỗi: "Không thể thu hẹp phạm vi: bộ phận đang có nhân viên ngoài phạm vi mới."
- **Liên kết với cấu hình tòa:** lưu cấu hình tòa thì bị chặn nếu quy tắc giao việc dùng một bộ phận không phụ trách tòa đó (test e2e đã có).
- **Khóa phiên bản và audit:** mọi lần sửa phải gửi `version`; mọi thao tác ghi audit.

## 4. Khoảng trống

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| OG-01 | Thu hẹp phạm vi bộ phận chỉ kiểm tra nhân viên, **không kiểm tra quy tắc giao việc**. Quy tắc của tòa vừa bị bỏ vẫn còn trong cấu hình, nhưng không còn ai khớp. Hồ sơ mới ở tòa đó vì vậy không được tự giao việc, và hệ thống không báo vì sao | `departments.service.ts` `update` chỉ truy vấn `users`; cấu hình chỉ kiểm khi lưu | Trung bình | Khi thu hẹp phạm vi: chặn nếu còn quy tắc tham chiếu, hoặc liệt kê các quy tắc sẽ mất hiệu lực để người dùng xác nhận. Gom vào SPEC cấu hình tòa (module `buildings`) |
| OG-02 | Không ngừng dùng được bộ phận | OR-04 | Thấp | DF-14 áp tương tự: chỉ ngừng dùng khi không còn nhân viên **và** không còn quy tắc tham chiếu; không xóa |
| OG-03 | **Đã xử lý ở AD-S1 (26/10, chưa merge).** Không xem được lịch sử bộ phận; audit ghi chung loại `ACCOUNT` | OR-05 | Thấp | Xử lý chung khi phân tích module `audit` |
| OG-04 | `GET /api/departments` mở cho mọi người đã đăng nhập | controller | Thấp | Giống roles RG-07: cần biết màn hình nào cần endpoint này rồi mới thu hẹp |

**Không có câu hỏi mới cho khách.** D5-QT không nhắc tới bộ phận. Mặc định: bộ phận chỉ là nhóm quản trị nội bộ.

## 5. Slice

Chưa giao slice riêng vì module nhỏ:
- OG-01 gom vào SPEC cấu hình tòa (module `buildings`, phân tích kế tiếp).
- OG-02 gom vào slice "ngừng dùng vai trò và bộ phận" (DF-14).
- OG-03 xử lý cùng module `audit`.
