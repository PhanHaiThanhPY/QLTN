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
| AC-0.3 | Fix round 1 (review finding): browser click-through in web api mode with headless Chrome, script [`supporting/s1-ui-check.mjs`](supporting/s1-ui-check.mjs) (CDP, no extra packages; password read from `api-qltn/.env`, never printed). `bql-a` fills the form (location, "không thuộc thiết bị", title, description, one PNG) and clicks "Gửi xác nhận" → detail shows "Chờ xác nhận"; `kt-a` opens the record, clicks "Xác nhận cần sửa", enters the note → status "Chờ lập tờ trình" and card "Lịch sử xác nhận hiện trạng" shows the conclusion. Run 26/10/2026 ~07:55Z: `AC-0.3 S1 UI flow: PASS`, record `SC-002` in `qltn_dev`. Screenshots: [`S1-1`](supporting/evidence/S1-1-bql-a-form-filled.png), [`S1-2`](supporting/evidence/S1-2-bql-a-submitted.png), [`S1-3`](supporting/evidence/S1-3-kt-a-before-confirm.png), [`S1-4`](supporting/evidence/S1-4-kt-a-confirmed-history.png). | Pass |

**Checks** (26/10/2026, run in phases)
- `api-qltn`: `npm run format:check` OK · `npm run lint` OK · `npm run typecheck` OK · `npm test` 39/39 · `npm run test:e2e` 8 suites, 85/85 (new suite 6/6).
- `web`: `npx vitest run` 37 files, 289/289 · `npx tsc -b` OK · `vite build` OK (output to scratchpad). `web` has no lint script.
- Local dev DB `qltn_dev`: migration `2026-10-26a` applied on dev API restart.

**Not done / notes for review**
- AC-0.3 was missing in round 1; added in fix round 1 (row above). No code changed in the fix round.
- No unit test for `assertRecordAction`'s confirmer branch; covered by e2e AC-1.2.

### Kết quả review (dev-review)

**Ngày:** 26/10/2026 · **Candidate reviewed:** `feature/b03-s1-confirmation` at `ab67a6c` (evidence `2d52094`).

**Independent checks:**

- API format check, lint and typecheck: pass.
- API unit tests: 7 suites, 39/39 pass.
- S1 e2e: 1 suite, 6/6 pass.
- Full API e2e: 8 suites, 85/85 pass.
- Web API adapter and mapper tests: 2 files, 99/99 pass.
- Full web tests: 37 files, 289/289 pass; `tsc -b` and `vite build` pass.
- Transport smoke: `http://localhost:5190/` returned HTTP 200 with the app shell; `/api/public/health-check` returned `database: up`.

**Review verdict: FAILED — return to dev-build for AC-0.3 evidence.**

- AC-0.3 remains unproven: the S1 API-mode UI click-through was not executed. The review seat had no available browser surface (`agent-browser` is not installed; the CUA browser inventory was unavailable), so the passing adapter/mapper tests and HTTP smoke check do not substitute for the required user journey.
- Please add reproducible browser evidence for the API-mode flow: create/submit a record as `bql-a`, run `confirm-repair` as `kt-a`, and verify the detail view shows the confirmation history. Then return the candidate to review through the workflow.
- Non-blocking notes: full API e2e emitted the existing `pg@9.0` concurrent-query deprecation warning; `vite build` emitted existing Zod/Rollup annotation and chunk-size warnings.

**Review round 2 — PASS WITH RESIDUE (26/10/2026).** Candidate code remains `ab67a6c`; evidence head is `53db4c6`.

- The builder's supplied AC-0.3 evidence is now complete: `s1-ui-check.mjs` drives the real API-mode UI through record creation/submission as `bql-a`, confirmation as `kt-a`, and verifies the `Chờ lập tờ trình` state plus the `Lịch sử xác nhận hiện trạng` note. Four screenshots are present under `supporting/evidence/`; the final screenshot visibly shows the confirmation toast, target status, assigned confirmer, and history card. The stale `S1-failed.png` artifact is absent.
- Independent reruns of the narrow code paths remain green: S1 e2e 6/6 and web adapter/mapper tests 99/99. The evidence script passes `node --check`, and the evidence diff passes `git diff --check`.
- Residue: rerunning the headless-Chrome evidence script in this review seat failed before page startup (`Chrome did not expose a page target`); Chrome is unavailable to this seat's browser surface. This is an environment limitation, not a candidate failure, and the builder's reproducible run plus screenshots are retained as the AC-0.3 proof.

