# SPEC — Đặt lại mật khẩu và lịch sử tài khoản trên web (module users, US-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Đã duyệt`
**Người duyệt:** chủ dự án, duyệt bổ sung ngày 26/10/2026 (PD-11). Bản build ban đầu được giao theo PD-05 (PM/BA tự duyệt)
**Nguồn:** [phân tích module users](../../modules/users.md): UG-01, UG-02, UG-07

## 1. Mục tiêu

Ở chế độ `api`, quản trị viên làm được hai việc mà API đã hỗ trợ nhưng web chưa có:
- Đặt lại mật khẩu cho nhân viên (`POST /api/users/:id/reset-password`).
- Xem lịch sử thay đổi của một tài khoản (`GET /api/users/:id/audit`).

## 2. Phạm vi

**Trong phạm vi**
- Nút "Đặt lại mật khẩu" và tab hoặc khối "Lịch sử" trong dialog sửa nhân viên (`UserDialog`).
- Một quy tắc mới ở API (BR-04).
- Test e2e cho reset-password.

**Ngoài phạm vi**
- Phân công lại khi khóa tài khoản và thay người phụ trách (US-S2).
- Bắt đổi mật khẩu ở lần đăng nhập đầu (AQ-01).
- Chế độ `mock`: không hiện nút và tab mới.

## 3. Luồng

### 3.1 Đặt lại mật khẩu

1. Quản trị có `ACCOUNT_MANAGE` mở dialog sửa một nhân viên. Nút **Đặt lại mật khẩu** chỉ hiện khi sửa tài khoản đã có, không hiện khi tạo mới. Với tài khoản của chính mình, nút không hiện (BR-04).
2. Bấm nút thì mở hộp thoại xác nhận, gồm:
   - Dòng cảnh báo: "Nhân viên «Họ tên (Mã)» sẽ bị đăng xuất khỏi mọi thiết bị và phải đăng nhập bằng mật khẩu mới."
   - Hai ô **Mật khẩu mới** và **Nhập lại mật khẩu mới**, có nút hiện/ẩn.
3. Bấm **Đặt lại**: web kiểm BR-01 và BR-02, rồi gọi API.
4. **Thành công:** đóng hộp thoại xác nhận và hiện toast "Đã đặt lại mật khẩu cho «Mã». Hãy gửi mật khẩu mới cho nhân viên qua kênh an toàn." Dialog nhân viên vẫn mở; tab Lịch sử có thêm dòng mới.
5. **Lỗi:**
   - Lỗi trường: hiện dưới đúng ô.
   - 404 (tài khoản ngoài phạm vi): toast "Không tìm thấy tài khoản."
   - Lỗi mạng: toast lỗi chung; hộp thoại không đóng.

### 3.2 Lịch sử tài khoản

1. Trong dialog sửa nhân viên, người có `ADMIN_VIEW` thấy khối **Lịch sử**. Dữ liệu tải khi mở khối, mới nhất trước, mỗi lần 20 dòng; có nút **Xem thêm** nếu còn trang.
2. Mỗi dòng hiện: thời điểm (định dạng dùng chung `formatDateTime` của web, `HH:mm dd/mm/yyyy`, giống lịch sử hồ sơ), người thực hiện (họ tên; "Hệ thống" nếu không có), hành động bằng tiếng Việt (BR-05), ghi chú (`reason`).
3. Danh sách trống: "Chưa có lịch sử."

## 4. Quy tắc nghiệp vụ

- **BR-01:** Mật khẩu mới dài 8–72 ký tự, dùng `PASSWORD_LIMITS` và `passwordError` sẵn có ở web.
- **BR-02:** Hai ô mật khẩu phải trùng nhau. Chỉ kiểm ở client.
- **BR-03:** Đặt lại thành công thì mọi phiên của nhân viên bị đăng xuất (hành vi hiện có) và có một dòng audit `resetPassword`.
- **BR-04 (mới ở API):** Quản trị không được dùng reset-password cho **chính tài khoản đang đăng nhập**. API trả 400 `VALIDATION_ERROR`, `details.reason = self_reset_denied`, thông báo "Dùng chức năng Đổi mật khẩu cho tài khoản của bạn." Lý do: reset bỏ qua bước kiểm mật khẩu hiện tại; cùng nguyên tắc với quy tắc "không tự ngừng hoạt động" đang có.
- **BR-05:** Nhãn hành động:

  | Hành động | Nhãn |
  |---|---|
  | `createUser` | Tạo tài khoản |
  | `updateUser` | Cập nhật thông tin |
  | `deactivateUser` | Ngừng hoạt động |
  | `resetPassword` | Đặt lại mật khẩu |
  | khác | hiện nguyên mã hành động |

- **BR-06:** Mật khẩu không bao giờ được ghi vào log, URL, `localStorage` hay audit. Hiện API chỉ ghi mã tài khoản vào `reason`; quy tắc này giữ nguyên như vậy.

## 5. Tiêu chí nghiệm thu

| AC | Kiểm bằng | Nội dung |
|---|---|---|
| AC-1 | e2e API | Admin reset mật khẩu của `kt-a2`: trả 200; refresh token cũ của `kt-a2` trả 401; đăng nhập bằng mật khẩu cũ trả 401, bằng mật khẩu mới trả 200; có audit `resetPassword`. |
| AC-2 | e2e API | Reset tài khoản thuộc tòa ngoài phạm vi trả 404. Người không có `ACCOUNT_MANAGE` gọi thì trả 403. Mật khẩu 7 ký tự trả 400 lỗi trường `password`. |
| AC-3 | e2e API | Admin reset chính mình trả 400 `self_reset_denied`; mật khẩu không đổi. |
| AC-4 | e2e API | `GET /users/:id/audit` của một tài khoản vừa tạo, sửa và reset trả đủ 3 dòng, mới nhất trước, có `actorName`. |
| AC-5 | test web | Nút Đặt lại mật khẩu hiện khi sửa người khác ở chế độ `api`. Nút không hiện khi tạo mới, khi sửa chính mình, và ở chế độ `mock`. |
| AC-6 | test web | Ô trống, mật khẩu dưới 8 ký tự hoặc hai ô không khớp: báo lỗi dưới đúng ô, không gọi API. |
| AC-7 | test web | API trả 200: hiện toast; khối Lịch sử tải lại. |
| AC-8 | test web | Khối Lịch sử hiện nhãn tiếng Việt theo BR-05, có nút "Xem thêm" khi `meta.totalPages > 1`, hiện "Chưa có lịch sử." khi trống. |
| AC-9 | chạy thật trên trình duyệt | `admin-demo` reset mật khẩu của `kt-a2` trên web, xem dòng lịch sử mới; `kt-a2` đăng nhập được bằng mật khẩu mới. Có ảnh chụp. Sau đó đặt lại mật khẩu seed. |

## 6. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] `api-qltn`: e2e `catalog-admin` (nhóm accounts) cùng các test mới của reset và audit.
- [ ] `web`: test mới của `UserDialog`, hộp thoại reset và khối lịch sử.
- [ ] Lint, typecheck, format cho các file đã đổi.
- [ ] BR-06: mật khẩu không nằm trong audit, log hay URL (đọc code).
- [ ] Bằng chứng AC-9.

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 26/10/2026 | Bản đầu (PD-05). |
| 26/10/2026 | §3.2: định dạng thời điểm đổi sang `formatDateTime` dùng chung (dev-build hỏi, PM/BA chọn "shared"). |
