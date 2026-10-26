# SPEC — Nhật ký thao tác (AD-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 26/10/2026 (PD-14). Bốn điểm ở §8 được chấp nhận đúng như đề xuất
**Nguồn:** [phân tích reference, audit, health](../../modules/platform-reference-audit-health.md) AD-G1, AD-G2, AD-G5, HE-G1; [roles.md](../../modules/roles.md) RG-06; [organization.md](../../modules/organization.md) OG-03
**Căn cứ nghiệp vụ:** D2 nhóm 18 "xuất dữ liệu, lưu tệp và **nhật ký thao tác**"; D1 tr. 39 "kiểm quyền, tách hai quỹ, **lưu vết thay đổi**"

## 1. Mục tiêu

Người có trách nhiệm giám sát xem được **mọi thay đổi trong phạm vi của mình** trên một màn hình: ai làm gì, lúc nào, với hồ sơ nào, từ trạng thái nào sang trạng thái nào, lý do gì. Họ lọc được dữ liệu và xuất ra file. Dữ liệu đã có sẵn, vì mỗi thay đổi đều ghi audit cùng transaction. Hiện chỉ xem được lịch sử của từng đối tượng riêng lẻ.

## 2. Phạm vi

**Trong phạm vi**
1. API danh sách nhật ký có lọc, và API xuất CSV.
2. Màn "Nhật ký thao tác" trên web, chế độ `api`.
3. Quyền mới `AUDIT_VIEW` (BR-01).
4. Tách loại đối tượng `ROLE` và `DEPARTMENT` khỏi `ACCOUNT`; thêm lịch sử vai trò và bộ phận (AD-G2).
5. Health check trả 503 khi DB lỗi (HE-G1).

**Ngoài phạm vi**
- Nhật ký đăng nhập (AU-S2).
- Khóa bảng audit ở mức DB (ADR-0002).
- Xuất Excel theo mẫu (module reports, DF-18).
- Chế độ `mock`: menu không hiện.
- Xóa hoặc sửa nhật ký: **không bao giờ có chức năng này.**

## 3. Luồng

1. Người có `AUDIT_VIEW` mở menu **Nhật ký thao tác**, nằm trong nhóm "Theo dõi", cạnh "Báo cáo".
2. Màn hình mặc định hiện **7 ngày gần nhất**, mới nhất trước, 50 dòng một trang.
3. **Bộ lọc:**
   - tòa (trong phạm vi);
   - khoảng thời gian, tối đa 366 ngày;
   - người thực hiện (chọn từ danh mục người dùng trong phạm vi);
   - loại đối tượng (BR-04);
   - hành động (danh sách theo loại đối tượng đã chọn);
   - ô tìm theo mã đối tượng, ví dụ `SC-001`.
   Đổi bộ lọc thì quay về trang 1.
4. **Mỗi dòng gồm:**
   - thời điểm (`formatDateTime`);
   - tòa (mã tòa, hoặc "Toàn hệ thống");
   - người thực hiện (họ tên và mã; "Hệ thống" nếu không có);
   - đối tượng (nhãn loại và mã);
   - hành động (nhãn tiếng Việt, BR-05);
   - trạng thái trước → sau (nhãn, nếu có);
   - lý do hoặc ghi chú.
5. **Mở đối tượng:** bấm vào mã đối tượng để mở màn gốc, nếu người xem có quyền mở màn đó (BR-06). Không có quyền thì mã chỉ hiện dạng chữ.
6. **Xuất CSV** theo đúng bộ lọc đang chọn. Kết quả quá 10.000 dòng thì báo "Kết quả có N dòng, vượt giới hạn 10.000. Vui lòng thu hẹp khoảng thời gian hoặc bộ lọc." và không xuất (BR-07).
7. **Lịch sử vai trò và bộ phận:** trong dialog sửa vai trò và dialog sửa bộ phận có khối **Lịch sử**, dùng lại thành phần `AccountHistory` của US-S1.

## 4. Quy tắc nghiệp vụ

- **BR-01 Quyền mới `AUDIT_VIEW` cấp cho ADMIN, BQL, BQT.**
  - ADMIN có trách nhiệm quản trị.
  - BQL điều phối vận hành.
  - BQT là bên giám sát và duyệt chi (TT05 Điều 25).

  Ma trận ở API và web cập nhật giống nhau (cùng nguyên tắc ADR-0001). Vai trò tùy chỉnh **không** tự có quyền này (PD-07 Q5).
- **BR-02 Phạm vi dữ liệu:**
  - Dòng có `buildingId` chỉ hiện khi tòa đó nằm trong phạm vi tòa của người xem.
  - Dòng **không có** `buildingId` (thay đổi tài khoản, vai trò, bộ phận ở mức toàn hệ thống) **chỉ ADMIN xem được**.
  - Phạm vi khu vực **không** áp cho nhật ký: nhật ký là dữ liệu giám sát cấp tòa. **Giả định.**