**Review outcome:** S1 is acceptable for the PM/BA documentation close step. No application code changes were made in the fix round.

### Đóng (PM/BA)

**Ngày:** 26/10/2026 · **Kết quả:** S1 **đạt**, đóng. Code `ab67a6c`, bằng chứng tới `53db4c6`, nhánh `feature/b03-s1-confirmation`, chưa merge, chưa push.

- **AC đã có bằng chứng:**
  - AC-1.1 đến AC-1.4, cùng AC-0.1 và AC-0.2 cho ba hành động S1: e2e 6/6. Reviewer chạy lại độc lập, vẫn đạt.
  - AC-0.3: script `supporting/s1-ui-check.mjs` cùng 4 ảnh chụp. PM/BA đã tự xem ảnh `S1-4`: trạng thái "Chờ lập tờ trình", thẻ "Lịch sử xác nhận hiện trạng" có kết luận của KT-A, kèm toast "Đã xác nhận cần sửa".
- **Phần còn lại được chấp nhận:** reviewer không chạy lại được script trình duyệt vì seat review không có Chrome. Đây là giới hạn môi trường; lần chạy của dev-build và ảnh chụp được giữ làm bằng chứng.
- **Thay đổi ngoài gói S1 nhưng khớp SPEC §4:** mọi thao tác ghi hồ sơ, gồm cả lưu nháp, gửi và rút đã có, nay trả 404 khi vị trí hồ sơ nằm ngoài `locationIds` (nếu có) của người thực hiện. GET chi tiết và danh sách vẫn chỉ xét phạm vi tòa. PM/BA chấp nhận vì SPEC §4 yêu cầu "phạm vi tòa và khu vực". Phạm vi khu vực cho các thao tác đọc là điểm mở, sẽ xử lý khi rà phân quyền (OD-03, OD-10).
- **Việc tiếp theo:** chưa tạo. S2 chỉ giao khi chủ dự án yêu cầu. Việc merge `feature/b03-s1-confirmation` cũng do chủ dự án quyết định.

---

## v2: S2, S3, S4 (SPEC v2 đã duyệt, PD-12)

**Thứ tự:**
1. RM-S1, rồi RM-S2.
2. S2: workflow riêng, giao 26/10/2026.
3. S3, rồi S4: PM/BA giao sau khi slice trước đóng.

Mỗi slice làm trên một nhánh mới xếp chồng lên nhánh trước. Không push nếu chủ dự án chưa yêu cầu. Chỉ chạy các test liên quan.

### S2: Tờ trình và chuỗi duyệt

> **Bắt buộc thêm, từ lúc đóng RM-S2:** AC-2.3 chạy trên một tòa **mới tạo bằng mẫu mặc định**, và chứng minh sau khi TVKT duyệt thì hồ sơ sang chờ BQT, không sang `READY_FOR_CONSTRUCTION`. Đây là phần kiểm hành vi của RM-S2 AC-2.6 (BG-01).

#### Bằng chứng triển khai (dev-build)

**Ngày:** 26/10/2026 · **Nhánh:** `feature/b03-s2-proposal`, xếp trên `feature/rm-s2-intake-config`, chưa push.
**Commit:** API `9d73b49`, web `7c494cb` (kèm một sửa nhỏ ở API, mục "Khác SPEC"), docs PM/BA `0e80089`.

**Đã làm**
- **Dữ liệu (migration `2026-10-26d-repair-proposals.sql`, đã áp vào `qltn_dev`):**
  - bảng `repair_proposal_submissions` cho lần trình bất biến: nội dung, tổng tính ở máy chủ, tệp;
  - bảng `repair_proposal_decisions` cho quyết định từng bước, kèm nhà thầu được chọn và biên bản họp BQT;
  - bảng `repair_signatures` cho chữ ký theo tài liệu (`PROPOSAL`, `BOARD_DECISION`);
  - thêm cột vào `repair_records`: bản nháp tờ trình, bước đang chờ, lần trình hiện hành và lần trình được duyệt, số được duyệt (`bigint`), nhà thầu thực hiện.
