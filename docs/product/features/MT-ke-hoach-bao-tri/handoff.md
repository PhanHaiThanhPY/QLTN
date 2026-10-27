# Handoff: MT-S2 Kế hoạch bảo trì và sinh lượt tự động

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-26) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-MT2.19).

**Cách làm:**
- **MT-S1 đã đạt review nhưng chưa merge.** Tách nhánh từ `feature/mt-s1-equipment` (`0202f29`). Gợi ý tên nhánh: `feature/mt-s2-maintenance-plans`. Khi MT-S1 vào `main`, rebase lên `main`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- MT-S1: bảng thiết bị; thiết bị của hồ sơ sửa chữa; luật ngừng dùng (BR-MT-03). MT-S2 thêm điều kiện về kế hoạch (BR-MT2-09).
- API: loại chủ thể nhật ký `MAINTENANCE_PLAN`, `MAINTENANCE_OCCURRENCE`; quyền `MAINTENANCE_MANAGE`, `MAINTENANCE_REVIEW`; vai trò KT là `TECH_CONFIRMER`.
- Demo (tài liệu sống về hành vi, kèm các lỗi phải sửa theo SPEC):
  - `web/src/services/handlers/maintenance-plan-handlers.ts`, `maintenance-generation.ts`;
  - `web/src/domain/schedule.ts` (tính kỳ; MD-02 nằm ở dòng 13–33);
  - `features/maintenance/Plan*.tsx`, `components/Plan*`, `ChangeScheduleDialog`, `ScheduleVersionsCard`, `OccurrenceTable`.
- Bản trích luật demo có dẫn file:dòng: `docs/product/modules/maintenance.md` §2, §4.

**Những gì phải tạo mới:**
- Bảng kế hoạch, phiên bản chu kỳ, danh mục kiểm, lượt, kỳ bỏ qua. Ràng buộc duy nhất (kế hoạch, ngày gốc) cho lượt theo chu kỳ, kiểm ở tầng dữ liệu. Gộp vào **một** migration mới.
- **Lần sinh hằng ngày ở máy chủ, 00:15 giờ VN** (BR-MT2-06):
  - chạy lặp lại và chạy song song không sinh trùng;
  - một kế hoạch lỗi không chặn kế hoạch khác;
  - gọi trực tiếp được trong test (AC-MT2.8).
- Nối web chế độ `api`: menu "Kế hoạch bảo trì", tab "Bảo trì" của trang thiết bị. Bỏ nút "Cập nhật lịch" ở chế độ `api`.

