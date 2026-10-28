# ADR-0001: Ma trận vai trò và quyền v2, người giữ bước theo cấu hình tòa

**Trạng thái:** Đã chấp nhận (PD-07, 26/10/2026)
**Ngày:** 26/10/2026 · **Người đề xuất:** dev-build · **Người quyết:** PM/BA (`dev-pm-ba@qltn`), theo PD-06; câu trả lời Q1–Q8 và yêu cầu BG-01 tại qitem `qitem-20261026085328-0ac70085b7b9948e`
**Yêu cầu gốc:** qitem `qitem-20261026084751-b8b87d6d995fc67f` · **Căn cứ nghiệp vụ:** [PRODUCT-DEFAULTS.md](../../product/PRODUCT-DEFAULTS.md) DF-01, DF-02, DF-06, DF-08, DF-10, DF-11, DF-12

## Bối cảnh

### Mô hình hiện tại (đọc từ code ngày 26/10/2026)

- **Vai trò hệ thống cố định:** `ADMIN`, `BQL`, `TECH_CONFIRMER` (KT), `TECH_CONSULTANT` (TVKT), `OWNERS_BOARD` (BQT).
  - Định nghĩa tại `api-qltn/src/domain/permissions.ts`, có bản sao tại `web/src/domain/permissions.ts`; hai nơi phải đổi cùng nhau.
  - CSDL chặn bằng CHECK `CHK_users_role` và `CHK_role_definitions_base_role` (migration `2026-10-21a`, `2026-10-21b`).
- **Đồng bộ quyền:** `RolesService.syncSystemRoles` đồng bộ dòng vai trò hệ thống theo bảng quyền trong code ở mỗi lần khởi động. Đổi `ROLE_CAPABILITIES` là tự áp dụng cho mọi tài khoản dùng vai trò hệ thống.
- **Vai trò tùy chỉnh (`VT-xx`)** lưu danh sách quyền riêng, chỉ thu hẹp được vai trò gốc: `effectiveCapabilities = gốc ∩ danh sách riêng`.
- **Cấu hình tòa:**
  - `workflowStages` có 4 giai đoạn: `INTAKE`, `PROPOSAL`, `ACCEPTANCE`, `PAYMENT`. Mỗi giai đoạn có `approvalStepKeys`.
  - Bước có sẵn `TECH_CONFIRM` / `TECH` / `BOARD` gắn cứng với vai trò KT / TVKT / BQT. Ngoài ra có bước tùy chỉnh (`role` hoặc `roleDefId`).
  - `validateConfigRules` buộc vai trò của bước có quyền theo giai đoạn (`stageCapability`): `PAYMENT` → `PAYMENT_DECIDE`, `ACCEPTANCE` → `ACCEPTANCE_DECIDE`, còn lại → `PROPOSAL_DECIDE`, kể cả `INTAKE`.
- **Hồ sơ sửa chữa:**
  - Khi tạo, hồ sơ chụp lại cấu hình: `approvalStepKeys`, `workflowApprovalSteps`, `workflowStageApprovalStepKeys`, `approvalAssigneeUserIds`.
  - Người giữ bước có sẵn lấy từ cột cố định: `TECH_CONFIRM` → `confirmationUserId`, `TECH` → `consultantUserId`, `BOARD` → `boardUserId` (`APPROVAL_STEP_SLOT`). Bước tùy chỉnh lấy từ `approvalAssigneeUserIds`.
- **Xác nhận hiện trạng (S1, đã build):** người làm là `record.confirmationUserId`. Nhưng khi tạo, lưu nháp và gửi, `records.service.ts` buộc người này có vai trò `TECH_CONFIRMER` (`firstActiveInRole`, `validateConfirmer`, `assertSubmittable`). Giai đoạn `INTAKE` có trong cấu hình nhưng S1 **không đọc** nó.

### Yêu cầu mới (DF)

