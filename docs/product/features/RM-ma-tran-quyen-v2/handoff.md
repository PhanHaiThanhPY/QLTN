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

**FAILED — 26/10/2026.** Review range `d77a6f8..072df32`, bỏ qua `ca856c0` (docs-only); evidence `eb3934d`. PD-13 cập nhật SPEC trong lúc review.

- API format/lint/typecheck đạt; unit `7 suites / 43 tests` đạt.
- API focused e2e `auth`, `catalog-admin`, `record-confirmations`, `auth-change-password`, `users-reset-password`, `role-matrix-v2` đạt `6 suites / 57 tests` trên DB cô lập `qltn_review_rm_s1_e2e`.
- Web full Vitest đạt `45 files / 339 tests`; `tsc -b` đạt.
- `git diff --check` đạt. Migration v2 được chạy lại trong e2e AC-1.6 và không phát sinh lỗi; role matrix API/web parity, Kế toán, capability gates, custom-role snapshot và BQL location permissions đều được kiểm chứng.
- **Finding F-RM-S1-01 (PD-13 / BR-03a / AC-1.3, AC-1.3a):** Candidate vẫn giữ `GET /buildings/:id/audit` ở `BUILDING_CONFIG` và `getLocationSettings` chỉ nạp `canSeeHistory` cho `BUILDING_CONFIG`, nên BQL (dù có `LOCATION_MANAGE`) nhận 403 và không thấy khối "Lịch sử thay đổi vị trí". Sửa API authorization để BQL đọc audit trong phạm vi (vẫn 403 ngoài phạm vi/cho KT), và sửa web để BQL thấy cùng khối lịch sử chỉ đọc như ADMIN, không mở quyền sửa cấu hình. Bổ sung e2e AC-1.3 và test web AC-1.3a.
- Grep vẫn thấy `DEFAULT_APPROVAL_STEP_KEYS`/`DEMO_APPROVAL_STEP_KEYS`; việc loại bỏ hai hằng và hợp nhất approval-chain là BR/AC của RM-S2, ngoài review range RM-S1, nên không trả candidate về sửa ở slice này.
- Không có browser AC trong RM-S1. Các kiểm tra khác đạt nhưng không bù được finding trên.

Candidate RM-S1 cần trả về dev-build để sửa finding F-RM-S1-01 và chạy lại các kiểm tra liên quan.

### Vòng sửa 1 (dev-build)

**Candidate:** code fix `7c337e4` on `feature/rm-s1-role-matrix` (not pushed). Only finding F-RM-S1-01 is addressed.

- API: `GET /buildings/:id/audit` checks `BUILDING_CONFIG` **or** `LOCATION_MANAGE` in the handler, because the capability guard requires every listed capability, then the building scope.
  - Out of scope → **404**, as SPEC AC-1.3 states. The review note said "403 ngoài phạm vi"; the SPEC wins.
  - No capability → 403.
  - Configuration routes are unchanged (ADMIN only).
- Web: `getLocationSettings` always loads the building history (its caller already needs `LOCATION_MANAGE`). The locations screen shows the same "Lịch sử thay đổi vị trí" card to BQL and ADMIN. `canSeeHistory` was removed.

| AC | Evidence | Result |
|---|---|---|
| AC-1.3 (PD-13) | `role-matrix-v2.e2e-spec.ts` "AC-1.3 (PD-13)": `bql-a` and `admin-demo` get 200 for building A with **identical** rows; `bql-a` on building B → 404; `kt-a` → 403; `bql-a` config still → 403. The 403 on `GET …/audit` was removed from the first AC-1.3 test. | Pass |
| AC-1.3a | `web/src/services/config-and-emergency.test.ts` "AC-1.3a (PD-13)" (mock): BQL and ADMIN get the same history ids from `getLocationSettings`, including the new `createLocation`; BQL is still refused `getBuildingSettings`; TVKT refused. `web/src/features/buildings/LocationsPage.history.test.tsx`: the card renders with the event and no configuration action. | Pass |

**Checks rerun:** `api-qltn` format/lint/typecheck OK, unit 43/43, e2e `role-matrix-v2` + `catalog-admin` + `auth` 45/45 (isolated DB), build OK · `web` `vitest run src/services src/features/buildings src/features/admin src/app src/domain` 26 files, 238/238, `tsc -b` OK.

### Vòng review 2 (dev-review)

**PASS WITH RESIDUE — 26/10/2026.** Fix `7c337e4` addresses F-RM-S1-01; evidence `7ca21d7`.

