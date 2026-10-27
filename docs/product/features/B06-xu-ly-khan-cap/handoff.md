# Handoff: B06-S1 Xử lý khẩn cấp

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-19) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-E0.3).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/b06-s1-emergency`.
- Ưu tiên **sau FX-S1, FX-S2 và FX-S3**.
- B06-S1 sửa cùng các file với FX-S2 và FX-S3: `proposals.service.ts`, `records.service.ts`, `record-actions.ts`, `record-status-groups.ts` và migrations. Vì vậy nên rebase lên các nhánh FX sau khi chúng đạt review, để tránh xung đột.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §7.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- Trạng thái `EMERGENCY_IN_PROGRESS`: có nhãn, có nhóm `CONSTRUCTION`.
- Quyền `EMERGENCY_START` của BQL.
- Cấu hình tòa `emergencyLimitVnd` và `emergencyDocHours`.
- Module `notifications` (từ S3).
- Web demo: `features/records/components/emergency/*`, nút `startEmergencyRepair` trong `RecordDetailHeader`, cùng các handler mock `services/handlers/emergency-handlers.ts`. Hai file này là tài liệu sống về hành vi đang mong muốn.

**Những gì phải tạo mới:**
- Cột dữ liệu khẩn cấp (SPEC §3), qua một migration mới.
- Lệnh E-T1 và E-T2.
- Nới T04, T05 và T11 để chạy được ở `EMERGENCY_IN_PROGRESS`.
- Rẽ nhánh ở bước cuối của T07 (BR-E-06) và ở T09 (BR-E-07).
- Hai trạng thái mới; nhãn và nhóm của chúng phải khớp giữa API và web.
- Lệnh tương ứng trong `command-adapter` ở chế độ `api`.

**Cần lưu ý:**
- `finalPostReview=true` chỉ hợp lệ khi người gửi giữ bước BOARD. Thứ tự kiểm: 409 trước, rồi đến 403.
- `hoursLeft` và `docsOverdue` do API tính theo giờ máy chủ. Web không tự tính.
- Hồ sơ khẩn cấp không bao giờ vào `UNRESOLVED`. Có AC-E3.4 để giữ điều này.
- Quy tắc chặn thanh toán (BR-E-09) đã đúng nhờ máy trạng thái; việc cần làm chỉ là thêm test.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build ghi: nhánh, commit, AC → bằng chứng, test đã chạy, ảnh chụp)_
