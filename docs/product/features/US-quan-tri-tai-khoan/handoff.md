# Handoff — US-S1 Đặt lại mật khẩu và lịch sử tài khoản

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt` 26/10/2026, PD-05). Làm trên một nhánh mới. Không push nếu chủ dự án chưa yêu cầu. Chỉ chạy các test liên quan.

## Bằng chứng triển khai (dev-build)

**Candidate:** branch `feature/us-s1-reset-password`, code commit `d03bd60`. Not pushed. 26/10/2026.
Stacked on `feature/au-s1-change-password` (it reuses `PasswordInput` from AU-S1); no AU or S1 file is changed here.

**What changed**
- API `user-admin.service.ts`: `resetPassword` refuses the signed-in account itself first, 400 `VALIDATION_ERROR` with `details.reason = self_reset_denied`, message "Dùng chức năng Đổi mật khẩu cho tài khoản của bạn." (BR-04). The audit `reason` stays the account code (BR-06). README updated.
- Web:
  - `services/http/users-api.ts`: `resetUserPassword()`, `listAccountHistory()` (20 rows per page).
  - `ResetPasswordDialog.tsx`: warning line, two `PasswordInput` fields, client rules BR-01 (shared `passwordError`) and BR-02. On 200 it shows the success toast, closes and reloads the history. A `password` field error stays under its field; 404 shows "Không tìm thấy tài khoản."; other errors show a generic toast. The dialog stays open on any failure.
  - `AccountHistory.tsx` + `AccountHistoryList.tsx`: collapsible "Lịch sử" that loads only when opened (TanStack `useInfiniteQuery`), with BR-05 labels, "Hệ thống" when there is no actor, "Xem thêm" while `page < totalPages`, and "Chưa có lịch sử." when empty. Time uses the shared `formatDateTime`, per SPEC §3.2 as updated by PM/BA.
  - `UserDialog.tsx`: the button shows only in api mode, on an existing account other than the viewer, for a viewer with `ACCOUNT_MANAGE`. History shows in api mode on an existing account for a viewer with `ADMIN_VIEW`.

**AC evidence**

| AC | Evidence | Result |
|---|---|---|
| AC-1 | `api-qltn/test/users-reset-password.e2e-spec.ts` "AC-1: …": 200; old refresh → 401; old password → 401, new → 200; newest audit `resetPassword` with reason `KT-A2`, new password absent from the audit | Pass |
| AC-2 | same file "AC-2: …": admin scoped to building A resets KT-B → 404; `bql-a` → 403; 7 characters → 400 on `password` | Pass |
| AC-3 | same file "AC-3: …": 400 `self_reset_denied`, admin still logs in with the old password | Pass |
| AC-4 | same file "AC-4: …": created + updated + reset account → 3 rows `resetPassword, updateUser, createUser`, `actorName` "Quản trị demo" | Pass |
| AC-5 | `web/.../UserDialog.account-tools.test.tsx`: shown when editing another account (api); hidden on create, on self (history kept), in mock mode, and without `ACCOUNT_MANAGE` | Pass (5 tests) |
| AC-6 | `ResetPasswordDialog.test.tsx` "AC-6: …": empty, < 8, mismatch; API not called | Pass (3 tests) |
| AC-7 | `ResetPasswordDialog.test.tsx` "AC-7: …" (toast, close, `onReset`); `UserDialog` wires `onReset` to invalidate the history query. The browser run shows the new row appearing (AC-9) | Pass |
| AC-8 | `AccountHistory.test.tsx`: labels incl. unknown code and "Hệ thống", "Xem thêm" appends page 2 then disappears, empty state, loads only when opened | Pass (4 tests) |
| AC-9 | Browser run (headless Chrome), script [`supporting/us-s1-ui-check.mjs`](supporting/us-s1-ui-check.mjs) with the shared `docs/tools/cdp-browser.mjs` and `docs/tools/seed-accounts.mjs`. `admin-demo` opens KT-A2 in "Nhân viên", expands "Lịch sử", resets with a random password → toast; "Đặt lại mật khẩu" rows 3 → 4; `kt-a2` signs in with the new password; old → 401; seed restored in `finally`. Run 26/10/2026: `AC-9 US-S1 UI flow: PASS`, `seed password restored: reset 200, login 200`. Screenshots: [`US-1`](supporting/evidence/US-1-admin-employee-dialog-history.png), [`US-2`](supporting/evidence/US-2-reset-dialog-filled.png), [`US-3`](supporting/evidence/US-3-reset-toast-and-history.png), [`US-4`](supporting/evidence/US-4-kt-a2-signed-in-with-new-password.png) | Pass |

**Checks** (focused, per SPEC §6)
- `api-qltn`: `format:check`, `lint`, `typecheck` OK · `npm test` 39/39 · e2e `users-reset-password` + `catalog-admin` 2 suites, 32/32, run on an isolated DB (`E2E_POSTGRES_DB=qltn_build_e2e`) · build (tsc to scratchpad) OK.
- `web`: `vitest run src/features/admin src/services/http` 7 files, 135/135 · `tsc -b` OK.

**Notes for review**
- e2e on the shared default DB `qltn_e2e` can collide when two seats run suites at the same time (each suite wipes the schema). One such run failed here and passed on rerun; use your own `E2E_POSTGRES_DB=<name>_e2e`.
- Earlier runs from AU-S1 and US-S1 left 3 older `resetPassword` rows on KT-A2 in `qltn_dev`; they are visible in the US-3 screenshot.

## Kết quả review (dev-review)

**PASS WITH RESIDUE — 26/10/2026.** Review xác nhận code candidate sau restack `7577afe` (code tương đương `d03bd60`; diff chỉ là tài liệu AU-S1) và evidence `c31516d`.

- API format/lint/typecheck đạt; unit `7 suites / 39 tests` đạt.
- API focused e2e `users-reset-password` + `catalog-admin` đạt `2 suites / 32 tests` trên DB cô lập `qltn_review_us_s1_e2e`.
- Web focused Vitest đạt `7 files / 135 tests`; `tsc -b` đạt.
- `git diff --check` và `node --check` cho script AC-9 đạt. Code audit xác nhận password chỉ nằm trong request body/form state; không xuất hiện trong URL, localStorage, audit reason, hay log chủ động (failure log chỉ ghi error code/unknown error).
- Đã xem 4 ảnh AC-9: dialog tài khoản với nút reset/lịch sử, form reset, toast cùng dòng lịch sử mới, và màn hình sau khi `kt-a2` đăng nhập bằng password mới.
- Rerun AC-9 trong seat này dừng trước flow vì Chrome không expose page target (`Chrome did not expose a page target`); không có mutation/cleanup nào xảy ra. Evidence run của builder ghi nhận seed password đã được restore (`reset 200`, login `200`).
- Không chạy `vite build` theo giới hạn RAM của packet. Không có finding cần trả về dev-build.

Candidate chấp nhận được để chuyển sang bước PM/BA close.

## Đóng (PM/BA)

**Ngày:** 26/10/2026 · **Kết quả:** US-S1 **đạt**, đóng. Code `7577afe` (nhánh `feature/us-s1-reset-password`, xếp trên nhánh AU-S1), bằng chứng `c31516d`, chưa merge, chưa push.

- AC-1 đến AC-9 đều có bằng chứng. Reviewer chạy lại: e2e 32/32 trên DB riêng, web 135/135. Reviewer đã xem 4 ảnh AC-9 và đọc code để xác nhận BR-06.
- **Phần còn lại được chấp nhận:** seat review không chạy lại được script trình duyệt vì không có Chrome. Mật khẩu seed đã được khôi phục theo bằng chứng của dev-build.
- **Cập nhật tài liệu:** [modules/users.md](../../modules/users.md) UG-01, UG-02, UG-07 đã xử lý xong.
- **Việc tiếp theo:** không tạo việc mới. Việc merge cả hai nhánh AU-S1 và US-S1 do chủ dự án quyết định.
