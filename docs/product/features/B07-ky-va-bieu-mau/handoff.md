# Handoff: B7-S1 Bản xem và in theo mẫu D5

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-20) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

**Cách làm:**
- Nhánh và worktree riêng, tách từ `main` mới nhất (đã có FX-S1–S3). Gợi ý tên nhánh: `feature/b07-s1-print-forms`.
- Làm **sau B06-S1**, hoặc song song nếu còn RAM. Slice này gần như chỉ sửa web và không đụng các file B06-S1 đang sửa. Có một chỗ có thể chạm nhau: view đọc của `GET /records/:id`, nếu B7-S1 cần thêm trường đọc.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan (SPEC §5). Chạy dev server một lần cho ảnh và PDF.

## Ghi chú cho dev-build (PM/BA)

**Mẫu gốc** nằm ở `docs/sources/customer/D5-bieu-mau/`:
- `Số tờ trình.docx`
- `BIÊN BẢN NGHIỆM THU.docx`
- `BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`: tệp này là thư đề nghị thanh toán.

Đọc chữ của mẫu bằng `unzip -p <tệp> word/document.xml`. Những đoạn mà SPEC ghi "chép nguyên văn" (cơ sở xin phê duyệt, câu mở đầu, lời kết) phải lấy đúng chữ trong mẫu.

**Dữ liệu sẵn có:** chi tiết hồ sơ ở chế độ `api` đã trả `signatureDataUrl` cho lần trình, quyết định nghiệm thu và đợt thanh toán (`construction.service.ts`, `payments.service.ts`). Hãy kiểm thêm xem đã có họ tên người ký và quyết định ở bước BOARD chưa. Thiếu thì thêm vào view đọc, và ghi lại vào phần bằng chứng.

**Bản demo hiện có** (`detail/record-document.ts`, `RecordDocumentButton`) dùng cho chế độ `mock`, giữ nguyên (AC-B7.14). Mã của nó có thể tham khảo, nhưng bố cục phải theo D5.

**Quyết toán 0 đồng** đến từ FX-S2: đợt có `amountVnd = '0'` và trạng thái `TRANSFERRED`.

**Nếu SPEC chưa rõ:** chỉ hỏi PM/BA khi câu trả lời có thể làm đổi ý định nghiệp vụ. Còn lại thì tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build ghi: nhánh, commit, AC → bằng chứng, test đã chạy, ảnh và PDF)_