- **Tiền:** chuỗi số nguyên VND, tính bằng BigInt, không qua số thực. Thành tiền làm tròn nửa lên đến đồng (`src/domain/proposal-quote.ts`, có unit test).
- **API T04–T09:** `POST /api/records/:id/{save-proposal-draft, submit-proposal, resubmit-proposal, approve-proposal, request-proposal-update, reject-proposal}`. Chi tiết trong `api-qltn/README.md`.
  - Bước duyệt kiểm theo thứ tự: capability, rồi trạng thái (409), rồi người giữ bước (403).
  - Người giữ bước đọc từ bản đồ thống nhất `approvalAssigneeUserIds`. Hồ sơ cũ không có bản đồ thì đọc các cột cũ.
- **Mục đích tệp:** thêm `QUOTATION`, `INCIDENT_MINUTES` và `BOARD_MINUTES`, mỗi loại có luật riêng về người tải và thời điểm (BR-C-02).
- **Chi tiết hồ sơ:** `GET /records/:id` trả thêm `proposal` (bản nháp và các lần trình, gồm quyết định và chữ ký) và `proposalAttachments`.
- **Web chế độ `api`:**
  - tab "Tờ trình và phê duyệt" có form D5-TT và bảng báo giá (hạng mục × nhà thầu, xem trước tổng);
  - mỗi nhà thầu có tệp báo giá riêng; có ô biên bản ghi nhận sự việc và chữ ký người trình;
  - thẻ chờ quyết định có hộp thoại: ở bước BQT thì kèm biên bản họp và chữ ký; ở bước cuối thì cho chọn nhà thầu, kèm lý do;
  - mỗi lần trình có thẻ chỉ đọc.

**AC → bằng chứng.** Test e2e ở `api-qltn/test/record-proposals.e2e-spec.ts`, đạt 11/11. Chạy cả bộ API: 13 suite, 116/116. Unit API 52/52; web 48 file, 350/350.

| AC | Test hoặc bằng chứng |
|---|---|
| AC-2.1 | `AC-2.1: 3 items × 3 contractors…`: tổng từng nhà thầu khớp số tính tay, dòng 1 là 1,5 × 333.333 = 500.000. Tổng do client gửi bị bỏ qua. Chữ ký `PROPOSAL` được lưu, hồ sơ sang `PENDING_TECH_REVIEW` |
| AC-2.2 | 2 nhà thầu không có lý do → 400 `shortfallReason`. Thiếu `INCIDENT_MINUTES` → 400. Chữ ký SVG → 400. Không lần nào để lại lần trình; có lý do thì trình được |
| AC-2.3 | Chạy trên **tòa `S2N` mới tạo bằng mẫu mặc định**: chuỗi `['TECH','BOARD']`. TVKT duyệt → `PENDING_BOARD_APPROVAL`, không phải `READY_FOR_CONSTRUCTION` (theo yêu cầu thêm của PM/BA). BQT duyệt thiếu biên bản → 400; thiếu chữ ký → 400; đủ cả hai → `READY_FOR_CONSTRUCTION`, số duyệt 3.410.000 = tổng nhà thầu đề xuất |
| AC-2.4 | TVKT gửi `selectedContractorIndex` khi chưa phải bước cuối → 400. BQT chọn nhà thầu 2 không có lý do → 400; chỉ số ngoài bảng → 400. Có lý do → số duyệt 3.146.000, nhà thầu Nam Phát, lý do có trong audit |
| AC-2.5 | BQT từ chối thiếu biên bản → 400; có biên bản → `REJECTED_RESUBMITTABLE`. Trình lại → bước TECH, `attemptNo` = 2. Lần 1 giữ nguyên toàn bộ (so sánh bằng nhau) cùng 2 quyết định |
| AC-2.6 | Yêu cầu bổ sung ở lần 3 → 409 `final_attempt_decide_only`. BQT từ chối lần 3 → `UNRESOLVED`. Trình lần 4 → 409 (`invalid_status_transition`; đã đủ 3 lần thì `max_submission_attempts`) |
| AC-2.7 | BQT tải `BOARD_MINUTES` khi hồ sơ chưa chờ BQT → 403; TVKT tải khi hồ sơ chờ BQT → 403 `attachment_step_denied`; người giữ bước BQT tải được |
| BR-S2-04/07 | Người giữ bước BOARD không hợp lệ → 400 `approvalStepKeys.1`. Người không giữ bước → 403 `not_step_assignee`. `submissionId` cũ → 409 `CONFLICT` |
| AC-0.1 | Bốn hành động gọi từ `PENDING_PROPOSAL`, cùng trình hoặc lưu nháp khi đang chờ duyệt → 409 `invalid_status_transition`, không ghi audit (không tính audit tải tệp) |
| AC-0.2 | Hồ sơ có snapshot cũ (bản đồ người giữ bước rỗng, người giữ nằm ở cột `consultant_user_id`/`board_user_id`) chạy hết chuỗi đến `READY_FOR_CONSTRUCTION` |
| AC-0.3 | `supporting/s2-ui-check.mjs` và 5 ảnh `evidence/S2-1…S2-5`, web chế độ `api`, tài khoản demo. BQL lập tờ trình 3 hạng mục × 3 nhà thầu kèm tệp và chữ ký, rồi trình. TVKT duyệt. BQT chọn Nam Phát kèm lý do, biên bản họp và chữ ký. Kết quả: số duyệt 3.146.000 ₫ |

