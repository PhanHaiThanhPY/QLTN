# Handoff: AT-S1 Tải và xem tệp đáng tin hơn

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-23) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-AT.12).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/at-s1-upload-report`.
- Chạy song song được với B4-S1: hai slice không sửa chung file code nào.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- `components/common/FileUploader.tsx`: vòng tải nằm trong `try`, nên lỗi đầu tiên thoát cả vòng (ATG-01). Đây là chỗ chính cần sửa.
- `components/common/AttachmentViewer.tsx`: đã có blob và object URL; `Dialog` có `footer`; `utils/download.ts` có `downloadBlob`.
- `components/common/Notice.tsx` có tone `warning` và `danger`.
- Chỗ dùng `FileUploader`: `features/records/components/shared/AttachmentField.tsx`, `features/maintenance/components/ItemDocumentsCard.tsx`, `occurrence/ChecklistWorkEditor.tsx`, `occurrence/ChecklistEntryEditor.tsx`.
- Lý do lỗi của máy chủ: `toErrorMessage` (`domain/errors`). Mã lý do 403 là `attachment_step_denied`.

**Những gì phải tạo mới:**
- Tải tiếp khi lỗi, kèm khối báo cáo (BR-AT-01, BR-AT-02).
- Nút "Tải xuống" (BR-AT-03).
- Nén ảnh ở web (BR-AT-04): dùng canvas hoặc `createImageBitmap` có sẵn của trình duyệt. Chỉ thêm thư viện nếu thật cần, và ghi lý do vào bằng chứng.
- Chặn HEIC (BR-AT-05).

**Cần lưu ý:**
- Hướng xoay EXIF: `createImageBitmap(file, { imageOrientation: 'from-image' })` hoặc tương đương. Phải có test cho ảnh orientation 6 (AC-AT.7).
- Tệp tải xuống phải đúng byte của tệp đã lưu, không phải bản đã nén ở máy người xem.
- Không đổi API. Nếu thấy cần, hỏi PM/BA trước.
- AC-AT.10 (iPhone thật): không có thiết bị thì ghi rõ là chưa kiểm.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/at-s1-upload-report` (worktree `../QLTN-at-s1`, tách từ `main` dc9d2f1). Chưa push, chưa merge.

**Commit:**
- `36a86a4`: web.
- `3fe8c73`: API, sửa tên tệp UTF-8.
- Commit bằng chứng này.

### Thay đổi API duy nhất của slice (PM/BA đã duyệt lúc 08:07Z)

- Lỗi tìm thấy khi kiểm AC-AT.5 trên trình duyệt thật: multer 2.4.0 mặc định đọc tên tệp trong multipart theo latin1. Vì vậy `HD-0012 Hòa Phát.pdf` bị lưu và tải về thành `HD-0012 HÃ²a PhÃ¡t.pdf`.
- Cách sửa: `FileInterceptor('file', { …, defParamCharset: 'utf8' })` ở `attachments.controller.ts`.
- Không đổi luật tải, giới hạn hay định dạng. Không sửa ngược các tên đã lưu sai (chỉ có ở dữ liệu dev).
- E2e mới ở `attachments.e2e-spec.ts` kiểm tên trong metadata và trong `Content-Disposition`. Test này fail trước khi sửa (nhận `HÃ²a PhÃ¡t`) và đạt sau khi sửa.

### Quyết định của dev-build

- **Tách hai module thuần:**
  - `services/upload-prep.ts`: chặn HEIC và nén ảnh. Bộ giải mã/mã hóa ảnh tiêm vào được, để test không cần trình duyệt thật.
  - `components/common/upload-batch.ts`: vòng tải lần lượt từng tệp.
  - `FileUploader` chỉ nối hai module này với giao diện. `UploadReport.tsx` dựng khối báo cáo từ `Notice`.
- **Mã lỗi dừng lượt:** FORBIDDEN (403), NOT_FOUND (404), CONFLICT và INVALID_TRANSITION (409), UNAUTHORIZED (401). Mọi lỗi khác chỉ thuộc về tệp đó.
- **Mất mạng:** lỗi `NETWORK_ERROR` khi `navigator.onLine = false` dùng câu "Mất kết nối — chưa tải được tệp này.". Nếu vẫn có mạng (ví dụ lỗi 5xx) thì dùng lời của máy chủ.
- **Nén ảnh:** `createImageBitmap(file, { imageOrientation: 'from-image' })` xoay ảnh theo EXIF ngay khi giải mã, sau đó vẽ lên canvas và xuất JPEG 0,85. Bản JPEG mới không mang EXIF nên luôn đứng đúng chiều. Không thêm thư viện.
- **Ảnh không giải mã được** (ví dụ tệp `.txt` đổi đuôi): gửi nguyên như đã chọn, để máy chủ (hoặc demo) nêu lý do đúng định dạng (AC-AT.1).
- **Tải xuống:** dùng lại blob đang xem, qua `downloadBlob` với tên `attachment.fileName`, không tải lại tệp.
  - Nút có `aria-label="Tải xuống «tên»"`, bị khóa khi đang mở tệp, bị ẩn khi mở lỗi.
  - Footer có thêm nút "Đóng" (brief §2.2). Dialog vẫn giữ nút × của nó, nên có hai nút tên "Đóng".
