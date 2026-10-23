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
steps, workflow definitions, per-step assignees and `dueDays`. In T1 only create, draft save and detail are wired;
submitting for confirmation (T3), files (T2) and lists (T4) are not. `maintenanceItemId` and `attachmentIds` are
therefore rejected (400); `noMaintenanceItem` marks "Không thuộc thiết bị cụ thể".

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| POST | `/api/records` | RECORD_EDIT | Draft (`DRAFT`) with an `SC-…` code; optional draft fields |
| PATCH | `/api/records/:id` | RECORD_EDIT | Draft save; `version` is the optimistic lock (stale → 409) |
| GET | `/api/records/:id` | any | `{ record, audit }`; parts not built yet are left empty |

## Tests

```bash
npm test              # unit tests
npm run test:e2e      # boots the real app on database qltn_e2e (wiped each run; name must end in _e2e)
npm run lint && npm run typecheck && npm run format:check
```
