# Module `attachments`: Tệp đính kèm

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-22)**

**Code đã đọc** (commit `b2bf9c3`):
- API: `api-qltn/src/modules/attachments/` (`attachments.controller.ts`, `attachments.service.ts`, `file-storage.ts`, `entities/attachment.entity.ts`, `dto/upload-attachment.dto.ts`); `bootstrap.ts` (helmet); `records.service.ts` (`getDetail`, `list`); `record-loader.ts`.
- Web: `components/common/FileUploader.tsx`, `AttachmentList.tsx`, `AttachmentViewer.tsx`, `services/file-service.ts`, `utils/download.ts`.
- Test: `api-qltn/test/attachments.e2e-spec.ts` (chỉ đọc tên ca), `FileUploader.test.tsx`, `file-service.api.test.ts`.
- Đặc tả demo D3 §8.1 (`archive/2026-10/specs/D3-dac-ta-demo-2026-10-12.md` dòng 328–330); SPEC [B03–B09 v2](../features/B03-B09-luong-sua-chua/SPEC.md) BR-C-02.

**Liên quan nghiệp vụ:** tệp là bằng chứng của mọi bước sửa chữa: ảnh hiện trường, báo giá, biên bản, ảnh thi công và nghiệm thu, hóa đơn, chứng từ chuyển khoản. Bảo trì (B10–B13) cũng sẽ dùng cùng bảng này (D3: `MAINTENANCE_OCCURRENCE`, `MAINTENANCE_ITEM`…).

## 1. Tính năng và trạng thái

| # | Tính năng | API | Web `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| AT-01 | Tải tệp lên một hồ sơ sửa chữa, theo **mục đích** (10 loại: ảnh hiện trường, báo giá, biên bản sự việc, biên bản họp BQT, quyết định chi phí BQT, thi công, nghiệm thu, đề nghị thanh toán, hóa đơn, chứng từ chuyển khoản) | `POST /attachments` | `FileUploader` | e2e `attachments`, test web | **API** |
| AT-02 | Kiểm tệp: JPEG/PNG/WebP/PDF, ≤ 10 MB, không rỗng, **nội dung đúng định dạng** (magic bytes) | có | báo lỗi bằng toast, ghi tên tệp | e2e | **API** |
| AT-03 | Ai được tải loại nào, ở bước nào (`PURPOSE_RULES`) | có | nút chỉ hiện ở bước hợp lệ | e2e | **API** |
| AT-04 | Xem tệp: ảnh trong hộp xem, PDF trong khung | `GET /attachments/:id/content` | `AttachmentViewer` (tải blob kèm token, tạo object URL khi mở, thu hồi khi đóng) | e2e | **API** |
| AT-05 | Bỏ tệp khỏi một danh sách (nháp hồ sơ, tờ trình…) | qua lệnh của từng bước | nút "Bỏ" | e2e "detaches … keeping the file readable" | **API**; tệp vẫn còn trong kho |
| AT-06 | Nhật ký tải tệp | `uploadAttachment` vào `audit_events` | — | e2e | **API** |
| AT-07 | Tải xuống tệp gốc | — | **không có nút** | — | **Chưa có** |
| AT-08 | Xóa hẳn tệp, dọn tệp không dùng | — | — | — | **Chưa có** |
| AT-09 | Tệp cho bảo trì (lượt, kế hoạch, thiết bị) | chỉ nhận `REPAIR_RECORD` | demo IndexedDB | — | **Demo**; làm cùng module maintenance |

## 2. Quy tắc đang chạy (đọc từ code)

- **Phạm vi khi đọc:** tệp chỉ được trả cho người có **tòa** của tệp trong phạm vi. Ngoài phạm vi thì trả 404, không phân biệt "không có" và "không được xem". Quyền không bao giờ dựa riêng vào ID tệp, đúng D3 §8.1.
- **Phạm vi khi tải lên:** kiểm tòa, rồi đến **vị trí** (nếu người dùng bị giới hạn vị trí), rồi đến luật của mục đích. Bị từ chối thì trả 403 với lý do `attachment_step_denied`.
- **Luật theo mục đích** (rút gọn):
  - BQL quản lý hồ sơ tải ảnh hiện trường lúc nháp; báo giá và biên bản sự việc lúc soạn tờ trình; ảnh thi công lúc thi công hoặc khẩn cấp.
  - Người giữ bước BQT tải biên bản họp khi tờ trình đang chờ mình. Tải quyết định chi phí khi hồ sơ "không duyệt hậu kiểm" (B06).
  - BQL có quyền thanh toán tải đề nghị thanh toán và hóa đơn. Người có `PAYMENT_CONFIRM` tải chứng từ chuyển khoản.
  - Nghiệm thu: BQL lúc thi công hoặc khắc phục; thành viên nghiệm thu khi đang chờ nghiệm thu.
