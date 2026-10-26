# Handoff — SPEC B03–B09

**Chủ sở hữu:** PM/BA (gói việc), dev-build (bằng chứng), dev-review (kết quả review) · **Cập nhật:** 26/10/2026

Mỗi slice một mục. Dev-build ghi bằng chứng, dev-review ghi kết quả, PM/BA ghi đóng.

## S1 — Xác nhận hiện trạng

### Gói việc (PM/BA, 26/10/2026)

Approved by the project owner on 26/10/2026 (PD-04; relayed by dev-build at 07:13Z).

#### Contract
docs/product/features/B03-B09-luong-sua-chua/SPEC.md, status "Đã duyệt". It is the only requirements authority.
If the SPEC and the web demo disagree, the SPEC wins. If the SPEC is silent, ask dev-pm-ba before choosing.

#### Scope of S1
- Actions T01 requestRecordUpdate, T02 confirmRepair, T03 closeNoRepair (SPEC section 5), as
  POST /api/records/:id/request-record-update | confirm-repair | close-no-repair.
- Check order for manager/confirmer slots (section 4). Rules BR-01 (version) and BR-02 (audit). New
  details.reason not_step_assignee (section 7).
- GET /api/records/:id returns `confirmations` (section 7).
- Web api mode wired for the three actions; UI unchanged from the demo.
- api-qltn/README.md updated for the new endpoints.

#### Done when
- AC-1.1 to AC-1.4, plus AC-0.1 and AC-0.2 for the three S1 actions, each pass in an e2e test on the real API.
  AC-0.3 shown in web api mode.
- npm test, npm run test:e2e, lint, typecheck and format:check pass.
- docs/product/features/B03-B09-luong-sua-chua/handoff.md has an S1 section: each AC with its evidence
  (test name, command, result) and anything not done.
- Hand the review to dev-review@qltn through the queue, pointing at handoff.md.

#### Out of scope for S1
Slices S2-S4 and everything in SPEC section 2.2. Do not commit to main or push unless the user asks; work on a branch.

### Bằng chứng triển khai (dev-build)

**Candidate:** branch `feature/b03-s1-confirmation`, commit `ab67a6c` (parent `f0f2e19`). Not pushed. Ngày 26/10/2026.

**What changed**
- API: `POST /api/records/:id/request-record-update | confirm-repair | close-no-repair` (`records.controller.ts`, `RecordsService.confirm`), body `ConfirmRecordDto { note, version }`.
- Rules: `record-actions.ts` gets slot `confirmer` and the three actions (`from: PENDING_CONFIRMATION`, `RECORD_CONFIRM`); refusal `not_step_assignee` with the demo message. Order capability → assignee → status, as `assertRecordAction` (SPEC §4, row manager/confirmer).
- The three routes have no `@RequireCapabilities`, on purpose: the global guard answers 403 without `details.reason` and before the scope check, so the service does scope (404) → capability (403 `missing_capability`).
- Data: migration `2026-10-26a-repair-confirmations.sql` + entity `RepairConfirmation` (append-only, outcome `CONFIRMED | NEEDS_UPDATE | NO_REPAIR`, CHECK + FKs). Conclusion row, status change and audit (`reason` = note) in one transaction (BR-01, BR-02).
- `GET /api/records/:id` returns `confirmations` oldest first.
- Scope: every record write now answers 404 when the record's location is outside the caller's non-empty `locationIds` (SPEC §4 "phạm vi tòa và khu vực"). This also applies to the existing draft/submit/withdraw writes; GET detail and the list are unchanged (still building scope only).
- Web api mode: `command-adapter.ts` wires the three actions; `mappers.ts` maps `confirmations`. UI unchanged.
- `api-qltn/README.md` documents the endpoints and the scope rule.

**AC evidence** (`api-qltn/test/record-confirmations.e2e-spec.ts`, real app on `qltn_e2e`)

| AC | Test | Result |
|---|---|---|
| AC-1.1 | `AC-1.1: the assigned confirmer runs T01, T02 and T03 …` | Pass |
| AC-1.2 | `AC-1.2: an unassigned confirmer, a BQL and another building are refused …` (kt-a2 403 `not_step_assignee`, bql-a 403 `missing_capability`, kt-b 404) | Pass |
| AC-1.3 | `AC-1.3: a record sent back is supplemented, resubmitted and confirmed …` (outcomes `NEEDS_UPDATE`, `CONFIRMED`) | Pass |
| AC-1.4 | `AC-1.4: a 4-character note answers 400 on note and a stale version answers 409 CONFLICT` | Pass |
| AC-0.1 (S1 actions) | `AC-0.1: every S1 action from a status outside PENDING_CONFIRMATION answers 409 …` (from `DRAFT` and `PENDING_PROPOSAL`; audit, confirmations and version unchanged) | Pass |
| AC-0.2 (S1 statuses) | `AC-0.2: the summary and the needs-update list count the S1 statuses` | Pass |
| AC-0.3 | Not clicked through in a browser. Verified the web route instead: script through the web dev proxy `localhost:5190/api` → create, photo, submit (`bql-a`) → `confirm-repair` (`kt-a`) → detail `confirmations = [CONFIRMED]` (record `SC-001` "[TEST S1] …" left in `qltn_dev`). Adapter and mapper covered by web unit tests. | Partial: UI click-through not done |

**Checks** (26/10/2026, run in phases)
- `api-qltn`: `npm run format:check` OK · `npm run lint` OK · `npm run typecheck` OK · `npm test` 39/39 · `npm run test:e2e` 8 suites, 85/85 (new suite 6/6).
- `web`: `npx vitest run` 37 files, 289/289 · `npx tsc -b` OK · `vite build` OK (output to scratchpad). `web` has no lint script.
- Local dev DB `qltn_dev`: migration `2026-10-26a` applied on dev API restart.

**Not done / notes for review**
- AC-0.3 UI click-through in web api mode (see above).
- No unit test for `assertRecordAction`'s confirmer branch; covered by e2e AC-1.2.

### Kết quả review (dev-review)

_Chưa có._

### Đóng (PM/BA)

_Chưa có._
