---
spec: F.S4
fidelity: Level 1 (ASCII) + brief
screens: [reconciliation-month, statement-import, match-panel]
---

# UI-UX brief: F-S4 Sao kê và đối soát

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo D1 tr. 12:** hàng 4 ô số (đầu kỳ, thu, chi, cuối kỳ **theo sao kê**). Cột trái là sao kê, cột phải là chứng từ đã ghép. Dòng tình trạng: "Chênh lệch 0 đ · Lệch/trùng 0/0".
- **Đối soát là việc so hai danh sách,** nên bố cục là hai cột song song. Mỗi cặp đã ghép nằm **cùng một hàng**, để mắt dò ngang được.
- **Tiền:** thu có dấu `+` và chữ `text-good`; chi có dấu `−` và chữ `text-ink`; luôn có dấu, không chỉ dựa vào màu. Dùng `tabular-nums`, `formatVnd`.
- **Thêm mục "Sao kê và đối soát"** vào nhóm "Quỹ khai thác". Chỉ kế toán và BQT thấy mục này.
- Dùng lại `Card`, `Tabs`, `Dialog`, `Field`, `Notice`, `Table`, `FileUploader`, `Badge`, `useOnline`, cùng các khối ô số và bộ chọn tòa, tháng của "Sổ quỹ" (F-S3).
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Tình trạng tháng | `Badge`: "Đã khớp" `good` kèm ✓; "Còn lệch" `warn`; "Chưa có sao kê" `neutral` | |
| Dòng sao kê | `Badge`: Chưa ghép `warn`, Đã ghép `good`, Đã ghi nhận từ sao kê `info`, Có thể trùng `crit` | |
| Đề xuất ghép | hàng có nền `bg-info-soft`, kèm nút "Xác nhận" | |
| Dòng tự khử | chữ `text-ink-3`, nhãn "Tự khử" `neutral` | |
| Chênh lệch ≠ 0 | số `text-crit font-semibold`, kèm biểu tượng ⚠ và chữ "Chênh lệch" | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Đối soát tháng (`/exploitation/reconciliation`)

```
Sao kê và đối soát                       [Tòa: Aqua 1 ▾] [Tháng 11/2026 ▾]   [Nhập sao kê]
Quỹ khai thác · Tài khoản ****0001 · Theo sao kê
┌ Đầu kỳ 50 tr ┐ ┌ Thu 15 tr ┐ ┌ Chi 5 tr ┐ ┌ Cuối kỳ 60 tr ┐
(✓ Đã khớp) 4/4 khớp · Chênh lệch 0 đ · Lệch/trùng 0/0       Chỉ tính giao dịch thực nhận, thực chi.
┌ SAO KÊ · ****0001 ────────── (4 giao dịch) ┐ ┌ CHỨNG TỪ ĐÃ GHÉP ────────────── (4/4 khớp) ┐
│ GD-001  18/11/2026            +10.000.000  │ │ PT-001 · Liên kết GD-001                 ✓ │
│ GD-002  22/11/2026             +5.000.000  │ │ PT-002 · Liên kết GD-002                 ✓ │
│ GD-003  22/11/2026             −2.000.000  │ │ GNT-001 · Liên kết GD-003                ✓ │
│ GD-004  23/11/2026             −3.000.000  │ │ PC-001 · Liên kết GD-004                 ✓ │
└────────────────────────────────────────────┘ └────────────────────────────────────────────┘
Chưa ghép (0)   ·   Lần nhập (1) ›
```

- **Tháng có dòng lệch:** khối "Chưa ghép" mở ra, chia hai phần:
  - **Sao kê chưa ghép:** mỗi dòng có nút "Ghép…" và, nếu là phí hoặc lãi, nút "Ghi nhận từ sao kê";
  - **Sổ chưa đối soát:** mỗi dòng có nút "Ghép…".