| DF | Cần gì về quyền và mô hình |
|---|---|
| DF-01 | Người xác nhận hiện trạng cấu hình theo tòa. Mẫu "Aqua" dùng TVKT; không có TVKT thì dùng BQT. |
| DF-02 | Chuỗi tờ trình TVKT → BQT. Quyết định của BQT phải kèm tệp "biên bản họp BQT". |
| DF-06 | Thành phần nghiệm thu cấu hình theo tòa; mẫu "Aqua" = BQL + BQT + TVKT. Lượt nghiệm thu chỉ đạt khi mọi thành phần bắt buộc xác nhận ĐẠT. |
| DF-08, DF-10 | Vai trò hệ thống mới **Kế toán**: xác nhận đã chuyển khoản (B09; BQT cũng được xác nhận), và làm nghiệp vụ tiền của F06–F09, T03–T06. |
| DF-11 | Chỉ Quản trị sửa cấu hình tòa: bỏ `BUILDING_CONFIG` khỏi BQL. |
| DF-12 | Bước đang mở của người bị khóa hoặc thu hẹp quyền chuyển vào "Cần phân công lại" (US-S2). Chỉ ảnh hưởng mô hình ở chỗ: người giữ bước phải tra được theo khóa bước. |

## Quyết định

### 1. Vai trò hệ thống: thêm `ACCOUNTANT`

| Vai trò | Mã dòng `role_definitions` | Nhãn |
|---|---|---|
| `ACCOUNTANT` (mới) | `KTOAN` (không dùng `KT`, vì `KT` đã là Kỹ thuật) | Kế toán |

Vẫn giữ `TECH_CONFIRMER` (KT). KT vẫn kiểm tra bảo trì và vẫn có thể là người xác nhận ở mẫu cấu hình khác "Aqua". Không thêm vai trò "Người nghiệm thu" (DF-10): thành phần nghiệm thu là các bước trong giai đoạn `ACCEPTANCE`.

### 2. Quyền mới

| Quyền | Ý nghĩa | Ghi chú |
|---|---|---|
| `PAYMENT_CONFIRM` | Xác nhận đã chuyển khoản một đợt thanh toán, kèm chứng từ (DF-08) | Tách khỏi `PAYMENT_RECORD`. Từ nay `PAYMENT_RECORD` chỉ còn nghĩa: BQL lập đề nghị và đóng hồ sơ. |
| `FUND_OPERATE` | Nghiệp vụ tiền của quỹ khai thác (F06–F09) và tiền gửi quỹ bảo trì (T03–T06) | F-S3 dùng cho khoản thu, nhận cọc, thuế, phiếu chi của quỹ khai thác. Nhóm T dùng tiếp cho quỹ bảo trì. |
| `LOCATION_MANAGE` | Quản lý tầng, khu vực, vị trí của tòa trong phạm vi | Tách khỏi `BUILDING_CONFIG` để BQL vẫn quản lý vị trí sau DF-11. **Cần PM/BA xác nhận (Q7).** |

### 3. Ma trận v2 (API và web giống nhau)

Ký hiệu: ✓ = giữ như hiện nay; **+** = thêm; **−** = bỏ.

