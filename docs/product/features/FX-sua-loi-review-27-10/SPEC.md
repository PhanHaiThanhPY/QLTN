# SPEC: Sửa lỗi sau review 27/10 (FX-S1, FX-S2, FX-S3)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-17), gồm hai lựa chọn ở cuối §3 và §4
**Nguồn:** [review 27/10](../../../reviews/2026-10-27/review-tinh-nang-da-lam.md), các mục R-01, R-02, R-03, R-04, R-05, R-08.
**Căn cứ quyết định:** PD-16. Chủ dự án đồng ý cả ba đề xuất Q1–Q3 của bản review.
**Sửa vào các SPEC đã triển khai:**
- [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md): §3, §4.4, BR-S4-02, BR-S4-05, BR-S2 §4.2.
- [US-S1](../US-quan-tri-tai-khoan/SPEC.md).
- [RM](../RM-ma-tran-quyen-v2/SPEC.md): AC-1.3a.
- [AD-S1](../AD-nhat-ky-thao-tac/SPEC.md).

## 1. Mục tiêu

SPEC này sửa các lỗi review phát hiện trên `main` mà test hiện có không bắt được. Sửa xong thì:
- không hồ sơ nào kẹt ở trạng thái không có lối thoát;
- ADMIN không chiếm được tài khoản có phạm vi rộng hơn mình;
- BQL thấy đủ lịch sử tòa;
- file CSV xuất ra an toàn khi mở bằng Excel.

## 2. Phạm vi và thứ tự giao

| Slice | Nội dung | Ưu tiên |
|---|---|---|
| **FX-S1** | R-02: phạm vi khi ADMIN sửa hoặc đặt lại mật khẩu tài khoản khác | 1. Sửa nóng, slice nhỏ |
| **FX-S2** | R-01: quyết toán **bằng** tổng tạm ứng thì đóng được hồ sơ | 2 |
| **FX-S3** | R-03 (người giữ mọi bước), R-04 (PD-13 trên web), R-05 (CSV an toàn), R-08 (tràn số trong báo giá) | 3 |

Ba slice không phụ thuộc nhau, nên dev-build có thể làm song song trên các worktree riêng.

**Ngoài phạm vi:**
- Quyết toán **nhỏ hơn** tổng tạm ứng, tức nhà thầu phải hoàn tiền: vẫn chặn, chờ khách trả lời (OD-18).
- Giao lại người giữ bước khi tài khoản bị khóa (R-06): làm ở US-S2 theo DF-12.
- Xem hồ sơ theo phạm vi khu vực (R-07) và quyền xem nháp tờ trình (R-09): chờ chủ dự án quyết riêng.
- Các điểm Thấp còn lại (R-10, R-11, R-12) và test còn thiếu (R-13), trừ những test SPEC này yêu cầu.
- VT-01, VT-02.

## 3. FX-S1: Phạm vi quản trị tài khoản (R-02)

**Hiện trạng:** `user-admin.service.ts` coi tài khoản đích là "trong phạm vi" nếu có **ít nhất một** tòa nằm trong phạm vi người làm (`:77`, `:129`, `:182`). Vì vậy ADMIN của tòa A đặt lại được mật khẩu của ADMIN toàn hệ thống, rồi đăng nhập bằng tài khoản đó.

**Quy tắc:**
- **BR-FX1-01. Xem không đổi.** Danh sách và chi tiết tài khoản vẫn hiện tài khoản có ít nhất một tòa trong phạm vi, như hiện nay. Lý do: người quản lý tòa A cần thấy ai đang làm việc ở tòa A.
- **BR-FX1-02. Ghi cần phủ đủ phạm vi.** Mọi lệnh ghi lên một tài khoản khác chỉ được làm khi **mọi** tòa của tài khoản đó nằm trong phạm vi người làm. Hiện có hai lệnh ghi: `PATCH /users/:id` (gồm cả ngừng hoạt động) và `POST /users/:id/reset-password`.
  - Không thỏa thì trả **403** `account_scope_exceeded` với thông báo "Tài khoản này có tòa ngoài phạm vi của bạn nên bạn không sửa được."
  - Không ghi audit.
  - Thứ tự kiểm: không thấy tài khoản (404) → phạm vi (403) → `version` (409) → dữ liệu (400).
