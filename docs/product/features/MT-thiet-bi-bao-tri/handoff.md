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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy, dữ liệu thử.)_
