---
spec: T.S1
fidelity: Level 1 (ASCII) + brief
screens: [rate-invitations-list, invitation-detail, offer-dialog, comparison-and-result, banks-catalog]
---

# UI-UX brief: T-S1 Thư mời chào lãi và chọn ngân hàng

**Chủ sở hữu:** PM/BA · **Cập nhật:** 28/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo D1 tr. 33–34 và nhịp của nhóm F:** hàng 4 ô số; bên trái là thẻ chính, bên phải là bản xem hoặc kết quả; một nút chính.
- **Dùng lại** cách dựng của F-S1 (đầu trang, danh sách đơn vị được mời, hộp thoại có lý do, danh sách kiểm khi gửi) và F-S2 (bảng so sánh thẻ, đề xuất và duyệt, lịch sử quyết định). Không dựng một bộ component thứ hai cho cùng một việc; dev-build tách phần dùng chung nếu cần.
- **Nhóm menu mới** "Tiền gửi quỹ bảo trì" (biểu tượng `PiggyBank` hoặc `Landmark` của lucide), gồm:
  - "Thư mời chào lãi";
  - "Ngân hàng".

  Nhóm chỉ hiện ở chế độ `api`, cho BQL, BQT và kế toán.
- **Số:**
  - lãi suất hiện "6,000 %/năm" (3 chữ số thập phân khi có, nếu không thì "6,0 %");
  - tiền dùng `formatVnd`, `tabular-nums`; ô số rút gọn ("1.000 tr"), bảng ghi đủ.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái thư | `Badge`: Nháp `neutral`, Đang nhận bản chào `info`, Đã hết hạn nhận `warn`, Đã chọn ngân hàng `good`, Không có kết quả `neutral`, Đã hủy `neutral` có chữ `text-ink-3` | |
| Phản hồi từng ngân hàng | `Badge`: Đã nhận `good`, Còn chờ `warn` | như D1 tr. 33 |
| Bản chào | `Badge`: Đủ hồ sơ `good`, Thiếu `warn`; cờ "Trễ hạn" `crit`, "Ngoài danh sách mời" `info` | |
| Thẻ bản chào được chọn | viền `border-good`, nhãn "Được chọn" `good` | như D1 tr. 34 |
| Cảnh báo không cao nhất, khác cơ sở | `Notice warning` | |
| Tiến độ phản hồi | thanh hai đoạn, dùng `--series-1` cho phần đã nhận và `--line` cho phần còn lại; kèm chữ "2/3" | không dùng màu tình trạng |

Không thêm token mới.

## 2. Màn hình

### 2.1 Danh sách thư mời (`/deposits/invitations`)

- **Ô số:** Đang nhận bản chào, Sắp hết hạn (≤ 2 ngày), Chờ duyệt kết quả, Đã chọn trong năm.
- **Bảng:** mã, tòa, số tiền, kỳ hạn, hạn phản hồi (kèm "còn N ngày"), "k/n đã phản hồi", trạng thái.
- Nút "Lập thư mời" chỉ hiện cho BQL.

### 2.2 Trang thư mời (D1 tr. 33)

```
MC-001 · Thư mời chào lãi suất                  (Đang nhận bản chào)   [+ Ghi nhận bản chào] [⋯ Gia hạn · Đóng sớm · Hủy]
Aqua 1 · Quỹ bảo trì · gửi 25/08/2026
┌ Số tiền 1.000 tr ┐ ┌ Kỳ hạn 90 ngày ┐ ┌ Hạn phản hồi 27/08 · 17:00 ┐ ┌ Đã phản hồi 2/3 ┐
(Thư mời & phản hồi) (So sánh bản chào 2) (Kết quả) (Lịch sử)
┌ MC-001 · THƯ MỜI ─────────────────────────┐ ┌ PHẢN HỒI NGÂN HÀNG ─────────────────── 2/3 ┐
│ Quỹ bảo trì Aqua 1                        │ │ ██████████████░░░░░░░  2 đã phản hồi · 1 chờ│
│ Số tiền mời gửi: 1.000.000.000 ₫          │ │ Ngân hàng A                     (Đã nhận) › │
│ Kỳ hạn: 90 ngày                           │ │ Ngân hàng B                     (Đã nhận) › │
│ Hạn phản hồi: 27/08/2026 · 17:00          │ │ Ngân hàng C                     (Còn chờ)   │
│ ▢ Thư mời MC-001.pdf                      │ │ Chưa sang chọn ngân hàng.                   │
└───────────────────────────────────────────┘ └─────────────────────────────────────────────┘
```

- **Thư ở Nháp:** nút chính "Ghi nhận gửi". Mở hộp thoại có ngày gửi và danh sách kiểm (tệp thư, ngân hàng, hạn phản hồi). Mục thiếu có dấu ✗ và liên kết tới chỗ cần sửa.
- **"Ghi nhận bản chào":** hộp thoại có các trường của BR-T1-06.
  - Ô lãi suất kiểm ngay số chữ số thập phân.
  - Dưới ô lãi suất có dòng xem trước "Lãi cả kỳ để so sánh: 15.000.000 ₫ (1.000.000.000 × 6,0% × 90 ÷ 360)", để BQL kiểm lại ngay khi nhập.