- **BR-FX1-03.** Logic giữ các tòa ngoài phạm vi khi sửa (`keptOutside`) không còn cần, vì sau BR-FX1-02 tài khoản đích không thể có tòa ngoài phạm vi. dev-build quyết định gỡ hay giữ.
- **BR-FX1-04. Web.** Trong dialog tài khoản, nếu tài khoản có tòa ngoài phạm vi người xem:
  - mọi ô ở chế độ chỉ đọc;
  - ẩn nút **Lưu** và **Đặt lại mật khẩu**;
  - hiện ghi chú "Tài khoản có tòa ngoài phạm vi của bạn: chỉ xem."

  Web tự tính điều này từ `buildingIds` của tài khoản so với phạm vi của phiên. API vẫn là lớp chặn chính.

**AC:**
- **AC-FX1.1** Tạo `admin-a`, ADMIN chỉ có tòa A. `admin-a` đặt lại mật khẩu `admin-demo` (có mọi tòa): trả 403 `account_scope_exceeded`, mật khẩu không đổi, không có audit, phiên của `admin-demo` vẫn còn.
- **AC-FX1.2** `admin-a` gọi `PATCH` lên `admin-demo` (đổi họ tên hoặc ngừng hoạt động): trả 403, dữ liệu không đổi.
- **AC-FX1.3** `admin-a` đặt lại mật khẩu và sửa một tài khoản chỉ có tòa A: thành công như US-S1 AC-1.
- **AC-FX1.4** `admin-a` vẫn thấy `admin-demo` trong danh sách và mở được chi tiết (BR-FX1-01).
- **AC-FX1.5** Web: `admin-a` mở `admin-demo` thì thấy dialog chỉ đọc theo BR-FX1-04. Có test component và ảnh chụp chế độ `api`.

## 4. FX-S2: Quyết toán bằng tổng tạm ứng (R-01)

**Hiện trạng:** `payments.service.ts:163-167` bắt số quyết toán **lớn hơn** tổng tạm ứng đã chuyển khoản. Ví dụ: được duyệt 10 tr, đã tạm ứng 10 tr, chi phí thực 10 tr. Khi đó không gửi được quyết toán, và hồ sơ kẹt mãi ở `PENDING_PAYMENT_REQUEST`. Ngoài ra DB có ràng buộc `CHK_repair_payments_amount` là `amount_vnd > 0`.

**Quy tắc (sửa B03 v2 §4.4, BR-S4-02, BR-S4-05):**
- **BR-FX2-01.** Số quyết toán phải lớn hơn **hoặc bằng** tổng tạm ứng đã chuyển khoản. Số của đợt quyết toán = số quyết toán − Σ tạm ứng đã chuyển, nên có thể bằng **0**.
- **BR-FX2-02. Số quyết toán nhỏ hơn tổng tạm ứng đã chuyển:** vẫn trả 400 lỗi trường `amountVnd`, với thông báo "Số quyết toán nhỏ hơn tổng tạm ứng đã chuyển khoản («X»). Hệ thống chưa hỗ trợ trường hợp nhà thầu hoàn lại tiền." Đây là cách xử lý tạm, chờ OD-18.
- **BR-FX2-03. Đợt quyết toán 0 đồng:**
  - Vẫn bắt buộc tệp `PAYMENT_REQUEST` và `INVOICE` (BR-S4-03), vì đây là chứng từ của toàn bộ chi phí.
  - Vẫn bắt buộc chữ ký BQL.
  - Vẫn đi qua đủ chuỗi duyệt PAYMENT (T19, T20).
  - Thông tin người hưởng (tên tài khoản, số tài khoản, ngân hàng) và nội dung chuyển khoản **không bắt buộc**. Nếu có nhập thì vẫn phải hợp lệ.
