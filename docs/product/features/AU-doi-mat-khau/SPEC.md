# SPEC — Đổi mật khẩu của chính mình trên web (module auth, AU-S1)

**Chủ sở hữu:** PM/BA (`dev-pm-ba@qltn`) · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Đã duyệt`
**Người duyệt:** chủ dự án, duyệt bổ sung ngày 26/10/2026 (PD-11). Bản build ban đầu được giao theo PD-05 (PM/BA tự duyệt)
**Nguồn:** [phân tích module auth](../../modules/auth.md): AG-01, AG-08

## 1. Mục tiêu

Người dùng ở chế độ `api` tự đổi được mật khẩu của mình trên web. API `POST /api/auth/change-password` đã có; hiện chưa có màn hình nào gọi API này.

## 2. Phạm vi

**Trong phạm vi**
- Màn hình hoặc hộp thoại "Đổi mật khẩu" mở từ khối tài khoản ở cuối sidebar (`SidebarUser`).
- Một quy tắc mới ở API: mật khẩu mới phải khác mật khẩu hiện tại (BR-03).
- Test e2e chứng minh mọi phiên bị đăng xuất (AG-08).

**Ngoài phạm vi**
- Bắt đổi mật khẩu ở lần đăng nhập đầu, quên mật khẩu, chính sách độ phức tạp, khóa tạm tài khoản: chờ AQ-01 và AQ-02.
- Thu hồi access token còn hạn (AG-03): cần ADR.
- Chế độ `mock`: ở chế độ này **không hiện** mục "Đổi mật khẩu".

## 3. Luồng

1. Người dùng đã đăng nhập (chế độ `api`) bấm "Đổi mật khẩu" ở khối tài khoản. Sidebar thu gọn hay mở rộng đều phải có lối vào.
2. Form gồm ba trường bắt buộc: **Mật khẩu hiện tại**, **Mật khẩu mới**, **Nhập lại mật khẩu mới**. Cả ba đều là ô mật khẩu (ẩn ký tự) và có nút hiện/ẩn.
3. Người dùng bấm **Lưu**. Web kiểm tra phía client (BR-01, BR-02, BR-03) rồi gọi `POST /api/auth/change-password { currentPassword, newPassword }`.
4. **Thành công:** web xóa phiên cục bộ (giống đăng xuất), chuyển về `/login` và hiện toast "Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới." Lý do: API đã thu hồi mọi refresh token, kể cả của phiên hiện tại.
5. **Lỗi:**
   - Sai mật khẩu hiện tại (400, lỗi trường `currentPassword`): hiện dưới ô **Mật khẩu hiện tại**, giữ nguyên các ô đã nhập.
   - Lỗi trường khác: hiện dưới đúng ô.
   - 429 (vượt giới hạn tần suất): toast "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút."
   - Lỗi mạng: toast lỗi chung; form không đóng.
6. **Hủy:** đóng form, không gọi API.

## 4. Quy tắc nghiệp vụ

- **BR-01:** Mật khẩu mới dài 8–72 ký tự, khớp `PASSWORD_MIN`/`PASSWORD_MAX` của API. Thông báo: "Mật khẩu mới phải từ 8 đến 72 ký tự."
- **BR-02:** "Nhập lại mật khẩu mới" phải trùng "Mật khẩu mới". Chỉ kiểm phía client, không gửi lên API. Thông báo: "Mật khẩu nhập lại không khớp."
- **BR-03:** Mật khẩu mới phải khác mật khẩu hiện tại. Kiểm **cả ở client và ở API**.
  - API so mật khẩu mới với hash hiện tại **sau khi** đã xác nhận mật khẩu hiện tại đúng.
  - Nếu trùng, API trả 400 `VALIDATION_ERROR`, lỗi trường `newPassword`: "Mật khẩu mới phải khác mật khẩu hiện tại."
- **BR-04:** Đổi thành công thì mọi phiên của tài khoản bị đăng xuất (hành vi hiện có của API). Thao tác chỉ được tính là thành công sau khi API trả 200; trước đó web không xóa phiên.
- **BR-05:** Mật khẩu không bao giờ được ghi vào log, URL hay `localStorage`.

## 5. Tiêu chí nghiệm thu

| AC | Kiểm bằng | Nội dung |
|---|---|---|
| AC-1 | test web | Ở chế độ `api`, khối tài khoản có mục "Đổi mật khẩu" (cả khi sidebar thu gọn). Ở chế độ `mock`, mục này không xuất hiện. |
| AC-2 | test web | Bỏ trống một trong ba ô, mật khẩu mới dưới 8 hoặc trên 72 ký tự, ô nhập lại không khớp, hoặc mật khẩu mới trùng mật khẩu hiện tại: báo lỗi dưới đúng ô và **không** gọi API. |
| AC-3 | e2e API | Mật khẩu hiện tại đúng nhưng mật khẩu mới trùng mật khẩu hiện tại: 400, lỗi trường `newPassword`, mật khẩu không đổi (vẫn đăng nhập được bằng mật khẩu cũ). |
| AC-4 | e2e API | Hai phiên A và B của cùng tài khoản. A đổi mật khẩu thành công. Sau đó `POST /auth/refresh` bằng refresh token của B trả 401; đăng nhập bằng mật khẩu cũ trả 401; đăng nhập bằng mật khẩu mới trả 200. |
| AC-5 | test web | API trả 400 lỗi `currentPassword`: lỗi hiện dưới ô Mật khẩu hiện tại, form vẫn mở, phiên chưa bị xóa. |
| AC-6 | test web | API trả 200: phiên cục bộ bị xóa, chuyển về `/login`, hiện toast thành công. |
| AC-7 | test web | API trả 429: hiện toast giới hạn tần suất, form vẫn mở. |
| AC-8 | chạy thật trên trình duyệt | `kt-a2` đổi mật khẩu trên web ở chế độ `api`, bị đưa về `/login`, đăng nhập lại được bằng mật khẩu mới. Có ảnh chụp. Sau khi kiểm, đặt lại mật khẩu seed bằng tài khoản admin. |

## 6. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] `api-qltn`: e2e của auth và catalog-admin (phần change-password); unit test nếu thêm.
- [ ] `web`: các test mới của form đổi mật khẩu và `SidebarUser`; test hiện có của `LoginPage`.
- [ ] Lint, typecheck và format cho các file đã đổi.
- [ ] Mật khẩu không xuất hiện trong log console, request URL hay `localStorage` (BR-05). Kiểm bằng cách đọc code.
- [ ] Bằng chứng AC-8 (ảnh chụp, các bước).
