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

_Chưa có._

### Kết quả review (dev-review)

_Chưa có._

### Đóng (PM/BA)

_Chưa có._