- **BR-FX2-04. Duyệt bước PAYMENT cuối của đợt 0 đồng:**
  - Đợt chuyển thẳng sang `TRANSFERRED`, không qua `PENDING_TRANSFER`.
  - `confirmedBy` và `confirmedAt` để trống. Audit ghi lý do "Không cần chuyển khoản: số của đợt bằng 0".
  - Hồ sơ sang `PENDING_PAYMENT` như T19.
  - BQL đóng hồ sơ bằng T22. BR-S4-05 không đổi: Σ đã chuyển = số quyết toán.
  - Không có thao tác xác nhận chuyển khoản (T21) cho đợt này. Gọi T21 thì trả 409 như với đợt đã chuyển.
- **BR-FX2-05. DB:** ràng buộc số tiền được nới thành `amount_vnd > 0 OR (kind = 'QUYET_TOAN' AND amount_vnd = 0)`. Đợt tạm ứng vẫn phải > 0. Cần một migration mới; không sửa migration cũ.
- **BR-FX2-06. Web** (màn thanh toán chế độ `api`):
  - Cách tính hiện "10.000.000 − 10.000.000 = 0 đ · Không cần chuyển khoản".
  - Các ô người hưởng ghi "(không bắt buộc)".
  - Khi đợt ở trạng thái đã chuyển, không hiện nút xác nhận chuyển khoản; nhãn trạng thái là "Không cần chuyển khoản".

**AC:**
- **AC-FX2.1** Được duyệt 10 tr. Tạm ứng 10 tr đã chuyển khoản. Gửi quyết toán 10 tr, có đủ tệp và chữ ký, không nhập người hưởng: được nhận, số của đợt là 0. BQT duyệt: đợt `TRANSFERRED`, hồ sơ `PENDING_PAYMENT`. BQL đóng hồ sơ: hồ sơ `COMPLETED`.
- **AC-FX2.2** Như AC-FX2.1 nhưng quyết toán 9 tr: trả 400 lỗi trường `amountVnd` với thông báo của BR-FX2-02.
- **AC-FX2.3** Đợt 0 đồng đang `TRANSFERRED`, gọi `confirmPaymentTransfer`: trả 409, không có audit.
- **AC-FX2.4** Hồi quy: AC-4.3 và AC-4.4 của B03 v2 (tạm ứng 4 tr, quyết toán 10 tr và 9 tr) vẫn đạt.
- **AC-FX2.5** Có unit test cho phép tính số của đợt quyết toán, gồm các trường hợp > 0, = 0 và < 0 (bị chặn). Đây cũng là test còn thiếu ở §8 của B03 v2 (R-13).
- **AC-FX2.6** Ảnh chụp chế độ `api` của luồng AC-FX2.1 trên web.

## 5. FX-S3: Các lỗi còn lại

### 5.1 Người giữ mọi bước (R-03)

**Hiện trạng:** khi tạo hồ sơ, hệ thống chỉ chụp định nghĩa bước và người giữ bước cho các bước trong `approvalStepKeys`, tức chuỗi tờ trình (`records.service.ts:159-165`, `:254`). Nếu một bước tùy chỉnh chỉ nằm ở ACCEPTANCE hoặc PAYMENT, `stepHolderOf` trả `null` và không ai quyết định được bước đó. Điều này lệch §3 của B03 v2 ("bản đồ người giữ cho mọi bước").