- API format/lint/typecheck đạt; unit `43/43`.
- API focused e2e `auth`, `catalog-admin`, `role-matrix-v2` đạt `3 suites / 45 tests` trên DB cô lập `qltn_review_rm_s1_fix_e2e`. BQL audit trong phạm vi trả 200 giống ADMIN, ngoài phạm vi trả 404, KT trả 403; BQL vẫn không sửa được config.
- Web targeted tests đạt `9 files / 47 tests`, gồm AC-1.3a history/card/config-gate; `tsc -b` đạt.
- `git diff --check` riêng fix commit `7c337e4` đạt. Các whitespace cảnh báo khi diff ancestry rộng thuộc tài liệu cũ ngoài fix commit.
- Không có finding còn lại trong scope RM-S1/PD-13. Các hằng approval-chain cũ vẫn thuộc RM-S2 như đã ghi ở vòng review đầu.

Candidate chấp nhận được để chuyển sang bước PM/BA close.

### Đóng (PM/BA)

**Ngày:** 26/10/2026 · **Kết quả:** RM-S1 **đạt**, đóng. Code `ebe816d`, `072df32`, cùng bản sửa `7c337e4`, trên nhánh `feature/rm-s1-role-matrix`; bằng chứng `7ca21d7`. Chưa merge, chưa push.

- **Bằng chứng:** AC-1.1 đến AC-1.9 và AC-1.3a đều có bằng chứng. Vòng 1 review không đạt với một phát hiện, F-RM-S1-01: thay đổi PD-13 đến khi đang review. Vòng sửa đã xử lý; reviewer chạy lại: e2e 45/45 trên DB riêng, web 47/47.
- **SPEC sửa theo code:** AC-1.3 ghi `apply-template` trả 200, nhưng code trả **201** như trước giờ (POST tạo mới). PM/BA sửa SPEC theo code; không có thay đổi hành vi.
- **Phần còn lại:** các hằng số cũ của chuỗi duyệt (`DEFAULT_APPROVAL_STEP_KEYS`, `DEMO_APPROVAL_STEP_KEYS`) thuộc RM-S2, đúng kế hoạch.
- **Cập nhật tài liệu:**
  - [modules/roles.md](../../modules/roles.md): RG-01, RG-02, RG-03 đã xử lý.
  - [modules/buildings.md](../../modules/buildings.md): BG-03, BG-08 đã xử lý.
- **Việc tiếp theo:** RM-S2 (đã duyệt, PD-10) được bắt đầu. Merge do chủ dự án quyết định.

## RM-S2

### Bằng chứng triển khai (dev-build)

**Candidate:** branch `feature/rm-s2-intake-config`, code commit `32c732c` (parent `0bab62e`, RM-S1 closed). Not pushed. 26/10/2026.

**What changed (API)**
- `domain/building-config.ts`:
  - BR-06: `stageCapability('INTAKE') = RECORD_CONFIRM`; INTAKE must have exactly 1 step whose role can confirm (400 on `workflowStages.<i>.approvalStepKeys`).
  - BR-10: `approvalStepKeys` must equal the PROPOSAL stage (400 on `approvalStepKeys`, "Chuỗi phê duyệt phải trùng các bước của giai đoạn Tờ trình."). Default PROPOSAL = `[TECH, BOARD]`.
  - BR-09: template `AQUA` (`stageSteps`, thresholds of RESIDENTIAL).
  - `stepBindingsOf` binds to the stage's first step when the default step is missing. `DEFAULT_APPROVAL_STEP_KEYS` removed.
- `building-config.service.ts`: `approvalStepKeys` is derived from the PROPOSAL stage when the request omits it; `applyTemplate` resets stages and chain together. Create, copy, PUT and bulk all go through `validateConfigRules`.
- Seed: `DEMO_APPROVAL_STEP_KEYS` removed; demo configs come from their template (same chain TVKT → BQT).
- Migration `2026-10-26c-approval-chain-single-source.sql` (BR-11):
  - An out-of-sync PROPOSAL stage gets the running chain, with bindings re-pointed, `version + 1`, and an audit `migrateApprovalChain`.
  - A building without BQT is audited once ("Thiếu BQT…").
  - Records are untouched.
  - Applied to `qltn_dev` on restart: A–D were `{TECH,BOARD}` vs PROPOSAL 3 steps → now `[TECH, BOARD]`, 4 audit rows.
- `records.service.ts` (BR-07): the confirmer is the first eligible holder of the INTAKE step, resolved against the building's step library.
  - If nobody is eligible, the BQT holder is used and the `createRecord` audit gets the reason "Không có người xác nhận theo cấu hình, dùng BQT".
  - The draft and submit checks accept that INTAKE step, or BQT only when nobody is eligible.
  - BR-08 message updated (`not_step_assignee` unchanged).

