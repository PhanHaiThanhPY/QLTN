# Handoff: RM-S2 Quản trị xem được toàn bộ, không thao tác nghiệp vụ

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-38). Slice nhỏ, không có UI-UX brief riêng; giao diện theo BR-RM2-04.

**Cách làm:**
- **Làm xen ngay sau T-S1** (hoặc ngay bây giờ nếu T-S1 đang chờ review). Tách nhánh từ `main`. Gợi ý: `feature/rm-s2-admin-view-all`.
- **Riêng T-S1 đang build:** cấp luôn quyền xem tiền gửi cho ADMIN ngay trong T-S1 (BR-RM2-02), để T-S1 merge xong là chủ dự án thấy được.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5.

## Ghi chú cho dev-build (PM/BA)

- **Ma trận quyền:** `api-qltn/src/domain/permissions.ts` (`ROLE_CAPABILITIES.ADMIN`) và bản tương ứng ở `web/src/domain/permissions.ts`. Cập nhật ADR-0001 (`docs/engineering/adr/ADR-0001-role-matrix-v2.md`) và lịch sử SPEC RM.
- **Bẫy cần sửa (BR-RM2-03):**
  - F-S3 hiện đủ số tài khoản theo `FUND_VIEW` hoặc `FUND_OPERATE` (`fund-views.ts`, `seesFullAccount`).
  - Đổi điều kiện sang **vai trò kế toán hoặc BQT**, hoặc `FUND_OPERATE` / `FUND_APPROVE`. Lý do: sau slice này, ADMIN có `FUND_VIEW` mà vẫn phải thấy số bị che.
  - Kiểm luôn các chỗ khác đang dùng một quyền xem như điều kiện để hiện thêm dữ liệu nhạy cảm, và báo trong bằng chứng nếu có.
