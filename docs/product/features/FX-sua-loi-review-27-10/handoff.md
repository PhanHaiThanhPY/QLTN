# Handoff: FX-S1, FX-S2, FX-S3 (sửa lỗi sau review 27/10)

**Gói việc:** [SPEC.md](SPEC.md), trạng thái `Đã duyệt` (PD-17). Phát hiện gốc nằm ở [review 27/10](../../../reviews/2026-10-27/review-tinh-nang-da-lam.md).

**Cách làm:**
- Ba slice độc lập. Mỗi slice làm trên nhánh và worktree riêng, tách từ `main` (`fb4fd7a` hoặc mới hơn). Gợi ý tên nhánh: `fix/fx-s1-account-scope`, `fix/fx-s2-zero-settlement`, `fix/fx-s3-review-fixes`.
- Thứ tự ưu tiên: FX-S1 → FX-S2 → FX-S3. Làm song song cũng được.
- **Không đụng cây thư mục chung.** Trong đó đang có thay đổi chưa commit ở màn đăng nhập (`LoginShell.tsx`, `PasswordLoginForm.tsx`, `login-hero.png`); đó không phải việc của gói này.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy các test liên quan (§7 của SPEC).

## Ghi chú cho dev-build (PM/BA)

**FX-S1**
- Có ba chỗ dùng `some(...)`: `user-admin.service.ts:77`, `:129`, `:182`. Chỉ đổi hai lệnh ghi (`:129` và `:182`) sang kiểm "mọi tòa"; `get` (`:77`) giữ nguyên theo BR-FX1-01.
- Thứ tự kiểm lỗi: 404 → 403 → 409 → 400.
- Seed hiện chưa có ADMIN nào chỉ quản lý một phần tòa. Test tạo tài khoản đó, không thêm vào seed demo.

**FX-S2**
- Cần một migration mới để nới `CHK_repair_payments_amount`. Không sửa migration `2026-10-26g`.
- Ở `payments.service.ts:163-167`, đổi điều kiện thành `settlement < advances` và dùng thông báo của BR-FX2-02.
- Khi duyệt bước PAYMENT cuối của đợt 0 đồng, đợt đi thẳng sang `TRANSFERRED`.
- Các trường người hưởng chỉ không bắt buộc khi số của đợt bằng 0.

**FX-S3**
- R-03: ở `records.service.ts`, `workflowApprovalStepsOf` và `defaultWorkflowApprovers` mới chụp các bước trong `approvalStepKeys`. Cần chụp đủ bước của cả 4 giai đoạn trong `workflowStages`.
  - Kiểm `step_holder_missing` theo cùng cách `proposals.service.ts:390-405` đang làm cho tờ trình.
  - `MANAGER` lấy từ `managerUserId`, không nằm trong bản đồ người giữ bước.
- R-04: `web/src/features/buildings/LocationsPage.tsx:36`.
- R-05: `csvCell` ở `audit-log.service.ts:111`.
- R-08: `proposal-quote.ts`. Kiểm giới hạn số tiền trước khi lưu, để không còn lỗi 500.

**Nếu thấy SPEC chưa rõ:** chỉ hỏi PM/BA khi việc làm rõ có thể đổi ý định nghiệp vụ. Còn lại thì cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build ghi theo từng slice: nhánh, commit, AC → bằng chứng, các test đã chạy, ảnh chụp)._

### FX-S1 — `fix/fx-s1-account-scope` (worktree `../QLTN-fx-s1`)

Commit: `30a08bf` (API + web), `ce00268` (nút "Xem" trên danh sách + bằng chứng). Tách từ `main` `fb4fd7a`.

| AC | Bằng chứng |
|---|---|
| AC-FX1.1 | e2e `users-reset-password` › FX-S1 AC-FX1.1: 403 `account_scope_exceeded`, đúng thông báo, refresh token của admin-demo vẫn dùng được, số dòng audit không đổi. |
| AC-FX1.2 | e2e AC-FX1.2: đổi họ tên, ngừng hoạt động, và cả `version` cũ đều trả 403 (phạm vi kiểm trước version). Dữ liệu và audit không đổi. |
| AC-FX1.3 | e2e AC-FX1.3: ADMIN-A sửa và đặt lại mật khẩu KT-A (chỉ tòa A) → 200; audit ghi người làm là ADMIN-A. |
| AC-FX1.4 | e2e AC-FX1.4: danh sách và chi tiết vẫn trả admin-demo. |
| AC-FX1.5 | `UserDialog.account-tools.test.tsx` (dialog chỉ đọc: ghi chú, `fieldset` bị khóa, không có Lưu hay Đặt lại mật khẩu, nút Đóng), `AccountsCard.scope.test.tsx` (nút trên dòng: Xem / Sửa / không có), ảnh `supporting/evidence/FX-S1-1-admin-a-opens-admin-demo-read-only.png` (script `supporting/fx-s1-ui-check.mjs`, tài khoản thử `TEST-ADMIN-A`). |