| Quyền | ADMIN | BQL | KT | TVKT | BQT | Kế toán |
|---|---|---|---|---|---|---|
| `VIEW` | ✓ | ✓ | ✓ | ✓ | ✓ | **+** |
| `RECORD_EDIT` | | ✓ | | | | |
| `RECORD_CONFIRM` | | | ✓ | **+** (DF-01) | **+** (DF-01, dự phòng) | |
| `PROPOSAL_DECIDE` | | | ✓ | ✓ | ✓ | |
| `CONSTRUCTION` | | ✓ | | | | |
| `ACCEPTANCE_DECIDE` | | **+** (DF-06, xem Q1) | ✓ | ✓ | **+** (DF-06) | |
| `PAYMENT_DECIDE` | | | | | ✓ | |
| `PAYMENT_RECORD` (lập đề nghị, đóng hồ sơ) | | ✓ | | | | |
| `PAYMENT_CONFIRM` (mới) | | | | | **+** | **+** |
| `FUND_OPERATE` (mới) | | | | | | **+** |
| `MAINTENANCE_MANAGE` | | ✓ | | | | |
| `MAINTENANCE_REVIEW` | | | ✓ | | | |
| `ITEM_CONDITION` | | ✓ | | | | |
| `REASSIGN` | | ✓ | | | | |
| `REPLACE_MANAGER` | ✓ | | | | | |
| `REPORT_VIEW` | ✓ | ✓ | | ✓ | ✓ | **+** |
| `ADMIN_VIEW` | ✓ | | | | | |
| `BUILDING_CONFIG` | ✓ | **−** (DF-11) | | | | |
| `LOCATION_MANAGE` (mới, Q7) | **+** | **+** | | | | |
| `ACCOUNT_MANAGE` | ✓ | | | | | |
| `EMERGENCY_START` | | ✓ | | | | |
| `EXPLOITATION_VIEW` (mới, F-S1) | **+** (RM-S2, chỉ xem) | **+** | | | **+** | |
| `EXPLOITATION_MANAGE` (mới, F-S1) | | **+** | | | | |
| `EXPLOITATION_APPROVE` (mới, F-S2) | | | | | **+** | |
| `EXPLOITATION_CONTRACT_VIEW` (mới, F-S2) | **+** (RM-S2, chỉ xem) | **+** | | | **+** | **+** |
| `FUND_VIEW` (mới, F-S3) | **+** (RM-S2, chỉ xem) | | | | **+** | **+** |
| `FUND_APPROVE` (mới, F-S3) | | | | | **+** | |
| `FUND_REPORT` (mới, F-S5) | **+** (RM-S2, chỉ xem) | | | | **+** | **+** |
| `DEPOSIT_VIEW` (mới, T-S1) | **+** (RM-S2, chỉ xem) | **+** | | | **+** | **+** |
| `DEPOSIT_MANAGE` (mới, T-S1) | | **+** | | | | |
| `DEPOSIT_APPROVE` (mới, T-S1) | | | | | **+** | |

Nguyên tắc cũ vẫn giữ: ADMIN không có quyền quyết định nghiệp vụ.

### 4. Người giữ bước theo cấu hình (DF-01, DF-06)

**4.1. Quyền theo giai đoạn.** Sửa `stageCapability`: `INTAKE` → `RECORD_CONFIRM` (hiện là `PROPOSAL_DECIDE`). Các giai đoạn khác giữ nguyên. Nhờ đó `validateConfigRules` tự từ chối cấu hình đặt vào `INTAKE` một vai trò không có quyền xác nhận.

**4.2. Người xác nhận (DF-01) = bước duy nhất của giai đoạn `INTAKE`.**
- Thêm luật cấu hình: `INTAKE.approvalStepKeys` có đúng 1 phần tử.
- Mẫu "Aqua" (template mới `AQUA`) đặt `INTAKE = [TECH]`. Mẫu `STANDARD` giữ `[TECH_CONFIRM]`. Tòa không có TVKT chọn `[BOARD]`.
- Khi tạo hồ sơ, người xác nhận là người đầu tiên đủ điều kiện cho bước đó, theo luật giao việc. Nếu không có ai, áp dụng **dự phòng tại thời điểm tạo hồ sơ**: lấy người giữ bước `BOARD`, và ghi audit lý do "Không có TVKT, dùng BQT" (xem Q2).
- `validateConfirmer`, `firstActiveInRole('TECH_CONFIRMER')` và kiểm tra trong `assertSubmittable` đổi sang kiểm theo vai trò (hoặc `roleDefId`) của bước `INTAKE` trong snapshot. Không còn chuỗi cứng `TECH_CONFIRMER`.

