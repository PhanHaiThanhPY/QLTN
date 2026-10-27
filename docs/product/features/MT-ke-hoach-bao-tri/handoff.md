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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