Quyết định của dev-build:
- BR-FX1-03: **gỡ** `keptOutside` ở API và ở mock (`account-handlers.ts`). Test mock cũ "giữ tòa ngoài phạm vi khi sửa" được thay bằng test 403.
- Trước đây danh sách không có nút nào trên dòng tài khoản ADMIN, nên AC-FX1.5 không làm được qua giao diện. Nay dòng có tòa ngoài phạm vi người xem hiện nút **"Xem"** (gồm cả ADMIN) và mở dialog chỉ đọc. ADMIN trong phạm vi vẫn không có nút như cũ.
- Mã lỗi mới: web hiện thẳng thông báo của API qua toast, giống các mã hiện có; không có bảng nhãn riêng.

Test đã chạy: e2e `users-reset-password` + `catalog-admin` 36/36; web `tsc -b`; vitest `src/features/admin` + `review-fixes` + `config-and-emergency` + `command-adapter` (9 file, 109 test) và lần chạy lại `src/features/admin` 30/30; api `format:check`, eslint, `tsc --noEmit`.

### Kết quả review độc lập — FX-S1 (dev-review, 27/10/2026)

**Kết luận: PASS WITH RESIDUE → handoff PM/BA close.** Không phát hiện finding cần sửa.

- API: `npm test` → 8 suites / 54 tests đạt; `E2E_POSTGRES_DB=qltn_review_fx_s1_e2e SEED_DEMO_PASSWORD='(đã cấp qua env)' npm run test:e2e -- --runTestsByPath test/users-reset-password.e2e-spec.ts test/catalog-admin.e2e-spec.ts` → 2 suites / 36 tests đạt.
- Web: `npm test` → 56 files / 393 tests đạt; `npm run typecheck` → đạt.
- Chất lượng: API `npm run format:check`, `npm run lint`, `npm run typecheck` đều đạt; `git diff --check fb4fd7a..ce00268` và `node --check docs/product/features/FX-sua-loi-review-27-10/supporting/fx-s1-ui-check.mjs` đều đạt.
- AC-FX1.1–1.4 được kiểm bằng e2e thật trên DB cô lập: 403 `account_scope_exceeded` trước version validation, không đổi dữ liệu/audit, account rộng vẫn xem được, account chỉ tòa A vẫn sửa/reset được.
- AC-FX1.5 được kiểm bằng `UserDialog.account-tools.test.tsx`, `AccountsCard.scope.test.tsx` và ảnh `supporting/evidence/FX-S1-1-admin-a-opens-admin-demo-read-only.png`: dòng ADMIN-DEMO hiện **Xem**, dialog có ghi chú chỉ xem, fieldset disabled, không có Lưu/Đặt lại mật khẩu.
- Residue: chưa rerun live browser trên đúng worktree FX-S1 vì `agent-browser` không có trong PATH; Chrome tab QLTN hiện đang trỏ server cây chung, không phải candidate. Ảnh bằng chứng và test component đã được xem độc lập; cần giữ giới hạn này khi đóng packet.

### Đóng FX-S1 (PM/BA, 27/10/2026)

- **FX-S1 đóng.** Review đạt (PASS WITH RESIDUE). Cả 5 AC (AC-FX1.1–1.5) đều có bằng chứng ở trên.
- **Residue được chấp nhận:** chưa chạy lại trình duyệt trên đúng bản ứng viên. Bù lại đã có ảnh chụp và test component, đã được kiểm độc lập. Đây cũng là giới hạn lặp lại của seat review (không có Chrome riêng).
- Chủ dự án yêu cầu merge vào `main` để tự kiểm (27/10/2026).

### FX-S2 — `fix/fx-s2-zero-settlement` (worktree `../QLTN-fx-s2`)

Commit: `5bf84fc` (API + migration + web), `cd94906` (bằng chứng). Tách từ `main` `fb4fd7a`.

