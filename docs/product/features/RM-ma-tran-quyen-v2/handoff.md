# Handoff — RM Ma trận quyền v2

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt` 26/10/2026). Làm RM-S1 trước, RM-S2 sau; mỗi slice đi qua review riêng. Làm trên nhánh mới. Không push nếu chủ dự án chưa yêu cầu. Chỉ chạy các test liên quan.

> **Tiếp tục (26/10/2026):** chủ dự án đã duyệt SPEC (PD-10). Lần tạm dừng trước ghi bên dưới.
>
> **Tạm dừng (26/10/2026 09:03Z, PD-08):** SPEC đang chờ chủ dự án review.
> - RM-S1: workflow `01M5VPW70NSDBCG58W0WWMFXK3` ở trạng thái waiting, chặn bởi việc chờ chủ dự án review. Phần đã làm lưu ở commit WIP `ebe816d`, nhánh `feature/rm-s1-role-matrix`. **Không merge**, chưa push.
> - RM-S2: workflow `01M5VPWB85M5MW20SSQZ5CCJB5` chưa bắt đầu.
> - Khi đang ở trạng thái WIP, API dev local từng lỗi tạm thời vì chế độ watch nạp code khi chưa chạy migration. dev-build đã sửa; DB dev không bị đổi.

## RM-S1

### Bằng chứng triển khai (dev-build)

**Candidate:** branch `feature/rm-s1-role-matrix`, code commits `ebe816d` (WIP before the hold) + `072df32` (completion). Not pushed. 26/10/2026.
Stacked on `feature/us-s1-reset-password` (`d77a6f8`). Review the range `d77a6f8..072df32`, ignoring the docs-only commit `ca856c0`.

**What changed**
- API `domain/permissions.ts`: matrix v2 exactly as ADR §3. New role `ACCOUNTANT` (row `KTOAN`, label "Kế toán"). New capabilities `PAYMENT_CONFIRM`, `FUND_OPERATE`, `LOCATION_MANAGE`. BQL loses `BUILDING_CONFIG`. `ACCOUNTANT` is in `ASSIGNMENT_ROLES`.
- Migration `2026-10-26b-role-matrix-v2.sql`:
  - CHECK constraints accept `ACCOUNTANT`.
  - New column `role_definitions.base_capabilities`, backfilled for existing custom roles with the v1 matrix of their base role.
  - `BUILDING_CONFIG` removed from stored lists of BQL-based custom roles.
  - System rows sync at boot as before.
- Roles: `base_capabilities` is set when a custom role is created or saved. `GET /roles` returns `newBaseCapabilities` = base capabilities gained since the last save and not held (BR-04). Copying a role drops capabilities the base lost.
- Locations: `POST/PATCH …/locations*` need `LOCATION_MANAGE`. Configuration, templates, `building-configs` and building audit stay `BUILDING_CONFIG` (ADMIN only).
- Seed: department `KTOAN` "Kế toán", account `KTOAN-A` (building A), assignment rule `KTOAN → ACCOUNTANT`. VT-01 gets a base snapshot. Applied to `qltn_dev` on restart 09:27Z (`+1 departments, +1 users`).
- Web:
  - Mirror of the matrix, `ACCOUNTANT` labels and icon, API role mapping.
  - Menu: "Tầng, khu vực, vị trí" uses `LOCATION_MANAGE`. The new `visibleNavItems` is used by `Sidebar`.
  - `HomeRedirect`: BUILDING_CONFIG → settings, ADMIN_VIEW → employees, else `/records`.
  - Locations screen uses the new `getLocationSettings`, which needs `LOCATION_MANAGE`. The history card only shows with `BUILDING_CONFIG`, because the building audit is ADMIN-only on the API (see notes).
  - Mock handlers for locations use `LOCATION_MANAGE`.
  - Matrix: Kế toán column, RG-03 fixed (proposal row now under `PAYMENT_RECORD`), rows for `PAYMENT_CONFIRM`, `FUND_OPERATE`, `BUILDING_CONFIG`, `LOCATION_MANAGE`.
  - Roles card shows "Có quyền mới chưa bật: …".

**AC evidence**

| AC | Evidence | Result |
|---|---|---|
| AC-1.1 | `web/src/domain/permissions.parity.test.ts` imports `api-qltn/src/domain/permissions.ts`: same roles, same capabilities, same list per role (7 tests); `api-qltn/src/domain/permissions.spec.ts` "matrix v2" (4 tests) | Pass |
| AC-1.2 | `api-qltn/test/role-matrix-v2.e2e-spec.ts` "AC-1.2": `KTOAN` system row with exactly 4 capabilities; `ktoan-a` signs in; `auth.e2e` seed count = 10 | Pass |
| AC-1.3 | same file "AC-1.3": `bql-a` → 403 on the 5 routes; ADMIN 200 on `GET /building-configs`, `GET …/audit`, `GET …/config`; `apply-template` answers **201** (unchanged existing status code, the SPEC says 200) | Pass |
| AC-1.4 | same file "AC-1.4": `bql-a` creates (201), renames (200), stops using (200) a location; `kt-a` → 403 | Pass |
| AC-1.5 | same file "AC-1.5": a new Kế toán account lists records (200), creating → 403, `confirm-repair` → 403 `missing_capability` | Pass |
| AC-1.6 | same file "AC-1.6": a BQT custom role stored as v1 + migration rerun → `newBaseCapabilities = [RECORD_CONFIRM, ACCEPTANCE_DECIDE, PAYMENT_CONFIRM]`, its holder lacks them; saving the role clears the list; VT-01 holder lacks `BUILDING_CONFIG`, has `LOCATION_MANAGE`, config → 403 | Pass |
| AC-1.7 | `web/src/app/navigation.test.ts`: BQL (api and mock) sees locations, not configuration/workflow; ADMIN sees all three; Kế toán none | Pass (5 tests) |
| AC-1.8 | `web/.../PermissionMatrix.v2.test.tsx`: Kế toán column, RG-03 row under `PAYMENT_RECORD`, holders of the new rows, notice shown/hidden | Pass (5 tests) |
| AC-1.9 | e2e `catalog-admin` (configuration group now as `admin`, plus BQL 403 checks), `auth`, `record-confirmations` (S1), `auth-change-password` (AU-S1), `users-reset-password` (US-S1), `role-matrix-v2`: 6 suites, 57/57 | Pass |

**Checks** (focused, isolated e2e DB `qltn_build_e2e`)
- `api-qltn`: `format:check`, `lint`, `typecheck` OK · `npm test` 43/43 · e2e 6 suites 57/57 · build (tsc to scratchpad) OK.
- `web`: full `vitest run` 45 files, 339/339 (mock tests that let BQL edit configuration now run as ADMIN and assert BQL is refused) · `tsc -b` OK.

**Notes for review**
- **Location history:** BQL no longer sees the "Lịch sử thay đổi vị trí" card, because `GET /buildings/:id/audit` is `BUILDING_CONFIG` per AC-1.3. Giving it back needs a location-only audit route. Question for PM/BA.
- **VT-01 notice:** in `qltn_dev` VT-01 existed before the migration, so it now shows "Có quyền mới chưa bật: Nghiệm thu, Quản lý tầng, khu vực, vị trí" until an admin saves it. Fresh seeds have no notice. This is BR-04 working as specified.
- **Incident:** on 26/10 ~09:00Z the dev API (watch mode) crashed on the WIP because the new migration was not in `dist` yet. No DB change. It now runs on this branch with the migration applied.

### Kết quả review (dev-review)

_Chưa có._

### Đóng (PM/BA)

_Chưa có._

## RM-S2

### Bằng chứng triển khai (dev-build)

_Chưa có._

### Kết quả review (dev-review)

_Chưa có._

### Đóng (PM/BA)

_Chưa có._