**4.3. Bản đồ người giữ bước thống nhất.**
- `approvalAssigneeUserIds` (hiện chỉ dùng cho bước tùy chỉnh) được mở rộng thành bản đồ **khóa bước → người giữ** cho mọi bước của hồ sơ mới, kể cả `TECH_CONFIRM`, `TECH`, `BOARD`.
- Thêm bước có sẵn mới `MANAGER` (vai trò `BQL`, người giữ = `managerUserId`). Bước này chỉ hợp lệ trong giai đoạn `ACCEPTANCE`.
- `confirmationUserId` giữ nghĩa "người giữ bước `INTAKE`", bất kể vai trò.
- Lý do: khi người xác nhận là TVKT, bảng `APPROVAL_STEP_SLOT` hiện tại sẽ cho `TECH_CONFIRM` trỏ vào một TVKT. Tra theo khóa bước cũng là điều DF-12 / US-S2 cần để tìm "bước đang mở của người X".
- Cột `consultantUserId`, `boardUserId` vẫn giữ để đọc hồ sơ cũ. Hồ sơ mới ghi cả hai nơi cho đến khi bỏ cột (ADR sau).

**4.4. Nghiệm thu (DF-06).**
- Thành phần bắt buộc = `ACCEPTANCE.approvalStepKeys` trong snapshot. Mẫu `AQUA` = `[MANAGER, BOARD, TECH]`.
- Mọi thành phần quyết định **song song**, không theo thứ tự. Lượt đạt khi mọi bước đạt. Một thành phần "không đạt" thì lượt không đạt.
- Quy tắc này thay quy tắc tạm "song song khi đúng bằng `[TECH_CONFIRM, TECH]`" (BR-09 của SPEC B03–B09 v1) cho các hồ sơ theo SPEC v2.

**4.5. Biên bản họp BQT (DF-02).**
- Thêm mục đích tệp `BOARD_MINUTES`.
- `approveProposal` / `rejectProposal` ở bước có vai trò `OWNERS_BOARD` bắt buộc có ít nhất 1 tệp `BOARD_MINUTES` của lần trình hiện hành.
- Người tải lên: người giữ bước BQT, khi hồ sơ đang ở trạng thái chờ BQT. Đây là một dòng mới trong bảng người tải tệp (BR-12 của SPEC).

**4.6. Xác nhận chuyển khoản (DF-08).**
- `recordPayment` cần `PAYMENT_CONFIRM` và **không có người giữ bước cố định**: bất kỳ BQT hoặc Kế toán nào trong phạm vi tòa đều được xác nhận (xem Q4).
- Kế toán dùng phạm vi tòa như mọi vai trò khác (`user_buildings`).

### 4.7. Một nguồn duy nhất cho chuỗi duyệt tờ trình (BG-01)

**Kiểm chứng code và dữ liệu (dev-build, 26/10/2026).** PM/BA đọc code đúng, và lệch còn rộng hơn:

- Bộ máy chạy theo `config.approvalStepKeys`:
  - Khi tạo hồ sơ, `records.service.ts` chụp `approvalStepKeys: [...config.approvalStepKeys]` và `workflowApprovalStepsOf(config)`, cả hai đọc `config.approvalStepKeys`.
  - `assertSubmittable` và các handler tờ trình của web đi theo `record.approvalStepKeys`.
- Màn thiết kế (`web/.../WorkflowDesignerCard.tsx`) lưu `approvalStepKeys = PROPOSAL.approvalStepKeys`, nhưng chỉ ở client.
- API không ép hai giá trị bằng nhau ở bất kỳ đường ghi nào:
  - `templateValues()` (dùng khi tạo tòa) đặt `approvalStepKeys = DEFAULT_APPROVAL_STEP_KEYS = ['TECH']`, trong khi `defaultWorkflowStages()` có `PROPOSAL = [TECH_CONFIRM, TECH, BOARD]`.
  - `applyTemplate` (theo mẫu) đặt lại `approvalStepKeys = ['TECH']` nhưng **giữ nguyên** `workflowStages` hiện có.
  - `PUT config` và cập nhật hàng loạt (`mergeValues`) nhận hai trường độc lập.
  - `validateConfigRules` không so sánh hai trường.
