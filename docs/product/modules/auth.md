# Module `auth`: Đăng nhập, phiên, mật khẩu

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `641c8b5`):
- API: `api-qltn/src/modules/auth/*`, `src/common/auth/*`, `src/config/configuration.ts`, `src/bootstrap.ts`, `src/app.module.ts`.
- Web: `web/src/features/auth/*`, `src/services/http/{auth-api,client,token-store}.ts`, `src/store/session-store.ts`, `web/vercel.json`.
- Test: `api-qltn/test/auth.e2e-spec.ts`, `catalog-admin.e2e-spec.ts`.

**Liên quan nghiệp vụ:** nền tảng cho B17 (Nhân sự và phân quyền) và mọi module khác. D1 và D2 không mô tả riêng chức năng đăng nhập. Yêu cầu gián tiếp duy nhất là "truy cập theo quyền" (D1 sơ đồ 01, tr. 39 "kiểm quyền") và "web máy tính và điện thoại" (D2 mục 04).

## 1. Tính năng và trạng thái

| # | Tính năng | API | Web chế độ `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| AU-01 | Đăng nhập bằng tên đăng nhập **hoặc** email + mật khẩu | `POST /api/auth/login` | `PasswordLoginForm` | e2e: đăng nhập, sai mật khẩu, tài khoản đã khóa, kiểm tra body | Có |
| AU-02 | Trả hồ sơ người dùng kèm capability và phạm vi tòa | trong kết quả login; `GET /api/auth/me` | `fetchViewerProfile` | e2e: hồ sơ theo phạm vi tòa, không lộ hash | Có |
| AU-03 | Làm mới phiên bằng refresh token xoay vòng; dùng lại token cũ thì thu hồi mọi phiên | `POST /api/auth/refresh` | `client.ts`: khi gặp 401 thì refresh **một lần**, dùng chung cho mọi request đang chờ, rồi gọi lại | e2e: xoay token, phát hiện dùng lại | Có |
| AU-04 | Đăng xuất (thu hồi refresh token, gọi lại nhiều lần vẫn an toàn) | `POST /api/auth/logout` | `SidebarUser` → `signOut` | e2e | Có |
| AU-05 | Đổi mật khẩu của chính mình (đăng xuất mọi phiên) | `POST /api/auth/change-password`; mật khẩu mới phải khác mật khẩu cũ | `ChangePasswordDialog` từ `SidebarUser` | `auth-change-password.e2e-spec.ts` (AC-3, AC-4) | **Có**, qua AU-S1 (`9de70f3`, 26/10, chưa merge) |
| AU-06 | Khóa tài khoản có hiệu lực ngay: mỗi request đều đọc lại tài khoản | `JwtStrategy.validate` | — | e2e: access token bị từ chối ngay sau khi khóa | Có |
| AU-07 | Đổi vai trò hoặc phạm vi tòa có hiệu lực ngay | như AU-06 | — | e2e gián tiếp trong `catalog-admin` | Có |
| AU-08 | Đặt lại mật khẩu do quản trị (đăng xuất mọi phiên) | `POST /api/users/:id/reset-password`, thuộc module `users` | màn hình quản trị nhân viên | e2e trong `catalog-admin` | Có; phân tích chung với module `users` |
| AU-09 | Chọn tài khoản demo, không cần mật khẩu (chế độ `mock`) | — | `DemoAccountLogin` | `LoginPage.test.tsx` | Chỉ dùng cho demo |
| AU-10 | Quên mật khẩu (tự đặt lại qua email hoặc OTP) | không có | không có | — | **Chưa có**; nguồn khách chưa yêu cầu |

## 2. Quy tắc đang chạy (đọc từ code)

- **Mật khẩu:** độ dài 8–72 ký tự (`PASSWORD_MIN`, `PASSWORD_MAX`), không yêu cầu độ phức tạp. Băm bằng bcrypt với 12 vòng.
- **Chống dò tài khoản:** tên đăng nhập không tồn tại và sai mật khẩu trả **cùng một** lỗi `INVALID_CREDENTIALS`, tốn cùng thời gian (băm giả). Lỗi `ACCOUNT_INACTIVE` chỉ hiện khi đã nhập đúng mật khẩu.
- **Token:**
  - Access token JWT HS256, mặc định 3600 giây (`ACCESS_TOKEN_TTL_SECONDS`).
  - Refresh token là chuỗi ngẫu nhiên 32 byte; DB chỉ lưu hash SHA-256; mặc định 7 ngày (`REFRESH_TOKEN_TTL_DAYS`). Mỗi bản ghi lưu user-agent và IP.
  - Secret JWT dài tối thiểu 32 ký tự; thiếu thì service không khởi động.
- **Giới hạn tần suất:** login, refresh và đổi mật khẩu cho tối đa 10 request/phút trên mỗi IP. Toàn hệ thống 600 request/phút. `trust proxy = 1`.
- **Web:**
  - Token lưu trong `localStorage` (`qltn-api-session`).
  - CSP chặt trên Vercel: `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`.
  - Lỗi khi refresh thì xóa phiên, không để giao diện "nửa đăng nhập".
- **Nguồn dữ liệu của web:** chọn bằng `VITE_DATA_SOURCE`, **mặc định `mock`** (`web/.env.example`, `config/data-source.ts`).