| AC | Bằng chứng |
|---|---|
| AC-FX2.1 | e2e `record-payments` › FX-S2 AC-FX2.1/2.3: tạm ứng 10 tr → quyết toán 10 tr không có người hưởng → đợt 0 đ `PENDING_APPROVAL`; BQT duyệt → `TRANSFERRED`, `confirmedBy`/`confirmedAt` null, hồ sơ `PENDING_PAYMENT`, audit approvePayment có "Không cần chuyển khoản: số của đợt bằng 0"; T22 → `COMPLETED`, đã chuyển 10 tr. Vẫn bắt buộc hóa đơn và vẫn kiểm định dạng số tài khoản nếu có nhập. |
| AC-FX2.2 | e2e AC-FX2.2: 9 tr → 400 `amountVnd` với đúng thông báo BR-FX2-02. |
| AC-FX2.3 | e2e (cùng ca AC-FX2.1): T21 → 409 `payment_already_confirmed`, số dòng audit không đổi. |
| AC-FX2.4 | e2e AC-4.3, AC-4.4, AC-4.6, BR-S4-05, AC-0.1 vẫn đạt (8/8 cả suite). Thêm ca BR-FX2-03: đợt > 0 thiếu người hưởng → 400 ở 3 trường. |
| AC-FX2.5 | unit `src/domain/payment-settlement.spec.ts`: > 0, = 0, < 0 (bị chặn), số lớn hơn giới hạn float. |
| AC-FX2.6 | ảnh `supporting/evidence/FX-S2-1-bql-settlement-equal-to-advances.png`, `FX-S2-2-bqt-approved-no-transfer.png`, `FX-S2-3-bql-record-completed.png` (script `supporting/fx-s2-ui-check.mjs`, hồ sơ SC-016 và SC-017). Test web: `payment.test.ts` (nhãn), `InstalmentCard.test.tsx`. |

- Migration `2026-10-27a-zero-settlement.sql` nới `CHK_repair_payments_amount` (entity `@Check` cũng sửa theo).
  - Đã chạy thử trên `qltn_dev` có 3 đợt S4 trong một transaction rồi rollback: chạy được.
  - Sau đó migration đã được áp thật vào `qltn_dev` lúc API từ worktree khởi động (02:59Z).
- Người hưởng chỉ không bắt buộc khi số quyết toán bằng đúng tổng tạm ứng đã chuyển, tức số của đợt bằng 0. Dialog vẫn điền sẵn thông tin người hưởng từ đợt tạm ứng như trước.

Test đã chạy: e2e `record-payments` 8/8; unit `src/domain` 34/34; web `tsc -b`; vitest `payment.test.ts` + `src/features/records` (9 file, 28 test); api `format:check`, eslint, `tsc --noEmit`.

### FX-S3 — `fix/fx-s3-review-fixes` (worktree `../QLTN-fx-s3`)

Commit: `b51fb9a` (R-05 + R-08), `46267c5` (R-04, web), `7765cd7` (R-03), `75251a6` (bằng chứng). Tách từ `main` `fb4fd7a`. Làm theo yêu cầu trực tiếp của chủ dự án; FX-S3 chưa có qitem riêng.

| AC | Bằng chứng |
|---|---|
| AC-FX3.1 | e2e mới `stage-holders` › AC-FX3.3 → AC-FX3.1: tòa A trên AQUA, PAYMENT = `[CUSTOM_X, BOARD]`. `CUSTOM_X` dùng vai trò tùy chỉnh dẫn xuất từ BQT, có một tài khoản `KSC-A`. BQT duyệt trước thì bị 403 `not_step_assignee`; KSC-A duyệt → bước BOARD; BQT duyệt → `PENDING_PAYMENT`. |
| AC-FX3.2 | e2e AC-FX3.2: ngừng hoạt động KSC-A rồi gửi quyết toán → 409 `step_holder_missing` với đúng thông báo; trạng thái và `version` của hồ sơ không đổi. |
| AC-FX3.3 | e2e (cùng ca AC-FX3.1): ACCEPTANCE = `[MANAGER, CUSTOM_Y]`; BQL đạt thì hồ sơ vẫn chờ; KSC-A đạt thì sang `PENDING_PAYMENT_REQUEST`. |
| AC-FX3.4 | e2e `record-confirmations`, `record-proposals`, `record-construction`, `record-payments`, `rm-s2-intake-config`, `stage-holders`: 6 suite, 41/41. Kiểm đột biến: bỏ phần chụp đủ bước ở `records.service.ts` thì `stage-holders` đỏ 2/2. |
| AC-FX3.5 | ảnh `supporting/evidence/FX-S3-1-bql-sees-template-in-building-history.png` (script `supporting/fx-s3-ui-check.mjs`): ADMIN áp lại STANDARD cho tòa A, BQL thấy "Áp dụng cấu hình mẫu" kèm người làm, thời điểm và lý do. |
| AC-FX3.6 | `LocationsPage.history.test.tsx` (thay test cũ): thẻ "Lịch sử thay đổi tòa" hiện cả sự kiện vị trí lẫn cấu hình; bộ lọc Vị trí / Cấu hình lọc đúng. |
| AC-FX3.7 | unit `src/modules/audit/csv-cell.spec.ts`: 9 trường hợp, gồm cả 4 trường hợp trong AC. |
| AC-FX3.8 | e2e `audit-log` › AC-FX3.8: lý do `=1+1` → ô thứ 9 là `'=1+1` (8/8 cả suite). |
| AC-FX3.9 | unit `proposal-quote.spec.ts` › quotation bounds: `999999999999999 × 999999999` được báo vượt giới hạn và không tràn số. Có thêm ca tổng vượt giới hạn và ca giá trị sai định dạng. |
| AC-FX3.10 | e2e `record-proposals` › FX-S3 R-08: trình với tổng bằng 0 → 400 `contractors.N.totalVnd` cho cả 3 nhà thầu; lưu nháp → 200. Vượt 15 chữ số → 400 ở `contractors.0.unitPricesVnd.0` hoặc `contractors.0.totalVnd`, lúc lưu nháp và lúc trình, không có 500 (13/13). |

