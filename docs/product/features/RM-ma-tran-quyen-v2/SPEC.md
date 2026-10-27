# SPEC — Ma trận quyền v2 và người giữ bước theo cấu hình (RM-S1, RM-S2)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Đã duyệt`
**Người duyệt:** chủ dự án, ngày 26/10/2026 (PD-10). Trước đó bản này đã lỡ được giao lúc 08:57Z theo PD-05 và bị tạm dừng theo PD-08; nay được tiếp tục.
**Thiết kế kỹ thuật:** [ADR-0001](../../../engineering/adr/ADR-0001-role-matrix-v2.md), trạng thái "Đã chấp nhận". Khi SPEC này và ADR khác nhau về **nghiệp vụ** thì theo SPEC; về **kỹ thuật** thì theo ADR.
**Nguồn:** [PRODUCT-DEFAULTS](../../PRODUCT-DEFAULTS.md); [modules/roles.md](../../modules/roles.md) RG-01, RG-02, RG-03; [modules/buildings.md](../../modules/buildings.md) BG-01, BG-02, BG-03.

## 1. Mục tiêu

Hệ thống phân quyền và giao người theo đúng quy trình thật của khách (D5-QT):
- TVKT, hoặc BQT nếu không có TVKT, xác nhận hiện trạng.
- BQT luôn duyệt tờ trình.
- Có vai trò Kế toán.
- Chỉ Quản trị sửa được cấu hình tòa.
- Chuỗi duyệt hiển thị trên màn thiết kế luôn trùng với chuỗi engine thực sự chạy.

## 2. Phạm vi

| Slice | Nội dung (ADR §7) | Thứ tự |
|---|---|---|
| **RM-S1** | R1: ma trận v2 (ADR §3); vai trò `ACCOUNTANT` (Kế toán); quyền mới `PAYMENT_CONFIRM`, `FUND_OPERATE`, `LOCATION_MANAGE`; BQL mất `BUILDING_CONFIG`; sửa nhãn ma trận RG-03 | Trước |
| **RM-S2** | R2: giai đoạn INTAKE cần quyền `RECORD_CONFIRM` và có đúng 1 bước; chọn người xác nhận theo cấu hình (sửa S1); mẫu `AQUA`; BG-01 chỉ còn một nguồn cho chuỗi duyệt, kèm migration | Sau RM-S1 |

**Ngoài phạm vi:** R3 (bản đồ người giữ bước thống nhất, bước `MANAGER`, `BOARD_MINUTES`) và R4 (dùng `PAYMENT_CONFIRM` trong thanh toán) đi cùng SPEC B03–B09 v2. Các quyền mới được khai báo ở RM-S1 nhưng **chưa đổi hành vi** của tờ trình, nghiệm thu hay thanh toán.

## 3. Quy tắc nghiệp vụ

- **BR-01:** Ma trận vai trò → quyền đúng như ADR §3, **giống hệt** ở API và web.
- **BR-02:** Vai trò hệ thống mới **Kế toán** (`ACCOUNTANT`, mã dòng `KTOAN`), có `VIEW`, `REPORT_VIEW`, `PAYMENT_CONFIRM`, `FUND_OPERATE`. Seed demo thêm tài khoản `KTOAN-A` cho tòa A, mật khẩu là `SEED_DEMO_PASSWORD`. Kế toán được dùng trong luật giao việc (PD-07 Q3).
- **BR-03:** Chỉ ADMIN có `BUILDING_CONFIG` để **sửa** cấu hình tòa, áp mẫu và dùng Workflow Designer. ADMIN và BQL có `LOCATION_MANAGE` để quản lý tầng, khu vực, vị trí (PD-07 Q7).
- **BR-03a (PD-13):** **Xem** lịch sử tòa (`GET /buildings/:id/audit`, gồm cả cấu hình và vị trí) mở cho người có `BUILDING_CONFIG` **hoặc** `LOCATION_MANAGE`. BQL xem đúng màn lịch sử hiện có, giống ADMIN, ở chế độ chỉ đọc. **Không làm màn hình mới.**
- **BR-04:** Vai trò tùy chỉnh **không** tự được quyền mới của vai trò gốc. Màn Phân quyền ghi "Có quyền mới chưa bật: …" trên vai trò tùy chỉnh có vai trò gốc vừa được thêm quyền (PD-07 Q5).
- **BR-05:** Bảng ma trận trên web ghi đúng quyền thực tế. Dòng "lập đề nghị thanh toán" đổi sang `PAYMENT_RECORD`; thêm cột Kế toán và các dòng `PAYMENT_CONFIRM`, `FUND_OPERATE`, `LOCATION_MANAGE`.
- **BR-06 (RM-S2):**
  - Giai đoạn INTAKE có đúng 1 bước duyệt, và vai trò của bước phải có `RECORD_CONFIRM`. Sai thì trả 400 lỗi trường `workflowStages.<i>.approvalStepKeys`.
  - Bước `MANAGER` chưa có ở slice này.
