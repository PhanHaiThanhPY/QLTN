# api-qltn

Backend for QLTN (building repair & maintenance management). One NestJS 11 service,
TypeORM + PostgreSQL, modelled on the VMI-GROUP backend conventions.

## Quick start

```bash
cp .env.example .env          # fill CONFIG_POSTGRES_PASSWORD_QLTN, CONFIG_JWT_SECRET, SEED_DEMO_PASSWORD
npm install
npm run db:up                 # Postgres 16 on localhost:5434 (docker compose)
npm run start:dev             # http://localhost:5300/api
```

- Swagger: `http://localhost:5300/api/docs` (disabled when `CONFIG_ENV_MODE=production`)
- Health: `GET /api/public/health-check`

At boot the service applies pending `src/database/migrations/*.sql`, then (when
`SEED_DEMO_DATA=true`, never in production) inserts the demo buildings, departments and
accounts if missing. Demo usernames are the lower-case account codes: `admin-demo`,
`bql-a`, `kt-a`, `kt-a2`, `kt-a-cu` (inactive), `bql-b`, `kt-b`, `tvkt`, `bqt`; all share
`SEED_DEMO_PASSWORD`.

## Conventions

| Topic | Rule |
| --- | --- |
| Response | Success `{ success: true, data, timestamp, correlationId }`; error `{ success: false, error: { code, message, details }, timestamp, correlationId }`. Messages are Vietnamese. |
| Lists | `?page=&limit=` (default 20, max 100) → `{ data, meta: { page, limit, total, totalPages } }` |
| Validation | Global `ValidationPipe` (whitelist + forbid unknown fields); `VALIDATION_ERROR` lists every field in `details.fields`. |
| Auth | `Authorization: Bearer <access JWT>` (HS256). Every route is protected unless `@Public()`. The account is re-read per request, so deactivation and role/scope changes apply immediately. |
| Permissions | `@RequireCapabilities(...)` checks the role matrix in `src/domain/permissions.ts` (mirror of `web/src/domain/permissions.ts`). Building scope (`buildingIds`) is checked in services. |
| Schema | Only through new `YYYY-MM-DD[a-z]-slug.sql` files (idempotent, never edited after applying). `synchronize` is off. Constraint/index names in SQL are also declared on the entity. |
| Config | Connection settings and secrets have no defaults; a missing one stops boot. |
| Logs | `[ISO] [QLTN] [api-qltn] [LEVEL] [context] message`, level via `CONFIG_LOGGER_LEVEL`. |

## Auth endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username, password }` (username or email) → access + refresh token + profile. 10 req/min/IP. |
| POST | `/api/auth/refresh` | `{ refreshToken }` → new pair; the old refresh token is revoked. Replaying a rotated token revokes every session of the account. |
| POST | `/api/auth/logout` | `{ refreshToken }`; idempotent. |
| GET | `/api/auth/me` | Current profile, effective capabilities and building scope. |

`POST /api/auth/change-password` `{ currentPassword, newPassword }` changes the caller's password and signs out every session.
A wrong current password answers 400 on `currentPassword`; once it is proven, a new password equal to the current one
answers 400 on `newPassword` ("Mật khẩu mới phải khác mật khẩu hiện tại."). The web dialog lives in the sidebar account block (api mode).

## Catalog & administration endpoints

