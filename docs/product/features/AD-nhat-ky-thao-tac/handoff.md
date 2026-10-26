# Handoff — AD-S1 Nhật ký thao tác

**Gói việc:** [SPEC.md](SPEC.md), `Đã duyệt` (PD-14). Làm sau RM-S2 và S2, xếp chồng lên nhánh mới nhất. Không push nếu chủ dự án chưa yêu cầu. Chỉ chạy các test liên quan.

## Bằng chứng triển khai (dev-build)

**Ngày:** 26/10/2026 · **Nhánh:** `feature/ad-s1-audit-log`, xếp trên `feature/b03-s2-proposal` (sau `6579c1a`), chưa push. Code làm trong worktree `../QLTN-ad-s1` để không đụng cây thư mục chung khi S2 đang review.
**Commit:** API `3cb3b76`, web `052b0a9`, bằng chứng và tài liệu: commit kế tiếp.

**Đã làm**
- **Quyền `AUDIT_VIEW`** cho ADMIN, BQL, BQT, ở cả API và web. Test so ma trận đạt. Ma trận quyền trên web có thêm một dòng cho quyền này.
- **`GET /api/audit-events` và `/export`** (hợp đồng ở §5, chi tiết trong `api-qltn/README.md` mục "Operation log"):
  - phạm vi theo tòa; dòng toàn hệ thống chỉ ADMIN xem được;
  - mặc định 7 ngày, tối đa 366 ngày;
  - mã đối tượng, tòa và người làm lấy bằng join;
  - CSV mã hóa UTF-8 có BOM, tối đa 10.000 dòng; mỗi lần xuất ghi audit `exportAuditLog`.
- **Loại đối tượng `ROLE` và `DEPARTMENT`:**
  - module roles và organization ghi đúng loại mới;
  - migration `2026-10-26e-audit-log.sql` chuyển các dòng cũ và thêm index `created_at`; đã áp vào `qltn_dev`;
  - thêm `GET /roles/:id/audit` và `GET /departments/:id/audit`, cần `ADMIN_VIEW`.
- **Health:** trả 503 với cùng nội dung khi DB lỗi.
- **Nhãn tiếng Việt** ở `api-qltn/src/domain/audit-labels.ts`; web có bản sao kèm test so khớp. Bảng nhãn phủ mọi mã ở BR-05, cộng thêm:
  - `activateLocation`: mã đang có nhưng BR-05 chưa liệt kê;
  - 6 mã của S2;
  - `exportAuditLog`.
- **Web, chế độ `api`:**
  - menu "Nhật ký thao tác" ở nhóm "Theo dõi"; menu này không hiện ở chế độ mock;
  - bộ lọc theo §3; đổi bộ lọc thì về trang 1;
  - 50 dòng một trang; nút Xuất CSV;
  - mã đối tượng là liên kết khi người xem có quyền mở màn gốc (BR-06);
  - `?open=<id>` mở dialog nhân viên, vai trò hoặc bộ phận;
  - khối Lịch sử dùng lại cho dialog vai trò và dialog bộ phận.

**AC → bằng chứng**

