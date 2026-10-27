---
spec: F.S5
fidelity: Level 1 (ASCII) + brief
screens: [fund-report, fund-report-print, contract-termination-tab]
---

# UI-UX brief: F-S5 Báo cáo thu chi, thanh lý

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo D1 tr. 13–14:** hàng 4 ô số; bên trái là khối chính (thác nước hoặc điều kiện khép), bên phải là khối kết luận (số dư cuối kỳ hoặc trạng thái đóng); một nút chính ("Xuất thu chi" hoặc "Đóng hồ sơ").
- **Biểu đồ theo skill `dataviz`:**
  - **Thác nước một trục,** đơn vị ghi rõ. Cột "Đầu kỳ" và "Cuối kỳ" dùng `--series-1`.
  - **Cột "+Thu" và "−Chi" không dùng màu tình trạng** (`--good`, `--crit`). Lý do: B01 §5.3 đã kiểm và thấy `--series-1` quá gần `--good`.
  - Hai cột thay đổi dùng một cặp màu mà dev-build chọn rồi **kiểm bằng `validate_palette.js`**, cùng với `--series-1`, ở cả chế độ sáng và tối. Mỗi cột có **nhãn số có dấu** ("+15", "−5"), nên không phụ thuộc vào màu.
  - Mọi biểu đồ có nút "Xem dạng bảng" và chú thích khi rê chuột (giá trị đủ, đơn vị đồng).
- **Nguồn số luôn hiện ở đầu báo cáo:** nhãn "Theo sao kê · Đã đối soát" (`good`), hoặc "Số liệu theo sổ, chưa đối soát xong" (`warn`, kèm danh sách tháng lệch).
- **Công nợ và cọc nằm trong khối riêng,** không bao giờ đứng cạnh số dư như một phần của nó (D1: "chưa cộng vào tiền quỹ").
- Dùng lại `Card`, `Tabs`, `Dialog`, `Field`, `Notice`, `Table`, `FileUploader`, `Badge`, `useOnline`; khung bản in A4 của B7-S1 (`DocumentPrintPage`: `@page`, chân trang, nút In).
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Cột đầu và cuối kỳ | `--series-1` | đã kiểm ở B01 §5.3 |
| Cột +Thu, −Chi | cặp do dev-build chọn và kiểm bằng script | không dùng `--good`, `--crit`, `--warn` |
| Nguồn số | `Badge`: "Theo sao kê · Đã đối soát" `good` kèm ✓; "Theo sổ, chưa đối soát xong" `warn` kèm ⚠ | |
| Trạng thái hợp đồng | thêm "Đang thanh lý" `info`, "Đã thanh lý" `neutral` có chữ `text-ink-3`; cờ "Đã hết hạn, chưa thanh lý" `warn` | |
| Điều kiện khép | `Badge`: "Đạt", "Đã lập", "Đã xử lý" `good`; "Còn X đ" `crit`; "Chưa có" `neutral`; "Đang chờ duyệt" `info` | như D1 tr. 14 |
| Trạng thái đóng | khối có biểu tượng ✕ trong ô viền (chưa thể đóng) hoặc ✓ (đủ điều kiện); số còn lại `text-warn` cỡ lớn | như D1 tr. 14 |
| Dòng nội bộ | `Badge` `neutral` "Nội bộ" | |

## 2. Màn hình

### 2.1 Báo cáo thu chi (`/exploitation/report`, D1 tr. 13)