- **Có đề xuất:** dải `Notice info` đầu trang "n đề xuất ghép đang chờ xác nhận", kèm nút "Xác nhận tất cả đề xuất". Mỗi hàng đề xuất có nút "Xác nhận" và "Bỏ qua".
- **"Ghép…"** mở bảng chọn phía bên kia. Ứng viên thỏa BR-F4-05 được xếp lên đầu, kèm lý do vì sao là ứng viên ("cùng số tiền, lệch 1 ngày"). Ứng viên lệch ngày > 5 thì có ô lý do bắt buộc.
- **Bỏ ghép:** menu `⋯` trên hàng đã ghép, mở hộp thoại có ô lý do.
- **Chênh lệch ≠ 0:** dòng tình trạng ghi rõ ngày và hai số, ví dụ "Theo sổ 61.000.000 · Theo sao kê 60.000.000 · Chênh lệch +1.000.000 đ".
- **Cảnh báo số dư đầu** (BR-F4-09) là `Notice warning` đầu trang.

### 2.2 Nhập sao kê (hộp thoại 2 bước)

1. **Bước 1, chọn cách nhập:**
   - "Tải tệp" (`FileUploader` nhận `.csv`, `.xlsx`), kèm liên kết "Tải mẫu tệp";
   - hoặc "Nhập tay".
   - Cả hai đều có các ô: kỳ từ, kỳ đến, số dư đầu kỳ, số dư cuối kỳ theo ngân hàng.
2. **Bước 2, xem trước:**
   - bảng các dòng đọc được, kèm cột "Kết quả": Mới / Trùng (bỏ qua) / Có thể trùng / Lỗi;
   - dòng kiểm "Đầu kỳ 50.000.000 + giao dịch 10.000.000 = 60.000.000 · Cuối kỳ theo ngân hàng 60.000.000 ✓".

   Có dòng lỗi, hoặc sao kê không khép, thì nút "Nhập" bị khóa. Lỗi hiện theo số dòng và cột (BR-F4-02).
3. **Sau khi nhập:** đóng hộp thoại, kèm toast "Đã nhập 4 dòng, bỏ qua 0 dòng trùng, 4 đề xuất ghép."

### 2.3 Lần nhập

- **Danh sách:** thời điểm, người nhập, kỳ, số dòng mới, số dòng trùng, tệp gốc (tải xuống được).
- Nút "Xóa lần nhập" chỉ hiện khi chưa có dòng nào được ghép (BR-F4-04).

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Hai cột song song như §2.1 |
| 768–1023px | Hai cột thu hẹp; nội dung giao dịch rút gọn, kèm `title` đầy đủ |
| < 768px | Ô số 2 × 2. Mỗi cặp ghép là **một thẻ**: dòng sao kê ở trên, chứng từ ở dưới, có mũi tên nối. Dòng chưa ghép là thẻ đơn có nút "Ghép…". Xem trước khi nhập: mỗi dòng một thẻ, lỗi nằm trong thẻ. Hộp thoại chiếm toàn màn. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và hai cột |
| Chưa có sao kê của tháng | Ô số ghi "Chưa có sao kê"; khối giữa có câu "Nhập sao kê tháng này để đối soát." kèm nút "Nhập sao kê" (kế toán) |
| Chưa thiết lập quỹ | Như F-S3: "Thiết lập quỹ trước khi nhập sao kê." |
| Lỗi tệp | Hiện ở bước 2, theo dòng; không đóng hộp thoại; giữ tệp đã chọn |
| Xung đột (người khác vừa ghép cùng dòng) | `Notice warning`: "Dòng này vừa được ghép bởi người khác. Tải lại." Không ghép đè |
| 403 / 404 | BQL mở trang: "Bạn không có quyền xem đối soát." Ngoài phạm vi tòa: "Không tìm thấy" |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại". Hộp thoại nhập giữ nguyên tệp và các số đã nhập; **không bao giờ báo "Đã nhập" khi chưa nhập** |
| Offline | `useOnline`: khóa nhập, ghép, bỏ ghép, kèm dòng "Đang mất kết nối." |
| Accessibility | Hai cột là hai `<section>` có tiêu đề. Mỗi cặp ghép có tên đọc được: "GD-001, ngày 18 tháng 11, cộng mười triệu đồng, đã ghép với PT-001". Dòng tình trạng có `aria-live="polite"` để báo khi chênh lệch thay đổi. Bảng xem trước có `<th scope>`; dòng lỗi có `aria-invalid` và lời lỗi đọc được |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn F.