**What changed (web)**
- `domain/building-config.ts` mirrors the API:
  - default PROPOSAL `[TECH, BOARD]` (`DEFAULT_PROPOSAL_STEP_KEYS` replaces `DEFAULT_APPROVAL_STEP_KEYS`);
  - `AQUA` in `CONFIG_TEMPLATES` (the apply-template dialog lists it);
  - binding fallback, `proposalChainOf`, `withProposalChain`.
- Mock handlers:
  - same INTAKE / chain rules on save; templates reset stages;
  - the confirmer is picked from the INTAKE step with BQT fallback (audited) and validated the same way.
- Settings `ConfigCard` sends the stages with the PROPOSAL stage set to the edited chain, so it never trips BR-10.
- Record form: the confirmer field ("Người xác nhận hiện trạng") defaults to "Theo cấu hình tòa (tự động)" and lists active users with `RECORD_CONFIRM`. An empty choice is not sent, so the backend picks per BR-07. Without this, the form would pre-pick a KT and the AQUA building would refuse it.

**AC evidence**

| AC | Evidence | Result |
|---|---|---|
| AC-2.1 | unit `building-config.spec.ts` "refuses an INTAKE stage…"; e2e `rm-s2-intake-config.e2e-spec.ts` "AC-2.1" (0 steps, 2 steps, BQL custom step → 400 on `workflowStages.<i>.approvalStepKeys`) | Pass |
| AC-2.2 | e2e "AC-2.2": AQUA on building A → new record confirmer = `tvkt`; `tvkt` T02 → `PENDING_PROPOSAL`; `kt-a` → 403 `not_step_assignee` with the new message | Pass |
| AC-2.3 | e2e "AC-2.3": TVKT deactivated → confirmer `bqt`, audit reason as BR-07, `bqt` confirms. **Note:** with AQUA's chain `[TECH, BOARD]` and no TVKT, *submit* is refused by the existing S1 rule that checks every proposal-chain holder (`approvalStepKeys.0`). The test therefore sets PROPOSAL `[BOARD]` (INTAKE stays `[TECH]`). See question Q-RM2-1. | Pass |
| AC-2.4 | e2e "AC-2.4": building B (INTAKE `[TECH_CONFIRM]`) → `kt-b` is confirmer and confirms; `record-confirmations.e2e` (S1) unchanged | Pass |
| AC-2.5 | e2e "AC-2.5": mismatch → 400 with the BR-10 message; PUT without the chain derives it; apply-template, copy, bulk, create building → `approvalStepKeys == PROPOSAL` each time; new building = `[TECH, BOARD]` | Pass |
| AC-2.6 | e2e "AC-2.6": record on a default-template building snapshots `[TECH, BOARD]`. Proposal submit/approve endpoints do not exist yet (S2), so "không sang thẳng Chờ thi công" can only be shown through the snapshot until S2. | Pass (snapshot level) |
| AC-2.7 | e2e "AC-2.7": building C `{TECH,BOARD}` / PROPOSAL 3 steps → `[TECH, BOARD]`, version +1, 1 audit; building D `{TECH}` → `[TECH]` with "Thiếu BQT"; second run changes nothing; an old record keeps its `approvalStepKeys` | Pass |
| AC-2.8 | web `ApprovalChainSource.test.tsx`: the record stepper uses `record.approvalStepKeys` even when the record's PROPOSAL snapshot differs; the designer gets the stored PROPOSAL stage over a stale chain | Pass |
| AC-2.9 | Browser (headless Chrome), [`supporting/rm-s2-ui-check.mjs`](supporting/rm-s2-ui-check.mjs): ADMIN applies "Mẫu: Aqua…" to Tòa A in the detail dialog; BQL creates and submits SC-003 with the confirmer on "Theo cấu hình tòa"; detail shows TVKT (Võ Thanh Tâm) as confirmer; TVKT sees it in "Hồ sơ sửa chữa" and confirms → "Chờ lập tờ trình". Run: `AC-2.9 RM-S2 UI flow: PASS`; building A restored to STANDARD (201). Screenshots `evidence/RM2-1` … `RM2-5`. | Pass |

**Checks** (isolated e2e DB `qltn_build_e2e`)
- `api-qltn`: `format:check`, `lint`, `typecheck` OK · `npm test` 48/48 · e2e `rm-s2-intake-config`, `catalog-admin`, `records`, `record-confirmations`, `record-transitions`, `role-matrix-v2`, `auth`: 7 suites, 77/77 · build OK.
- `web`: full `vitest run` 47 files, 343/343 · `tsc -b` OK.
- Grep: no `DEFAULT_APPROVAL_STEP_KEYS` / `DEMO_APPROVAL_STEP_KEYS` left in `api-qltn` or `web`.

