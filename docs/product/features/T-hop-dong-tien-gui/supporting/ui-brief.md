---
spec: T.S2
fidelity: Level 1 (ASCII) + brief
screens: [maintenance-fund-ledger, fund-regulation, deposit-contracts-list, deposit-contract-detail, interest-schedule]
---

# UI-UX brief: T-S2 Quỹ bảo trì, quy chế, hợp đồng tiền gửi

**Chủ sở hữu:** PM/BA · **Cập nhật:** 28/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo D1 tr. 35–36 và nhịp đã dùng:** hàng 4 ô số; bên trái là thẻ chính, bên phải là "Mốc hồ sơ liên kết" hoặc khoản kế tiếp; một nút chính.
- **Dùng lại, không dựng lại:**
  - "Sổ quỹ" của F-S3: thêm ô chọn **loại quỹ** (Khai thác / Bảo trì) cạnh ô chọn tòa;
  - màn đối soát của F-S4: tự chạy được cho tài khoản quỹ bảo trì;
  - trang hợp đồng khai thác của F-S2: "Mốc hồ sơ liên kết", bảng lịch, phụ lục có xem trước;
  - khung duyệt và lịch sử quyết định của F-S2 và T-S1.
- **Ba số của quỹ bảo trì luôn đi cùng nhau,** đúng thứ tự: **Số dư tài khoản · Gốc đang gửi · Tài sản quỹ**.
  - Tài sản quỹ có dòng giải thích "= số dư tài khoản + gốc đang gửi".
  - Không có ô nào ghi "Số dư" trơn ở quỹ bảo trì, để không lẫn hai khái niệm.
- **Lãi suất và tiền:** như T-S1. Ngày đáo hạn luôn hiện cùng kỳ hạn, ví dụ "90 ngày · đáo hạn 30/11/2026".
- Thêm vào nhóm menu "Tiền gửi quỹ bảo trì": "Hợp đồng tiền gửi", "Quy chế quỹ". "Sổ quỹ bảo trì" là cùng màn sổ quỹ, đã chọn sẵn loại Bảo trì.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái hợp đồng | `Badge`: Nháp `neutral`, Chờ duyệt `info`, Đã duyệt `good`, Bị từ chối `crit`, Đã ký `info`, Đang gửi `good`, Đã hủy `neutral` có chữ `text-ink-3` | |
| Kỳ lãi | `Badge`: Chưa đến kỳ `neutral`, Đến hạn `warn`, Quá hạn `crit` | T-S3 thêm Đã nhận, Nhận thiếu |
| Khác bản chào | `Notice warning`, liệt kê từng trường khác: "Lãi suất: 6,1% (bản chào 6,0%)" | |
| Quy chế | `Badge`: Đang hiệu lực `good`, Chờ duyệt `info`, Phiên bản cũ `neutral` | |
| Gửi tiền chưa đối soát | `Badge` `neutral` "Chưa đối soát" (như F-S4) | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Sổ quỹ bảo trì (màn sổ quỹ của F-S3, loại Bảo trì)

```
Sổ quỹ                         [Tòa: Aqua 1 ▾] [Quỹ: Bảo trì ▾] [Tháng 9/2026 ▾]
Aqua 1 · Quỹ bảo trì · Tài khoản 0071000000002 · Số liệu theo sổ
┌ Số dư tài khoản 200 tr ┐ ┌ Gốc đang gửi 1.000 tr ┐ ┌ Tài sản quỹ 1.200 tr ┐ ┌ Lãi dự kiến 15 tr ┐
  Tài sản quỹ = số dư tài khoản + gốc đang gửi
Ngày   │ Chứng từ │ Nội dung                              │ Nhóm               │ Số tiền
01/08  │ —        │ Số dư đầu                             │                    │ 1.200.000.000
01/09  │ TG-001   │ Gửi tiền có kỳ hạn · Ngân hàng B      │ Gửi tiền có kỳ hạn │ −1.000.000.000
```

