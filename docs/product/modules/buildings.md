# Module `buildings`: Tòa nhà, vị trí, cấu hình và workflow

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC  
**Code đã đọc** (commit `530831a`):
- API: `api-qltn/src/modules/buildings/*` (gồm `buildings.service.ts`, `locations.service.ts`, `building-config.service.ts`, `buildings.controller.ts`), `src/domain/building-config.ts`, `src/modules/records/records.service.ts` (dòng 290, 297–298, 338–340).
- Web: `web/src/features/buildings/*`, `web/src/features/workflow/*` (`WorkflowDesignerCard.tsx`, `hooks/useWorkflowDraft.ts`), `web/src/domain/building-config.ts`, `web/src/domain/repair-alerts.ts`.
- Test: `catalog-admin.e2e-spec.ts` (nhóm buildings, locations, config).

**Liên quan nghiệp vụ:**
- B15 (D2 nhóm 15): "Quản lý tòa, tầng, khu vực và vị trí; cấu hình theo từng tòa; sao chép mẫu cấu hình, ngưỡng tiền và quy tắc giao việc".
- B16 (D2 nhóm 16): "Thiết lập các giai đoạn, bước nghiệp vụ, vai trò duyệt và phạm vi từng tòa; quản lý cấu hình/phiên bản quy trình".
- D1 tr. 29–30.

## 1. Tính năng và trạng thái

| # | Tính năng | API | Quyền | Web `api` | Trạng thái |
|---|---|---|---|---|---|
| BU-01 | Danh sách và chi tiết tòa trong phạm vi | `GET /buildings[/:id]` | mọi người | có | Có |
| BU-02 | Tạo tòa từ mẫu cấu hình; người tạo được thêm vào phạm vi tòa mới | `POST /buildings` | ACCOUNT_MANAGE | có | Có |
| BU-03 | Sửa tòa (mã, tên, địa chỉ, hoạt động) | `PATCH /buildings/:id` | ACCOUNT_MANAGE | có | Có |
| BU-04 | Vị trí: danh sách, tạo, sửa, ngừng dùng (tầng, khu vực, tên) | `…/locations` | xem: mọi người; ghi: BUILDING_CONFIG | `LocationsPage` | Có |
| BU-05 | Xem và sửa cấu hình tòa: hạn xử lý từng bước, hạn mức khẩn cấp, ngưỡng cảnh báo, quy tắc giao việc | `GET/PUT …/config` | BUILDING_CONFIG | `ConfigCard` | Có |
| BU-06 | Áp mẫu cấu hình, hoặc sao chép từ tòa khác | `POST …/config/apply-template` | BUILDING_CONFIG | có | Có |
| BU-07 | Workflow Designer: giai đoạn, bước duyệt, bước tùy chỉnh; áp cho một hoặc nhiều tòa, tất cả cùng thành công hoặc cùng không | `PUT /building-configs/workflow` | BUILDING_CONFIG | `WorkflowDesignerCard` | Có, **có lỗi BG-01** |
| BU-08 | Lịch sử cấu hình và vị trí | `GET …/audit` | BUILDING_CONFIG | có | Có |
| BU-09 | Danh mục bước, giai đoạn, mẫu, giới hạn | `GET /building-configs/catalog` | mọi người | có | Có |
| BU-10 | Phiên bản quy trình: xem và quay lại phiên bản trước | không có | — | không có | **Chưa có** (D2 nhóm 16 có "phiên bản quy trình"). Hồ sơ đã chụp cấu hình lúc tạo nên không bị ảnh hưởng khi đổi |

## 2. Quy tắc đang chạy

- **Tòa:** mã duy nhất. Tạo tòa luôn đi kèm một cấu hình theo mẫu: `STANDARD` (mặc định), `RESIDENTIAL` hoặc `OFFICE`.

  | Mẫu | Hạn mức khẩn cấp | Giờ bổ sung hồ sơ | Ngày tra lặp | Số lần lặp | Tỷ lệ giá |
  |---|---|---|---|---|---|
  | STANDARD | 20 triệu | 24 | 90 | 2 | 1,5 |
  | RESIDENTIAL | 15 triệu | 24 | 90 | 2 | 1,5 |
  | OFFICE | 50 triệu | 48 | 120 | 3 | 1,3 |

  Hạn mức khẩn cấp lưu dạng số nguyên VND, gửi và nhận dạng chuỗi.
- **Vị trí:** gồm tầng, khu vực (tùy chọn) và tên. Tên là duy nhất trong cùng một tầng, không phân biệt hoa thường. Ngừng dùng vị trí thì vị trí bị ẩn khỏi các lựa chọn mới nhưng vẫn giữ trên hồ sơ cũ.
- **Cấu hình:**
  - Có 4 giai đoạn: INTAKE, PROPOSAL, ACCEPTANCE, PAYMENT. Mỗi giai đoạn có danh sách bước duyệt và các bước nghiệp vụ gắn với bước duyệt.
  - Có 3 bước duyệt hệ thống: TECH_CONFIRM, TECH, BOARD. Có thể thêm bước tùy chỉnh theo vai trò hoặc vai trò tùy chỉnh.
  - Vai trò của mỗi bước phải có quyền tương ứng với giai đoạn (`stageCapability`).
  - Quy tắc giao việc không được trùng; bộ phận trong quy tắc phải phụ trách tòa đó.