- **Test chung của BR-RM2-02:** mọi quyền `*_VIEW` và `*_REPORT` phải thuộc ADMIN; không quyền ghi hay duyệt nào thuộc ADMIN, trừ các quyền quản trị đã có. Đặt test ở nơi CI chạy cùng unit của ma trận quyền.
- **e2e cũ:** chỗ nào kỳ vọng "ADMIN xem bị 403" thì sửa thành xem được. Liệt kê các chỗ đã sửa trong bằng chứng.
- Không cần migration.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/rm-s2-admin-view` (worktree `../QLTN-rm-s2`). Chưa push.
- Nhánh tách từ `feature/t-s1-rate-invitations`, **không** từ `main` như handoff gợi ý. Đã merge `main` (SPEC RM-S2) và bản sửa F-T1-01 vào.
- Lý do: T-S1 cũng sửa hai tệp ma trận quyền (`permissions.ts` của API và web). Nếu tách từ `main`, hai nhánh sẽ xung đột khi merge. Merge T-S1 trước thì RM-S2 vào thẳng, không xung đột.

**Không có migration.**

### Đã làm

- **ADMIN có thêm các quyền xem** `EXPLOITATION_VIEW`, `EXPLOITATION_CONTRACT_VIEW`, `FUND_VIEW`, `FUND_REPORT`. `DEPOSIT_VIEW` đã có từ T-S1. Sửa ở `api-qltn/src/domain/permissions.ts` và bản tương ứng ở `web/src/domain/permissions.ts`.
- **Test chung BR-RM2-02** dùng hàm `adminMatrixProblems(tất cả quyền, quyền của ADMIN)`, có ở cả API và web. Hàm trả về:
  - quyền `*_VIEW` hoặc `*_REPORT` mà ADMIN thiếu;
  - quyền ADMIN đang có mà tên chứa `MANAGE`, `APPROVE`, `OPERATE`, `DECIDE`, `RECORD`, `CONFIRM`, `EDIT`. Bỏ qua các quyền quản trị cũ (`LOCATION_MANAGE`, `ACCOUNT_MANAGE`, `REPLACE_MANAGER`…), vì tên của chúng có chữ MANAGE.

  Test ở `permissions.spec.ts` (API) và `permissions.matrix.test.ts` (web). Hai trường hợp kiểm AC-RM2.5 có trong test: thêm quyền giả `X_VIEW` thì ra "ADMIN thiếu X_VIEW"; gắn `FUND_APPROVE` cho ADMIN thì ra "ADMIN không được có FUND_APPROVE".
- **Số tài khoản (BR-RM2-03):** `seesFullAccount` (`fund/fund-rules.ts`) nay theo vai trò kế toán hoặc BQT, hoặc theo `FUND_OPERATE` / `FUND_APPROVE`; không còn theo `FUND_VIEW`. Màn đối soát và báo cáo dùng chung hàm này. Báo cáo thì luôn che số tài khoản.
- **Các chỗ khác dùng quyền xem để mở thêm dữ liệu** (theo yêu cầu kiểm của handoff):
  - `attachments.service` dùng quyền xem để cho đọc tệp của khai thác, quỹ và tiền gửi. Đây đúng là đọc, nên không đổi.
  - `ContractPage.canSeeBids` (`EXPLOITATION_VIEW`) chỉ hiện mốc chọn thầu.
  - Không tìm thấy dữ liệu nhạy cảm nào khác gắn với quyền xem.
- **Giao diện (BR-RM2-04):** thêm `AdminViewNotice` vào khung trang. Dòng "Bạn đang xem với quyền Quản trị — chỉ xem." hiện một lần, khi ADMIN mở các trang nghiệp vụ: `/records`, `/maintenance`, `/exploitation`, `/deposits`. Không hiện ở trang hệ thống và quản trị. Nút thao tác vốn đã gắn với quyền ghi, nên ADMIN không thấy nút nào.
- Đã cập nhật ma trận ở ADR-0001 §3, lịch sử SPEC RM và test menu.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| RM2.1 | Script: menu của `admin-demo` có đủ (thiếu: `[]`). Ảnh RM2-1. Test menu web: ADMIN thấy nhóm Quỹ khai thác và nhóm Tiền gửi |
| RM2.2 | e2e `admin-view-all`: ADMIN đọc MT-001 kèm hồ sơ dự thầu, HĐ-001 và tab Thanh lý, sổ quỹ, thuế, phiếu chi, đối soát, báo cáo, XLSX, thư mời. Ảnh RM2-2, RM2-3, RM2-4: không có nút thao tác; dòng "chỉ xem" hiện đúng một lần |
| RM2.3 | e2e: 7 lệnh trả 403: ghi khoản thu, lập phiếu chi, duyệt phiếu chi, xác nhận đối soát, duyệt tờ trình, xác nhận lượt bảo trì, thêm ngân hàng. Lệnh duyệt kết quả thầu đã có 403 sẵn trong e2e F-S1 |
| RM2.4 | e2e và script: với ADMIN, `accountNo` là null, `accountMasked` là `****0001` (cả ở đối soát); kế toán thấy đủ số |
| RM2.5 | Unit test API (98/98) và web (`permissions.matrix.test.ts`), gồm ca đỏ với `X_VIEW` |
| RM2.6 | e2e: tạo một tài khoản ADMIN chỉ có tòa A; mở sổ quỹ tòa B → 404; danh sách quỹ chỉ có tòa A |
| RM2.7 | Các e2e đều đạt: `role-matrix` 6/6, `exploitation` 13/13, `exploitation-contracts` 10/10, `exploitation-fund` 13/13, `fund-statements` 11/11, `fund-termination` 9/9, `attachments` 9/9, `audit-log` 8/8, `deposit-invitations` 13/13 |

**e2e đã sửa kỳ vọng:** không có e2e nào kỳ vọng "ADMIN xem bị 403"; các chỗ ADMIN nhận 403 hiện có đều là lệnh ghi, nên giữ nguyên. Chỉ sửa kỳ vọng ở unit test ma trận (danh sách vai trò của các quyền xem nay có ADMIN) và test menu web (ADMIN chuyển từ nhóm "ẩn" sang nhóm "hiện").

**Chạy lại bằng chứng:** [supporting/rm-s2-admin-view-check.mjs](supporting/rm-s2-admin-view-check.mjs), chỉ đọc. Lần chạy cuối: `PASS`.

### Test đã chạy

- **API:** `format:check` OK; `tsc` OK; `eslint` OK; unit test domain 98/98; e2e `admin-view-all` 4/4, cùng 9 suite ở trên.
- **Web:** `tsc -b` OK; `vitest` 626/626 (107 tệp).