- Ô số thứ tư là "Lãi dự kiến": tổng lãi các kỳ chưa nhận của các hợp đồng đang gửi. Ô này không cộng vào ô nào khác.
- Mã TG-001 là liên kết tới hợp đồng.

### 2.2 Quy chế quỹ (`/deposits/regulation`)

- Một thẻ "Quy chế đang hiệu lực":
  - kỳ hạn được phép "30–365 ngày";
  - đồng chủ tài khoản (họ tên · chức danh);
  - ngày hội nghị thông qua;
  - tệp quy chế.
- Nút "Lập phiên bản mới" (kế toán). Phiên bản chờ duyệt hiện thành thẻ thứ hai, kèm 3 nút quyết định cho BQT.
- Lịch sử phiên bản nằm dưới, thu gọn.
- Quỹ chưa có quy chế: khối rỗng "Quỹ chưa có quy chế được duyệt. Cần quy chế trước khi lập hợp đồng tiền gửi." kèm nút lập (kế toán).

### 2.3 Trang hợp đồng tiền gửi (D1 tr. 35)

```
TG-001 · Hợp đồng tiền gửi · Ngân hàng B           (Đang gửi) · Phiên bản 1     [Phụ lục]
Aqua 1 · Quỹ bảo trì · Từ KQ-TG01
┌ Gốc 1.000 tr ┐ ┌ Lãi suất 6,0 %/năm ┐ ┌ Kỳ hạn 90 ngày ┐ ┌ Lãi theo HĐ 15 tr ┐
(Tổng quan) (Lịch lãi 3) (Tài liệu) (Lịch sử)
┌ TG-001 · ĐIỀU KHOẢN ───────────────────┐ ┌ MỐC HỒ SƠ LIÊN KẾT ─────────────────────┐
│ Ngày gửi 01/09/2026 · đáo hạn 30/11/2026│ │ 28/08  Kết quả chọn KQ-TG01 · Đã duyệt   │
│ Cơ sở tính ngày 360 · làm tròn nửa lên   │ │ 31/08  Hợp đồng được ký · Bản ký         │
│ Trả lãi mỗi 30 ngày                      │ │ 01/09  Gửi tiền · −1.000.000.000 ›       │
│ Số HĐ tại ngân hàng: …                   │ │ 01/10  Kỳ lãi L-001 · 5.000.000 ›        │
│ ▢ Bản ký TG-001.pdf                       │ │ 30/11  Đáo hạn                           │
└──────────────────────────────────────────┘ └──────────────────────────────────────────┘
```

- **Soạn hợp đồng:**
  - form điền sẵn từ KQ-TG và bản chào;
  - ô **"Cách làm tròn tiền lãi" để trống**, bắt buộc chọn, kèm gợi ý "Chọn đúng như hợp đồng của ngân hàng";
  - dòng xem trước "Đáo hạn 30/11/2026 · Lãi theo HĐ 15.000.000 ₫" cập nhật ngay khi sửa;
  - trường nào khác bản chào thì hiện `Notice warning` liệt kê, kèm ô lý do. Nút chính khi đó là "Gửi BQT duyệt".
- **Kỳ hạn ngoài quy chế:** lỗi ngay dưới ô, ví dụ "Quy chế cho phép 30–365 ngày."
- **"Ghi nhận gửi tiền"** (hợp đồng "Đã ký"): hộp thoại có ngày gửi (khóa bằng ngày gửi của hợp đồng), chứng từ chuyển tiền, và dòng xem trước "Số dư tài khoản sau khi gửi: 200.000.000 ₫". Số dư âm thì báo lỗi BR-T2-07, nút lưu bị khóa.

### 2.4 Tab "Lịch lãi" (D1 tr. 36)