- **Seed demo cũng lệch:** `DEMO_APPROVAL_STEP_KEYS = ['TECH', 'BOARD']` ghi đè chuỗi, giai đoạn vẫn mặc định ba bước. DB local `qltn_dev` ngày 26/10/2026: cả 4 tòa A–D có `approval_step_keys = {TECH,BOARD}` nhưng `PROPOSAL = [TECH_CONFIRM, TECH, BOARD]`.
- **Hồ sơ cũng chụp hai giá trị lệch:** `SC-001`, `SC-002` có `approvalStepKeys = {TECH,BOARD}` còn `workflowStageApprovalStepKeys.PROPOSAL` có ba bước.
- **Hệ quả:** người xem màn thiết kế thấy KT → TVKT → BQT, nhưng hồ sơ chạy TVKT → BQT (seed) hoặc chỉ TVKT (tòa tạo hay áp mẫu qua API, không lưu lại ở màn thiết kế). Trường hợp chỉ TVKT bỏ qua BQT, trái D5-QT bước 5 và DF-02.

**Quyết định:**
1. **Nguồn chuẩn là giai đoạn `PROPOSAL`.** `approvalStepKeys` của cấu hình trở thành giá trị **suy ra**: server luôn ghi `approvalStepKeys = PROPOSAL.approvalStepKeys` ở mọi đường ghi: tạo tòa (`templateValues`), áp mẫu, sao chép từ tòa khác, `PUT config`, cập nhật workflow hàng loạt, và seed.
   - Nếu request gửi `approvalStepKeys` khác `PROPOSAL`, API trả 400 lỗi trường `approvalStepKeys`: "Chuỗi phê duyệt phải trùng các bước của giai đoạn Tờ trình."
   - `validateConfigRules` thêm đúng luật này nên mọi đường ghi đều bị chặn.
   - Cột `approval_step_keys` giữ lại để không đổi schema và hồ sơ cũ.
2. **Mặc định mới:** `defaultWorkflowStages().PROPOSAL = [TECH, BOARD]` (DF-02). Bỏ `DEFAULT_APPROVAL_STEP_KEYS` và `DEMO_APPROVAL_STEP_KEYS`. `applyTemplate` đặt lại cả `workflowStages` và chuỗi duyệt về giá trị của mẫu, để hai giá trị luôn đi cùng nhau.
3. **Migration dữ liệu cấu hình** (migration SQL, idempotent, có audit `migrateApprovalChain` cho từng tòa bị đổi): với tòa lệch, ghi `PROPOSAL.approvalStepKeys := approval_step_keys`, tức **giữ chuỗi bộ máy đang chạy**.
   - Lý do: không đổi hành vi của hồ sơ sẽ tạo ngay sau migration, và seed khi đó khớp DF-02 (TVKT → BQT).
   - Tòa chỉ có `[TECH]` vẫn thiếu BQT sau migration. Migration liệt kê các tòa này trong audit để quản trị áp mẫu `AQUA`/`STANDARD`. PM/BA có thể chọn "màn thiết kế thắng" thay vì cách này (Q9).
4. **Hồ sơ đã tạo: không migrate.** Đồng ý với PM/BA: bộ máy vẫn đọc `record.approvalStepKeys` (chuỗi đã chạy). Riêng phần hiển thị của web không được dựng chuỗi tờ trình từ `workflowStageApprovalStepKeys.PROPOSAL` của hồ sơ, vì với hồ sơ cũ giá trị này có thể lệch. Hồ sơ mới thì hai giá trị trùng nhau.
5. **Web mock:** `web/src/domain/building-config.ts` và `building-handlers.ts` có cùng cấu trúc. Sửa cùng gói để chế độ mock không lệch lại.
6. Thuộc đợt **R2** (cùng `INTAKE`/người xác nhận). Test cần có: mỗi đường ghi lưu ra hai giá trị bằng nhau; request lệch trả 400; migration đổi đúng tòa lệch và không đổi tòa đã khớp; hồ sơ cũ vẫn chạy theo snapshot.