```
Báo cáo thu chi quỹ           [Tòa: Aqua 1 ▾] [Kỳ: Tháng 11/2026 ▾]      [In] [Xuất thu chi ▾ XLSX]
Aqua 1 · Quỹ khai thác · (✓ Theo sao kê · Đã đối soát) · Số liệu tính đến 09:42 27/11/2026
┌ Đầu kỳ 50 tr ┐ ┌ Thu 15 tr ┐ ┌ Chi 5 tr ┐ ┌ Cuối kỳ 60 tr ┐
┌ AQUA 1 · THÁNG 11/2026 ────────────────────────┐ ┌ SỐ DƯ CUỐI KỲ ─────────────────────────┐
│ Dòng tiền quỹ khai thác                        │ │ 60 triệu                                │
│        +15                                     │ │ Thu khai thác                (15 triệu) │
│   50  ▇▇▇▇   −5         60                     │ │ Chi thuế                      (2 triệu) │
│  ████       ▔▔▔▔       ████                    │ │ Chi dịch vụ                   (3 triệu) │
│  ████                  ████                    │ │ ─────────────────────────────────────── │
│  Đầu kỳ  Thu   Chi    Cuối kỳ                  │ │ trong đó tiền cọc đang giữ: 0 ₫         │
│ Đơn vị: triệu đồng · 50 + 15 − 5 = 60          │ └─────────────────────────────────────────┘
│ [Xem dạng bảng]                                │ ┌ THEO DÕI RIÊNG · KHÔNG CỘNG VÀO QUỸ ───┐
└────────────────────────────────────────────────┘ │ Còn phải thu: 5 triệu                   │
                                                   │   HĐ-001 · DV-A · 5.000.000 · quá hạn 2 ngày│
                                                   │ Không thu được trong kỳ: 0 ₫            │
                                                   └─────────────────────────────────────────┘
Thu theo hợp đồng: bảng mã · đơn vị · số tiền       ·   Chi tiết sổ ›
```

- **Ô chọn kỳ:** Tháng (mặc định tháng trước), Quý, Năm, Khoảng tùy chọn.
- **Nguồn số là "theo sổ":** dải `Notice warning` dưới tiêu đề, liệt kê tháng lệch và chênh lệch, kèm liên kết tới màn đối soát của tháng đó (F-S4).
- Mỗi dòng nguồn hình thành mở danh sách chứng từ; mỗi hợp đồng là liên kết.
- **"Xuất thu chi"** mở menu XLSX. **"In"** mở bản in A4 ở tab mới.

### 2.2 Bản in A4

- Dùng khung `DocumentPrintPage` của B7-S1: nền trắng, chữ đen, `@page A4 portrait`, chân trang "Bản in từ hệ thống QLTN · Báo cáo thu chi · Aqua 1 · 11/2026 · in lúc … · trang X/Y".
- Thứ tự trên bản in:
  1. tiêu đề;
  2. nhãn nguồn số;
  3. bảng số chính;
  4. thác nước, vẽ bằng SVG đen trắng, có nhãn số;
  5. nguồn hình thành;
  6. theo dõi riêng;
  7. thu theo hợp đồng;
  8. hai ô ký tay "Người lập" và "Ban quản trị".
- Bản in **không** dùng màu. Thác nước dùng đậm nhạt và nhãn số.

### 2.3 Tab "Thanh lý" trong trang hợp đồng (D1 tr. 14)

```
┌ Hồ sơ thanh lý 1 ┐ ┌ Còn phải thu 5 tr ┐ ┌ Bàn giao 1/1 ┐ ┌ Điều kiện thiếu 1 ┐
┌ TL-001 · HĐ-001 ──────────────────────────────────┐ ┌ TRẠNG THÁI ĐÓNG ──────────────────┐
│ Điều kiện khép hồ sơ                              │ │  ┌───┐                            │
│ Bàn giao khu vực · BG-001                  (Đạt) │ │  │ ✕ │  Chưa thể đóng              │
│ Biên bản thanh lý · TL-001              (Đã lập) │ │  └───┘                            │
│ Công nợ hợp đồng                    (Còn 5 triệu)│ │  Khoản phải thu còn lại           │
│ Tiền cọc                                (Đã xử lý)│ │  5.000.000 đ                      │
│ Đề xuất đang chờ                          (Không) │ │  Bàn giao ngày 30/11 · Rà soát 01/12│
│ ┌ Còn nghĩa vụ cần xử lý ─────────────────────┐   │ └───────────────────────────────────┘
│ │ Hồ sơ được giữ mở đến khi xử lý xong công nợ│   │
│ │ [Ghi khoản thu] [Cấn trừ cọc] [Không thu được…]│ │
│ └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘                       [Đóng hồ sơ] (khóa)
```

