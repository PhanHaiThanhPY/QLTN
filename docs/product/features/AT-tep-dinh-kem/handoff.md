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

_(dev-build điền: commit, quyết định, bảng AC → bằng chứng, test đã chạy.)_