### 5. Ảnh hưởng chuyển đổi (migration)

| Đối tượng | Việc phải làm | Rủi ro |
|---|---|---|
| CSDL | Migration mới: sửa `CHK_users_role`, `CHK_role_definitions_base_role` để thêm `ACCOUNTANT` (DROP rồi ADD constraint trong một transaction). Không cần bảng mới cho quyền. | Thấp. Migration chỉ thêm, idempotent theo quy ước hiện có. |
| Dòng vai trò hệ thống | Không cần SQL: `syncSystemRoles` tạo dòng `KTOAN` và cập nhật quyền của các dòng khác ở lần khởi động đầu tiên. | Phiên đang đăng nhập nhận quyền mới khi token được đọc lại (JWT strategy đọc lại tài khoản mỗi request). |
| Vai trò tùy chỉnh `VT-xx` | Quyền bị **bỏ** khỏi vai trò gốc (`BUILDING_CONFIG` của BQL) tự mất nhờ phép giao. Quyền được **thêm** cho vai trò gốc (ví dụ BQT `ACCEPTANCE_DECIDE`) **không** tự thêm vào vai trò tùy chỉnh dựa trên nó; quản trị phải chủ động bật (Q5). `VT-01` (BQL, đã bỏ `BUILDING_CONFIG`) không đổi gì. | Một BQT dùng vai trò tùy chỉnh sẽ không nghiệm thu được cho đến khi được bật quyền. |
| Seed demo | Thêm bộ phận "Kế toán" và tài khoản `KTOAN-A` (tòa A). Thêm template `AQUA`. Seed chỉ chèn phần còn thiếu nên dữ liệu cũ giữ nguyên. | Test đếm số tài khoản seed sẽ đổi (`auth.e2e`: 9 → 10). |
| Cấu hình tòa đã lưu | Vẫn hợp lệ: `INTAKE = [TECH_CONFIRM]` thỏa `RECORD_CONFIRM` của KT; `ACCEPTANCE` và `PAYMENT` không đổi. Tòa A, B không tự chuyển sang mẫu `AQUA`; quản trị áp mẫu khi muốn. | Không có. |
| Hồ sơ đã tạo | Giữ snapshot: người xác nhận cũ (KT) vẫn có `RECORD_CONFIRM`; chuỗi duyệt và quy tắc nghiệm thu cũ chạy theo snapshot. Hồ sơ cũ không có `approvalAssigneeUserIds` cho bước có sẵn → đọc dự phòng từ cột cố định (`APPROVAL_STEP_SLOT`), giữ một nhánh code tương thích. | Phải có test cho hồ sơ "cũ" và hồ sơ "mới". |

### 6. Ảnh hưởng tới phần đã build

| Phần | Ảnh hưởng |
|---|---|
| **S1 xác nhận hiện trạng** | Logic hành động không đổi: slot `confirmer` = `confirmationUserId`. Phải đổi phần **chọn và kiểm người xác nhận** khi tạo, lưu nháp và gửi (mục 4.2). Câu báo lỗi đổi từ "Chỉ kỹ thuật xác nhận được giao…" thành "Chỉ người xác nhận hiện trạng được giao…". `record-confirmations.e2e` vẫn đạt với mẫu `STANDARD` (KT). Cần thêm ca: mẫu `AQUA` → TVKT xác nhận; tòa không có TVKT → BQT xác nhận. |
| **AU-S1 đổi mật khẩu** | Không ảnh hưởng. |
| **US-S1 đặt lại mật khẩu** | Không đổi logic. Danh sách vai trò khi tạo tài khoản có thêm Kế toán (lấy từ API). |
| **Cấu hình tòa (API + web)** | Các route `@RequireCapabilities('BUILDING_CONFIG')` giữ nguyên, nhưng BQL không còn quyền vào. Route tầng/khu vực/vị trí chuyển sang `LOCATION_MANAGE` (nếu Q7 đồng ý). Web ẩn menu "Tòa nhà và cấu hình" và "Workflow Engine" với BQL. |
| **e2e hiện có** | `catalog-admin.e2e` nhóm "building configuration" đang dùng `bqlA` để sửa cấu hình → đổi sang `admin`, và thêm ca BQL nhận 403. `auth.e2e` đếm seed 9 → 10. `building-config.spec.ts` thêm ca `INTAKE` → `RECORD_CONFIRM`, ca `INTAKE` đúng 1 bước, ca `MANAGER` chỉ trong `ACCEPTANCE`. `permissions.spec.ts` cập nhật ma trận. |
| **Web chế độ mock** | Bảng quyền dùng chung nên demo mock cũng đổi theo: BQL mất màn cấu hình, BQT có nút nghiệm thu. Test web của các màn này cần cập nhật (`permission-rows.ts`, `config-and-emergency.test.ts`, các test nghiệm thu). |

