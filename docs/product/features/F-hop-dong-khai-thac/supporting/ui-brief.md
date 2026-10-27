---
spec: F.S2
fidelity: Level 1 (ASCII) + brief
screens: [package-selection-tab, package-assembly-tab, contracts-list, contract-detail, receivable-schedule]
---

# UI-UX brief: F-S2 Chọn đơn vị, hội nghị, hợp đồng

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo nhịp của F-S1 và D1 tr. 7–9:** hàng 4 ô số; bên trái là thẻ chính, bên phải là bản xem hoặc chi tiết; một nút chính.
- **Dùng lại các component của F-S1:** đầu trang gói, thẻ đơn vị, `Badge` trạng thái, hộp thoại có lý do, danh sách kiểm. Thêm hai tab vào trang gói ("Kết quả chọn", "Hội nghị"), và một mục menu "Hợp đồng khai thác" trong nhóm "Quỹ khai thác".
- Dùng lại `Card`, `Tabs`, `Dialog`, `Field`, `Notice`, `Table`, `FileUploader`, `AttachmentList`, `formatVnd`, `useOnline`.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái kết quả | `Badge`: Nháp `neutral`, Chờ duyệt `info`, Cần sửa `warn`, Đã duyệt `good`, Bị từ chối `crit`, Đã thay thế `neutral` có chữ `text-ink-3` | |
| Thẻ đơn vị ở bảng so sánh | được chọn: viền `border-good`, nhãn "Được chọn" `good`; không đủ: nhãn "Chưa đủ" `warn`, cả thẻ dùng chữ `text-ink-2` | như D1 tr. 7 |
| Kết quả hội nghị | `Badge`: Thông qua `good`, Không thông qua `crit`, Chưa họp `neutral` | |
| Trạng thái hợp đồng | `Badge`: Nháp `neutral`, Đã ký `info`, Hiệu lực `good`, Đã hủy `neutral` có chữ `text-ink-3` | |
| Trạng thái kỳ | `Badge`: Chưa đến hạn `neutral`, Đến hạn `warn`, Quá hạn `crit` | luôn kèm chữ |
| Mốc hồ sơ liên kết | dòng thời gian dọc: ngày màu `text-accent`, tiêu đề `font-semibold`, dòng phụ `text-ink-2` | như D1 tr. 8 |

Không thêm token mới.

## 2. Màn hình

### 2.1 Tab "Kết quả chọn" trong trang gói (D1 tr. 7)

```
┌ Đơn vị 2 ┐ ┌ Đủ điều kiện 1 ┐ ┌ Được chọn 1 ┐ ┌ Biên bản 1 ┐
┌ KQ-001 · MT-001 ── (Chờ duyệt) ──────────┐ ┌ KẾT QUẢ LỰA CHỌN ───────────────────┐
│ Căn cứ chọn đơn vị                       │ │ DV-A                                 │
│ ┌ DV-A ─── (Được chọn) ┐ ┌ DV-B ─ (Chưa đủ)┐│ │ Hồ sơ đủ điều kiện theo biên bản     │
│ │ 20                   │ │ 22              ││ │ đánh giá.                            │
│ │ triệu đồng / tháng   │ │ triệu đồng/tháng││ │ ▢ BB-001 · Biên bản đánh giá         │
│ │ Đủ hồ sơ             │ │ Thiếu chứng từ  ││ │ Giá chào cao hơn không thay thế điều │
│ └──────────────────────┘ └─────────────────┘│ │ kiện hồ sơ.                          │
└──────────────────────────────────────────┘ │ [Duyệt] [Yêu cầu sửa] [Từ chối]  (BQT)│
                                             └──────────────────────────────────────┘
```

- **Gói "Đã đóng nhận", chưa có kết quả:** nút chính "Lập đề xuất kết quả".
- **Hộp thoại đề xuất:**
  - chọn đơn vị: chỉ bấm được thẻ của đơn vị **đủ hồ sơ**. Thẻ không đủ bị khóa, kèm dòng lý do ("Đang bổ sung · thiếu Chứng từ điều kiện");
  - nếu chọn hồ sơ trễ hạn thì hiện thêm ô "Lý do xét hồ sơ trễ hạn";
  - tải biên bản; ghi căn cứ;
  - phương án phụ "Không chọn được đơn vị".
- Lịch sử các quyết định (người, thời điểm, lý do) nằm dưới khối kết quả.
- Nút "Đổi kết quả" chỉ hiện khi chưa có hợp đồng đã ký.

### 2.2 Tab "Hội nghị" trong trang gói (D1 tr. 9)

```
┌ Hồ sơ trình 1 ┐ ┌ Tài liệu đủ 3 ┐ ┌ Còn thiếu 0 ┐ ┌ Có biên bản 1 ┐
┌ HN-001 · 12/11/2026 ───────────────────────┐ ┌ HỒ SƠ HỘI NGHỊ ─────────────────┐
│ Khai thác quầy dịch vụ Aqua 1               │ │ Quyết nghị NQ-001               │
│ ┌ Kết quả hội nghị ─────────── (Thông qua) ┐│ │ Nội dung: Khai thác quầy tiện ích│
│ │ Liên kết MT-001 và HĐ-001                ││ │ Hồ sơ liên quan: MT-001 / HĐ-001 │
│ └──────────────────────────────────────────┘│ │ Biên bản: BB-HN01                │
│ 01  Tờ trình khai thác · TR-001 · Đã tập hợp│ └──────────────────────────────────┘
│ 02  Biên bản hội nghị · BB-HN01 · Đã lưu    │
│ 03  Quyết nghị · NQ-001 · Đã cập nhật       │
└─────────────────────────────────────────────┘           [Lưu kết quả hội nghị]
```

