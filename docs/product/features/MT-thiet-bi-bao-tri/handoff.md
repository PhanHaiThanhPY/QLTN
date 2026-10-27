# Handoff: MT-S1 Thiết bị trên dữ liệu thật, gắn với hồ sơ sửa chữa

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-25) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-MT.16).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/mt-s1-equipment`.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng, như các slice trước.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- API:
  - loại chủ thể nhật ký `MAINTENANCE_ITEM`;
  - quyền `MAINTENANCE_MANAGE` và `ITEM_CONDITION` (`api-qltn/src/domain/permissions.ts`);
  - cột `repair_records.no_maintenance_item` và lỗi trường `maintenanceItemId` khi gửi (`records.service.ts` dòng 585–595);
  - cột `approved_amount_vnd` của hồ sơ (dùng cho chi phí đã duyệt);
  - seed demo theo kiểu chỉ thêm khi chưa có, dựa theo mã (`database/seeds/database-seed.service.ts`).
- Tệp: `attachments.service.ts` chỉ nhận chủ thể `REPAIR_RECORD`. Cần thêm chủ thể `MAINTENANCE_ITEM` và mục đích "Tài liệu thiết bị" (`ITEM_DOCUMENT`, như demo), cùng luật của BR-MT-05.
- Web:
  - màn demo `features/maintenance/ItemsPage.tsx`, `ItemDetailPage.tsx`, `components/item/*`, `components/item-list/*`, `ItemFormDialog.tsx`;
  - luật demo trong `services/handlers/maintenance-item-handlers.ts`;
  - form hồ sơ `features/records/components/form/RecordInfoFields.tsx`: ở chế độ `api` hiện chỉ có ô tích "Không thuộc thiết bị cụ thể";
  - `services/http/mappers.ts` dòng ~1138 đang bỏ `maintenanceItemId`;
  - `reference-service` ở chế độ `api` trả `items: []`.
- Dữ liệu mẫu: `web/src/mock/seed-maintenance.ts` (16 thiết bị).

**Những gì phải tạo mới:**
- Bảng thiết bị, kèm ràng buộc duy nhất (tòa, mã); cột thiết bị của hồ sơ sửa chữa. Gộp vào **một** migration mới.
- API thiết bị (đọc và ghi) và phần tổng hợp cho trang thiết bị (số lần sửa chữa, chi phí đã duyệt, đang sửa chữa).
- Nối web chế độ `api`, và mở menu "Thiết bị" ở chế độ `api` (`navigation.ts`, `router.tsx`).

**Cần lưu ý:**
- Tiền: `approved_amount_vnd` là bigint. Cộng bằng số nguyên hoặc chuỗi, không dùng số thực.
- MD-06 (sửa được mã) phải sửa ở **cả** handler `mock`.
- Migration phải chạy được trên `qltn_dev` đã có dữ liệu. Ghi rõ tên tệp migration vào bằng chứng, để PM/BA ghi chú phải áp migration trước khi merge.
- Không gắn ngược thiết bị cho hồ sơ cũ (BR-MT-10).

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/mt-s1-equipment` (worktree `../QLTN-mt-s1`, tách từ `main` 4bb4325). Chưa push, chưa merge.

**Commit:**
- `981c674`: API.
- `9dc40ed`: web.
- Commit bằng chứng này: sửa chữ và lưu ảnh.

**Migration:** `api-qltn/src/database/migrations/2026-10-27c-maintenance-items.sql`. **Phải áp trước khi merge** (API tự áp khi khởi động).
- Tạo bảng `maintenance_items`, có chỉ mục duy nhất `(building_id, code)`.
- Thêm cột `repair_records.maintenance_item_id`, kèm FK và chỉ mục. Hồ sơ cũ giữ `NULL`.
- Đã chạy thử hai lần liên tiếp trên `qltn_dev` trong `BEGIN…ROLLBACK`: không lỗi; 66/66 hồ sơ cũ vẫn là `NULL`.
- Đã **áp thật trên `qltn_dev`** lúc 09:23Z, khi chạy API của worktree để chụp ảnh. Lần khởi động đó seed thêm 16 thiết bị (`+16 items`). API main đang chạy ở 5300 không bị ảnh hưởng, vì đây chỉ là bảng và cột mới.

### API (hình dạng endpoint)

- `GET /maintenance-items?buildingId&q&type&includeInactive`
  - Trả mọi thiết bị trong phạm vi, sắp theo mã.
  - Mỗi dòng: `item`, `repairCount`, `openRepairCount`, `approvedTotalVnd` (chuỗi số nguyên), `warranty` (`NONE`/`ACTIVE`/`EXPIRING`/`EXPIRED`) và `needsAttention`.
  - Ô tìm kiếm bỏ dấu tiếng Việt.
- `GET /maintenance-items/:id`: số liệu như trên, kèm `repairs` (hồ sơ được tính, mới nhất trước), `documents` và `audit`.
- Ghi:
  - `POST /maintenance-items`;
  - `PATCH /maintenance-items/:id` (nhận trường `code` nhưng **bỏ qua**, BR-MT-06);
  - `POST :id/deactivate` và `POST :id/reactivate` (cần lý do);
  - `POST :id/condition` (cần ghi chú);
  - `PUT :id/documents`.
  - Mọi lệnh ghi đều có version và nhật ký. Thứ tự kiểm: ngoài phạm vi tòa hoặc vị trí → 404; thiếu quyền → 403; sai version → 409.
- Tệp: chủ thể `MAINTENANCE_ITEM` với mục đích `ITEM_DOCUMENT` ("Tài liệu thiết bị"). Chỉ người có `MAINTENANCE_MANAGE` trong phạm vi tải được, và chỉ khi thiết bị đang dùng.
- Hồ sơ sửa chữa:
  - Nhận `maintenanceItemId`: phải cùng tòa và đang dùng. Thiết bị đang gắn sẵn trên hồ sơ vẫn hợp lệ dù sau đó đã ngừng.
  - Chọn thiết bị mà chưa có vị trí thì hồ sơ lấy vị trí của thiết bị.
  - Gửi kèm cả thiết bị lẫn `noMaintenanceItem: true` thì bị từ chối ở trường thiết bị.
  - Khi gửi (T02) phải đã chọn một trong hai, và thiết bị đã chọn phải còn đang dùng.
  - Chi tiết hồ sơ trả thêm `maintenanceItem: {id, code, name, active} | null`.
- `GET /reference` có thêm `items` (cả thiết bị đã ngừng), dùng cho ô chọn và để hiện tên.
- Seed demo: thêm 16 thiết bị của `mock/seed-maintenance.ts` vào `database/seeds/demo-items.ts`, chỉ thêm theo mã nếu chưa có. Ngày tính lùi/tiến từ ngày seed: CAM-A01 còn 20 ngày bảo hành, BOM-A01 và nhiều thiết bị khác đã hết.

### Quyết định của dev-build

- **Lịch sử tình trạng** lấy từ nhật ký sẵn có: `fromStatus`/`toStatus` là tình trạng cũ/mới, `reason` là ghi chú. Không thêm bảng mới.
- **Số liệu sửa chữa** tính bằng một truy vấn gộp, và tiền được cộng trong DB. Hồ sơ không tính: `DRAFT`, `CLOSED_NO_REPAIR`, `CLOSED_WITHDRAWN` (D-MT-1). "Đang sửa chữa" là hồ sơ được tính mà chưa ở trạng thái kết thúc.
- **Ngưỡng bảo hành** 30 ngày đặt ở một chỗ: `api-qltn/src/domain/warranty.ts` (`WARRANTY_SOON_DAYS`). Web hiện nhãn bằng `warrantyInfo` (cùng ngưỡng 30), còn bộ lọc dùng cờ do API trả về.
- **Phân trang danh sách** làm ở web, 20 dòng mỗi trang, trên toàn bộ thiết bị trong phạm vi. Lý do: các lọc nhanh và số đếm cần đủ dữ liệu, và số thiết bị mỗi tòa chỉ hàng chục đến hàng trăm.
- **Web chế độ api:** router nạp `features/maintenance/api/ItemsApiPage` và `ItemDetailApiPage`. Hai trang này dựng từ chính các component demo (header, bộ lọc, lọc nhanh, `ItemSpecCard`, `ItemDocumentsCard`, `ConditionHistory`, `AuditTimeline`, `ItemFormDialog`, `ItemConditionDialog`), bỏ mọi phần cần kế hoạch. Màn mock giữ nguyên.
  - Component dùng chung chỉ thêm prop tùy chọn: `sorts`, `filters`, `showInactiveToggle`, `actions`, `inactiveLabel`.
- **Không có quyền thì không có nút:** người không có quyền sẽ không thấy nút Sửa / Đổi tình trạng / Ngừng dùng / Dùng lại (AC-MT.5), thay vì nút bị khóa như demo. Khi mất mạng, các nút ghi bị khóa.
- **Xung đột phiên bản:** `useCommand` có thêm `errorCode` (chỉ thêm, không đổi hành vi cũ). `ItemFormDialog` dùng nó để hiện `Notice` kèm nút "Tải lại".
- **Ô chọn thiết bị trong form hồ sơ** dùng chung cho cả hai chế độ (`RecordItemSelect`). Thiết bị đã ngừng mà đang gắn với hồ sơ hiện kèm "(đã ngừng)". Tòa có hơn 50 thiết bị thì đổi thành ô nhập có `<datalist>`. Chưa chọn tòa thì ô bị khóa, gợi ý "Chọn tòa nhà trước."
- **Chữ hiển thị (cả hai chế độ):**
  - tình trạng mặc định "Chưa đánh giá" → "Chưa rõ" (theo SPEC AC-MT.1);
  - "Đầu mối" → "Người phụ trách";
  - "Mô tả" → "Thông tin kỹ thuật";
  - thứ tự trường của hộp thoại theo brief §2.3;
  - ô Loại có gợi ý từ các loại đã có trong tòa.
- **Sửa MD-06 trong mock:** `updateMaintenanceItem` giờ ghi `{ ...payload, code: item.code }`. Thêm test mock cho AC-MT.3.
- **Ngoài phạm vi nhưng đã sửa (một dòng):** ở chế độ api, menu chưa hiện "Lịch sửa chữa", vì `/records/schedule` thiếu trong `API_READY_PATHS`. Đây là thiếu sót của B4-S1 so với AC-B4.1. Đã thêm cùng `/maintenance/items`.
- **Test cũ đã sửa:** `mappers.test.ts`, ca "draft body". Test này trước kiểm rằng `maintenanceItemId` bị bỏ; nay gửi đi đúng như quy tắc MT-S1.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| AC-MT.1 | e2e "AC-MT.1": tạo BOM-A09, mã viết thường được viết hoa, tình trạng UNKNOWN, cờ `EXPIRING` và `needsAttention`, dòng nhật ký `createMaintenanceItem` của BQL-A; ảnh `MT-1-list.png` ("Sắp hết BH") |
| AC-MT.2 | e2e: trùng mã trong tòa A → lỗi ở trường `code` với đúng câu; `bql-b` tạo BOM-A09 ở tòa B → 201; một ca sai năm trường cùng lúc |
| AC-MT.3 | e2e: gửi `code: BOM-X` → mã vẫn BOM-A09, tên mới được lưu, version cũ → 409; test mock `alerts-and-equipment` (MD-06); test web `maintenance-item-mappers` (lệnh sửa không gửi `code`) |
| AC-MT.4 | e2e: `bql-b` không thấy trong danh sách, kể cả lọc theo tòa A; GET/PATCH → 404; test component: màn "Không tìm thấy thiết bị" kèm nút về danh sách |
| AC-MT.5 | e2e: `ktoan-a` đọc được, mọi lệnh ghi → 403; `kt-a` đổi tình trạng → 403; test component: không có nút ghi nào, không có "Thêm thiết bị" |
| Phạm vi vị trí | e2e: BQL bị giới hạn ở "Sảnh chính" sửa thiết bị ở chỗ khác → 404; tạo ở vị trí ngoài phạm vi → lỗi `locationId` |
| AC-MT.6 | e2e: ngừng dùng → biến khỏi danh sách mặc định, hiện lại với `includeInactive`, sửa → 409, tạo hồ sơ mới với thiết bị đó → lỗi `maintenanceItemId`; dùng lại → chọn được; hai dòng nhật ký có lý do; test component: Notice "đã ngừng dùng từ … Lý do: …" và nút "Dùng lại" |
| AC-MT.7 | e2e: ghi chú ngắn bị từ chối; UNKNOWN → NEEDS_ATTENTION được ghi nhật ký kèm ghi chú và người đổi; dòng có `needsAttention` |
| AC-MT.8 | e2e: tải lên `Hướng dẫn BOM-A09.pdf` (giữ đúng tên có dấu nhờ bản sửa UTF-8 của AT-S1), tải lại nội dung trùng byte; `kt-a` → 403; mục đích sai → 400; tài liệu không thuộc thiết bị → 400 |
| AC-MT.9 | e2e: vị trí lấy theo thiết bị, gửi được, chi tiết hồ sơ có `maintenanceItem`; script: mở "Báo sự cố" (`?itemId=`) thì form chọn sẵn BOM-A09 và điền vị trí (`MT-3-record-form-item.png`), chi tiết hồ sơ có liên kết sang trang thiết bị (`MT-4-record-detail-item.png`) |
| AC-MT.10 | e2e: chọn "Không thuộc thiết bị cụ thể" thì gửi được; chưa chọn gì → lỗi `maintenanceItemId` |
| AC-MT.11 | e2e: thiết bị tòa B → lỗi; chọn cả thiết bị và "không thuộc" → lỗi; thiết bị đã ngừng → lỗi (trong ca AC-MT.6) |
| AC-MT.12 | e2e: H1 COMPLETED 12.500.000 và H2 IN_CONSTRUCTION 4.000.000 → 2 lần, `16500000`, đang sửa 1; H3 nháp và H4 rút không được tính. Trạng thái và số tiền đặt thẳng trong DB, vì luồng duyệt có bộ test riêng. Test component: thẻ hiện `16.500.000 ₫` dạng `<dl>` |
| AC-MT.13 | e2e: hồ sơ chọn "không thuộc" có `maintenanceItemId: null` và `maintenanceItem: null`; migration giữ 66 hồ sơ cũ trên dev ở `NULL` |
| AC-MT.14 | Script: menu có "Thiết bị" (và "Lịch sửa chữa"), không có "Kế hoạch bảo trì" và "Lịch bảo trì"; ảnh `MT-1-list.png` |
| AC-MT.15 | e2e: DB mới có đúng 16 thiết bị; chạy `DatabaseSeedService.run()` lần hai vẫn 16; CAM-A01 `EXPIRING`, có thiết bị `EXPIRED`; trên dev log ghi `+16 items` |
| AC-MT.16 | Test component (loading, rỗng, lọc không ra, lỗi kèm "Thử lại", 404, h1 "mã · tên", thẻ số dạng `<dl>`, bảng có `th scope`); script 375px cho danh sách và trang thiết bị: overflow 0px (`MT-5-list-375.png`, `MT-6-item-375.png`); chế độ mock: toàn bộ test web đạt |

### Test đã chạy

- **api-qltn:**
  - `format:check`, eslint (`src/modules`, `src/database`, `src/domain`, e2e mới) và `tsc --noEmit` đều OK.
  - Unit `warranty.spec.ts`: 3/3.
  - e2e (`E2E_POSTGRES_DB=qltn_build_e2e`): `maintenance-items` 15/15; `attachments` 9/9; `records-list`, `record-emergency`, `auth`, `attachments` đều đạt.
  - `records.e2e-spec.ts` có **1 ca fail đã có sẵn trên main** (`c5d0999`): "creates a DRAFT record…" vẫn chờ `workflowApprovalSteps` theo kiểu trước FX-S3. Ca này không do MT-S1; PM/BA đã giao tôi sửa ở nhánh riêng.
- **web:**
  - `tsc -b` OK.
  - Toàn bộ vitest: 508/508. Test mới: `item-api-ui`, `ItemsApiPage`, `ItemDetailApiPage`, `RecordItemSelect`, `maintenance-item-mappers`, và ca mock MD-06.
- **Trình duyệt thật:**
  - Script `supporting/mt-s1-equipment-check.mjs`, chế độ api, API của worktree ở cổng 5302, cổng debug Chrome 9344.
  - Kết quả: PASS.

### Dữ liệu thử để lại trên qltn_dev

- 16 thiết bị demo (do seed tạo).
- Thiết bị BOM-A09 của tòa A (tạo ở lần chạy đầu, lần sau dùng lại).
- Hai hồ sơ nháp `[TEST MT THIẾT BỊ] …` mã SC-067 và SC-068, gắn với BOM-A09.

## Đóng MT-S1 (PM/BA, 27/10/2026)

- **MT-S1 đóng.** Review trên đúng bản ứng viên `0202f29`: PASS WITH RESIDUE, không có lỗi sản phẩm. Cả 16 AC có bằng chứng ở trên. PM/BA tự kiểm AC-MT.3, AC-MT.12, AC-MT.13, AC-MT.15 và tệp migration.
- **Residue được chấp nhận:**
  - Chưa chạy lại trình duyệt trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
  - Tiền hiện ký hiệu của `formatVnd` dùng chung toàn ứng dụng ("₫").
- **Merge vào `main`** (`905ba2e`) theo yêu cầu của chủ dự án. Kiểm trên bản đã merge: typecheck API và web; test web bảo trì và form hồ sơ 25/25.
- **Trước khi chạy code này**, phải áp migration `2026-10-27c-maintenance-items.sql` lên mọi DB. API tự áp khi khởi động.
