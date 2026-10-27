---
spec: MT.S1
fidelity: Level 1 (ASCII) + brief
screens: [items-list, item-detail, item-form, record-form-item-select]
---

# UI-UX brief: MT-S1 Thiết bị

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Dùng lại màn demo** cho chế độ `api`: `ItemsPage`, `ItemDetailPage`, `ItemFormDialog`, `components/item/*`, `components/item-list/*`. Slice này nối dữ liệu thật và bỏ các phần cần kế hoạch bảo trì. Không vẽ lại màn hình.
- Ở chế độ `api`, **ẩn** mọi phần dựa vào kế hoạch hoặc lượt bảo trì: thẻ "Quá hạn bảo trì", lọc nhanh "Quá hạn", tab "Bảo trì", `ItemPlanList`, `UpcomingMaintenanceList`, sắp xếp theo "lần kế tiếp", và các dòng lượt bảo trì trong `EquipmentHistoryTimeline`. **Không** để lại chỗ trống hay câu "sắp có".
- Dùng lại `Card`, `Badge`, `Tabs`, `Dialog`, `Field`, `Notice`, `LoadingState`, `EmptyState`, `ErrorState`, `Pagination`, `AttachmentList`, `FileUploader`, `useOnline`, `formatVnd`.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Tình trạng | `Badge` tone `good` "Tốt", `warn` "Cần chú ý", `neutral` "Chưa rõ" | như demo |
| Bảo hành | `WarrantyBadge` có sẵn, giữ nhãn và tone của demo cho 4 trạng thái: không có, còn bảo hành, sắp hết, đã hết | ngưỡng theo BR-MT-11 |
| Đang sửa chữa | `Badge` tone `info` "Đang sửa chữa" | |
| Đã ngừng dùng | `Badge` tone `neutral` "Đã ngừng dùng"; dòng trong danh sách có chữ `text-ink-3` | |
| Chi phí | `formatVnd`, chữ số `tabular-nums` | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Danh sách thiết bị (`/maintenance/items`)

```
Thiết bị                                                   [+ Thêm thiết bị]
Danh mục thiết bị của các tòa trong phạm vi của bạn.
┌ Thiết bị 16 ┐ ┌ Cần xử lý 3 ┐ ┌ Đang sửa chữa 1 ┐
(Tất cả) (Cần xử lý) (Đang sửa chữa) (Sắp hết bảo hành)
[Tìm mã, tên…]  [Tòa ▾]  [Loại ▾]  [☐ Gồm thiết bị đã ngừng]   Sắp xếp [Mã ▾]
┌──────────┬──────────────────┬──────────────┬──────────┬────────────┬──────────────┐
│ Mã       │ Tên              │ Vị trí       │ Tình trạng│ Bảo hành   │              │
├──────────┼──────────────────┼──────────────┼──────────┼────────────┼──────────────┤
│ BOM-A01  │ Bơm nước sinh hoạt│ A · Tầng hầm │ Tốt      │ Còn BH     │ Đang sửa chữa│
│ CAM-A01  │ Camera sảnh       │ A · Sảnh     │ Chưa rõ  │ Sắp hết · 12 ngày │       │
└──────────┴──────────────────┴──────────────┴──────────┴────────────┴──────────────┘
```

- Nút "Thêm thiết bị" chỉ hiện cho người có `MAINTENANCE_MANAGE`.
- Bấm dòng để mở trang thiết bị. Mã là liên kết thật (`<a>`).
- Bộ lọc giữ khi quay lại trang (như các danh sách khác của ứng dụng).

### 2.2 Trang thiết bị (`/maintenance/items/:itemId`)

```
BOM-A01 · Bơm nước sinh hoạt                [Sửa] [Đổi tình trạng] [⋯ Ngừng dùng]
Tòa A · Tầng hầm · Phụ trách: Nguyễn Văn A   (Tốt) (Còn bảo hành)
┌ Số lần sửa chữa 2 ┐ ┌ Chi phí đã duyệt 16.500.000 đ ┐ ┌ Đang sửa chữa 1 ┐ ┌ Bảo hành còn 210 ngày ┐
┌ Cần chú ý ──────────────────────────────────────────┐
│ • SC-031 đang mở · Đang thi công                    │
└─────────────────────────────────────────────────────┘
(Tổng quan) (Sửa chữa 2) (Tài liệu 1) (Lịch sử thay đổi)
```

- **Tổng quan:** thẻ thông số (loại, model, nhà cung cấp, ngày lắp, bảo hành, thông tin kỹ thuật), kèm 3 hồ sơ sửa chữa gần nhất.
- **Sửa chữa:** bảng mã, tên, ngày tạo, trạng thái, chi phí đã duyệt. Hồ sơ chưa có số tiền thì ghi "Chưa duyệt". Rỗng: "Chưa có hồ sơ sửa chữa nào cho thiết bị này."
- **Tài liệu:** `AttachmentList` kèm `FileUploader` (mục đích "Tài liệu thiết bị"). Ô tải chỉ hiện cho BQL khi thiết bị đang dùng.
- **Lịch sử thay đổi:** tạo, sửa, đổi tình trạng (cũ → mới, ghi chú), ngừng dùng và dùng lại (lý do), tài liệu. Mỗi dòng có người làm và thời điểm.
- **Thiết bị đã ngừng:** dải `Notice` tone `info` dưới đầu trang: "Thiết bị đã ngừng dùng từ dd/mm/yyyy. Lý do: …". Nút "Dùng lại" thay cho "Ngừng dùng"; các nút sửa bị ẩn.
- Thẻ số "Chi phí đã duyệt" có dòng nhỏ "Tổng số đã duyệt của các hồ sơ sửa chữa".