- **BR-03 Chỉ đọc:** không có API sửa hay xóa nhật ký. Nhật ký **giữ vô thời hạn**, không xóa theo lịch (AD-G5, **giả định**).
- **BR-04 Loại đối tượng và nhãn:**

  | Mã | Nhãn |
  |---|---|
  | `REPAIR_RECORD` | Hồ sơ sửa chữa |
  | `BUILDING` | Tòa nhà và cấu hình |
  | `ACCOUNT` | Tài khoản |
  | `ROLE` (mới) | Vai trò |
  | `DEPARTMENT` (mới) | Bộ phận |
  | `MAINTENANCE_ITEM` | Thiết bị |
  | `MAINTENANCE_PLAN` | Kế hoạch bảo trì |
  | `MAINTENANCE_OCCURRENCE` | Lượt bảo trì |

  Từ khi triển khai, `roles` ghi `ROLE` và `organization` ghi `DEPARTMENT`. Migration chuyển các dòng cũ có `subject_id` thuộc `role_definitions` hoặc `departments` sang loại đúng. Migration chạy lại không đổi gì thêm.
- **BR-05 Nhãn hành động:** có bảng nhãn tiếng Việt cho mọi mã hành động hiện có:

  | Nhóm | Mã → nhãn |
  |---|---|
  | Hồ sơ | `createRecord` Tạo hồ sơ; `saveRecordDraft` Lưu nháp; `submitRecord` Gửi xác nhận; `withdrawRecord` Rút hồ sơ; `requestRecordUpdate` Trả bổ sung; `confirmRepair` Xác nhận cần sửa; `closeNoRepair` Đóng không cần sửa |
  | Tệp | `uploadAttachment` Tải tệp lên |
  | Tòa và vị trí | `createBuilding` Tạo tòa; `updateBuilding` Sửa tòa; `createLocation` Tạo vị trí; `updateLocation` Sửa vị trí; `deactivateLocation` Ngừng dùng vị trí |
  | Cấu hình | `updateBuildingConfig` Sửa cấu hình; `applyConfigTemplate` Áp mẫu cấu hình; `updateWorkflowConfig` Sửa workflow; `migrateApprovalChain` Chuẩn hóa chuỗi duyệt |
  | Tài khoản | `createUser` Tạo tài khoản; `updateUser` Cập nhật thông tin; `deactivateUser` Ngừng hoạt động; `resetPassword` Đặt lại mật khẩu |
  | Vai trò | `createRoleDef` Tạo vai trò; `updateRoleDef` Sửa vai trò |
  | Bộ phận | `createDepartment` Tạo bộ phận; `updateDepartment` Sửa bộ phận |

  Mã chưa có nhãn thì hiện nguyên mã. Các slice sau (S2–S4, RM-S2…) **phải bổ sung nhãn** cho mã mới của mình; đây là một dòng trong checklist review.
- **BR-06 Mở đối tượng:** liên kết tới màn gốc của đối tượng.

  | Loại | Màn gốc |
  |---|---|
  | Hồ sơ sửa chữa | chi tiết hồ sơ |
  | Tòa nhà | màn cấu hình tòa |
  | Tài khoản | dialog nhân viên |
  | Vai trò | dialog vai trò |
  | Bộ phận | dialog bộ phận |

  Liên kết chỉ hiện khi người xem có quyền mở màn đó theo ma trận hiện có. Ví dụ BQL không mở được dialog tài khoản. Đối tượng thuộc module chưa nối API (bảo trì, thiết bị) thì chỉ hiện mã.
- **BR-07 Xuất CSV:**
  - Mã hóa UTF-8 có BOM, để Excel đọc đúng tiếng Việt.
  - Cột theo đúng §3 bước 4, cộng thêm `correlationId`.
  - Tên file `nhat-ky-thao-tac-YYYYMMDD-HHmm.csv`.
  - Tối đa 10.000 dòng; vượt thì trả 400 `too_many_rows` kèm số dòng.
  - Mỗi lần xuất ghi một dòng audit `exportAuditLog`. Dòng này ghi bộ lọc vào lý do, và chỉ ADMIN xem được.
- **BR-08 Health:** `GET /api/public/health-check` trả **503** với cùng nội dung khi `database: 'down'`; trả 200 khi `up`.

## 5. Hợp đồng API

- `GET /api/audit-events` (cần `AUDIT_VIEW`).
  - Tham số: `?buildingId=&dateFrom=&dateTo=&actorId=&subjectType=&action=&subjectCode=&page=&limit=`. `limit` tối đa 100.
  - `dateFrom` và `dateTo` theo dạng `YYYY-MM-DD`, giờ Việt Nam. Thiếu thì mặc định 7 ngày gần nhất. Khoảng > 366 ngày trả 400.
  - Kết quả: danh sách dạng chuẩn `{ data, meta }`. Mỗi dòng gồm `AuditEventView` hiện có, cộng `subjectCode` (mã hiển thị của đối tượng, ví dụ `SC-001`, `A`, `KT-A`, `VT-01`, `KT`), `buildingCode` và `actorCode`.
  - `buildingId` ngoài phạm vi trả trang rỗng (`total = 0`), giống danh sách hồ sơ.