**Cần lưu ý:**
- Chu kỳ mới: **mỗi N tuần (1–8) hoặc mỗi N tháng (1–24)**. Demo chỉ có 1/3/6/12 tháng.
- Chọn chu kỳ áp dụng theo **ngày hiệu lực**, không theo số phiên bản (MD-02, AC-MT2.13).
- Tạm dừng và kết thúc **tự hủy** lượt "Đã lên lịch" (khác demo).
- Slice này không gửi thông báo, và lượt chưa có trang chi tiết (MT-S3).
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/mt-s2-plans` (worktree `../QLTN-mt-s2`), tách từ `main` `57a21cb` (đã có MT-S1).

**Commit:** `8ce52cf` (schema + tính kỳ), `962dbc5` (WIP), `cae2b16` (API + e2e + seed), `ec05a2d` (web), và commit bằng chứng này.

**Migration:** `api-qltn/src/database/migrations/2026-10-27e-maintenance-plans.sql`.
- Bốn bảng: `maintenance_plans`, `maintenance_schedule_versions`, `maintenance_occurrences`, `maintenance_skipped_periods`.
- Lượt theo chu kỳ có ràng buộc duy nhất từng phần `(plan_id, period_key) WHERE period_key IS NOT NULL`.
- Chạy thử hai lần liền trong `BEGIN … ROLLBACK` trên qltn_dev: OK.
- Đã áp thật lên qltn_dev khi API của worktree khởi động (để chụp ảnh).

### Quyết định (SPEC chưa nói rõ)

- **Lần sinh:**
  - Mỗi kế hoạch một transaction. Khi chèn dùng `ON CONFLICT DO NOTHING` trên khóa kỳ, nên chạy lặp lại hay chạy song song đều không sinh trùng.
  - Lỗi của một kế hoạch được ghi log, trả về trong `failedPlans`, rồi chạy tiếp các kế hoạch khác.
  - Hẹn giờ chạy 00:15 giờ VN, cộng một lần **chạy bù khi khởi động** (cho các kỳ lỡ trong lúc máy chủ tắt, và kế hoạch vừa seed).
  - Tắt khi `NODE_ENV=test` hoặc `MAINTENANCE_SCHEDULER=off`. `runDaily(today)` gọi trực tiếp được trong test.
- **Khóa kỳ (`period_key`):**
  - Hủy thường giữ khóa kỳ, nên lần sinh sau không sinh lại kỳ đó.
  - Tạm dừng, kết thúc, và hủy một lượt "Lịch đã đổi" thì nhả khóa kỳ, để lịch mới dùng được ngày đó (BR-MT2-05).
- **Chạy lại:** ghi kỳ bỏ qua cho các kỳ trong `[ngày tạm dừng, hôm nay)` chưa có lượt nào còn hiệu lực. Sau đó sinh lượt từ hôm nay.
- **Sửa kế hoạch đang chạy hoặc tạm dừng:** người, danh mục kiểm và nhà thầu được áp cho các lượt "Đã lên lịch" (D-MT2-4). Gửi các trường chu kỳ hay thiết bị thì máy chủ bỏ qua; gửi thiết bị khác thì báo lỗi trường `itemId`.
- **Đổi người quản lý:** `POST /maintenance-plans/:id/manager`, chỉ ADMIN; chưa có màn hình, vì brief không có.
- **Seed demo:**
  - Thêm 6 kế hoạch "Bảo trì định kỳ «mã»" (`KH-001`…`006`) cho TM-A01, BOM-A01, MPD-A01, BC-A01, CS-B01, TG-B01, ở trạng thái Đang chạy, ngày gốc lấy tương đối theo hôm nay như mock.
  - Người quản lý và người thực hiện là BQL phụ trách thiết bị; người xác nhận là KT như mock.
  - Kế hoạch chỉ được thêm khi thiết bị chưa có kế hoạch cùng tên.
- **Web: các màn chế độ `api` nằm riêng trong `features/maintenance/api/`**, theo cách MT-S1 đã làm.
  - Lý do: các component kế hoạch của demo gắn chặt với kiểu dữ liệu demo (`frequency` 1/3/6/12 tháng, `revision`), không biểu diễn được "mỗi N tuần".
  - Dùng lại nguyên `ChecklistTemplateEditor` (sửa thành generic và thêm ô "Cần ảnh"; demo không đổi hành vi), `ChecklistTemplateCard`, `DateReasonDialog` (thêm `maxDate` và gợi ý), `DetailHeaderCard`, `ReasonDialog`, `AuditTimeline`.
  - Phép tính kỳ có bản sao ở `web/src/domain/maintenance-periods.ts`, giống `api-qltn/src/domain/maintenance-schedule.ts`. Web chỉ dùng để xem trước ngày và giới hạn ngày đổi lịch; máy chủ vẫn là nơi quyết định.
- **Menu `⋯`:** thêm `components/ui/action-menu.tsx` (radix DropdownMenu, dùng được bằng bàn phím).
- **Danh mục kiểm trong trang kế hoạch:** mục cần ảnh ghi "(cần ảnh)" sau tên mục.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| MT2.1 | e2e "a new plan is a draft…" (mã `KH-NNN`, chưa có lượt); script: `AC-MT2.1 KH-007: DRAFT` |
| MT2.2 | e2e "people and checklist rules"; web `plan-api-form-schema.test`, `plan-api-ui.test` (người hợp lệ) |
| MT2.3, MT2.8 | e2e "activation generates within 30 days; the daily run adds the next period later" (`runDaily` với ngày tương lai) |
| MT2.4 | e2e "a draft whose start has passed…" (lỗi trường `startDate`, sửa ngày rồi kích hoạt được) |
| MT2.5, MT2.6 | e2e "every two weeks; repeated and parallel daily runs add nothing" |
| MT2.9 | e2e "a broken plan is logged and never stops the others" |
| MT2.10 | e2e "pausing cancels…; resuming records the skipped periods…"; web: kỳ bỏ qua hiện trong bảng (`PlanDetailApiPage.test`) |
| MT2.11 | e2e "ending cancels, cannot resume, and the daily run adds nothing"; web: kế hoạch kết thúc không có nút nào |
| MT2.12, MT2.13 | e2e "a schedule change flags…, and replaces later changes"; script: `2026-11-10, 2026-11-12*, 2026-11-24`; ảnh MT2-3, MT2-4 |
| MT2.14–16 | e2e "reschedule before the next period, people follow, make-up occurrence"; web `plan-api-ui.test` (ngày đổi lịch muộn nhất) |
| MT2.17 | e2e "an item with a running plan cannot be stopped…" (409, có mã kế hoạch; không tạo được lượt bù) |
| MT2.18 | e2e "building scope, read-only accounts and the version lock" (404, 403, 409) |
| MT2.19 | ảnh MT2-1…8 bên dưới; test component `PlansApiPage`, `PlanDetailApiPage`, `ItemDetailApiPage` |
| BR-MT2-10 | e2e "the demo seed adds six running plans once…" |

### Ảnh (`supporting/evidence/`, chế độ api, tài khoản `bql-a`)

Script: `supporting/mt-s2-plans-check.mjs`. Kết quả: PASS, không cuộn ngang ở 375px.
- Dữ liệu thử: kế hoạch `[TEST MT KẾ HOẠCH] … ` (KH-007) trên BOM-A09, sinh 3 lượt BT-0005…0007. Script tự kết thúc kế hoạch này khi xong, nên BOM-A09 vẫn ngừng dùng được.

| Ảnh | Nội dung |
|---|---|
| MT2-1-plans | menu "Kế hoạch bảo trì", thẻ số, bảng có chu kỳ bằng chữ và lượt kế tiếp |
| MT2-2-plan-form | form mở từ thiết bị (`?itemId=`), "Mỗi [1] [tháng]", ô "Cần ảnh", xem trước "27/10 · 27/11 · 27/12" |
| MT2-3-plan-page | kế hoạch đang chạy, thông báo "1 lượt có lịch đã đổi", cờ "Lịch đã đổi" |
| MT2-4-occurrence-menu | menu `⋯` của lượt bị đánh dấu: Giữ lượt này · Đổi lịch · Hủy; lịch sử chu kỳ ghi "Bị thay bởi lần đổi" |
| MT2-5-change-schedule | hộp thoại đổi chu kỳ |
| MT2-6-item-maintenance | tab "Bảo trì" và thẻ "Lần kế tiếp" trong trang thiết bị |
| MT2-7-plans-375, MT2-8-plan-375 | điện thoại: thẻ; các nút đầu trang gom vào "Thao tác" |

### Test đã chạy (trên `ec05a2d`)

- **api:**
  - `format:check`, `tsc` và eslint: OK.
  - unit 97/97 (gồm `maintenance-schedule.spec` 7/7).
  - e2e trên `qltn_build_e2e`: `maintenance-plans` (13), `maintenance-items`, `records`, `records-list`: 47/47.
- **web:** `tsc -b` OK; vitest toàn bộ 535/535 (84 tệp).
- **Tốc độ:** khi khởi động, lần sinh chạy bù cho 6 kế hoạch seed mất 22 ms (+4 lượt, 0 lỗi).

### Còn lại / ghi chú cho review

- **Gộp với TK-S1:** TK-S1 (đang chờ PM/BA đóng) cũng sửa `API_READY_PATHS` trong `web/src/app/navigation.ts`. Khi gộp, giữ cả `/tasks` lẫn `/maintenance/plans`.
- Lượt chưa có trang chi tiết (MT-S3), nên dòng lượt không phải liên kết.

## Đóng MT-S2 (PM/BA, 27/10/2026)

- **MT-S2 đóng.** Review PASS WITH RESIDUE trên `6e3b32c`. Sau khi F-S1 chuyển lần sinh lượt sang bộ lịch chạy dùng chung, dev-review chạy lại e2e kế hoạch bảo trì trên bản F-S1 `a572cbe`: 13/13 (AC-MT2.6, AC-MT2.8). Mọi AC đều có bằng chứng ở trên.
- **Residue được chấp nhận:** chưa chạy lại trình duyệt trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
- **Merge vào `main`** theo yêu cầu của chủ dự án: TK-S1 (`896d7eb`), rồi nhánh tích hợp `integration/tk-mt2-f1` (`d6ebda4`, MT-S2 và F-S1). dev-build gỡ xung đột `navigation.ts` và `app.module.ts` theo kiểu giữ cả hai. PM/BA kiểm `API_READY_PATHS` đủ 9 đường dẫn.
- **Kiểm trên bản đã merge:**
  - dev-build: vitest 229/229, API unit 79/79, e2e 58/58;
  - PM/BA: typecheck API và web.
- **Trước khi chạy code này**, phải áp migration `2026-10-27e-maintenance-plans.sql` lên mọi DB. API tự áp khi khởi động.