- **BR-FX3-01.** Khi tạo hồ sơ, chụp định nghĩa và người giữ cho **mọi bước của mọi giai đoạn** trong `workflowStages` (INTAKE, PROPOSAL, ACCEPTANCE, PAYMENT). Người giữ được chọn theo cùng quy tắc giao việc như hiện nay. Một bước xuất hiện ở nhiều giai đoạn thì dùng cùng một người giữ.
- **BR-FX3-02. Kiểm trước khi vào giai đoạn.** Khi gửi nghiệm thu (T12, T16), gửi quyết toán (T18) hoặc gửi tạm ứng (A1, A1b), mọi bước của giai đoạn tương ứng phải có người giữ đang hoạt động và có quyền của giai đoạn đó. Đây là cùng cách BR-S2-04 làm cho tờ trình.
  - Không thỏa thì trả 409 `step_holder_missing`, với thông báo "Bước «tên bước» chưa có người xử lý hợp lệ. Liên hệ quản trị để giao người."
  - Không đổi trạng thái hồ sơ.
  - Như vậy hồ sơ báo lỗi rõ ràng thay vì kẹt im lặng. Việc giao lại người giữ làm ở US-S2 (R-06).
- **BR-FX3-03.** Hồ sơ đã tạo trước bản sửa giữ nguyên snapshot cũ (giống AC-0.2). Với hồ sơ cũ thiếu người giữ bước tùy chỉnh, BR-FX3-02 trả 409 thay vì để kẹt. Không có migration dữ liệu hồ sơ.

**AC:**
- **AC-FX3.1** Tòa có PAYMENT = `[CUSTOM_X, BOARD]`, trong đó `CUSTOM_X` gắn vai trò có quyền `PAYMENT_DECIDE` và có người khớp quy tắc giao việc. Tạo hồ sơ mới rồi đi hết đến quyết toán: người giữ `CUSTOM_X` duyệt, sau đó BQT duyệt, hồ sơ sang `PENDING_PAYMENT`.
- **AC-FX3.2** Như AC-FX3.1 nhưng người giữ `CUSTOM_X` bị ngừng hoạt động trước khi gửi quyết toán: gửi trả 409 `step_holder_missing`, trạng thái hồ sơ không đổi.
- **AC-FX3.3** Như AC-FX3.1 cho ACCEPTANCE = `[MANAGER, CUSTOM_Y]`: nghiệm thu đạt khi cả hai bước đã đạt.
- **AC-FX3.4** Hồi quy: các e2e của S2, S3, S4 trên mẫu AQUA và STANDARD vẫn đạt.

### 5.2 BQL xem lịch sử cấu hình tòa (R-04, PD-13)

**Hiện trạng:** API đã mở lịch sử tòa cho BQL, nhưng web lọc chỉ còn các hành động về vị trí (`LocationsPage.tsx:36`). Vì vậy BQL không thấy ai đã áp mẫu hay sửa workflow.

- **BR-FX3-04.** Trên màn Vị trí, đổi thẻ "Lịch sử thay đổi vị trí" thành **"Lịch sử thay đổi tòa"** và hiện mọi sự kiện của tòa mà API trả về: vị trí, cấu hình, workflow, thông tin tòa. Thẻ chỉ đọc, giữ đúng tinh thần PD-13 ("dùng màn hiện có").
  - Nếu cần, có bộ lọc nhanh "Tất cả / Vị trí / Cấu hình".
  - Nhãn hành động dùng `audit-labels` có sẵn.

**AC:**
- **AC-FX3.5** ADMIN áp mẫu cấu hình cho tòa A. BQL tòa A mở màn Vị trí thì thấy dòng "áp mẫu cấu hình" kèm người làm và thời điểm.
- **AC-FX3.6** Test component thay cho `LocationsPage.history.test.tsx`: thẻ hiện cả sự kiện vị trí và sự kiện cấu hình.

### 5.3 CSV an toàn (R-05)

**Hiện trạng:** `csvCell` (`audit-log.service.ts:111`) không xử lý các ô bắt đầu bằng `=`, `+`, `-` hoặc `@`. Excel có thể chạy những ô này như công thức.

- **BR-FX3-05.** Mọi ô trong file CSV xuất ra có ký tự đầu là `=`, `+`, `-`, `@`, tab hoặc CR thì được thêm dấu `'` vào đầu, sau đó mới áp quy tắc bọc ngoặc kép như hiện nay. Quy tắc áp cho mọi cột, không chỉ cột lý do.
  - Tiền và số đứng một mình (ví dụ `-5`) cũng bị thêm `'`. Chấp nhận điều này, vì file nhật ký không dùng để tính toán.