```
┌ Lãi cả kỳ 15 tr ┐ ┌ Chưa đến kỳ 10 tr ┐ ┌ Đến hạn 0 ┐ ┌ Quá hạn 5 tr ┐
Kỳ    │ Từ – đến                │ Ngày đến hạn │ Số ngày │ Lãi         │ Phiên bản │ Trạng thái
L-001 │ 01/09 – 01/10/2026      │ 01/10/2026   │ 30      │ 5.000.000   │ 1         │ (Quá hạn)
L-002 │ 01/10 – 31/10/2026      │ 31/10/2026   │ 30      │ 5.000.000   │ 1         │ (Chưa đến kỳ)
L-003 │ 31/10 – 30/11/2026      │ 30/11/2026   │ 30      │ 5.000.000   │ 1         │ (Chưa đến kỳ)
                                                  Tổng   │ 15.000.000
Khoản chưa đến kỳ không tính là quá hạn.
```

- Ô "Quá hạn" ở slice này chỉ có nghĩa "đã qua ngày đến hạn". T-S3 sẽ trừ phần đã nhận.
- **Phụ lục:** hộp thoại có lãi suất mới, cách trả lãi, ngày hiệu lực, tệp và lý do. Có **xem trước** lịch mới:
  - kỳ giữ nguyên, kỳ sinh lại;
  - kỳ bị chia hai đoạn có dòng phụ "14 ngày × 6,0% + 16 ngày × 5,0%".

### 2.5 Tiền chuyển đến từ quỹ khác

- **Ở sổ quỹ bảo trì:** nút "Ghi nhận tiền chuyển đến" mở danh sách phiếu chi "Chuyển sang quỹ khác → Bảo trì" đã chi, chưa ghi nhận, của cùng tòa. Chọn một phiếu, nhập ngày nhận và chứng từ. Số tiền bị khóa bằng phiếu.
- **Ở phiếu chi** (quỹ khai thác): nhãn "Chưa ghi nhận ở quỹ nhận", hoặc "Đã ghi nhận ở quỹ bảo trì ngày …".

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Như §2 |
| 768–1023px | Một cột; "Mốc hồ sơ liên kết" nằm dưới điều khoản. Bảng lịch lãi bỏ cột "Phiên bản", đưa nhãn phiên bản vào dòng phụ |
| < 768px | Ô số 2 × 2, giữ đúng thứ tự ba số của quỹ. Lịch lãi: mỗi kỳ một thẻ (mã, ngày đến hạn, lãi, trạng thái). Hộp thoại chiếm toàn màn. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và hai cột |
| Rỗng | Danh sách hợp đồng: "Chưa có hợp đồng tiền gửi nào." Tạo từ kết quả chọn đã duyệt, kèm liên kết tới các KQ-TG đã duyệt mà chưa có hợp đồng |
| Chưa thiết lập quỹ / chưa có quy chế | Khối hướng dẫn tương ứng, kèm liên kết; không hiện form hợp đồng |
| Lỗi trường | Báo dưới đúng trường; `aria-invalid` và `aria-describedby` |
| Xung đột phiên bản | `Notice warning` kèm nút "Tải lại" |
| 403 / 404 | BQL mở sổ quỹ bảo trì: "Bạn không có quyền xem sổ quỹ." Ngoài phạm vi tòa: "Không tìm thấy" |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại"; hộp thoại giữ nguyên dữ liệu; **không báo "Đã gửi tiền" khi chưa ghi** |
| Offline | `useOnline`: khóa nút ghi, kèm dòng "Đang mất kết nối." |
| Accessibility | `h1` "TG-001 · Hợp đồng tiền gửi". Ô số là `<dl>`; ba số của quỹ đọc kèm quan hệ ("Tài sản quỹ một tỷ hai trăm triệu, bằng số dư tài khoản cộng gốc đang gửi"). Bảng lịch lãi có `<th scope>` và `<tfoot>`. Dòng thời gian là `<ol>` có `<time>`. Lãi suất đọc đủ |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn T.