Quyết định của dev-build:
- **R-03.**
  - Hồ sơ chụp định nghĩa của mọi bước thuộc chuỗi tờ trình và 4 giai đoạn. Danh sách được bỏ trùng, nên mỗi bước chỉ có một người giữ.
  - `MANAGER` vẫn lấy từ `managerUserId`.
  - Việc kiểm người giữ dùng `isActiveUserForApprovalStep`, đúng như cách BR-S2-04 kiểm (đang hoạt động, đúng vai trò, trong phạm vi). Quyền của giai đoạn đã được kiểm ở lúc lưu cấu hình (bước tùy chỉnh so với quyền của vai trò).
  - PAYMENT rỗng thì dùng `[BOARD]` như chuỗi của đợt thanh toán; logic này nay nằm chung ở `stage-holders.ts`.
  - Kiểm người giữ chạy ngay sau khi tải hồ sơ, nên lỗi 409 đến trước lỗi dữ liệu.
- **R-04.** Nhãn hành động dùng bảng nhãn có sẵn của timeline: `applyConfigTemplate` hiện là "Áp dụng cấu hình mẫu", chưa đổi thành "Áp mẫu cấu hình" (khác với `audit-labels` của màn Nhật ký). Có bộ lọc nhanh Tất cả / Vị trí / Cấu hình. Sự kiện thông tin tòa chỉ hiện ở "Tất cả".
- **R-08.** Lỗi tổng nhà thầu nằm ở trường `contractors.N.totalVnd`, web hiện qua danh sách lỗi chung. Tổng vượt giới hạn chỉ báo khi không dòng nào vượt, để không báo trùng.
- **Mã lỗi mới** (`step_holder_missing`): web hiện thẳng thông báo của API.

Test đã chạy: unit `src/domain` + `csv-cell`; e2e như bảng; web `tsc -b`, vitest `src/features/buildings`; api `format:check`, eslint, `tsc --noEmit`.

### Sự cố lúc chụp ảnh (đã khôi phục)

- **Nguyên nhân:**
  - Cổng 5300 và 5190 đang có server của cây chung chạy, nên tôi chạy bản của mình trên 5301 và 5191 (proxy vite trỏ 5301 tạm thời, đã trả lại và không commit).
  - Lần chạy đầu của `fx-s1-ui-check.mjs` đi vào API của worktree FX-S2, bản này chưa có FX-S1.
  - Lời gọi kiểm 403 vì thế đã đổi thật mật khẩu `admin-demo` trên `qltn_dev`.
- **Đã khôi phục:** đổi lại về mật khẩu demo bằng `change-password` lúc ~03:05Z, đăng nhập lại được.
- **Hệ quả còn lại:** các phiên `admin-demo` đang mở bị đăng xuất; `qltn_dev` có thêm audit `resetPassword` (bởi TEST-ADMIN-A) và `changePassword`.
- **Phòng lại:** script nay gửi chính mật khẩu demo trong lời gọi kiểm 403, nên chạy nhầm vào API cũ cũng không đổi được mật khẩu.

Dữ liệu thử còn lại trong `qltn_dev`: `TEST-ADMIN-A` (chỉ tòa A, mật khẩu ngẫu nhiên đặt lại mỗi lần chạy), SC-016 và SC-017 (`[TEST FX-S2 UI]`, đã COMPLETED). Tòa A đã trả về STANDARD.