- **BR-07 (RM-S2):** Khi tạo hồ sơ, người xác nhận là người đầu tiên đủ điều kiện cho bước INTAKE trong snapshot, theo luật giao việc. Đủ điều kiện nghĩa là đúng vai trò hoặc `roleDefId`, còn hoạt động, đúng phạm vi tòa và khu vực.
  - Không có ai: lấy người giữ bước `BOARD`, và ghi audit "Không có người xác nhận theo cấu hình, dùng BQT" (PD-07 Q2).
  - Không có cả người giữ `BOARD`: giữ hành vi hiện tại, tức báo thiếu người xác nhận khi gửi.
- **BR-07a (RM-S2, làm rõ Q-RM2-1):** Gửi xác nhận (`submitRecord`) chỉ yêu cầu người giữ bước **INTAKE** còn hợp lệ, gồm cả trường hợp dự phòng BQT theo BR-07. Người giữ các bước của chuỗi duyệt tờ trình **không** được kiểm ở bước này; chúng được kiểm khi trình tờ trình (SPEC B03–B09 v1 BR-05, v2 BR-S2-04). Lý do: AC-2.3 yêu cầu BQT xác nhận được hồ sơ ở tòa AQUA không có TVKT, nên hồ sơ phải gửi được.
- **BR-08 (RM-S2):** Thông báo lỗi khi sai người xác nhận đổi thành "Chỉ người xác nhận hiện trạng được giao mới thực hiện được bước này." `details.reason` giữ nguyên `not_step_assignee`.
- **BR-09 (RM-S2):** Mẫu `AQUA` ("Aqua – theo quy trình Ban quản trị"):

  | Giai đoạn | Bước |
  |---|---|
  | INTAKE | `[TECH]` |
  | PROPOSAL | `[TECH, BOARD]` |
  | ACCEPTANCE | `[BOARD, TECH]` (RM-S2; R3 sẽ thêm `MANAGER`) |
  | PAYMENT | `[BOARD]` |

  Các ngưỡng lấy theo mẫu `RESIDENTIAL`.
- **BR-10 (RM-S2, BG-01):** Nguồn chuẩn của chuỗi duyệt tờ trình là giai đoạn PROPOSAL.
  - Server ghi `approvalStepKeys = PROPOSAL.approvalStepKeys` ở mọi đường ghi: tạo tòa, áp mẫu, sao chép, PUT config, cập nhật hàng loạt, seed.
  - Request gửi `approvalStepKeys` khác PROPOSAL thì trả 400 lỗi trường `approvalStepKeys`: "Chuỗi phê duyệt phải trùng các bước của giai đoạn Tờ trình."
  - Mặc định mới: PROPOSAL = `[TECH, BOARD]`.
  - Áp mẫu đặt lại **cả** giai đoạn và chuỗi duyệt.
