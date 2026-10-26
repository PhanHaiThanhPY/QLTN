# Handoff — AU-S1 Đổi mật khẩu

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt` 26/10/2026, PD-05). Làm trên một nhánh mới, ví dụ `feature/au-s1-change-password`. Không push nếu chủ dự án chưa yêu cầu. Chỉ chạy các test liên quan.

## Bằng chứng triển khai (dev-build)

**Candidate:** branch `feature/au-s1-change-password`, code commit `9de70f3`. Not pushed. 26/10/2026.
The branch starts from `feature/b03-s1-confirmation` (`641c8b5`) because the shared working tree was there; AU-S1 touches no S1 file, so it can be rebased onto `main` on its own.

**What changed**
- API `auth.service.ts`: after the current password is proven, a new password equal to it answers 400 `VALIDATION_ERROR` on `newPassword` (BR-03), using the shared `fieldError` helper. README documents it.
- Web:
  - `features/auth/ChangePasswordDialog.tsx`: RHF + zod, three `PasswordInput` fields (show/hide), client rules BR-01/02/03. On 200 it calls `signOut()` (drops the local session), navigates to `/login` and shows the success toast (BR-04). A `currentPassword`/`newPassword` field error stays under its field; 429 shows the SPEC toast; anything else shows a generic toast. The form stays open.
  - `components/common/PasswordInput.tsx` (new, reusable).
  - `SidebarUser.tsx`: key icon "Đổi mật khẩu" next to "Đăng xuất" (expanded) and under the avatar (collapsed), api mode only.
  - `services/http/auth-api.ts`: `changeOwnPassword()`.
  - `domain/errors.ts` + `client.ts`: HTTP 429 now maps to a new `ERROR_CODE.RATE_LIMITED` (was `NETWORK_ERROR`), so the dialog can tell it apart. `useCommand` keeps the command id on `RATE_LIMITED` as it did on `NETWORK_ERROR` (no behaviour change for commands).
- BR-05: passwords live only in the form state and the request body; the failure log prints only the error code (`console.error('Change password failed:', code)`), covered by a test.

**AC evidence**

| AC | Evidence | Result |
|---|---|---|
| AC-1 | `web/src/components/layout/SidebarUser.test.tsx`: shown in api mode, expanded and collapsed; hidden in mock mode, both layouts | Pass (4 tests) |
| AC-2 | `web/src/features/auth/ChangePasswordDialog.test.tsx` "AC-2: …": empty fields, < 8, > 72, mismatch, same as current; API not called | Pass (6 tests) |
| AC-3 | `api-qltn/test/auth-change-password.e2e-spec.ts` "AC-3: …" (400 on `newPassword`, old password still logs in), plus "checks the current password before comparing the new one" | Pass |
| AC-4 | same file, "AC-4: …": sessions A and B, refresh with B → 401 (A too), old password → 401, new → 200 | Pass |
| AC-5 | `ChangePasswordDialog.test.tsx` "AC-5: …" | Pass |
| AC-6 | `ChangePasswordDialog.test.tsx` "AC-6: …" | Pass |
| AC-7 | `ChangePasswordDialog.test.tsx` "AC-7: …" and `client.test.ts` "should map a 429 answer to RATE_LIMITED …" | Pass |
| AC-8 | Browser run (headless Chrome over CDP), script [`supporting/au-s1-ui-check.mjs`](supporting/au-s1-ui-check.mjs) with the shared driver `docs/tools/cdp-browser.mjs`. `kt-a2` signs in, opens "Đổi mật khẩu", saves a random new password → redirected to `/login` with the success toast → signs in with the new password; old password → 401. The seed password is then restored via `POST /users/:id/reset-password` as `admin-demo` (in `finally`, with a retry on the 10/min login limit). Final run 26/10/2026: `AC-8 AU-S1 UI flow: PASS`, `seed password restored: reset 200, login 200`. Screenshots: [`AU-1`](supporting/evidence/AU-1-sidebar-entry.png), [`AU-2`](supporting/evidence/AU-2-dialog-filled.png), [`AU-3`](supporting/evidence/AU-3-login-after-change.png), [`AU-4`](supporting/evidence/AU-4-signed-in-with-new-password.png) | Pass |

**Checks** (focused, per SPEC §6)
- `api-qltn`: `format:check`, `lint`, `typecheck` OK · `npm test` 39/39 · e2e `auth`, `auth-change-password`, `catalog-admin` 3 suites, 42/42 · build (tsc to scratchpad) OK.
- `web`: `vitest run src/features/auth src/components src/services/http src/hooks` 9 files, 140/140 (includes `LoginPage.test.tsx`) · `tsc -b` OK. `vite build` not run (RAM; no bundling change).

**Notes for review**
- Two earlier AC-8 runs failed in the cleanup step only (wrong list query, then the login rate limit), which left `kt-a2` on a random password for a few minutes each time. It was restored manually by the same reset call (`reset 200`, login with seed `200`) before the script got the retry and the final clean run above.
- Out of scope, unchanged: access tokens that are still valid stay valid until they expire (AG-03).

## Kết quả review (dev-review)

**PASS WITH RESIDUE — 26/10/2026.** Candidate `9de70f3`; evidence `de3697c`.

- API format/lint/typecheck đạt; unit `7 suites / 39 tests` đạt.
- API focused e2e `auth`, `auth-change-password`, `catalog-admin` đạt `3 suites / 42 tests` trên DB cô lập `qltn_review_e2e`.
- Web focused Vitest đạt `9 files / 140 tests`; `tsc -b` đạt. Không chạy `vite build` theo giới hạn RAM của packet.
- `git diff --check` và `node --check` cho script AC-8 đạt. Code audit xác nhận mật khẩu chỉ nằm trong form/request body; failure log chỉ ghi error code/unknown error, không ghi giá trị mật khẩu, URL hay localStorage.
- Đã xem 4 ảnh AC-8: mục Đổi mật khẩu ở sidebar, dialog ba trường, redirect `/login` với toast thành công, và đăng nhập lại thành công.
- Rerun AC-8 bằng `au-s1-ui-check.mjs` trong seat này dừng trước flow vì Chrome không expose page target (`Chrome did not expose a page target`); không có mutation/cleanup nào xảy ra. Evidence run do builder cung cấp ghi nhận seed password đã được restore (`reset 200`, login `200`).
- Lần chạy đầu trên DB mặc định `qltn_e2e` bị relation/seed contention (`buildings`, `refresh_tokens`, rồi `UQ_role_definitions_code`); không tái hiện trên DB cô lập sạch. Đây là residue môi trường, không phải finding của candidate.

Không có finding cần trả về dev-build. Candidate chấp nhận được để chuyển sang bước PM/BA close.

## Đóng (PM/BA)

**Ngày:** 26/10/2026 · **Kết quả:** AU-S1 **đạt**, đóng. Code `9de70f3`, bằng chứng `de3697c`, chưa merge, chưa push.

- AC-1 đến AC-8 đều có bằng chứng. Reviewer chạy lại độc lập: e2e 42/42 trên DB riêng, web 140/140. Reviewer đã xem 4 ảnh AC-8 và đọc code để xác nhận BR-05.
- **Phần còn lại được chấp nhận:** seat review không chạy lại được script trình duyệt vì không có Chrome (giới hạn môi trường, giống S1). Khi chạy AC-8, `kt-a2` hai lần bị kẹt ở mật khẩu ngẫu nhiên vài phút; dev-build đã đặt lại thủ công.
- **Cập nhật tài liệu:** [modules/auth.md](../../modules/auth.md) AG-01 và AG-08 đã xử lý xong. Các mục AG-02 đến AG-07 và AG-09 giữ nguyên trạng thái.
- **Việc tiếp theo:** không tạo việc mới. Việc merge do chủ dự án quyết định.
