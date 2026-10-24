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

## Catalog & administration endpoints

Writes take the `version` the client loaded; a stale one answers 409 `CONFLICT`. Every write
is audited in the same transaction. Out-of-scope buildings answer 404.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/reference` | any | Buildings, departments, locations, users in the caller's scope |
| GET | `/api/roles` | any | System roles + custom roles (`holderCount`) |
| POST / PATCH | `/api/roles`, `/api/roles/:id` | ACCOUNT_MANAGE | Custom roles only narrow their base role; codes `VT-NN` |
| GET / POST / PATCH | `/api/departments[/:id]` | read: any · write: ACCOUNT_MANAGE | Scope cannot shrink below members' buildings |
| GET | `/api/users`, `/api/users/:id`, `/api/users/:id/audit` | ADMIN_VIEW | `?q=&role=&buildingId=&departmentId=&active=&page=&limit=` |
| POST / PATCH | `/api/users`, `/api/users/:id` | ACCOUNT_MANAGE | System role is fixed; deactivation revokes sessions |
| POST | `/api/users/:id/reset-password` | ACCOUNT_MANAGE | Signs the account out everywhere |
| GET | `/api/buildings`, `/api/buildings/:id` | any | |
| POST / PATCH | `/api/buildings`, `/api/buildings/:id` | ACCOUNT_MANAGE | New building starts from a template and joins the creator's scope |
| GET | `/api/buildings/:id/audit` | BUILDING_CONFIG | Config and location history |
| GET | `/api/buildings/:id/locations` | any | `?includeInactive=false` hides inactive |
| POST / PATCH | `/api/buildings/:id/locations[/:locationId]`, `…/:locationId/status` | BUILDING_CONFIG | Name unique per floor |
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
`maintenanceItemId` is therefore rejected (400) and `POST /records` does not take `attachmentIds`;
`noMaintenanceItem` marks "Không thuộc thiết bị cụ thể". A refused source status answers 409 with
`details.reason = invalid_status_transition`; every write is limited to the record's managing BQL
(403 `not_record_manager`) and to the statuses listed in `record-actions.ts`.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/api/records` | VIEW | `?page=&limit=&search=&buildingId=&statusGroup=&status=&locationId=&assigneeId=&dateFrom=&dateTo=`; newest `updatedAt` first, `limit` > 100 answers 400, unknown parameters (e.g. `overdue`) answer 400. A `buildingId` outside the caller's scope answers an empty page with `total = 0` |
| POST | `/api/records` | RECORD_EDIT | Draft (`DRAFT`) with an `SC-…` code; optional draft fields |
| PATCH | `/api/records/:id` | RECORD_EDIT | Draft save (`DRAFT`/`NEEDS_RECORD_UPDATE`); `version` is the optimistic lock (stale → 409). `attachmentIds` replaces the record's file list (removing an id detaches the file, it is not deleted) |
| POST | `/api/records/:id/submit` | RECORD_EDIT | Optional draft fields + `version`; requires title/description/location/assignees, `noMaintenanceItem = true` and at least one image `SITE_PHOTO`; moves `DRAFT` → `PENDING_CONFIRMATION` |
| POST | `/api/records/:id/withdraw` | RECORD_EDIT | `reason` (5–1000 chars) + `version`; moves an editable record to `CLOSED_WITHDRAWN` and audits the reason |
| GET | `/api/records/:id` | any | `{ record, attachments, audit }`; parts not built yet are left empty |

## Attachment endpoints (Đợt 2 · T2)

Only repair-record site photos (`subjectType = REPAIR_RECORD`, `purpose = SITE_PHOTO`) are enabled; any other
combination answers 400 `details.reason = attachment_purpose_not_supported`. Allowed files are the demo's:
JPEG/PNG/WebP/PDF, at most 10 MB, non-empty, and the content must match the declared type (magic bytes).
Content lives under `STORAGE_DIR` (default `storage/`), named by a random id rather than the uploaded name.

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| POST | `/api/attachments` | RECORD_EDIT | Multipart `file`, `subjectType`, `subjectId`, `purpose` → 201 metadata. Only the record's manager may upload while it is `DRAFT`/`NEEDS_RECORD_UPDATE` (otherwise 403 `attachment_step_denied`) |
| GET | `/api/attachments/:id/content` | any | Bytes with the stored `Content-Type`, `Content-Disposition: inline`; another building answers 404 |

## Tests

```bash
npm test              # unit tests
npm run test:e2e      # boots the real app on database qltn_e2e (wiped each run; name must end in _e2e)
npm run lint && npm run typecheck && npm run format:check
```
