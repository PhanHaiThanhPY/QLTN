# Nhật ký quyết định sản phẩm QLTN

Quy ước:
- `Đã chốt`: có người quyết định và ngày; là chuẩn cho SPEC và nghiệm thu.
- `Chờ chốt`: câu hỏi mở; SPEC liên quan phải ghi rõ đang phụ thuộc mục này.
- `Thay thế bởi ADR-xx`: không còn hiệu lực, giữ lại làm lịch sử.

Không xóa mục cũ. Khi thay đổi, thêm mục mới và cập nhật trạng thái mục cũ.

## Đã chốt

| ID | Ngày | Quyết định | Người quyết định | Căn cứ |
|---|---|---|---|---|
| PD-01 | 26/10/2026 | Tài liệu sản phẩm đặt tại `docs/product/`; mỗi tính năng có đúng một `SPEC.md` làm hợp đồng yêu cầu. | PM/BA seat theo phân công vai trò | Phân công vai trò ngày 26/10/2026 |
| PD-02 | 26/10/2026 | Seat PM/BA không sửa code ứng dụng, schema, migration hay cấu hình deploy. Thay đổi kỹ thuật đi qua bàn giao cho dev-build. | Operator (phân công vai trò) | Phân công vai trò ngày 26/10/2026 |

## Chờ chốt

OD-01 đến OD-08 lấy từ [review 23/10 §10](../reviews/2026-10-23/review-tai-lieu-nghiep-vu.md). Người quyết định là khách hàng/chủ dự án trừ khi ghi khác.

| ID | Câu hỏi | Ảnh hưởng | Liên quan |
|---|---|---|---|
| OD-01 | D1 (23/10) thay thế D2 (20/10) ở những mục nào? 34 nghiệp vụ và S01/A01 có cùng nằm trong lần bàn giao này không? | Toàn bộ phạm vi và nghiệm thu | H01, H04, L02 |
| OD-02 | Bảo hành chính thức là 6 hay 12 tháng? Phí vận hành áp dụng theo mức và phạm vi nào? | Nghĩa vụ sau bàn giao | H02, H03 |
| OD-03 | Ai tạo, xác nhận, duyệt và ký từng loại hồ sơ ở từng tòa? Còn áp dụng vai trò CSH/CĐT không? | Ma trận quyền, workflow B03–B09 | H06, M01 |
| OD-04 | Hội nghị (F05), chọn đơn vị (F03) và ký hợp đồng khai thác (F04) có quan hệ điều kiện thế nào? | Luồng quỹ khai thác | §5.3 |
| OD-05 | Quy tắc tạm ứng, thanh toán nhiều đợt, công nợ còn lại và điều kiện đóng hồ sơ? | B09; quy tắc demo cũ "một lần đúng đủ" | H07 |
| OD-06 | Quy ước tính lãi, tất toán trước hạn, tái tục và lãi nhập gốc có thuộc phạm vi không? | T03–T06 | H05 |
| OD-07 | Mẫu biểu, Excel, sao kê, sơ đồ và dữ liệu thật nào dùng để nghiệm thu? | B07, B18, F08, S01 | M05, M10 |
| OD-08 | Tác vụ AI bắt buộc trong lần đầu là gì? Hạn mức và dữ liệu nguồn? | A01 | M07 |

## Đã trả lời (không cần chốt thêm)

| ID | Câu hỏi | Trả lời | Nguồn |
|---|---|---|---|
| OD-09 | Mã task `D2-T*` trong commit lấy từ kế hoạch nào? | Không có file kế hoạch. Dấu vết duy nhất là các mục "Đợt 2 · T1/T2" trong `api-qltn/README.md` và nội dung commit (merge từ `origin/feature/api-dot2`, 23–24/10). Coi README và code là bản ghi việc đã làm, không phải kế hoạch. Từ nay phạm vi triển khai lấy theo `docs/product/features/*/SPEC.md`. | dev-build, 26/10/2026 |