- **Hợp đồng chưa có hồ sơ thanh lý:** tab có nút "Lập hồ sơ thanh lý" (BQL). Hợp đồng có cờ "Đã hết hạn, chưa thanh lý" thì nút nổi bật hơn.
- **Mỗi điều kiện** là một dòng có trạng thái. Dòng chưa đạt có nút hành động ngay bên cạnh, theo vai trò:
  - "Ghi bàn giao";
  - "Tải biên bản";
  - "Ghi khoản thu" (kế toán);
  - "Cấn trừ cọc" (kế toán);
  - "Đề xuất không thu được" (BQL hoặc kế toán);
  - "Lập phiếu hoàn cọc" (kế toán).
- **Hộp thoại cấn trừ** và **không thu được** có bảng phân bổ vào kỳ, như hộp thoại khoản thu của F-S3. Có dòng xem trước kết quả, ví dụ: "Sau khi cấn trừ: cọc còn 35.000.000, công nợ 0, số dư quỹ không đổi."
- **"Đóng hồ sơ":** khi đủ điều kiện, mở hộp thoại xác nhận "Đóng HĐ-001? Hợp đồng sẽ chuyển Đã thanh lý và không mở lại được." Nút xác nhận dùng tone `danger`.
- **Hồ sơ đã đóng:** cả tab chỉ đọc, kèm dải `Notice info` "Đã thanh lý ngày …".

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Hai cột như §2.1, §2.3 |
| 768–1023px | Một cột; khối số dư cuối kỳ và theo dõi riêng nằm dưới thác nước |
| < 768px | Ô số 2 × 2. Thác nước co theo chiều ngang, nhãn số vẫn đọc được; nếu quá hẹp thì chuyển thành bảng 4 dòng (đầu kỳ, thu, chi, cuối kỳ) kèm thanh ngang nhỏ. Điều kiện khép thành danh sách thẻ; nút "Đóng hồ sơ" dính đáy màn, như D1 mobile. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương có đúng chiều cao thác nước; trang không nhảy |
| Kỳ không có dòng | Thác nước chỉ có đầu kỳ bằng cuối kỳ, kèm câu "Không có khoản thu, chi nào trong kỳ." |
| Chưa thiết lập quỹ | "Kế toán chưa thiết lập quỹ khai thác của tòa này." |
| Đang xuất | Nút ở trạng thái đang tải; xong thì tải tệp về, kèm toast "Đã xuất báo cáo" |
| Lỗi điều kiện khi đóng | Gọi API đóng khi thiếu điều kiện, ví dụ do người khác vừa thay đổi: hiện lại danh sách điều kiện với điều kiện thiếu, không đóng |
| Xung đột phiên bản | `Notice warning` kèm nút "Tải lại" |
| 403 / 404 | BQL mở báo cáo: "Bạn không có quyền xem báo cáo quỹ." Ngoài phạm vi tòa: "Không tìm thấy" |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại"; hộp thoại giữ nguyên dữ liệu đã nhập; **không báo "Đã đóng" khi chưa đóng** |
| Offline | `useOnline`: khóa nút ghi và nút xuất, kèm dòng "Đang mất kết nối." |
| Accessibility | Thác nước là SVG có `role="img"` và `aria-label` tóm tắt đủ ("Đầu kỳ 50 triệu, thu 15 triệu, chi 5 triệu, cuối kỳ 60 triệu"), kèm bảng ẩn hoặc nút "Xem dạng bảng". Danh sách điều kiện khép là `<ul>`, mỗi mục đọc được "Công nợ hợp đồng: còn 5 triệu, chưa đạt". Nút "Đóng hồ sơ" khi bị khóa có `aria-disabled` và lý do đọc được |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn F.