Writes take the `version` the client loaded; a stale one answers 409 `CONFLICT`. Every write
is audited in the same transaction. Out-of-scope buildings answer 404.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/reference` | any | Buildings, departments, locations, users in the caller's scope |
| GET | `/api/roles` | any | System roles + custom roles (`holderCount`, `newBaseCapabilities` = capabilities the base role gained since the custom role was last saved and that it does not hold; never enabled automatically) |
| POST / PATCH | `/api/roles`, `/api/roles/:id` | ACCOUNT_MANAGE | Custom roles only narrow their base role; codes `VT-NN` |
| GET / POST / PATCH | `/api/departments[/:id]` | read: any · write: ACCOUNT_MANAGE | Scope cannot shrink below members' buildings |
| GET | `/api/roles/:id/audit`, `/api/departments/:id/audit` | ADMIN_VIEW | History of a role / department (subject types `ROLE`, `DEPARTMENT` since AD-S1), paginated like `/users/:id/audit`; unknown id 404 |
| GET | `/api/users`, `/api/users/:id`, `/api/users/:id/audit` | ADMIN_VIEW | `?q=&role=&buildingId=&departmentId=&active=&page=&limit=` |
| POST / PATCH | `/api/users`, `/api/users/:id` | ACCOUNT_MANAGE | System role is fixed; deactivation revokes sessions |
| POST | `/api/users/:id/reset-password` | ACCOUNT_MANAGE | `{ password }` (8–72); signs the account out everywhere and audits `resetPassword` (reason = account code, never the password). The signed-in account itself answers 400 `details.reason = self_reset_denied` (use change-password) |
| GET | `/api/buildings`, `/api/buildings/:id` | any | |
| POST / PATCH | `/api/buildings`, `/api/buildings/:id` | ACCOUNT_MANAGE | New building starts from a template and joins the creator's scope |
| GET | `/api/buildings/:id/audit` | BUILDING_CONFIG | Config and location history |
| GET | `/api/buildings/:id/locations` | any | `?includeInactive=false` hides inactive |
| POST / PATCH | `/api/buildings/:id/locations[/:locationId]`, `…/:locationId/status` | LOCATION_MANAGE | Name unique per floor (ADMIN and BQL) |
| GET / PUT | `/api/buildings/:id/config` | BUILDING_CONFIG | Omitted workflow parts are kept; returns `{ config, changes }` |
| POST | `/api/buildings/:id/config/apply-template` | BUILDING_CONFIG | `templateKey` or `sourceBuildingId`; returns `{ config, changes, skipped }` |
| GET | `/api/building-configs` | BUILDING_CONFIG | Configs of buildings in scope |
| GET | `/api/building-configs/catalog` | any | Approval/business steps, stages, templates, limits |
| PUT | `/api/building-configs/workflow` | BUILDING_CONFIG | Several buildings, all-or-nothing |

Money fields (`emergencyLimitVnd`) are VND integers sent and returned as strings.

## Repair record endpoints (Đợt 2 · T1)

Records run in the caller's building scope (another building answers 404). Writes are audited in the same
transaction. The record keeps a snapshot of the building configuration taken when it was created: approval
steps, workflow definitions, per-step assignees and `dueDays`. Site photos (T2) are attached after creation;
transitions out of the draft (T3) are `submit` and `withdraw`; the list (T4) paginates, searches and filters in SQL.
After submission the assigned technical confirmer decides (B03–B09 SPEC, slice S1, `docs/product/features/B03-B09-luong-sua-chua/SPEC.md`).
`maintenanceItemId` is therefore rejected (400) and `POST /records` does not take `attachmentIds`;
`noMaintenanceItem` marks "Không thuộc thiết bị cụ thể". A refused source status answers 409 with
`details.reason = invalid_status_transition`; every write is limited to the record's managing BQL
(403 `not_record_manager`) and to the statuses listed in `record-actions.ts`. A record outside the caller's location
scope answers 404 to every write, like another building's record. Confirmer actions are limited to the record's
`confirmationUserId` (403 `not_step_assignee`); a role without the capability answers 403 `missing_capability`.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/records` | VIEW | `?page=&limit=&search=&buildingId=&statusGroup=&status=&locationId=&assigneeId=&dateFrom=&dateTo=&open=&attention=`; newest `updatedAt` first, `limit` > 100 answers 400, unknown parameters (e.g. `overdue`) answer 400. A `buildingId` outside the caller's scope answers an empty page with `total = 0`. `open=1` keeps records outside the final statuses (`COMPLETED`, `CLOSED_NO_REPAIR`, `UNRESOLVED`, `CLOSED_WITHDRAWN`); `attention=needs_update` keeps `NEEDS_RECORD_UPDATE`, `NEEDS_SUBMISSION_UPDATE`, `NEEDS_PAYMENT_UPDATE`, `NEEDS_REPAIR`, `UNRESOLVED` |
| GET | `/api/records/summary` | VIEW | `?buildingId=`; one query: `{ open, needsUpdate, completed, total, asOf }`. Same building scope as the list, `buildingId` outside it answers zeros. `open` counts statuses outside the final list above, `needsUpdate` counts the `attention` statuses, `total` is the denominator (every record in scope). Each number equals `meta.total` of the list call its card links to (`open=1`, `attention=needs_update`, `status=COMPLETED`, no status filter) |
| POST | `/api/records` | RECORD_EDIT | Draft (`DRAFT`) with an `SC-…` code; optional draft fields |
| PATCH | `/api/records/:id` | RECORD_EDIT | Draft save (`DRAFT`/`NEEDS_RECORD_UPDATE`); `version` is the optimistic lock (stale → 409). `attachmentIds` replaces the record's file list (removing an id detaches the file, it is not deleted) |
| POST | `/api/records/:id/submit` | RECORD_EDIT | Optional draft fields + `version`; requires title/description/location/assignees, `noMaintenanceItem = true` and at least one image `SITE_PHOTO`; moves `DRAFT` → `PENDING_CONFIRMATION` |
| POST | `/api/records/:id/withdraw` | RECORD_EDIT | `reason` (5–1000 chars) + `version`; moves an editable record to `CLOSED_WITHDRAWN` and audits the reason |
| POST | `/api/records/:id/request-record-update` | RECORD_CONFIRM | `note` (5–1000 chars) + `version`; `PENDING_CONFIRMATION` → `NEEDS_RECORD_UPDATE`, the manager supplements and submits again |
| POST | `/api/records/:id/confirm-repair` | RECORD_CONFIRM | `note` (site conclusion, 5–1000) + `version`; `PENDING_CONFIRMATION` → `PENDING_PROPOSAL` |
| POST | `/api/records/:id/close-no-repair` | RECORD_CONFIRM | `note` (5–1000) + `version`; `PENDING_CONFIRMATION` → `CLOSED_NO_REPAIR` (final) |
| POST | `/api/records/:id/save-proposal-draft` | RECORD_EDIT | S2 T04. Any subset of the proposal fields below + `version`; keeps the status (`PENDING_PROPOSAL`, `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE`); a value that is sent must be well formed |
| POST | `/api/records/:id/submit-proposal` | RECORD_EDIT | S2 T05, from `PENDING_PROPOSAL`. Optional last edits + `signature` (PNG data URL ≤ 200 KB) + `version`. Needs every field, 1–50 items, 1–5 contractors each with a price per item and ≥ 1 `QUOTATION` file, a shortfall reason under 3 contractors, ≥ 1 `INCIDENT_MINUTES` file and a valid holder for every chain step (400 `approvalStepKeys.<i>`). Freezes attempt N and moves to the first step's waiting status. A 4th attempt answers 409 `max_submission_attempts` |
| POST | `/api/records/:id/resubmit-proposal` | RECORD_EDIT | S2 T06, same as submit from `NEEDS_SUBMISSION_UPDATE` / `REJECTED_RESUBMITTABLE`; restarts at step 1 |
| POST | `/api/records/:id/approve-proposal` | PROPOSAL_DECIDE | S2 T07, holder of the current step (409 on another status first, then 403 `not_step_assignee`); optional `submissionId` (stale → 409). The submitter answers 409 `self_approval_denied`. A BQT-role step needs `boardMinutesAttachmentIds` (≥ 1 `BOARD_MINUTES` uploaded for this attempt) and `signature`. The last step may send `selectedContractorIndex`, with `selectionReason` (5–1000) when it differs from the proposed one; then `READY_FOR_CONSTRUCTION` with `approvedAmountVnd` and `executingContractorName` |
| POST | `/api/records/:id/request-proposal-update` | PROPOSAL_DECIDE | S2 T08, `reason` (5–1000); → `NEEDS_SUBMISSION_UPDATE`. On attempt 3 answers 409 `final_attempt_decide_only` |
| POST | `/api/records/:id/reject-proposal` | PROPOSAL_DECIDE | S2 T09, `reason` (5–1000), BQT step needs minutes + signature as for approve; → `REJECTED_RESUBMITTABLE`, or `UNRESOLVED` on attempt 3 |
| GET | `/api/records/:id` | any | `{ record, confirmations, attachments, proposal, proposalAttachments, audit }`; `confirmations` lists every confirmer conclusion (`CONFIRMED`, `NEEDS_UPDATE`, `NO_REPAIR`) oldest first; `proposal` is `{ draft, submissions[] }`, each submission immutable with its content, server totals, decisions and signatures (PNG data URLs); parts not built yet are left empty |