**Khác SPEC hoặc tự chọn (đề nghị PM/BA xác nhận)**
1. **Kính gửi mặc định:** tên tòa trong seed đã bắt đầu bằng "Tòa", nên mặc định viết "Ban quản trị «tên tòa»" để tránh "tòa Tòa A". Tên tòa không có chữ "Tòa" vẫn theo đúng §4.1.
2. **Loại tờ trình và ngân sách** bắt buộc chọn khi trình, không tự điền.
3. **Chọn nhà thầu sớm:** gửi `selectedContractorIndex` ở bước không phải bước cuối thì trả 400, không bỏ qua.
4. **"Biên bản BQT của lần trình hiện hành"** = tệp `BOARD_MINUTES` của hồ sơ, tải lên từ lúc trình lần này trở đi. Chỉ người giữ bước BQT tải được loại tệp này, và chỉ khi hồ sơ đang chờ BQT.
5. **Route `POST /attachments`:** đổi guard từ `RECORD_EDIT` sang `VIEW`, vì BQT không có `RECORD_EDIT`. Luật theo mục đích trong service quyết định ai được tải (403 `attachment_step_denied`). Test tệp cũ vẫn đạt.
6. **Demo mock (IndexedDB)** giữ tờ trình v1. Giao diện v2 chỉ hiện khi dữ liệu đến từ API.

**Còn lại, chưa có bằng chứng**
- **`self_approval_denied` (409):** có trong code, chưa có e2e. Seed không có ai vừa là người trình (BQL, có `RECORD_EDIT`) vừa giữ một bước duyệt (cần `PROPOSAL_DECIDE`).
- **`PAYMENT_PROOF` chuyển sang người có `PAYMENT_CONFIRM` (BR-C-02):** API chưa có mục đích tệp này, để S4 làm.
- **Lần từ chối thứ 3:** không tạo thông báo "chưa xử lý". Đúng SPEC §2 (ngoài phạm vi), hồ sơ chỉ chuyển `UNRESOLVED`.

**Sửa thêm ở web:** `SignaturePad` bỏ qua lần đo kích thước 0 (khung ký bị ẩn hoặc co lại). Trước đây khi đó nét ký bị xóa và gửi đi ảnh rỗng `data:,`. Lỗi lộ ra khi chụp ảnh toàn trang trong lúc chạy script; người dùng thật cũng gặp được.

**Dữ liệu thử trong `qltn_dev`:** hồ sơ `[TEST S2 UI]` SC-004 đến SC-009 (các lần chạy script). Tòa A đã về mẫu STANDARD.

#### Kết quả review (dev-review)