- **BR-11 (RM-S2, migration):**
  - Tòa đang lệch: **giữ chuỗi engine đang chạy**, tức ghi PROPOSAL bằng `approval_step_keys`. Mỗi tòa bị đổi ghi một dòng audit `migrateApprovalChain` (PD-07 Q9).
  - Tòa chỉ còn `[TECH]` được liệt kê trong audit, để quản trị áp mẫu `AQUA` hoặc `STANDARD`.
  - Hồ sơ đã tạo **không** bị đổi: engine vẫn đọc `record.approvalStepKeys`. Web không được vẽ chuỗi duyệt của một hồ sơ từ `workflowStageApprovalStepKeys.PROPOSAL`.
- **BR-12:** Mọi thay đổi vai trò, quyền và cấu hình ghi audit như hiện nay. ADMIN vẫn **không** có quyền quyết định nghiệp vụ.

## 4. Tiêu chí nghiệm thu

### RM-S1

| AC | Kiểm bằng | Nội dung |
|---|---|---|
| AC-1.1 | unit | Ma trận ở API và web giống hệt ADR §3. Có một test so hai bản. |
| AC-1.2 | e2e | `GET /roles` có dòng hệ thống `KTOAN` (Kế toán) với đúng 4 quyền. Seed có tài khoản `KTOAN-A`, đăng nhập được. Số tài khoản seed trong `auth.e2e` là 10. |
| AC-1.3 | e2e | `bql-a` nhận 403 ở `PUT /buildings/:id/config`, `POST …/config/apply-template`, `PUT /building-configs/workflow`, `GET /building-configs`. `admin-demo` gọi được các route này (200, riêng `apply-template` trả 201). **`GET /buildings/:id/audit`: `bql-a` và `admin-demo` đều nhận 200 cho tòa trong phạm vi, 404 cho tòa ngoài phạm vi; `kt-a` nhận 403** (PD-13). |
| AC-1.3a | test web | BQL thấy khối lịch sử tòa và vị trí ở cùng chỗ và cùng nội dung như ADMIN, chỉ đọc. BQL không có nút sửa cấu hình (PD-13). |
| AC-1.4 | e2e | `bql-a` tạo, sửa, ngừng dùng được vị trí của tòa A (200). `kt-a` gọi thì nhận 403. |
| AC-1.5 | e2e | Tạo tài khoản vai trò Kế toán thành công. Tài khoản này xem được danh sách hồ sơ trong phạm vi, và nhận 403 khi tạo hồ sơ hoặc khi xác nhận. |
| AC-1.6 | e2e | Vai trò tùy chỉnh dựa trên BQT, tạo trước khi đổi, **không** có `ACCEPTANCE_DECIDE`, `RECORD_CONFIRM`, `PAYMENT_CONFIRM` sau khi đổi. `VT-01` (dựa trên BQL) vẫn hoạt động và mất `BUILDING_CONFIG`. |
| AC-1.7 | test web | Đăng nhập BQL (cả `api` và `mock`): menu không có "Tòa nhà và cấu hình" và "Workflow Engine", vẫn có "Tầng, khu vực, vị trí". Đăng nhập ADMIN: có đủ ba menu. |
| AC-1.8 | test web | Bảng ma trận có cột Kế toán, đúng các dòng mới, nhãn RG-03 đã sửa. Vai trò tùy chỉnh theo AC-1.6 hiện dòng "Có quyền mới chưa bật". |
| AC-1.9 | e2e chạy lại | Các e2e của S1 xác nhận hiện trạng, AU-S1 và US-S1 vẫn đạt. Riêng `catalog-admin` nhóm cấu hình đổi người gọi từ `bqlA` sang `admin` như ADR §6. |

### RM-S2