| POST | `/api/records/:id/start-construction` | CONSTRUCTION | S3 T10, from `READY_FOR_CONSTRUCTION`: `startDate`, `plannedEndDate` (≥ start), `planNote` (5–1000) → `IN_CONSTRUCTION`. Writes one notification "Kế hoạch thi công «code»" (contractor, dates, note) per holder of the record's BQT- and TVKT-role steps (BR-S3-01a) |
| POST | `/api/records/:id/update-construction` | CONSTRUCTION | S3 T11: `progressPercent` 0–100, `note` (5–1000), optional `attachmentIds` (`CONSTRUCTION`) |
| POST | `/api/records/:id/submit-acceptance` | CONSTRUCTION | S3 T12: progress must be 100; `completedDate` in [start, today VN], `inspectedAt`, `inspectionLocation` (≤ 200), `content` (10–2000), optional `otherMembers`, `photoAttachmentIds` (≥ 1, `ACCEPTANCE`/`CONSTRUCTION`). Creates minutes round N whose members are the snapshot's ACCEPTANCE steps → `PENDING_ACCEPTANCE` |
| POST | `/api/records/:id/pass-acceptance` | ACCEPTANCE_DECIDE | S3 T13, a member whose step is still open in the round (others 403 `not_step_assignee`, a second decision 409 `step_already_decided`; the manager holds `MANAGER`). Optional `note` (≤ 1000), `signature` required, optional `attachmentIds` (`ACCEPTANCE`). Members decide in parallel; when all passed → `PENDING_PAYMENT_REQUEST` and the round locks |
| POST | `/api/records/:id/fail-acceptance` | ACCEPTANCE_DECIDE | S3 T14: as pass, `note` (5–1000) required → `NEEDS_REPAIR` at once, round locked as failed |
| POST | `/api/records/:id/save-repair-evidence` | CONSTRUCTION | S3 T15, `NEEDS_REPAIR`: optional `note` (≤ 1000) and `attachmentIds`, kept in `execution.repairDraft` |
| POST | `/api/records/:id/resubmit-acceptance` | CONSTRUCTION | S3 T16: same body as submit, from `NEEDS_REPAIR`; new round, older rounds unchanged |

