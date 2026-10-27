---
spec: AT.S1
fidelity: Level 1 (ASCII) + brief
screens: [uploader-report, attachment-viewer]
---

# UI-UX brief: AT-S1 Tải và xem tệp

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Sửa tại chỗ hai component dùng chung:** `components/common/FileUploader.tsx` và `AttachmentViewer.tsx`. Mọi màn dùng chúng (hồ sơ sửa chữa qua `AttachmentField`, bảo trì) tự có hành vi mới. Không sửa riêng từng màn.
- Giữ nút "Thêm tệp" và dòng gợi ý "JPEG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp." như hiện nay. Thêm vào cuối dòng: "Ảnh lớn sẽ được tự thu nhỏ."
- Dùng lại `Button`, `Notice` (hoặc khối cảnh báo có sẵn), `Dialog` (có `footer`), `toast` của sonner, `downloadBlob` của `utils/download.ts`.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Khối báo cáo có tệp lỗi | `Notice` (`components/common/Notice.tsx`) tone `warning` | khi **mọi** tệp đều lỗi: tone `danger` |
| Dòng tệp lỗi | tên tệp `font-medium`; lý do `text-ink-2` | |
| Dòng "Chưa tải" | `text-ink-3` | |
| Nút "Tải xuống" | `Button variant="secondary"`, biểu tượng `Download` | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Khối báo cáo sau lượt tải

```
[📎 Thêm tệp]
JPEG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp. Ảnh lớn sẽ được tự thu nhỏ.

┌ ⚠ Đã tải 3/5 tệp ───────────────────────────────────────── [×] ┐
│ IMG_2041.HEIC   Ảnh HEIC chưa được hỗ trợ. Trên iPhone, vào …   │
│ bao-gia.png     Nội dung tệp không đúng định dạng JPEG/PNG/…    │
└─────────────────────────────────────────────────────────────────┘
```

- Khối nằm **ngay dưới** nút tải của đúng ô đó (một màn có thể có nhiều ô tải: ảnh hiện trường, báo giá…).
- Chỉ liệt kê tệp lỗi và tệp "Chưa tải". Tệp đã lên hiện trong danh sách tệp như hiện nay.
- Lý do dài thì cho xuống dòng, không cắt chữ.
- Nút `×` có `aria-label="Đóng báo cáo tải tệp"`.
- Đang tải: nút "Thêm tệp" ở trạng thái đang tải như hiện nay, kèm chữ "Đang tải 2/5…". Các ô tải khác trên màn vẫn dùng được.

### 2.2 Hộp xem tệp

```
┌ HD-0012 Hòa Phát.pdf ─────────────────────────────────── [×] ┐
│                                                               │
│                     (ảnh hoặc PDF)                            │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                    [⬇ Tải xuống]   [Đóng]     │
└───────────────────────────────────────────────────────────────┘
```

- "Tải xuống" và "Đóng" nằm trong `footer` của `Dialog`. Trên màn hẹp, hai nút xếp dọc và rộng hết hộp, theo kiểu sẵn có của `Dialog`.
- "Tải xuống" dùng lại blob đang xem, không tải lại tệp lần nữa.
- Ảnh: bỏ `[image-rendering:pixelated]`; giữ `max-h-[70vh] w-auto`.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 640px | Khối báo cáo chia hai cột: tên tệp (tối đa 40% chiều rộng, cắt `…` kèm `title` đầy đủ), rồi đến lý do |
| < 640px | Mỗi tệp lỗi là hai dòng: tên tệp ở trên, lý do ở dưới. Lề 16px. Không có cuộn ngang |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Đang nén ảnh | Chữ của nút đổi thành "Đang xử lý ảnh 2/5…". Giao diện không bị đứng; nén chạy không chặn thao tác cuộn |
| Đang tải | "Đang tải 2/5…" (§2.1) |
| Xong, không lỗi | Toast "Đã tải «n» tệp". Không có khối báo cáo |
| Xong, có lỗi | Khối báo cáo §2.1. Không có toast cho từng tệp lỗi |
| Mất mạng giữa chừng | Tệp đang tải có lý do "Mất kết nối — chưa tải được tệp này." Các tệp sau vẫn được thử (BR-AT-01) |
| Hộp xem: đang tải tệp | "Đang mở tệp…" như hiện nay; nút "Tải xuống" bị khóa |
| Hộp xem: lỗi | Lỗi như hiện nay; ẩn nút "Tải xuống" |
| Accessibility | Khối báo cáo có `role="status"` và `aria-live="polite"`. Khi khối xuất hiện, **không** chuyển focus vào nó, nhưng trình đọc màn hình đọc dòng đầu "Đã tải k/n tệp". Nút "Tải xuống" có tên đọc được là "Tải xuống «tên tệp»". Dùng được bằng bàn phím; Esc đóng hộp xem như hiện nay |

## 5. Phân biệt thật và mock

- Áp dụng cho cả `api` và `mock`, vì hai component dùng chung.
- Ở `mock`, lý do lỗi lấy từ phần kiểm tệp của demo (`file-service.ts`). Ở `api`, lý do là lời của máy chủ.
