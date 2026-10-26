# Quy trình tài liệu QLTN

**Cập nhật:** 26/10/2026 · **Áp dụng cho:** mọi thay đổi phạm vi, nghiệp vụ, API và nghiệm thu.

## 1. Nguyên tắc

1. **Một nguồn chuẩn cho mỗi loại thông tin.** Yêu cầu nằm ở `SPEC.md`, quyết định ở `DECISIONS.md`, quyết định kỹ thuật ở ADR, kết quả kiểm thử ở `qa/`. Không chép lại cùng một nội dung sang nơi khác — dẫn link.
2. **Không quyết định trong hội thoại.** Mọi quyết định ảnh hưởng phạm vi, quyền, tiền hoặc nghiệm thu phải ghi vào [product/DECISIONS.md](product/DECISIONS.md) kèm người quyết và ngày.
3. **Nguồn khách hàng là chỉ đọc.** File trong `sources/` không sửa; bản mới thêm cạnh bản cũ, có ngày trong tên và cập nhật [sources/INDEX.md](sources/INDEX.md).
4. **Không xóa, chỉ lưu trữ.** Tài liệu hết hiệu lực chuyển vào `archive/YYYY-MM/` và ghi lý do trong [archive/README.md](archive/README.md). Chỉ xóa bản nháp trùng hoặc ghi chú thô đã được tổng hợp, khi chủ dự án đồng ý.
5. **Tài liệu đi cùng code.** Thay đổi API/hành vi phải cập nhật SPEC hoặc README kỹ thuật trong cùng đợt bàn giao.

## 2. Vòng đời một yêu cầu

Khớp với workflow OpenRig `qltn-pm-ba-review-loop`.

| Bước | Ai | Đầu ra bắt buộc |
|---|---|---|
| 1. Yêu cầu | PM/BA (`dev-pm-ba`) | `product/features/<mã>/SPEC.md` trạng thái `Chờ duyệt`: phạm vi, AC đánh số, trạng thái, quy tắc, hợp đồng API nghiệp vụ, phụ thuộc OD-xx, mục "Ngoài phạm vi". |
| 1b. Duyệt | Chủ dự án (người dùng) | Chốt phạm vi; PM/BA ghi ngày và người duyệt vào đầu SPEC, chuyển `Đã duyệt`, rồi giao gói việc cho dev-build. Dev-build chỉ làm SPEC `Đã duyệt`. |
| 2. Triển khai | Dev (`dev-build`) | Code + test; cập nhật README kỹ thuật/ADR nếu có quyết định kỹ thuật; ghi `handoff.md`: AC nào đã làm, bằng chứng (lệnh test, kết quả), điểm chưa làm. |
| 3. Review | Reviewer (`dev-review`) | Kết quả review trong `handoff.md`: đạt hoặc danh sách phát hiện có mức độ và vị trí. |
| 4. Sửa | Dev | Chỉ sửa phát hiện đã ghi, cập nhật `handoff.md`, trả lại review. |
| 5. Đóng | PM/BA | SPEC chuyển `Đã triển khai`; cập nhật hiện trạng trong `product/README.md`; ghi biên bản vào `qa/` khi có UAT. |

Trạng thái của `SPEC.md`: `Nháp` → `Chờ duyệt` → `Đã duyệt` → `Đã triển khai` → (`Thay thế bởi …`).

- Một quy tắc phụ thuộc OD-xx còn `Chờ chốt` chỉ được vào SPEC `Đã duyệt` khi ghi rõ là **quy tắc tạm**, kèm OD-xx sẽ thay nó. Nếu không, quy tắc đó nằm ở mục "Ngoài phạm vi".
- Mỗi lần chuyển bước giữa các seat (giao việc, gửi review, trả sửa) đi kèm một việc trong hàng đợi OpenRig (`rig queue`) trỏ tới `SPEC.md`/`handoff.md`. Tin nhắn `rig send` chỉ để báo tin, không thay cho việc trong hàng đợi.
- Đóng ở bước 5 chỉ khi review ở bước 3 đạt và mọi AC trong SPEC có bằng chứng trong `handoff.md`, hoặc được ghi rõ là chuyển sang SPEC khác.

## 3. Mẫu và quy ước đặt tên

| Loại | Vị trí | Tên |
|---|---|---|
| Đặc tả tính năng | `product/features/` | `<mã D1>-<tên-không-dấu>/SPEC.md`, ví dụ `B03-ho-so-sua-chua/SPEC.md` |
| Quyết định sản phẩm | `product/DECISIONS.md` | `PD-xx` đã chốt, `OD-xx` chờ chốt |
| Quyết định kỹ thuật | `engineering/adr/` | `ADR-xxxx-<tên>.md`, theo [mẫu ADR](engineering/README.md#mẫu-adr) |
| Báo cáo review/phân tích | `reviews/YYYY-MM-DD/` | `<chủ-đề>.md`, bằng chứng trong `evidence/` |
| Biên bản UAT | `qa/uat/` | `YYYY-MM-DD-<mã>-<môi-trường>.md`, ghi rõ mock hay API thật |
| Nguồn khách hàng | `sources/customer/` | `<Dx>-<tên>/<tên>-YYYY-MM-DD.<ext>` |

- Tên file và thư mục: chữ thường, không dấu, nối bằng `-` (trừ file gốc khách hàng giữ tên khi cần đối chiếu).
- Ngày trong nội dung viết `dd/mm/yyyy`; ngày trong tên file viết `YYYY-MM-DD` để sắp xếp đúng.
- Link nội bộ dùng đường dẫn tương đối, không dùng đường dẫn tuyệt đối của máy cá nhân.
- Mỗi tài liệu mở đầu bằng: chủ sở hữu, ngày cập nhật, trạng thái.

## 4. Review tài liệu định kỳ

Cuối mỗi đợt bàn giao, PM/BA rà:

- SPEC nào đã lệch code → cập nhật hoặc mở OD mới.
- OD nào đã có câu trả lời → chuyển sang PD.
- Tài liệu nào không còn được tham chiếu → chuyển vào `archive/`.