| POST | `/api/records/:id/submit-advance-request` | PAYMENT_RECORD | S4 A1, `READY_FOR_CONSTRUCTION`…`NEEDS_REPAIR`: `amountVnd`, `payeeName`, `accountNo` (6–20 digits), `bankName`, optional `transferContent` (≤ 210, default "BQT «tòa» THANH TOAN CHI PHI «hồ sơ»"), `requestAttachmentIds` (≥ 1 `PAYMENT_REQUEST`), `signature`. One open advance at a time (409 `open_advance_exists`); Σ advances ≤ approved (400 `amountVnd`). The record status does not change |
| POST | `/api/records/:id/resubmit-advance-request` | PAYMENT_RECORD | S4 A1b: same body; resubmits the advance sent back for update (next revision), also after acceptance (`PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE`) |
| POST | `/api/records/:id/approve-advance`, `/request-advance-update` | PAYMENT_DECIDE | S4 A2, holder of the advance's current PAYMENT step (403 `not_step_assignee`); `reason` (5–1000) to send it back |
| POST | `/api/records/:id/confirm-advance-transfer` | PAYMENT_CONFIRM | S4 A3, anyone with the capability in scope: `amountVnd` (= the instalment), `transferDate` (≤ today), `reference`, `proofAttachmentIds` (≥ 1 `PAYMENT_PROOF`); once only (409 `payment_already_confirmed`) |
| POST | `/api/records/:id/save-payment-draft` | PAYMENT_RECORD | S4 T17: settlement draft, any subset of the fields |
| POST | `/api/records/:id/submit-payment-request` | PAYMENT_RECORD | S4 T18: `amountVnd` = settled total (≤ approved, > transferred advances), payee fields, `requestAttachmentIds` + `invoiceAttachmentIds` (`INVOICE`), `signature`; refused while an advance is open (409 `open_advance_exists`). The instalment pays settled total − transferred advances; → `PENDING_PAYMENT_APPROVAL` (chain `[BOARD]`) or `PENDING_CUSTOM_PAYMENT_APPROVAL` |
| POST | `/api/records/:id/approve-payment`, `/request-payment-update` | PAYMENT_DECIDE | S4 T19/T20 on the settlement; after the last step → `PENDING_PAYMENT`, a send-back → `NEEDS_PAYMENT_UPDATE` (resubmit = next revision) |
| POST | `/api/records/:id/confirm-payment-transfer` | PAYMENT_CONFIRM | S4 T21: as A3 for the settlement |
| POST | `/api/records/:id/complete` | PAYMENT_RECORD | S4 T22: settlement transferred and Σ transferred = settled total, else 400 `payment` → `COMPLETED` |