| AC | Kiểm bằng | Nội dung |
|---|---|---|
| AC-2.1 | unit + e2e | Lưu cấu hình có INTAKE 0 bước, 2 bước, hoặc bước có vai trò thiếu `RECORD_CONFIRM` (ví dụ BQL): trả 400 với đúng trường lỗi. |
| AC-2.2 | e2e | Tòa áp mẫu `AQUA`: hồ sơ mới có người xác nhận là `tvkt`. `tvkt` xác nhận cần sửa được (T02). `kt-a` gọi thì nhận 403 `not_step_assignee`, với câu báo lỗi mới. |
| AC-2.3 | e2e | Tòa mẫu `AQUA` không có TVKT nào hoạt động trong phạm vi: hồ sơ mới có người xác nhận là `bqt`, kèm dòng audit lý do. `bqt` xác nhận được. |
| AC-2.4 | e2e | Tòa mẫu `STANDARD`: hành vi S1 cũ không đổi, KT xác nhận. |
| AC-2.5 | e2e | `PUT config` với `approvalStepKeys` khác PROPOSAL trả 400. Không gửi `approvalStepKeys` thì server tự suy ra. Sau khi tạo tòa, áp mẫu, sao chép hoặc cập nhật hàng loạt, `approvalStepKeys` luôn bằng `PROPOSAL.approvalStepKeys`. Test bằng vòng lặp qua cả 5 đường ghi. |
| AC-2.6 | e2e | Tạo tòa mới theo mẫu mặc định rồi tạo hồ sơ và trình tờ trình: chuỗi chạy TVKT → BQT. **Không** sang thẳng "Chờ thi công" sau khi TVKT duyệt. |
| AC-2.7 | test migration | DB có một tòa lệch `{TECH,BOARD}` / PROPOSAL 3 bước và một tòa chỉ `{TECH}`. Sau migration: tòa thứ nhất có PROPOSAL = `[TECH, BOARD]`, có audit. Tòa thứ hai có PROPOSAL = `[TECH]` và có dòng audit liệt kê "thiếu BQT". Chạy migration lần hai không đổi gì thêm. Hồ sơ cũ giữ nguyên `approvalStepKeys`. |
| AC-2.8 | test web | Màn thiết kế và màn chi tiết hồ sơ hiện chuỗi duyệt từ đúng nguồn: cấu hình dùng PROPOSAL, hồ sơ dùng `record.approvalStepKeys`. |
| AC-2.9 | chạy thật trên trình duyệt | ADMIN áp mẫu `AQUA` cho một tòa. BQL tạo và gửi hồ sơ. TVKT thấy hồ sơ trong việc của mình và xác nhận. Có ảnh chụp. |

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] Unit: `permissions.spec.ts`, `building-config.spec.ts`, test so ma trận API và web.
- [ ] e2e: `auth`, `catalog-admin`, `record-confirmations`, cùng các e2e mới của RM.
- [ ] Web: các test menu, ma trận và nghiệm thu bị ảnh hưởng (ADR §6).
- [ ] Migration chạy hai lần không có thay đổi thêm, trên DB e2e riêng.
- [ ] Không còn tham chiếu `DEFAULT_APPROVAL_STEP_KEYS` và `DEMO_APPROVAL_STEP_KEYS` (grep).

## 6. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 26/10/2026 | Bản đầu (PD-05). Tạm dừng (PD-08), chủ dự án duyệt (PD-10). |
| 26/10/2026 | PD-13: BQL được **xem** lịch sử tòa như ADMIN, dùng màn lịch sử hiện có (BR-03a, AC-1.3 sửa, thêm AC-1.3a). Thay đổi này đến khi RM-S1 đang review, nên đưa vào vòng sửa của RM-S1. |
| 26/10/2026 | Lúc đóng RM-S1: AC-1.3 sửa mã trả về của `apply-template` thành 201, theo hành vi hiện có. |
| 26/10/2026 | BR-07a: làm rõ Q-RM2-1 của dev-build, suy ra từ AC-2.3 đã duyệt; không đổi phạm vi. |
| 27/10/2026 | F-S1 (BR-F1-11, dev-build) thêm 2 quyền: `EXPLOITATION_VIEW` (BQL, BQT) xem gói khai thác, đơn vị, hồ sơ dự thầu kèm giá chào và tài liệu; `EXPLOITATION_MANAGE` (BQL) lập, phát hành, ghi nhận, yêu cầu bổ sung, đóng, hủy. KT, TVKT, kế toán, ADMIN không có. Ma trận ở ADR-0001 §3 đã cập nhật. Vai trò tùy chỉnh dựa trên BQL/BQT nhận các quyền này dưới dạng "Có quyền mới chưa bật". |