**PASS WITH RESIDUE — 26/10/2026.** Candidate API `9d73b49`, web `7c494cb`, evidence/docs `c5f3e2b`, trên nhánh `feature/b03-s2-proposal`.

- API unit đạt `8 suites / 52 tests`; focused API e2e gồm `13 suites / 116 tests` trên DB cô lập `qltn_review_b03_s2_e2e`. Các luồng T04–T09, AC-0.1, AC-0.2, AC-2.1–AC-2.7 và legacy snapshot đều đạt.
- API format/lint/typecheck đạt. Web full Vitest đạt `48 files / 350 tests`; `tsc -b` đạt. Script evidence `s2-ui-check.mjs` qua `node --check`.
- Đã kiểm tra 5 screenshot AC-0.3: BQL lập tờ trình với 3 nhà thầu và chữ ký; trình thành công chờ TVKT; TVKT duyệt chuyển chờ BQT; hộp thoại BQT yêu cầu nhà thầu, lý do, biên bản họp và chữ ký; duyệt nhà thầu 2 với số tiền `3.146.000 ₫`, hồ sơ sang **Chờ thi công**.
- Rerun script headless Chrome trong seat review dừng trước khi mở page vì `Chrome did not expose a page target`; không có mutation/cleanup nào xảy ra. Đây là giới hạn môi trường, không phải lỗi candidate; evidence script và screenshot của dev-build được giữ làm bằng chứng AC-0.3.
- Không phát hiện finding chức năng trong scope S2. Tiền được giữ/tính bằng chuỗi và `bigint`; server bỏ qua tổng do client gửi và tính lại. Quyền, version, trạng thái, holder snapshot, biên bản BQT, chữ ký, chọn nhà thầu khác và tối đa 3 lần trình đều được kiểm tra qua e2e.
- **Residue:** `self_approval_denied` (BR-S2-07) có trong code nhưng chưa có e2e riêng vì seed không có người vừa là người trình vừa giữ quyền/bước duyệt. `PAYMENT_PROOF` thuộc S4 như handoff đã ghi; không thuộc scope S2.

Candidate chấp nhận được để chuyển sang bước PM/BA close.

#### Đóng (PM/BA)

**Ngày:** 26/10/2026 · **Kết quả:** S2 **đạt**, đóng. API `9d73b49`, web `7c494cb`, bằng chứng `c5f3e2b`, nhánh `feature/b03-s2-proposal` (xếp trên RM-S2). Chưa merge, chưa push.

- **Bằng chứng:** AC-2.1 đến AC-2.7 và AC-0.1 đến AC-0.3 đều có. Reviewer chạy lại: e2e 116, unit 52, web 350.
- **Yêu cầu bổ sung lúc đóng RM-S2 đã đạt:** AC-2.3 chạy trên tòa `S2N` mới tạo bằng mẫu mặc định. TVKT duyệt xong thì hồ sơ sang `PENDING_BOARD_APPROVAL`, không sang `READY_FOR_CONSTRUCTION`. **BG-01 đã chứng minh ở mức hành vi** (RM-S2 AC-2.6).
- **Phần còn lại được chấp nhận:**
  - `self_approval_denied` (BR-S2-07) đã có trong code nhưng chưa có e2e riêng. Theo ma trận v2, BQL (người trình) không có `PROPOSAL_DECIDE`, và vai trò tùy chỉnh chỉ được bớt quyền, nên hiện **không ai** vừa trình vừa duyệt được. Khi có vai trò làm được cả hai việc thì phải bổ sung e2e.
  - Seat review không có Chrome nên không chạy lại được bước kiểm trên trình duyệt; reviewer đã xem 5 ảnh.
  - `PAYMENT_PROOF` thuộc S4.
- **Việc tiếp theo:** S3 (đã duyệt, PD-12) giao ngay, xếp sau AD-S1 trong hàng đợi của dev-build. Merge do chủ dự án quyết định.

### S3: Thi công và nghiệm thu

#### Bằng chứng triển khai (dev-build)

_Chưa có._

#### Kết quả review (dev-review)

_Chưa có._

#### Đóng (PM/BA)

_Chưa có._

