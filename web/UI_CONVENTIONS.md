# UI conventions (demo QLTN)

Design system: QLTN "Cloud White + Sky Blue" (own identity). Light + dark themes.
The product uses a calm premium B2B visual language: white navigation with sky blue active states, azure primary actions, white and airy blue-tinted surfaces, restrained borders, and independent semantic status colours. Inputs use soft 12px corners, tables use quiet uppercase metadata headers, and cards use 16px corners with low-contrast shadows.
Tokens (src/index.css): bg, surface, surface-2, surface-3, ink, ink-2, ink-3, line, line-2, accent (azure, + accent-strong, accent-fg, accent-soft), navy / navy-2 / navy-3 / navy-ink / navy-ink-2 (sidebar, tags), info, good, warn, crit (+ -soft), shadow-card, shadow-pop, shadow-cta. Legacy aliases (primary, canvas, border, muted, danger, warning, success) exist only for compatibility. No raw Tailwind palette, no hex, no `font-mono`.
Status tones: good = done, warn = waiting on someone, crit = rejected/overdue/failed, info = work in progress, neutral = draft/closed. Azure is the brand/primary action colour — never use it to mean a status.
Layout: full-height white sidebar with sky blue active states (account card at the bottom), translucent content header (date, building scope, theme, notifications). PageHeader renders breadcrumb + large title + description + actions in the body; detail pages that open with a header card use `<PageHeader isCompact … />` (breadcrumb only, title kept for screen readers). Tabs are segmented controls (active = surface + azure text). KPIs = StatCard (tone stripe, metadata label first, big number). Codes = Tag (navy chip). Tables nested in a Card lose their own shadow automatically.
Spacing: use a compact 4–20px rhythm. Shared cards use 16px outer spacing and 16–20px inner padding; page shells use 20px vertical padding on desktop and 16px on small screens.

Stack: React 19, Vite 6, TS strict, Tailwind v4, TanStack Query, Zustand (session only), RHF + Zod for full-page forms, Sonner toasts, radix-ui primitives, lucide-react icons, react-router v7 (`import { Link, useNavigate, useParams, useSearchParams } from 'react-router'`).

## Data flow
- Screens NEVER touch Dexie/seed directly. Read via services (`src/services/*-service.ts`) with `useServiceQuery(key, fn)` (`src/hooks/useServiceQuery.ts`). All queries auto-refresh after any command (this tab or other tabs).
- Write ONLY via `useCommand()` (`src/hooks/useCommand.ts`): `execute({ subjectType, subjectId, expectedVersion, action, payload })`. Always pass `expectedVersion` = entity.version for existing subjects. It toasts errors, exposes `fieldErrors` (Vietnamese, keyed by field) and `isPending`. One `useCommand()` instance per dialog/intent.
- Files: `<FileUploader subjectType subjectId purpose onUploaded />` uploads immediately and returns Attachment rows; then send their ids in the command payload. View with `<AttachmentList attachments />`.
- Action availability: `evaluateAction(REPAIR_ACTIONS.x | OCCURRENCE_ACTIONS.x | PLAN_ACTIONS.x, viewer, subject)` from `src/domain/actions.ts` → `{ allowed, reason }`. Render with `<ActionButton state={...}>` (disabled + tooltip reason). Show only actions relevant to the current status (hide actions whose `from` does not include status), but keep role/assignment-denied ones visible-disabled for assigned steps.
- Viewer: `useReferenceData()` gives `data.viewer`, lookup lists (buildings, locations, users, items scoped to viewer) and name helpers `userName/buildingName/buildingCode/locationName/itemName`. There is no contractor catalogue: contractor names are free text.
- Links: `subjectPath(subjectType, id, tab?)` in `src/utils/subject-link.ts`. Detail pages read `?tab=` to open the right tab.

## Shared components (src/components)
ui/: Button (variant primary|secondary|danger|ghost|link, size sm|md|lg|icon, isLoading), Input, Textarea, NativeSelect, Field (label/error/hint/required), Card/CardHeader/CardBody, Badge (tone), Dialog (open,onOpenChange,title,description,footer,size), Tabs/TabPanel, Tooltip, Table/Th/Td/Tr (desktop only, hidden < md — render card list for mobile with `md:hidden`).
common/: PageHeader, LoadingState, EmptyState, ErrorState (handles NOT_FOUND/FORBIDDEN as "no permission"), ActionButton, ReasonDialog (required reason ≥5 chars), ConfirmDialog, FileUploader, AttachmentList, AuditTimeline, InfoGrid, Notice (info|warning|danger), Pagination, RepairStatusBadge/OccurrenceStatusBadge/PlanStatusBadge.
utils: formatDate (YYYY-MM-DD→dd/mm/yyyy), formatDateTime (ISO→VN), formatVnd, parseVndInput, toVnDate, addDays.
Runtime "today": `todayVn()` from `src/services/runtime.ts`.

## Rules (mandatory)
- No `any`; no nested ternary; no console.log (console.error in catch is fine); try/catch every async with toast for users; never empty catch.
- 1 component per file, ≤ 400 lines per file; no component defined inside another; early returns for loading/error/empty.
- Every list/detail handles loading, empty, error, no-permission. Buttons keep size while loading (Button isLoading).
- Mobile: single-column forms, cards instead of tables, no horizontal page scroll, touch-friendly buttons.
- All UI text Vietnamese; identifiers/comments English. Signing UI must read "Mô phỏng xác nhận đã ký".
- Do not edit files outside your assigned folders; if you need a helper/component, create it inside your feature folder. You may READ anything.
- Verify with `npx tsc -b` (from web/). Other agents work concurrently: ignore errors in files you do not own. Dev server already runs on http://localhost:5190 — do not start another.

## Money (deliberate exception to the "no number for money" rule)
- Amounts are whole VND kept as `number` (`amountVnd`, `estimatedAmountVnd`, `emergencyLimitVnd`, …). VND has no minor unit, so the demo never needs fractions.
- Every amount entering the domain is validated with `isValidVndAmount` (`src/utils/money.ts`: safe integer, > 0) via `FieldErrorCollector.amount`; narrow with `requireVndAmount` (`src/domain/validation.ts`) instead of `as number`.
- Allowed arithmetic on stored amounts: integer sums and comparisons. Fractional math (average/ratio in the price alert, `src/domain/repair-alerts.ts`) is display-only and never saved as an amount.
- Input/output only through `parseVndInput` / `formatVndInput` / `formatVnd`.
- When a real backend exists, switch to decimal strings (or `decimal.js`) end to end; this exception covers the IndexedDB demo only.