- Bấm một ngân hàng "Đã nhận" thì mở bản chào đó, chỉ đọc, kèm nút "Sửa" cho BQL.

### 2.3 Tab "So sánh bản chào" và "Kết quả" (D1 tr. 34)

```
Cùng điều kiện: 1.000.000.000 ₫ · 90 ngày                      (⚠ Các bản chào dùng cơ sở tính ngày khác nhau)
┌ #1 Ngân hàng B ─── (Được chọn) ┐ ┌ #2 Ngân hàng C ────────────┐ ┌ #3 Ngân hàng A ────────────┐
│ 6,0 %/năm · cơ sở 360          │ │ 5,9 %/năm · cơ sở 360      │ │ 5,8 %/năm · cơ sở 360      │
│ Lãi cả kỳ 15.000.000 ₫         │ │ Lãi cả kỳ 14.750.000 ₫     │ │ Lãi cả kỳ 14.500.000 ₫     │
│ Trả lãi định kỳ mỗi 30 ngày    │ │ Trả lãi cuối kỳ            │ │ Trả lãi cuối kỳ            │
│ (Đủ hồ sơ)                     │ │ (Đủ hồ sơ)                 │ │ (Đủ hồ sơ)                 │
└────────────────────────────────┘ └────────────────────────────┘ └────────────────────────────┘
┌ KQ-TG01 · KẾT QUẢ CHỌN ─────────── (Chờ duyệt) ┐
│ Ngân hàng B · Căn cứ: …                         │
│ ▢ BB-TG01 · Biên bản                            │
│ [Duyệt] [Yêu cầu sửa] [Từ chối]   (BQT)          │
└─────────────────────────────────────────────────┘
```

- Mỗi thẻ là một bản chào, xếp theo lãi cả kỳ giảm dần. Thẻ có thứ hạng `#n`. Thẻ "Thiếu" hoặc "Trễ hạn" có nhãn tương ứng, chữ `text-ink-2`.
- **Hộp thoại "Lập đề xuất kết quả"** (BQL, thư "Đã hết hạn nhận"):
  - chọn thẻ: chỉ bấm được thẻ đủ hồ sơ; thẻ "Thiếu" bị khóa, kèm lý do;
  - tải biên bản; ghi căn cứ;
  - nếu chọn thẻ không phải `#1` trong số bản đủ hồ sơ, hiện ngay ô "Lý do không chọn bản có lãi cao nhất" (bắt buộc), kèm `Notice warning`;
  - nếu chọn bản trễ hạn, hiện ô "Lý do xét bản chào trễ hạn";
  - phương án phụ "Không chọn được ngân hàng".
- **Góc nhìn BQT:** khối kết quả có cảnh báo (nếu có), bản chụp bảng so sánh lúc gửi duyệt, và 3 nút quyết định. Lịch sử quyết định nằm dưới.

### 2.4 Ngân hàng (`/deposits/banks`)

- **Bảng:** mã, tên, viết tắt, chi nhánh, người liên hệ, số thư đã mời, trạng thái.
- **Hộp thoại thêm và sửa** theo BR-T1-01.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Như §2 |
| 768–1023px | Một cột; khối phản hồi nằm dưới thư. Bảng so sánh 2 thẻ mỗi hàng |
| < 768px | Ô số 2 × 2. Danh sách thư dùng thẻ. Bảng so sánh: thẻ xếp dọc, giữ thứ hạng. Nút chính dính đáy màn, như D1 mobile. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và hai cột |
| Rỗng | Danh sách: "Chưa có thư mời chào lãi nào." kèm nút lập (BQL). Tab so sánh khi chưa có bản chào: "Chưa có ngân hàng nào gửi bản chào." Tab kết quả trước khi hết hạn nhận: "Lập kết quả sau khi hết hạn nhận bản chào." |
| Lỗi trường | Báo dưới đúng trường; danh sách kiểm khi gửi báo đúng mục; `aria-invalid` và `aria-describedby` |
| Xung đột phiên bản | `Notice warning` kèm nút "Tải lại" |
| 404 / ngoài phạm vi | "Không tìm thấy thư mời" kèm nút về danh sách |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại"; hộp thoại giữ nguyên dữ liệu đã nhập |
| Offline | `useOnline`: khóa nút ghi, kèm dòng "Đang mất kết nối — chưa lưu được thay đổi." |
| Accessibility | `h1` "MC-001 · Thư mời chào lãi suất". Ô số là `<dl>`. Thanh tiến độ có `role="progressbar"` với nhãn "2 trên 3 ngân hàng đã phản hồi". Thẻ bản chào trong hộp thoại đề xuất là `radio`; thẻ bị khóa có `aria-disabled` kèm lý do đọc được. Lãi suất đọc đủ "sáu phẩy không phần trăm một năm". Cờ luôn có chữ |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn T.