- **Toast thành công:** "Đã tải «n» tệp" giờ hiện ở mọi chỗ dùng `FileUploader` khi cả lượt thành công (trước đây không có toast thành công).
- **Test cũ đã sửa (AC-AT.12):** `FileUploader.test.tsx`, hai ca sai định dạng và quá 10 MB, trước kiểm `toast.error`, nay kiểm dòng trong khối báo cáo (BR-AT-02: không dùng toast cho tệp lỗi).
- **Cổng debug Chrome:** `docs/tools/cdp-browser.mjs` mặc định dùng cổng 9333, trùng với probe của dev-review đang chạy, nên một lần chạy đã bám nhầm Chrome của họ (đã báo dev-review). Script AT-S1 dùng `CDP_PORT`, mặc định 9344. Nên đổi mặc định của helper chung ở một slice khác.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| AC-AT.1 | Component `FileUploader.batch.test.tsx` "4/5"; script trên trình duyệt thật: 5 tệp, tệp thứ 2 là văn bản đổi đuôi `.png` → "Đã tải 4/5 tệp", `bao-gia.png` kèm lý do của máy chủ; ảnh `evidence/AT-1-report-wide.png`, `AT-2-report-375.png` (375px, overflow 0px) |
| AC-AT.2 | Component: mất mạng ở tệp 2, tệp 1 và 3 vẫn lên, tệp 2 có câu "Mất kết nối…" |
| AC-AT.3 | Component: 403 ở tệp 1 → "Đã tải 0/3 tệp", lý do của máy chủ, 2 dòng "Chưa tải", chỉ gọi tải 1 lần, tone danger; thêm ca 404 / 409 / 401 |
| AC-AT.4 | Component: 3 tệp hợp lệ → toast "Đã tải 3 tệp", không có khối báo cáo |
| AC-AT.5 | Script: `HD-0012 Hòa Phát.pdf` và `man-hinh.png` tải xuống từ hộp xem, lưu đúng tên gốc, sha256 trùng với tệp đã tải lên; e2e API cho tên tiếng Việt; component: nút khóa khi đang mở, dùng đúng tên và đúng blob; ảnh `AT-6-viewer-download.png` |
| AC-AT.6 | Script: `bql-b` lấy nội dung một tệp của tòa A → 404; component: lỗi thì ẩn "Tải xuống" |
| AC-AT.7 | Script: ảnh 6000×4000 có EXIF orientation 6, nặng 11,8 MB → lưu thành `IMG_DOC_6.jpg` 2667×4000 (đứng dọc), 2,3 MB, `image/jpeg`; góc đỏ ở góc trên trái của ảnh gốc nằm ở góc trên phải ảnh đã lưu (`topRight` = [224,0,0]), nghĩa là ảnh đứng đúng chiều; unit: ngưỡng, kích thước, chất lượng, đổi đuôi, gọi giải mã với `imageOrientation: 'from-image'`; ảnh `AT-3-viewer-portrait.png` |
| AC-AT.8 | Unit: ảnh 3 MB, 3000 px → trả đúng đối tượng File cũ, không gọi bộ mã hóa |
| AC-AT.9 | Unit (theo loại tệp và theo đuôi `.HEIC`/`.heif`, không giải mã); component: không gọi tải, có đúng câu ở BR-AT-05 |
| AC-AT.10 | **Chưa kiểm**: không có iPhone thật hay trình giả lập iOS Safari trên máy này. Chuyển sang UAT |
| AC-AT.11 | Ảnh 4000×3000 (không bị nén, `naturalWidth` 4000): `AT-4-viewer-smooth-after.png` (bản đang giao) và `AT-5-viewer-pixelated-before.png` (cùng ảnh, gắn lại `image-rendering: pixelated` để mô phỏng bản cũ); component: class không còn `pixelated` |
| AC-AT.12 | Toàn bộ test web đạt; test cũ đã sửa ghi ở trên; component cho loading ("Đang tải 1/1…"), `role="status"` (aria-live polite), nút đóng có `aria-label` |

### Test đã chạy

- **web:**
  - `tsc -b` OK.
  - Toàn bộ vitest: 471/471.
  - Test liên quan: `upload-prep` 10, `FileUploader.batch` 9, `FileUploader` 3, `AttachmentViewer` 3.
- **api-qltn:**
  - `format:check`, eslint (`src/modules/attachments` và e2e) và `tsc --noEmit` đều OK.
  - e2e `attachments` 9/9 (`E2E_POSTGRES_DB=qltn_build_e2e`).
- **Trình duyệt thật:**
  - Script `supporting/at-s1-upload-check.mjs`, Chrome headless, chế độ `api`.
  - API của worktree chạy ở cổng 5302, có bản sửa tên tệp. Kết quả: PASS.

### Dữ liệu thử để lại trên qltn_dev

- Hồ sơ nháp `[TEST AT TỆP] Ảnh hiện trường …` có mã SC-059 đến SC-066, sinh từ nhiều lần chạy script; các lần đầu dừng do lỗi của chính script, đã sửa. Kèm các tệp đã tải lên các hồ sơ này.
- Một số tệp tải lên trước khi sửa API có tên sai mã: `HD-0012 HÃ²a PhÃ¡t.pdf`.
- Không đụng tòa, cấu hình hay mật khẩu nào.