### 7. Thứ tự triển khai đề xuất

1. **R1:** ma trận quyền + vai trò Kế toán + migration CHECK + `LOCATION_MANAGE` + cập nhật e2e/web cho DF-11. Độc lập, nhỏ, review được riêng.
2. **R2:** `stageCapability(INTAKE)`, luật `INTAKE` 1 bước, template `AQUA`, người xác nhận theo cấu hình (sửa S1), và BG-01 (mục 4.7: một nguồn cho chuỗi duyệt + migration cấu hình). Có test hồ sơ cũ/mới.
3. **R3:** bản đồ người giữ bước thống nhất + bước `MANAGER`. Làm cùng SPEC B03–B09 v2 S2 (tờ trình, `BOARD_MINUTES`) và S3 (nghiệm thu song song).
4. **R4:** `PAYMENT_CONFIRM` cùng S4 (thanh toán nhiều đợt). `FUND_OPERATE` chờ SPEC F/T.

## Phương án đã cân nhắc

- **Cho mọi vai trò "xác nhận" qua bước tùy chỉnh, không đổi ma trận.** Ưu: không đụng code quyền. Nhược: bước tùy chỉnh vẫn cần vai trò có `RECORD_CONFIRM`, nên vẫn phải sửa ma trận; người dùng phải tự dựng cấu hình cho trường hợp phổ biến nhất. Loại.
- **Giữ cột cố định, thêm cột `acceptanceManagerUserId`…** Ưu: ít đổi. Nhược: mỗi vai trò mới lại thêm một cột; DF-12 phải quét nhiều cột. Loại, chọn bản đồ theo khóa bước (4.3).
- **Kế toán là vai trò tùy chỉnh dựa trên BQT.** Ưu: không cần migration. Nhược: vai trò tùy chỉnh chỉ thu hẹp được BQT; Kế toán không được có `PROPOSAL_DECIDE` / `PAYMENT_DECIDE` của BQT nhưng lại cần `FUND_OPERATE` mà BQT không có. Loại.
- **Gộp `PAYMENT_CONFIRM` vào `PAYMENT_DECIDE`.** Nhược: Kế toán sẽ duyệt được đề nghị thanh toán, trái DF-08 (BQT duyệt, Kế toán chỉ xác nhận chuyển khoản). Loại.

## Hệ quả

- **Dễ hơn:** thêm mẫu cấu hình cho khách mới mà không đổi code; DF-12 tìm bước đang mở theo một bản đồ duy nhất; quy tắc nghiệm thu thống nhất (song song, tất cả đạt).
- **Khó hơn:** code đọc hồ sơ phải hiểu hai dạng snapshot (cũ: cột cố định; mới: bản đồ) cho đến khi hồ sơ cũ đóng hết; mỗi lần đổi ma trận vẫn phải sửa hai bản (API + web).
- **Việc phải làm tiếp:** PM/BA trả lời các câu dưới, chấp nhận ADR, viết SPEC B03–B09 v2 và một gói R1 riêng cho ma trận quyền.