### 2.3 Hộp thoại thêm / sửa thiết bị

- Theo `ItemFormDialog` của demo. Thứ tự trường: Mã, Tên, Loại, Tòa, Vị trí, Người phụ trách, Model, Nhà cung cấp, Ngày lắp, Bảo hành đến, Thông tin kỹ thuật.
- Khi sửa: ô Mã và Tòa bị khóa, kèm gợi ý "Mã không đổi sau khi tạo." / "Tòa không đổi sau khi tạo."
- Ô Loại có gợi ý từ các loại đã có trong tòa (`<datalist>`), vẫn nhập tự do được.
- Ngừng dùng, Dùng lại, Đổi tình trạng: mỗi việc một hộp thoại nhỏ có ô lý do hoặc ghi chú bắt buộc (≥ 5 ký tự), báo lỗi ngay dưới ô.

### 2.4 Form hồ sơ sửa chữa: chọn thiết bị (chế độ `api`)

```
Thiết bị / hạng mục *
[Chọn thiết bị / hạng mục           ▾]
   Không thuộc thiết bị cụ thể
   BOM-A01 – Bơm nước sinh hoạt
   CAM-A01 – Camera sảnh
Bắt buộc khi gửi xác nhận. Chọn "Không thuộc thiết bị cụ thể" cho sửa chữa kết cấu chung.
```

- Thay ô tích "Không thuộc thiết bị cụ thể" hiện có ở chế độ `api` bằng ô chọn giống chế độ `mock` (`RecordInfoFields.tsx`).
- Chỉ liệt kê thiết bị **đang dùng** của tòa đã chọn. Riêng thiết bị đang gắn với hồ sơ thì vẫn hiện, dù đã ngừng, kèm chữ "(đã ngừng)".
- Chưa chọn tòa: ô bị khóa, gợi ý "Chọn tòa nhà trước."
- Tòa có hơn 50 thiết bị: dùng ô chọn có tìm kiếm. Dev-build chọn component có sẵn; nếu chưa có thì `<input list>` kèm `<datalist>`.
- Trong chi tiết hồ sơ: dòng "Thiết bị: BOM-A01 · Bơm nước sinh hoạt" là liên kết sang trang thiết bị. Không có thiết bị thì ghi "Không thuộc thiết bị cụ thể".

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Như §2.1, §2.2. Trang thiết bị có cột phụ bên phải cho thẻ thông số, như demo |
| 768–1023px | Bảng danh sách bỏ cột Vị trí, đưa vị trí xuống dưới tên. Thẻ số 2 cột |
| < 768px | Danh sách dùng thẻ: mã và cờ ở hàng trên, tên, vị trí, tình trạng. Thẻ số 2 cột. Tab cuộn ngang **bên trong thanh tab**. Hộp thoại chiếm toàn màn. Lề 16px. Không có cuộn ngang của trang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Danh sách: `LoadingState` 6 dòng. Trang thiết bị: khung xương đầu trang và thẻ số |
| Rỗng | Danh sách chưa có thiết bị: "Chưa có thiết bị nào." kèm nút "Thêm thiết bị" (nếu có quyền). Lọc không ra kết quả: "Không có thiết bị phù hợp." kèm nút "Xóa bộ lọc" |
| 404 / ngoài phạm vi | "Không tìm thấy thiết bị" kèm nút "Về danh sách thiết bị". Không hiện dữ liệu nào |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại". Lưu trong hộp thoại lỗi thì giữ nguyên dữ liệu đã nhập và báo lỗi trong hộp thoại |
| Xung đột phiên bản | `Notice` tone `warning`: "Thiết bị vừa được người khác cập nhật. Tải lại để xem bản mới." kèm nút "Tải lại" |
| Lỗi trường | Báo dưới đúng trường, `aria-invalid` và `aria-describedby` (như B06-S1) |
| Offline | Dùng `useOnline`. Khóa các nút ghi, kèm dòng "Đang mất kết nối — chưa lưu được thay đổi." Dữ liệu đã tải vẫn xem được |
| Accessibility | Trang có `h1` là "mã · tên". Thẻ số là danh sách `<dl>`. Bảng có `<th scope>`. Cờ không chỉ dựa vào màu, luôn có chữ. Hộp thoại giữ focus bên trong, Esc để đóng, focus trở về nút đã mở hộp thoại |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): danh sách, trang thiết bị, các thao tác ghi, chọn thiết bị trong form hồ sơ.
- Mock: giữ màn demo đầy đủ, gồm các phần bảo trì. Riêng lỗi sửa được mã (MD-06) được sửa ở cả hai chế độ.