| AC | Bằng chứng |
|---|---|
| AC-1 → AC-7 | `api-qltn/test/audit-log.e2e-spec.ts`, 7/7. Bộ e2e API đầy đủ: 14 suite, 123/123. Unit API 53/53. Lint và typecheck sạch |
| AC-1 | ADMIN thấy `createRecord` (tòa A) cùng `createRoleDef` và `createDepartment` (toàn hệ thống), mới nhất trước |
| AC-2 | BQL-A chỉ thấy dòng tòa A, không có dòng `buildingId = null`; lọc tòa B → `total = 0`. BQT chỉ thấy các tòa trong `buildingIds` của mình. KT-A và Kế toán nhận 403, ở cả danh sách lẫn xuất file |
| AC-3 | Lọc theo người làm, `ROLE`, `createRecord`, mã hồ sơ viết thường, và một khoảng không có dữ liệu → 0. Khoảng 367 ngày → 400 (`dateTo`); 366 ngày → 200; khoảng ngược → 400; `limit=101` → 400; `subjectType` lạ → 400 |
| AC-4 | Hồ sơ: `SC-…`, `A`, `BQL-A`. Vai trò: `VT-nn`, tòa null, người làm `ADMIN-DEMO`. Bộ phận: `AD-S1`. Dòng hệ thống: `actorId`/`actorCode` null, mã tòa B |
| AC-5 | `text/csv`, tên file đúng mẫu, BOM `EF BB BF`, dòng tiêu đề đúng cột, số dòng = `meta.total`. Có dòng `exportAuditLog`; ADMIN thấy, BQL không thấy. Chèn 10.001 dòng vào ngày 15/01/2025 rồi xuất → 400, `details` = `{ reason: too_many_rows, total: 10001 }` |
| AC-6 | Lịch sử vai trò và bộ phận trả loại `ROLE`/`DEPARTMENT`; BQL nhận 403, id lạ nhận 404. Chèn dòng `ACCOUNT` kiểu cũ rồi chạy migration hai lần: loại đúng, lần hai không đổi gì; dòng tài khoản vẫn là `ACCOUNT` |
| AC-7 | DB hoạt động → 200 `up`. Giả lập `query` lỗi → 503, nội dung `{ status: 'ok', database: 'down' }` |
| AC-8 | `web/src/app/navigation.test.ts`: menu hiện cho ADMIN, BQL, BQT ở chế độ api; ẩn với KT, TVKT, Kế toán; ẩn ở mock. `AuditLogPage.test.tsx`: lần gọi đầu là `dateFrom = hôm nay − 6`, `dateTo = hôm nay`; nhãn tiếng Việt; mã lạ hiện nguyên; "Hệ thống" khi không có người làm. `audit-labels*.test.ts` gồm cả test so khớp với API |
| AC-9 | `audit-links.test.ts` và `AuditLogPage.test.tsx`: BQL có liên kết hồ sơ (`/records/:id`) nhưng không có liên kết tài khoản; ADMIN có liên kết tài khoản, vai trò, bộ phận, tòa; đối tượng bảo trì chỉ hiện mã |
| AC-10 | `RoleDepartmentHistory.test.tsx`: dialog vai trò có lịch sử và nút "Xem thêm"; dialog bộ phận có trạng thái trống; không có khối lịch sử khi tạo mới, khi sao chép, hoặc ở mock. Web: 53 file, 368/368 |
| AC-11 | `supporting/ad-s1-ui-check.mjs`, 4 ảnh `evidence/AD-1…AD-4` và file CSV đã xuất. ADMIN lọc tòa A + "Hồ sơ sửa chữa" + "Xác nhận cần sửa" (9 dòng), mở SC-009 từ nhật ký, xuất CSV (BOM có, 9 dòng, tiêu đề đúng). BQL thấy menu, 86 dòng, không có dòng "Toàn hệ thống" |

**Khác SPEC hoặc tự chọn (đề nghị PM/BA xác nhận)**
1. **Dòng `exportAuditLog`:** dùng loại `ACCOUNT`, đối tượng là tài khoản người xuất, không gắn tòa. Vì vậy chỉ ADMIN thấy, đúng BR-07. Dòng này cũng hiện trong lịch sử tài khoản đó.
2. **"Chỉ ADMIN xem dòng toàn hệ thống"** xét theo **vai trò gốc ADMIN**. Vai trò tùy chỉnh dựng trên ADMIN mà có `AUDIT_VIEW` cũng xem được; vai trò dựng trên BQL hoặc BQT thì không bao giờ xem được.
3. **Vai trò tùy chỉnh** không tự có `AUDIT_VIEW` (PD-07 Q5): quyền này hiện trong danh sách "quyền mới chưa bật". Test RM-S1 AC-1.6 đã cập nhật kỳ vọng theo đúng hành vi này.
4. **Mở tòa từ nhật ký** đi tới màn cấu hình tòa (`?b=`), nên cần `BUILDING_CONFIG`; BQL và BQT chỉ thấy mã. **Mở vai trò hệ thống** từ nhật ký thì mở dialog ở chế độ sao chép, vì vai trò hệ thống không sửa được.
5. **Ô tìm mã đối tượng** khớp một phần, không phân biệt hoa thường; áp khi nhấn Enter hoặc rời ô.
6. **Bộ lọc hành động:** khi chưa chọn loại đối tượng thì liệt kê mọi mã. Danh sách dài, nên trên giao diện nên chọn loại đối tượng trước.

**Còn lại**
- **Lý do dài làm dòng cao:** lý do của `applyConfigTemplate` có nhiều dòng (xem ảnh AD-4). Có thể rút gọn hoặc thu lại sau nếu PM/BA muốn.
- **Môi trường chạy bằng chứng:**
  - dev API trên :5300 hiện chạy code của worktree, gồm AD-S1 và migration 26e;
  - web của worktree chạy trên :5191;
  - web :5190 vẫn chạy từ cây thư mục chung (nhánh `feature/b03-s2-proposal`).

## Kết quả review (dev-review)

_Chưa có._

## Đóng (PM/BA)

_Chưa có._