- `GET /api/audit-events/export`: cùng tham số (trừ `page`, `limit`), trả `text/csv`.
- `GET /api/roles/:id/audit` và `GET /api/departments/:id/audit` (cần `ADMIN_VIEW`): danh sách phân trang như `users/:id/audit`.

## 6. Tiêu chí nghiệm thu

| AC | Kiểm bằng | Nội dung |
|---|---|---|
| AC-1 | e2e | `admin-demo` gọi `GET /audit-events` được đủ dòng của các tòa trong phạm vi, cộng các dòng toàn hệ thống (tạo tài khoản, sửa vai trò). Mới nhất trước. |
| AC-2 | e2e | `bql-a` (tòa A) chỉ thấy dòng của tòa A; **không** thấy dòng toàn hệ thống. Lọc `buildingId` = tòa B trả `total = 0`. `bqt` thấy dòng trong phạm vi tòa của mình. `kt-a` nhận 403. Tài khoản Kế toán nhận 403. |
| AC-3 | e2e | Các bộ lọc thời gian, người làm, loại, hành động và `subjectCode` cho đúng kết quả. Khoảng thời gian 367 ngày trả 400. `limit` = 101 trả 400. |
| AC-4 | e2e | Mỗi dòng có `subjectCode`, `buildingCode`, `actorCode` đúng. Dòng do hệ thống làm có `actorId` = null. |
| AC-5 | e2e | Xuất CSV: `Content-Type` là CSV, có BOM, dòng tiêu đề đúng cột, số dòng bằng `meta.total` của cùng bộ lọc. Có dòng audit `exportAuditLog`. Bộ lọc cho hơn 10.000 dòng (seed giả lập trong test) trả 400 `too_many_rows`. |
| AC-6 | e2e + migration | Tạo hoặc sửa vai trò ghi `ROLE`; tạo hoặc sửa bộ phận ghi `DEPARTMENT`. Migration chuyển dòng cũ sang đúng loại; chạy lần hai không đổi gì. `GET /roles/:id/audit` và `GET /departments/:id/audit` trả đúng các dòng; người không có `ADMIN_VIEW` nhận 403. |
| AC-7 | e2e | Health check: DB hoạt động trả 200. DB không kết nối được (test giả lập) trả 503, nội dung có `database: 'down'`. |
| AC-8 | test web | Menu "Nhật ký thao tác" hiện cho ADMIN, BQL, BQT ở chế độ `api`; không hiện cho KT, TVKT, Kế toán; không hiện ở chế độ `mock`. Bộ lọc mặc định là 7 ngày. Nhãn tiếng Việt theo BR-04 và BR-05; mã chưa có nhãn thì hiện nguyên mã. |
| AC-9 | test web | Liên kết mở hồ sơ hiện với BQL. Liên kết mở tài khoản **không** hiện với BQL nhưng hiện với ADMIN. Đối tượng bảo trì chỉ hiện mã. |
| AC-10 | test web | Dialog vai trò và dialog bộ phận có khối Lịch sử, có nút "Xem thêm" và trạng thái trống. |
| AC-11 | chạy thật trên trình duyệt | ADMIN lọc theo tòa A và hành động "Xác nhận cần sửa", mở hồ sơ từ nhật ký, rồi xuất CSV và mở được file. BQL đăng nhập thấy menu nhưng không thấy dòng toàn hệ thống. Có ảnh chụp. |

## 7. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] e2e mới của audit, cùng `catalog-admin` (roles, departments) và health.
- [ ] Test so ma trận API và web (thêm `AUDIT_VIEW`).
- [ ] Migration phân loại lại audit chạy hai lần.
- [ ] CSV mở đúng tiếng Việt (có BOM).
- [ ] BR-02: dòng toàn hệ thống không lộ cho BQL hoặc BQT, kiểm bằng cả e2e và đọc code.
- [ ] Ảnh chụp AC-11.

## 8. Điểm chủ dự án cần xác nhận khi review

1. **Ai xem được nhật ký:** ADMIN, BQL, BQT (BR-01). Có cần thêm TVKT hay Kế toán không?
2. **BQL và BQT không thấy** thay đổi tài khoản, vai trò, bộ phận, vì đó là dữ liệu toàn hệ thống (BR-02).
3. **Giữ nhật ký vô thời hạn** (BR-03).
4. **Giới hạn xuất 10.000 dòng** mỗi lần (BR-07).