- **Kho:** tệp ghi ra thư mục `STORAGE_DIR` trên máy chủ, tên tệp trong kho là UUID, không dùng tên gốc. Metadata và nhật ký ghi cùng một giao dịch; giao dịch lỗi thì xóa tệp vừa ghi.
- **Trả nội dung:** `Content-Type` là loại đã kiểm; `Content-Disposition: inline` với tên gốc đã mã hóa. Helmet bật `nosniff`.
- **Bỏ tệp khỏi danh sách** chỉ gỡ liên kết. Tệp và dòng metadata vẫn còn và vẫn đọc được, để lịch sử đối chiếu được.
- **Web:** chọn nhiều tệp một lần, tải **lần lượt**.

## 3. Khoảng trống và rủi ro

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **ATG-01** | Chọn nhiều tệp mà một tệp bị từ chối (ví dụ tệp thứ 2 trong 5 tệp quá 10 MB): **các tệp sau đó không được tải, và không báo gì**. Toast chỉ nêu tệp lỗi. Người dùng tưởng 4 tệp kia đã lên | `FileUploader.tsx` `handleFiles`: vòng lặp nằm trong `try`, lỗi đầu tiên thoát vòng | **Trung bình** (mất bằng chứng âm thầm) | Tải tiếp các tệp còn lại; cuối lượt báo "Đã tải n/m tệp" và liệt kê từng tệp lỗi kèm lý do |
| **ATG-02** | Không có nút **Tải xuống** tệp gốc. Kế toán cần lưu hóa đơn và chứng từ; BQT cần tải biên bản. Hiện chỉ có cách dùng nút của trình xem PDF, hoặc chuột phải vào ảnh | `AttachmentViewer.tsx`; `utils/download.ts` có sẵn `downloadBlob` | **Trung bình** | Thêm nút "Tải xuống" trong hộp xem, dùng tên gốc |
| ATG-03 | Chỉ nhận JPEG/PNG/WebP/PDF. Báo giá của nhà thầu thường là Excel hoặc Word, như chính các mẫu D5 khách đang dùng (`.docx`). Người dùng phải tự đổi sang PDF | `ALLOWED_MIME_TYPES`; `sources/customer/D5-bieu-mau/` | Trung bình | **Hỏi khách** (ATQ-01). Mặc định đề xuất: giữ 4 định dạng. Thêm `.xlsx`/`.docx` thì chỉ cho tải xuống, không xem trong trang |
| ATG-04 | Ảnh chụp từ iPhone có thể là HEIC. Chưa kiểm xem Safari có tự đổi sang JPEG với `accept` hiện tại hay không. Ảnh điện thoại đời mới cũng có thể vượt 10 MB, và web không nén ảnh trước khi tải | `DEFAULT_ACCEPT`; `MAX_FILE_BYTES` | Trung bình | Kiểm trên iPhone thật khi làm slice. Nếu lỗi: nén hoặc đổi định dạng ở web trước khi tải |
| ATG-05 | Tệp không bao giờ bị xóa. Tệp tải lên rồi bỏ, hoặc tải lên rồi hủy nháp, nằm mãi trong kho. Không có hạn mức theo hồ sơ hay theo tòa | không có lệnh xóa; `storage.remove` chỉ dùng khi giao dịch lỗi | Thấp (dữ liệu nhỏ ở quy mô 4 tòa) | Ghi nhận. Dọn tệp mồ côi (chưa từng gắn vào bước nào, quá 30 ngày) để sau. Không xóa tệp đã từng là bằng chứng |
| ATG-06 | Kho là thư mục trên đĩa máy chủ. Sao lưu, khôi phục và chuyển máy chủ phải tính cả thư mục này, không chỉ PostgreSQL | `file-storage.ts` (ghi chú "a later S3 backend only replaces this class") | Trung bình (vận hành) | Ghi vào tài liệu triển khai: sao lưu `STORAGE_DIR` cùng lịch với DB. Việc này thuộc dev-build hoặc owner, không phải SPEC sản phẩm |
| ATG-07 | Đọc tệp chỉ kiểm **tòa**, trong khi tải lên kiểm cả **vị trí**. Điều này khớp với `GET /records` và `GET /records/:id` (cũng chỉ kiểm tòa), nên **không phải lỗi riêng của tệp**. Câu hỏi chung là người bị giới hạn vị trí có được xem hồ sơ của vị trí khác trong cùng tòa hay không | `readContent`; `records.service.ts` `getDetail`, `list`; `record-loader.ts` | Thấp | Chuyển sang phân tích `roles` / RM. Không sửa riêng ở attachments |
| ATG-08 | Ảnh trong hộp xem dùng `image-rendering: pixelated`. Ảnh chụp thật khi thu nhỏ vào khung 70vh sẽ bị răng cưa | `AttachmentViewer.tsx` dòng 44 | Thấp | Bỏ thuộc tính này cho ảnh chụp |
| ATG-09 | Không xem trước được nhiều ảnh: mỗi lần chỉ mở một tệp, không có nút ảnh trước/sau, không có ảnh thu nhỏ trong danh sách | `AttachmentList.tsx` | Thấp | Để sau. Có thể gom vào slice UI chung |
| ATG-10 | Bảo trì chưa dùng được API tệp (chỉ nhận `REPAIR_RECORD`) | `SUPPORTED_SUBJECT_TYPES` | — | Làm cùng module maintenance (#9), không tách riêng |

**Đã kiểm, không thấy lỗi:**
- Tệp giả định dạng (ví dụ tệp HTML đổi đuôi thành `.png`) bị từ chối nhờ kiểm magic bytes.
- Tên tệp gốc không dùng làm đường dẫn trong kho, khóa của kho được kiểm theo mẫu.
- Ảnh SVG không được nhận, nên không có đường cho script trong ảnh.
- Web không bao giờ trỏ thẳng `<img src>` vào API. Web tải blob kèm token, nên token không lọt vào URL.

## 4. Câu hỏi cho khách hoặc chủ dự án

Đã ghi thành **OD-22** trong `DECISIONS.md`.

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| ATQ-01 | Có cần nhận tệp Excel / Word (báo giá, biên bản nhà thầu gửi) không? | Không ở giai đoạn này; nhà thầu gửi PDF. Nếu khách cần: nhận `.xlsx`, `.docx`, chỉ cho tải xuống |
| ATQ-02 | Giới hạn 10 MB mỗi tệp có đủ không (ảnh điện thoại, bản quét nhiều trang)? | Đủ, nếu web tự nén ảnh lớn trước khi tải |
| ATQ-03 | Tệp đã gửi có được xóa không, ai xóa? | Không. Tệp đã gắn vào một bước là bằng chứng, chỉ gỡ được khi còn nháp (như hiện nay). Không có xóa hẳn |
| ATQ-04 | Tệp lưu bao lâu? Có quy định lưu trữ hồ sơ của BQT không? | Lưu suốt đời hồ sơ, không tự xóa |

## 5. Đề xuất slice

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **AT-S1** ([SPEC](../features/AT-tep-dinh-kem/SPEC.md), đã triển khai 27/10) | Sửa trải nghiệm tải và xem: tải tiếp khi một tệp lỗi và báo kết quả từng tệp (ATG-01); nút "Tải xuống" (ATG-02); bỏ `pixelated` cho ảnh chụp (ATG-08); kiểm ảnh iPhone (HEIC) và ảnh lớn trên điện thoại thật, nén ảnh ở web nếu cần (ATG-04). Chỉ sửa web, không đổi API | Không |
| AT-S2 | Nhận Excel/Word chỉ để tải xuống (ATG-03) | ATQ-01: chỉ làm nếu khách cần |
| AT-S3 | Dọn tệp mồ côi (ATG-05) | Sau khi có quy định lưu trữ (ATQ-04) |
| — | Tệp cho bảo trì (ATG-10) | Làm trong slice của module maintenance |
| — | Sao lưu `STORAGE_DIR` (ATG-06) | Việc vận hành của dev-build hoặc owner |

**AC nháp cho AT-S1:**
- **AC-1** Chọn 5 ảnh, ảnh thứ 2 quá 10 MB: 4 ảnh còn lại được tải lên. Có một thông báo "Đã tải 4/5 tệp", nêu tên ảnh lỗi và lý do "vượt quá 10 MB".
- **AC-2** Mở một hóa đơn PDF trong hộp xem, bấm "Tải xuống": máy lưu tệp có đúng tên gốc và đúng nội dung (so byte).
- **AC-3** Ảnh chụp 4000×3000 mở trong hộp xem không bị răng cưa (ảnh chụp so sánh).
- **AC-4** Trên iPhone (Safari), chọn ảnh từ thư viện và chụp ảnh mới: cả hai đều tải lên được, hoặc có thông báo lỗi rõ ràng, nói cách khắc phục.
- **AC-5** Người không có tòa của tệp vẫn nhận 404 khi mở hoặc tải xuống tệp (giữ hành vi hiện tại).