- **Ảnh chụp cấu hình:** hồ sơ chụp lại cấu hình lúc tạo, nên đổi cấu hình **không** ảnh hưởng hồ sơ đang chạy.
- **Ngưỡng cảnh báo:** `recentRepairDays`, `repeatMinRecords`, `priceRatio` dùng cho cảnh báo hỏng lặp lại và giá bất thường (B11). Ở web các ngưỡng này nằm trong `repair-alerts.ts`; API chưa dùng.

## 3. Khoảng trống và lỗi

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **BG-01** | **Chuỗi duyệt tờ trình có hai nguồn.** Engine dùng `approvalStepKeys`; Designer hiển thị và sửa `workflowStages[PROPOSAL]`, và khi lưu mới đồng bộ hai nơi (chỉ ở client). Nhưng tạo tòa hoặc áp mẫu qua API thì đặt `approvalStepKeys = ['TECH']`, còn PROPOSAL = `[TECH_CONFIRM, TECH, BOARD]`, và API không kiểm tra hai bên khớp nhau. **Hậu quả:** tòa mới tạo, chưa từng lưu bằng Designer, sẽ hiện 3 bước nhưng chỉ chạy bước TVKT, **bỏ qua BQT duyệt**. Điều này trái D5-QT bước 5 và DF-02 | `domain/building-config.ts` `templateValues` và `defaultWorkflowStages`; `records.service.ts` dòng 290, 338; `WorkflowDesignerCard.tsx` hàm `save` | **Cao** | Đã chuyển vào ADR-0001 (PD-07): chỉ giữ một nguồn, API buộc hai bên khớp ở mọi đường ghi, có migration. Làm trong RM-S1 |
| BG-02 | Không có mẫu "AQUA" theo quy trình D5 (TVKT xác nhận → TVKT thẩm định → BQT duyệt, nghiệm thu BQL + BQT + TVKT, BQT duyệt thanh toán) | 3 mẫu hiện có | Cao cho sản phẩm chào khách | ADR-0001 §4 thêm mẫu `AQUA`; RM-S1 |
| BG-03 | **Đã xử lý ở RM-S1.** BQL có quyền `BUILDING_CONFIG` | roles RG-01 | Cao | DF-11, ADR-0001 (tách `LOCATION_MANAGE`) |
| BG-04 | Thu hẹp phạm vi bộ phận làm quy tắc giao việc mất hiệu lực mà không báo | organization OG-01 | Trung bình | Khi lưu cấu hình hoặc thu hẹp phạm vi bộ phận: báo các quy tắc không còn ai khớp. Đưa vào SPEC cấu hình (BU-S2) |
| BG-05 | Không có phiên bản quy trình để xem và quay lại | BU-10; D2 nhóm 16 | Trung bình | BU-S2. Lịch sử audit đã có `changes`, có thể dựng phiên bản từ đó |
| BG-06 | Ngưỡng cảnh báo B11 chỉ chạy ở web demo, API chưa dùng | `repair-alerts.ts` | Thấp (B11 chưa nối API) | Xử lý khi làm module B11 |
| BG-08 | ~~BQL không còn xem được lịch sử vị trí sau RM-S1~~ **Chủ dự án quyết (PD-13):** BQL xem lịch sử tòa giống ADMIN, chỉ đọc, dùng màn hiện có. Làm trong vòng sửa RM-S1 | dev-build hỏi lúc 09:28Z | — | Không cần BU-S3 |
| BG-07 | Ngừng dùng vị trí không cảnh báo nếu vị trí đó còn hồ sơ hoặc thiết bị đang mở | `locations.service.ts` | Thấp | Hiện số hồ sơ đang mở khi ngừng dùng; không chặn |

**Đối chiếu D1/D2:** D1 tr. 30 minh họa "Thiết kế quy trình · Sửa chữa · Bước 3/6", khớp với mô hình giai đoạn và bước hiện có. Ngoài phần phiên bản quy trình (BG-05), không thấy chỗ lệch nghiệp vụ.

## 4. Slice

| Slice | Nội dung | Sẵn sàng? |
|---|---|---|
| **RM-S1** | ADR-0001 R1 + R2 cùng BG-01, BG-02: ma trận quyền v2, chọn người xác nhận theo cấu hình, một nguồn cho chuỗi duyệt, mẫu `AQUA` | Chờ dev-build bổ sung BG-01 vào ADR rồi chuyển ADR sang "chấp nhận". PM/BA viết SPEC ngay sau đó |
| BU-S2 | Phiên bản quy trình (BG-05) và cảnh báo quy tắc giao việc mất hiệu lực (BG-04) | Sau RM-S1 |