`GET /api/records/:id` also returns `execution = { construction, acceptances[], repairDraft }` and `payment = { approvedAmountVnd, transferredTotalVnd, draft, payments[] }`: the plan and progress
updates, every acceptance round (minutes fields, members, outcome, decisions with signatures) oldest first.

Proposal fields (SPEC B03–B09 v2 §4.1–§4.2): `recipient`, `preparedByName` (both default when blank), `proposalType`
(`SUA_CHUA` · `THAY_THE` · `KHAC`), `budgetSource` (`KINH_PHI_BAO_TRI` · `KINH_PHI_VAN_HANH` · `KHAC`),
`requestContent` and `assessment` (10–2000), `desiredApprovalDate` (`YYYY-MM-DD`, optional), `items`
(`{ name, unit, quantity }`, quantity a decimal string with ≤ 3 decimals), `contractors` (`{ name, unitPricesVnd[],
otherCostVnd, taxVnd, quotationAttachmentIds[] }`, money as integer strings), `proposedContractorIndex`,
`shortfallReason`, `incidentAttachmentIds`. The server computes every total: line = quantity × unit price rounded half
up to the đồng, contractor total = Σ lines + other costs + tax; totals sent by a client are ignored.

## Attachment endpoints (Đợt 2 · T2)

Repair-record files only (`subjectType = REPAIR_RECORD`); another subject or purpose answers 400
`details.reason = attachment_purpose_not_supported`. Who may upload depends on the purpose, otherwise 403
`attachment_step_denied`:

| Purpose | Who | When |
| --- | --- | --- |
| `SITE_PHOTO` | the record's manager | `DRAFT`, `NEEDS_RECORD_UPDATE` |
| `QUOTATION`, `INCIDENT_MINUTES` | the record's manager | `PENDING_PROPOSAL`, `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE` |
| `BOARD_MINUTES` | holder of the current BQT-role approval step | while the proposal waits on that step |
| `CONSTRUCTION` | the record's manager | `IN_CONSTRUCTION`, `NEEDS_REPAIR` |
| `ACCEPTANCE` | the record's manager; an acceptance member | manager: `IN_CONSTRUCTION`, `NEEDS_REPAIR`; member: `PENDING_ACCEPTANCE` |
| `PAYMENT_REQUEST` | the record's manager | advance and settlement statuses (`READY_FOR_CONSTRUCTION`…`NEEDS_PAYMENT_UPDATE`) |
| `INVOICE` | the record's manager | `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` |
| `PAYMENT_PROOF` | anyone with `PAYMENT_CONFIRM` in scope | while an instalment can wait for its transfer (same statuses plus `PENDING_PAYMENT`) |
 Allowed files are the demo's:
JPEG/PNG/WebP/PDF, at most 10 MB, non-empty, and the content must match the declared type (magic bytes).
Content lives under `STORAGE_DIR` (default `storage/`), named by a random id rather than the uploaded name.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| POST | `/api/attachments` | VIEW | Multipart `file`, `subjectType`, `subjectId`, `purpose` → 201 metadata; the purpose rule above decides who and when |
| GET | `/api/attachments/:id/content` | any | Bytes with the stored `Content-Type`, `Content-Disposition: inline`; another building answers 404 |

## Notifications (minimum of SPEC B03–B09 v2 BR-S3-01a)

Only the caller's own notifications; the full module (kinds, e-mail, preferences) is B14.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/notifications` | any | `?page=&limit=`, newest first |
| GET | `/api/notifications/unread-count` | any | `{ unread }` |
| POST | `/api/notifications/:id/read` | any | Marks it read (first time kept); another user's id answers 404 |

## Operation log (SPEC AD-S1)

Read only by design: no endpoint changes or deletes an audit event, and events are kept indefinitely. Rows of a
building show inside the caller's building scope; rows without a building (accounts, roles, departments, exports) show
to ADMIN only. Location scope does not apply. Labels live in `src/domain/audit-labels.ts` (mirrored in the web, parity
test): a slice that writes a new action code adds its label there.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/audit-events` | AUDIT_VIEW | `?buildingId=&dateFrom=&dateTo=&actorId=&subjectType=&action=&subjectCode=&page=&limit=`; dates `YYYY-MM-DD` Vietnam time, default the last 7 days, more than 366 days or an inverted range answers 400, `limit` ≤ 100. Newest first. Each row adds `subjectCode`, `buildingCode`, `actorCode`, `actorName`, `correlationId`. A `buildingId` outside the scope answers an empty page |
| GET | `/api/audit-events/export` | AUDIT_VIEW | Same filters without paging → `text/csv`, UTF-8 with BOM, `nhat-ky-thao-tac-YYYYMMDD-HHmm.csv`; above 10 000 rows answers 400 `details = { reason: too_many_rows, total, limit }`. Each export writes an `exportAuditLog` row (system-wide) |
| GET | `/api/public/health-check` | public | `{ status, database, uptimeSeconds }`; 503 with the same body when `database = down` |

## Tests

```bash
npm test              # unit tests
npm run test:e2e      # boots the real app on database qltn_e2e (wiped each run; name must end in _e2e)
npm run lint && npm run typecheck && npm run format:check
```

## Role matrix v2 (ADR-0001, SPEC RM-S1)

The capability matrix lives in `src/domain/permissions.ts` and is mirrored by `web/src/domain/permissions.ts`; a web test
(`permissions.parity.test.ts`) fails when they differ. System roles: `ADMIN`, `BQL`, `TECH_CONFIRMER` (KT),
`TECH_CONSULTANT` (TVKT), `OWNERS_BOARD` (BQT), `ACCOUNTANT` (Kế toán, row code `KTOAN`). `BUILDING_CONFIG` (building
configuration, templates, workflow, history) is ADMIN only; locations need `LOCATION_MANAGE` (ADMIN, BQL).
`PAYMENT_CONFIRM` and `FUND_OPERATE` are declared but not used by any endpoint yet.