- "Lưu kết quả hội nghị" mở hộp thoại: chọn Thông qua hoặc Không thông qua. Danh sách tài liệu bắt buộc **đổi theo lựa chọn** (BR-F2-06).
- Hồ sơ đã thay thế hiện thu gọn bên dưới, kèm nhãn "Đã thay thế bởi HN-…".

### 2.3 Danh sách hợp đồng (`/exploitation/contracts`)

- **Ô số:** Hiệu lực, Đã ký chờ hiệu lực, Kỳ quá hạn, Tổng phải thu còn lại của các kỳ chưa đến hạn. Ô cuối là số tiền, dùng `formatVnd` rút gọn.
- **Bảng:** mã, đơn vị, gói hoặc khu vực, thời hạn, giá trị mỗi kỳ, kỳ kế tiếp (hạn), trạng thái.

### 2.4 Trang hợp đồng (D1 tr. 8)

```
HĐ-001 · Hợp đồng khai thác quầy tiện ích     (Hiệu lực) · Phiên bản 1    [Phụ lục sửa đổi]
DV-A · Sảnh dịch vụ Aqua 1 · 16/11 – 30/11/2026
┌ Hợp đồng 1 ┐ ┌ Giá trị/kỳ 20 tr ┐ ┌ Bản ký 1 ┐ ┌ Phụ lục 1 ┐
(Tổng quan) (Lịch phải thu 1) (Tài liệu) (Lịch sử)
┌ HĐ-001 · BẢN KÝ ───────────────────────┐ ┌ MỐC HỒ SƠ LIÊN KẾT ──────────────────┐
│ Đơn vị DV-A      Khu vực Sảnh dịch vụ  │ │ 11/11  Kết quả chọn KQ-001 · Đã duyệt│
│ Kỳ khai thác 16–30/11/2026             │ │ 12/11  Hội nghị thông qua · HN-001   │
│ Nghĩa vụ kỳ 20 triệu đồng · Tháng      │ │ 15/11  Hợp đồng được ký · Bản ký,    │
│ Hạn thu: ngày đầu kỳ + 9 ngày          │ │        phụ lục                       │
│ ▢ HĐ-001 · Hợp đồng khai thác           │ │ 25/11  Đến hạn thu · 20 triệu đồng › │
│ ▢ PL-001 · Phụ lục thanh toán           │ └──────────────────────────────────────┘
└────────────────────────────────────────┘
```

- **Hợp đồng "Đã ký":** nút chính "Đưa vào hiệu lực" mở danh sách kiểm 3 điều kiện (BR-F2-09). Điều kiện thiếu có dấu ✗ và liên kết tới chỗ cần làm, ví dụ "Chưa có quyết nghị thông qua → Mở tab Hội nghị của MT-001".
- "Mốc hồ sơ liên kết" là dòng thời gian, mỗi mốc là liên kết. Mốc "Đến hạn thu" mở tab "Lịch phải thu".
- **Tab "Lịch phải thu":**
  - bảng: kỳ, từ–đến, hạn thu, phải thu, phiên bản, trạng thái;
  - dòng tổng ở cuối;
  - kỳ thuộc phiên bản cũ đã bị thay thì hiện thu gọn trong "Lịch sử phiên bản".
- **Phụ lục sửa đổi:** hộp thoại có các trường sửa được, ngày hiệu lực, tệp và lý do. Hộp thoại có **xem trước** lịch phải thu mới: kỳ giữ nguyên và kỳ sinh lại, trước khi lưu.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Hai cột như §2 |
| 768–1023px | Một cột; khối bên phải xuống dưới |
| < 768px | Ô số 2 × 2. Bảng so sánh: thẻ đơn vị xếp dọc. Lịch phải thu: mỗi kỳ một thẻ (kỳ, hạn, số tiền, trạng thái). Dòng thời gian giữ dạng dọc. Nút chính dính đáy màn. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và hai cột |
| Rỗng | Tab Kết quả chọn khi gói chưa đóng nhận: "Gói đang nhận hồ sơ. Lập kết quả sau khi đóng nhận." Tab Hội nghị khi chưa chọn đơn vị: "Trình hội nghị sau khi kết quả chọn được duyệt." Danh sách hợp đồng: "Chưa có hợp đồng khai thác nào." |
| Lỗi trường / điều kiện | Báo đúng chỗ. Danh sách kiểm "Đưa vào hiệu lực" luôn nói rõ thiếu gì; `aria-invalid` và `aria-describedby` |
| Xung đột phiên bản | `Notice warning` kèm nút "Tải lại" |
| 404 / ngoài phạm vi | "Không tìm thấy hợp đồng" hoặc "Không tìm thấy gói" kèm nút về danh sách |
| Không có quyền xem giá chào | Kế toán không thấy tab "Kết quả chọn"; trên trang hợp đồng, mốc "Kết quả chọn" chỉ hiện tên đơn vị, không hiện bảng so sánh |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại"; lỗi trong hộp thoại thì giữ nguyên dữ liệu đã nhập |
| Offline | `useOnline`: khóa nút ghi, kèm dòng "Đang mất kết nối — chưa lưu được thay đổi." |
| Accessibility | `h1` "mã · tên". Thẻ đơn vị trong hộp thoại đề xuất là `radio` (thẻ bị khóa có `aria-disabled` kèm lý do đọc được). Dòng thời gian là `<ol>` có `<time>`. Bảng lịch phải thu có `<th scope>` và dòng tổng trong `<tfoot>` |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn F.