## Câu hỏi và trả lời (PD-07)

| # | Câu hỏi | Đề xuất của dev-build |
|---|---|---|
| Q1 | BQL là thành phần nghiệm thu (DF-06), nhưng cũng chính BQL quản lý hồ sơ đã gửi nghiệm thu. Có cho người quản lý tự xác nhận ĐẠT không? | Cho phép: biên bản là ý kiến chung của các bên, không phải phê duyệt. Nếu không cho, bước `MANAGER` phải là một BQL khác. |
| Q2 | Dự phòng "không có TVKT thì BQT" (DF-01) áp ở đâu: chỉ ở cấu hình, hay cả lúc tạo hồ sơ? | Cả hai: mẫu cấu hình chọn bước; khi tạo hồ sơ mà bước đó không có ai, dùng người giữ `BOARD` và ghi audit. |
| Q3 | Kế toán có thuộc luật giao việc (`ASSIGNMENT_ROLES`) theo bộ phận và khu vực không? | Có, như các vai trò khác; mặc định phạm vi tòa, không giới hạn khu vực. |
| Q4 | Xác nhận chuyển khoản do **một người được giao** hay **bất kỳ** BQT/Kế toán trong tòa? | Bất kỳ người có `PAYMENT_CONFIRM` trong phạm vi tòa, có ghi audit người xác nhận. |
| Q5 | Quyền mới thêm cho vai trò gốc có tự bật cho vai trò tùy chỉnh dựa trên nó không? | Không tự bật (giữ nghĩa "chỉ thu hẹp"); màn Phân quyền báo "có quyền mới chưa bật". |
| Q6 | Giữ vai trò KT (`TECH_CONFIRMER`) trong mẫu `AQUA` không? KT còn làm gì ngoài kiểm tra bảo trì? | Giữ vai trò; mẫu `AQUA` không dùng KT trong chuỗi sửa chữa. |
| Q7 | DF-11 bỏ `BUILDING_CONFIG` của BQL. Quản lý tầng/khu vực/vị trí có đi theo không? | Tách `LOCATION_MANAGE` để BQL vẫn quản lý vị trí; chỉ cấu hình workflow, hạn mức, giao việc là của Quản trị. |
| Q8 | "Biên bản họp BQT" bắt buộc ở mọi bước có vai trò BQT (gồm duyệt thanh toán) hay chỉ ở bước duyệt tờ trình? | Chỉ bước duyệt tờ trình, theo đúng DF-02. |
| Q9 | Migration BG-01: tòa có chuỗi bộ máy khác màn thiết kế thì giữ bên nào? | Giữ chuỗi bộ máy đang chạy (mục 4.7.3), liệt kê tòa chỉ có `[TECH]` để quản trị áp mẫu. Chưa có trả lời; nếu PM/BA chọn "màn thiết kế thắng" thì chỉ đổi một câu lệnh trong migration. |

**Trả lời của PM/BA (PD-07, 26/10/2026):**
- **Q1:** đồng ý. BQL quản lý hồ sơ được xác nhận ĐẠT với tư cách thành phần nghiệm thu.
- **Q2:** cả hai. Mẫu chọn bước; khi tạo hồ sơ mà bước đó không có người, dùng người giữ `BOARD` và ghi audit.
- **Q3:** có. Kế toán nằm trong `ASSIGNMENT_ROLES`, mặc định theo phạm vi tòa.
- **Q4:** bất kỳ người có `PAYMENT_CONFIRM` trong phạm vi tòa, có ghi audit.
- **Q5:** không tự bật. Màn Phân quyền hiện "có quyền mới chưa bật".
- **Q6:** giữ KT. Mẫu `AQUA` không dùng KT trong chuỗi sửa chữa. NVKT của BQL là vai trò tùy chỉnh dựa trên BQL.
- **Q7:** có. Tách `LOCATION_MANAGE` (ADMIN + BQL).
- **Q8:** biên bản họp BQT chỉ bắt buộc ở bước duyệt tờ trình.