## 3. Khoảng trống và rủi ro

Mức độ chỉ là đánh giá của PM/BA. Rủi ro bảo mật cần dev-review xác nhận.

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý đề xuất |
|---|---|---|---|---|
| AG-01 | ~~Người dùng không tự đổi mật khẩu trên web được, dù API đã có~~ **Đã xử lý ở AU-S1** | không file nào trong `web/src` gọi `change-password` | Cao cho vận hành thật | Thêm màn hình "Đổi mật khẩu" trong menu tài khoản |
| AG-02 | Quản trị tạo tài khoản hoặc đặt lại mật khẩu thì biết mật khẩu đó, và người dùng không bị buộc đổi ở lần đăng nhập đầu | `users` reset-password; login không có cờ "phải đổi mật khẩu" | Trung bình | Chờ khách chốt (AQ-01) |
| AG-03 | Sau khi đổi hoặc đặt lại mật khẩu, access token cũ ở thiết bị khác vẫn dùng được tối đa 1 giờ (chỉ refresh token bị thu hồi) | `JwtStrategy.validate` chỉ kiểm tài khoản còn hoạt động; không có mốc "đổi mật khẩu lúc" hay danh sách `jti` bị thu hồi | Thấp–Trung bình | Đề xuất kỹ thuật: lưu `passwordChangedAt` và từ chối token phát trước mốc đó. Cần ADR |
| AG-04 | Bản build web để mặc định dữ liệu là `mock`: chỉ cần chọn tài khoản demo, không cần mật khẩu | `.env.example`: `VITE_DATA_SOURCE=mock` | **Cao nếu deploy nhầm** | Bản deploy production bắt buộc `VITE_DATA_SOURCE=api`; thêm bước kiểm tra trong checklist release. Cần dev-build xác nhận cấu hình Vercel hiện tại |
| AG-05 | Giới hạn tần suất chỉ theo IP; không khóa tạm theo tài khoản khi sai mật khẩu nhiều lần | `AUTH_THROTTLE` | Thấp | Chờ khách chốt (AQ-02) |
| AG-06 | Refresh token hết hạn hoặc đã thu hồi không bao giờ bị xóa, nên bảng dữ liệu cứ lớn dần | `auth.service.ts` không có bước dọn | Thấp | Thêm job dọn định kỳ khi có hạ tầng job (BullMQ) |
| AG-07 | Token trong `localStorage` có thể bị đọc nếu web dính lỗi XSS | `token-store.ts` | Thấp nhờ CSP chặt | Ghi nhận; đổi sang cookie httpOnly là quyết định kiến trúc, cần ADR nếu muốn |
| AG-08 | ~~Chưa có test chứng minh đổi mật khẩu thu hồi phiên ở thiết bị khác~~ **Đã xử lý ở AU-S1 (AC-4)** | `catalog-admin.e2e-spec.ts` chỉ kiểm đăng nhập lại bằng mật khẩu mới | Thấp | Thêm e2e: phiên B dùng refresh token cũ thì nhận 401 |
| AG-09 | Chưa có nhật ký đăng nhập (thành công hoặc thất bại) xem được trên giao diện; chỉ lưu `last_login_at` và log server khi phát hiện dùng lại token | `markLoggedIn`; `logger.warn` | Chờ yêu cầu | Chờ khách chốt (AQ-03); D1 tr. 39 chỉ yêu cầu "lưu vết thay đổi" |

**Không có sai nghiệp vụ nào được xác nhận.** Nguồn khách không mô tả chi tiết đăng nhập, nên các điểm trên là khoảng trống so với một hệ thống vận hành thật, không phải lệch so với D1 hay D2.

## 4. Câu hỏi cho khách hoặc chủ dự án

| ID | Câu hỏi |
|---|---|
| AQ-01 | Tài khoản mới hoặc vừa được đặt lại mật khẩu có phải đổi mật khẩu ở lần đăng nhập đầu không? Có cần chức năng "Quên mật khẩu" tự phục vụ không? Nếu có, qua kênh nào? (Kênh nhắn tin ngoài bị loại trừ theo D1 tr. 45; email cần xác nhận.) |
| AQ-02 | Có yêu cầu chính sách mật khẩu không (độ phức tạp, thời hạn đổi), và có khóa tạm tài khoản sau N lần sai không? |
| AQ-03 | Ban quản trị có cần xem lịch sử đăng nhập (thời điểm, thiết bị, IP) của nhân viên không? |
| AQ-04 | Một người được đăng nhập đồng thời trên nhiều thiết bị không? Hiện hệ thống cho phép không giới hạn. |

## 5. Đề xuất việc tiếp theo

1. **AG-04:** xác minh ngay cấu hình deploy. Đây là việc kiểm tra, không phải tính năng mới; nhờ dev-build.
2. **AG-01:** viết SPEC nhỏ cho màn hình đổi mật khẩu. Phạm vi rõ, không chờ khách.
3. **AG-02, AG-05, AG-09:** gửi AQ-01–AQ-04 cho khách cùng đợt với phiếu L0.
4. **AG-03, AG-06, AG-07:** quyết định kỹ thuật, dev-build đề xuất qua ADR.
