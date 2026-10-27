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

**Nhánh** `feature/b7-s1-sign-forms` (worktree `../QLTN-b7-s1`), rebase lên `main` `2b86ce2` (đã có FX-S1..S3 và B06-S1).

Commit:
- `2f47225`: tab và ba bản in;
- `2300313`: bỏ trang trắng khi in, sửa dòng tên tòa, bằng chứng.

**Không đổi API, không có migration.** Mọi dữ liệu bản in cần đã có sẵn trong `GET /records/:id`:
- lần trình kèm quyết định và chữ ký;
- lượt nghiệm thu kèm chữ ký từng quyết định;
- đợt thanh toán kèm `signatureDataUrl`, `submittedBy`, `submittedAt`.

Họ tên người ký lấy từ dữ liệu tham chiếu của phiên.

| AC | Bằng chứng |
|---|---|
| AC-B7.1 | `DocumentsTab.test.tsx` và `document-models.test.ts` (6 dòng theo thứ tự thời gian, đúng trạng thái và số chữ ký). Ảnh `supporting/evidence/B7-1-documents-tab.png` (hồ sơ thật, dựng đúng như SPEC §4). |
| AC-B7.2 | `DocumentsTab.test.tsx`: hồ sơ chưa trình lần nào hiện "Chưa có tài liệu nào để in" kèm câu của brief. |
| AC-B7.3 | `DocumentPrintPage.test.tsx`: khi `GET /records/:id` trả 404, trang chỉ hiện "Không tìm thấy hồ sơ hoặc tài liệu" và nút về danh sách, không có tờ giấy nào. Phạm vi xem dựa trên đúng endpoint chi tiết (BR-B7-02). |
| AC-B7.4 | `DocumentView.test.tsx` và ảnh `B7-2-proposal-attempt-2.png` / `.pdf`: đủ trường §3.1, bảng báo giá có Đơn giá, Thành tiền, Chi phí, Thuế, Tổng tiền; khối ký BQL và BQT có ảnh chữ ký, họ tên, "Ký trên hệ thống QLTN lúc …"; không có chữ chìm. |
| AC-B7.5 | `DocumentView.test.tsx` và `B7-3-proposal-attempt-1-refused.png` / `.pdf`: chữ chìm "CHƯA PHÊ DUYỆT" có ở cả 2 trang PDF; "Ý KIẾN CỦA BAN QUẢN TRỊ" là lý do từ chối; khối BQT có chữ ký của quyết định từ chối. |
| AC-B7.6 | `document-models.test.ts`: 5 nhà thầu được tách thành 2 bảng (3 + 2), bảng sau lặp lại cột hạng mục, số liệu khớp. Chưa có ảnh riêng cho trường hợp này. |
| AC-B7.7 | Số tờ trình, chức danh và tên tổ chức BQL in thành dòng chấm. Test quét chữ của model và của trang (DocumentView): không có `undefined`/`null`/`NaN`. Script chụp ảnh cũng quét chữ của từng trang thật. |
| AC-B7.8 | `DocumentView.test.tsx` và `B7-4` / `B7-5`: lượt 1 đánh dấu ☒ KHÔNG ĐẠT, có điểm cần khắc phục của BQT; lượt 2 đánh dấu ☒ ĐẠT, đủ 3 chữ ký, cột "Khác" để trống. |
| AC-B7.9 | `DocumentView.test.tsx`: lượt đang nghiệm thu có chữ chìm "CHƯA HOÀN TẤT", không ô nào được đánh dấu, chỉ ô của người đã quyết định có chữ ký. |
| AC-B7.10 | `DocumentView.test.tsx` và `B7-6-letter-settlement.png` / `.pdf`: 6.000.000 VNĐ, "Sáu triệu đồng", dòng cách tính, người hưởng và nội dung của đợt, 4 mục ✓, chữ ký BQL. |
| AC-B7.11 | `DocumentView.test.tsx`: thư tạm ứng có 2 mục hồ sơ đính kèm theo §3.3. |
| AC-B7.12 | Đợt chờ duyệt có chữ chìm "CHƯA PHÊ DUYỆT". Đợt quyết toán 0 đồng không có nút mà có dòng "Không cần thư đề nghị: số của đợt bằng 0", và đường dẫn trực tiếp tới thư đó trả "không tìm thấy". |
| AC-B7.13 | 5 PDF do Chrome in bằng `Page.printToPDF` (cùng bộ máy với "Lưu thành PDF", khổ A4 theo CSS): biên bản và thư 1 trang, tờ trình 2 trang. Chân trang dạng "Bản in từ hệ thống QLTN · SC-0xx · … · in lúc … · trang X/Y" có trên mọi trang; thanh công cụ không xuất hiện. Hai khối ký luôn nằm cùng trang. CSS có `thead { display: table-header-group }` và `tr { break-inside: avoid }`; dữ liệu test chưa có bảng nào dài quá một trang, nên **chưa có ảnh** chứng minh tiêu đề bảng lặp lại sang trang sau. |
| AC-B7.14 | Toàn bộ web vitest 68 file, 446/446, gồm `RecordDocumentButton.test.tsx` của chế độ `mock`. Nút demo không đổi; tab "Biểu mẫu" chỉ có ở chế độ `api`. |

**Quyết định của dev-build:**
- **Trang xem/in.** Route `/records/:id/documents/:kind/:docId` nằm ngoài khung ứng dụng (không có sidebar), mở ở tab trình duyệt mới. Chưa đăng nhập thì chuyển sang `/login`.
- **Chân trang in.** Lấy từ `@page` margin box (`@bottom-left`, `counter(page)/counter(pages)`), chèn lúc chạy cho từng tài liệu. Trên màn hình hiện cùng câu nhưng không có số trang.
- **"Kính gửi" và "TÒA NHÀ …".** Bỏ chữ "Tòa" bị lặp khi tên tòa đã bắt đầu bằng "Tòa", giống cách API dựng "Kính gửi".
- **Thời điểm ký của thư đề nghị.** Dùng `submittedAt` của lần gửi gần nhất, vì chữ ký được lưu trong cùng giao dịch lúc gửi.
- **Nút "In".** Bị khóa đến khi mọi ảnh chữ ký giải mã xong.
- **Trang in khi lỗi.** Gặp 404 hoặc 403 thì chỉ hiện "Không tìm thấy hồ sơ hoặc tài liệu". Lỗi khác thì hiện Notice và nút "Thử lại"; nếu đang offline thì báo mất kết nối.
- **Hook `useOnline`.** Chép nguyên từ B06; sau khi rebase thì file trùng khớp với `main`.

**Test đã chạy:** web `tsc -b`; vitest toàn bộ 68 file, 446/446. Các test mới: `document-models.test.ts` (13), `DocumentsTab.test.tsx` (3), `DocumentView.test.tsx` (7), `DocumentPrintPage.test.tsx` (2).

**Dữ liệu thử trong `qltn_dev`:** SC-020 đến SC-023 (`[TEST B7 IN]`, mỗi lần chạy script tạo một hồ sơ, đều `COMPLETED`). Tòa A đã về STANDARD.