**AC:**
- **AC-FX3.7** Unit test: `=HYPERLINK("x")` thành `"'=HYPERLINK(""x"")"`; `+1` thành `'+1`; `@a` thành `'@a`; `abc` giữ nguyên.
- **AC-FX3.8** e2e: một dòng audit có lý do `=1+1`. Xuất CSV thì ô lý do bắt đầu bằng `'=`.

### 5.4 Tràn số trong báo giá (R-08)

**Hiện trạng:**
- Đơn giá tối đa 15 chữ số, số lượng tối đa 9 chữ số phần nguyên. Tích của hai số có thể vượt giới hạn của cột `bigint`, nên lưu trả lỗi 500.
- Báo giá mà mọi đơn giá đều bằng 0 vẫn trình được, và số được duyệt khi đó là 0.

- **BR-FX3-06.** Mỗi thành tiền, tổng mỗi nhà thầu và số được duyệt phải ≤ **999.999.999.999.999** VND (15 chữ số, giống `VND_PATTERN`). Vượt thì trả 400 lỗi theo trường của dòng hoặc nhà thầu: "Số tiền vượt giới hạn hệ thống."
  - Kiểm ở lúc lưu nháp (T04) và lúc trình (T05, T06).
  - Không bao giờ trả 500.
- **BR-FX3-07.** Khi trình (T05, T06), tổng của mỗi nhà thầu phải > 0. Bằng 0 thì trả 400: "Tổng báo giá của nhà thầu phải lớn hơn 0." Lưu nháp vẫn cho phép tổng bằng 0.

**AC:**
- **AC-FX3.9** Unit test `proposal-quote`: một dòng có đơn giá `999999999999999` và số lượng `999999999` bị báo lỗi vượt giới hạn, không ném lỗi tràn.
- **AC-FX3.10** e2e: trình báo giá có tổng bằng 0 trả 400; lưu nháp cùng dữ liệu đó trả 200.

## 6. Chung cho cả ba slice

- **BR-FX-C1.** Giữ nguyên BR-C-01: khóa phiên bản và audit trong cùng transaction.
- **BR-FX-C2.** Mã lỗi mới (`account_scope_exceeded`, `step_holder_missing`) có nhãn tiếng Việt trên web và được hiện qua toast hoặc lỗi theo trường như các mã hiện có.
- **BR-FX-C3.** Mỗi slice có `handoff.md` riêng trong thư mục này, theo mẫu các slice trước.

## 7. Checklist test cho dev-review

Chỉ chạy test liên quan, không chạy toàn bộ suite.

- [ ] FX-S1: e2e `users-reset-password` và nhóm users của `catalog-admin`; test component `UserDialog`.
- [ ] FX-S2: e2e `record-payments`, kèm AC-4.x hồi quy; unit test phép tính quyết toán; migration chạy trên DB có dữ liệu S4 cũ.
- [ ] FX-S3: e2e `record-proposals`, `record-construction`, `record-payments` (bước tùy chỉnh); e2e `audit-log` (CSV); unit test `proposal-quote` và `csvCell`; test `LocationsPage`.
- [ ] Ảnh chụp chế độ `api`: AC-FX1.5, AC-FX2.6, AC-FX3.5.

## 8. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ bản review 27/10, theo PD-16. |
| 27/10/2026 | Chủ dự án duyệt (PD-17) và cho giao dev-build ngay. Giữ hai lựa chọn: hồ sơ 0 đồng vẫn do BQL bấm đóng (T22); quyền xem tài khoản không đổi (BR-FX1-01). |
| 27/10/2026 | FX-S1 triển khai, review đạt và đóng; merge vào `main` theo yêu cầu của chủ dự án. FX-S2, FX-S3 đang review. |
| 27/10/2026 | FX-S2 triển khai, review đạt và đóng; merge vào `main`. |
