# Handoff: B4-S1 Lịch thi công đọc dữ liệu thật

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-21) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-B4.11).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main` (`7f36c91` trở đi). Gợi ý: `feature/b4-s1-construction-schedule`.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- Dữ liệu thi công S3: bảng `repair_constructions` (một dòng mỗi hồ sơ: `start_date`, `planned_end_date`, `completed_date`, `progress_percent`). `completed_date` được ghi khi gửi nghiệm thu (`construction.service.ts`), và giữ nguyên khi hồ sơ sang `NEEDS_REPAIR`.
- Hồ sơ khẩn cấp B06-S1 có dòng thi công ngay khi được cho làm trước (`emergency.service.ts`, `startDate = hôm nay`).
- `GET /records`: phạm vi tòa, bộ lọc `buildingId`, `locationId`, `statusGroup`. Lịch phải cho cùng kết quả (BR-B4-03, BR-B4-09). Lưu ý: `dateFrom`/`dateTo` của `GET /records` là **ngày tạo**, không dùng được cho lịch.
- Web demo: `RepairSchedulePage.tsx`, `components/schedule/*`, `listRepairSchedule` trong `records-service.ts`. Route `records/schedule` đang dùng `connected()` (mock-only); cần mở cho chế độ `api`.
- `RecordFlags` đã có cờ "Khẩn cấp"; `useOnline` đã có ở `hooks/useOnline.ts`.

**Những gì phải tạo mới:**
- API đọc cho lịch (lọc giao nhau theo khoảng ngày) và cho khối "Chờ xếp lịch". Hình dạng endpoint do bạn chọn; ghi lại vào phần bằng chứng.
- Phần tính khoảng ngày và cờ "Trễ thi công" theo BR-B4-01 và BR-B4-04. Nên tính ở một chỗ (API) để web không tự tính lệch.
- Web chế độ `api`: nối 3 kiểu xem, mục nhiều ngày ở kiểu Tuần/Tháng, khối "Chờ xếp lịch", trạng thái cắt bớt (BR-B4-06).

**Cần lưu ý:**
- "Hôm nay" theo giờ Việt Nam, giống `vnDate()` ở API.
- Số đếm là số hồ sơ khác nhau, không phải số ô (AC-B4.6).
- Không dùng chữ "Quá hạn" cho cờ trễ; chữ là "Trễ thi công" (brief §1).
- Không cần migration. Nếu thấy cần, hỏi PM/BA trước.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build điền: commit, quyết định, bảng AC → bằng chứng, test đã chạy, dữ liệu thử.)_