**Notes and questions for review / PM/BA**
- **Q-RM2-1:** should *submit to confirmation* still require every proposal-chain holder to be valid? In AQUA, a building without TVKT can create a record (BQT fallback) but cannot submit it until the chain changes (AC-2.3 note).
- `records.e2e` read the configuration as `bql-a`, which RM-S1 forbids; the test now reads it as admin. Test-only; RM-S1's run did not include this suite.
- Cosmetic, outside the SPEC: the record's "Người xử lý" card still labels the confirmer "Kỹ thuật xác nhận" even when it is TVKT/BQT, and the apply-template preview does not list per-stage step changes (only the chain and thresholds). Candidates for a later small slice.


### Kết quả review (dev-review)

**FAILED — 26/10/2026.** Review candidate `32c732c`, evidence `4eabad5`, theo packet `qitem-20261026101308-fae2ac80`. Q-RM2-1 đã được PM/BA chốt bằng BR-07a trong SPEC: `submitRecord` chỉ kiểm tra holder của bước INTAKE; holder của chuỗi Tờ trình chỉ kiểm tra khi trình tờ trình.

- API format/lint/typecheck đạt; unit đạt `7 suites / 48 tests`.
- API focused e2e (`rm-s2-intake-config`, `catalog-admin`, `records`, `record-confirmations`, `record-transitions`, `role-matrix-v2`, `auth`) đạt `7 suites / 77 tests` trên DB cô lập `qltn_review_rm_s2_e2e`.
- Web full Vitest đạt `47 files / 343 tests`; `tsc -b` đạt. Grep không còn `DEFAULT_APPROVAL_STEP_KEYS` hoặc `DEMO_APPROVAL_STEP_KEYS`; `git diff --check` đạt.
- Browser script `rm-s2-ui-check.mjs` không rerun được trong môi trường review vì Chrome không expose page target trước khi flow bắt đầu. Đã kiểm tra các screenshot AC-2.9 do dev-build cung cấp; evidence thể hiện flow apply AQUA → BQL submit → TVKT confirm và restore building A.
- **Finding F-RM-S2-01 (BR-07a / AC-2.3):** `records.service.ts` vẫn duyệt toàn bộ holder của `approvalStepKeys` trong `assertSubmittable()` khi `submitRecord`. Vì vậy AQUA nguyên bản `[TECH, BOARD]` với TVKT đã bị vô hiệu sẽ bị từ chối do thiếu holder TECH, dù BQT đã được chọn làm confirmer fallback của INTAKE. Test AC-2.3 hiện phải sửa cấu hình PROPOSAL thành `[BOARD]` trước khi submit, nên không kiểm chứng hành vi SPEC yêu cầu và che khuất lỗi.
  - Cần sửa `submitRecord` để chỉ kiểm tra confirmer/holder INTAKE theo BR-07a; giữ kiểm tra chuỗi Tờ trình ở endpoint trình tờ trình. Bổ sung e2e với AQUA nguyên bản, không có TVKT, BQT fallback, submit và BQT confirm thành công mà không sửa PROPOSAL chain.
- AC-2.6 hiện mới có bằng chứng snapshot chuỗi `[TECH, BOARD]`; handoff ghi rõ endpoint trình/duyệt tờ trình chưa tồn tại, nên phần chuyển trạng thái thực tế của AC này chưa được kiểm chứng trong candidate.

Candidate cần trả về `dev-build` để sửa F-RM-S2-01 và cập nhật bằng chứng AC-2.3 theo BR-07a.

### Vòng sửa 1 (dev-build)

**Candidate:** code fix `2fa2954` on `feature/rm-s2-intake-config` (not pushed). Only finding F-RM-S2-01 (BR-07a) is addressed.

- API `records.service.ts`: `assertSubmittable` no longer checks the proposal-chain holders. Submitting for confirmation needs only a valid INTAKE holder, including the BQT fallback. The now-unused `APPROVAL_STEP_SLOT` and `approvalStepsOf` were removed. Proposal-chain holders get checked again when proposal submission is built (S2, v2 BR-S2-04); until then nothing checks them.
- Mock `repair-record-handlers.ts`: `submitRecord` calls `assertSubmittable(…, { checkApprovers: false })`. The emergency start keeps the approver check, because it goes straight into the proposal chain. The mock's `submitProposal` already checks the approvers.
- e2e `rm-s2-intake-config` "AC-2.3" now runs on the **unchanged** AQUA chain `[TECH, BOARD]`, with TVKT deactivated: confirmer `bqt` with the audit reason, submit OK, `bqt` confirms.

**Checks rerun:** `api-qltn` format/lint/typecheck OK, unit 48/48, e2e `rm-s2-intake-config` + `records` + `record-transitions` + `record-confirmations` 32/32 (isolated DB) · `web` `vitest run src/services` 194/194, `tsc -b` OK.

### Đóng (PM/BA)

_Chưa có._
