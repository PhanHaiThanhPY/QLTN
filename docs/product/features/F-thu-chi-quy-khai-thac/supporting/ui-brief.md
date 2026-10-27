---
spec: F.S3
fidelity: Level 1 (ASCII) + brief
screens: [fund-ledger, contract-receipts-tab, receipt-dialog, tax, payment-vouchers]
---

# UI-UX brief: F-S3 Sổ quỹ, khoản thu, thuế, phiếu chi

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Theo nhịp F-S1, F-S2 và D1 tr. 10–11:** hàng 4 ô số; bên trái là danh sách hoặc thẻ chính, bên phải là thẻ "tiếp theo" hoặc chứng từ; một nút chính.
- **Tiền phải đọc được trong 2 giây:**
  - số lớn dùng `tabular-nums`, căn phải trong bảng;
  - thu có dấu `+` và màu `text-good`, chi có dấu `−` và chữ `text-ink`. Màu không bao giờ là cách duy nhất để biết chiều tiền: luôn có dấu và chữ "Thu" hoặc "Chi";
  - ô số rút gọn ("15 tr"), bảng và chú thích ghi đủ ("15.000.000 ₫"), dùng `formatVnd`.
- **Mọi số dư ghi "theo sổ"** (BR-F3-05). Công nợ hiện ở khối riêng, không nằm trong số dư. Tiền cọc đang giữ hiện dòng "trong đó …".
- **Thêm vào nhóm menu "Quỹ khai thác":** "Sổ quỹ", "Thuế", "Phiếu chi". Chỉ kế toán và BQT thấy ba mục này (BQL thì không). Tab "Khoản thu" nằm trong trang hợp đồng.
- Dùng lại `Card`, `Tabs`, `Dialog`, `Field`, `Notice`, `Table`, `FileUploader`, `AttachmentList`, `Badge`, `useOnline`.
- **Thanh tiến độ đã thu của kỳ** như D1 tr. 10: hai đoạn (đã thu, còn thu), có nhãn, kèm vòng % bên cạnh. Màu `--series-1` cho phần đã thu, `--line` cho phần còn lại. Không dùng màu tình trạng cho thanh này (B01 §5.3).
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái kỳ | `Badge`: Chưa đến hạn `neutral`, Đã thu một phần `info`, Đến hạn `warn`, Quá hạn `crit`, Đã thu đủ `good` | luôn kèm chữ |
| Phiếu chi | `Badge`: Nháp `neutral`, Chờ duyệt `info`, Cần sửa `warn`, Đã duyệt `good`, Đã chi `good` kèm biểu tượng ✓, Bị từ chối `crit`, Đã hủy `neutral` có chữ `text-ink-3` | |
| Dòng sổ đã hủy hoặc dòng đảo | chữ `text-ink-3` có gạch ngang (dòng gốc); nhãn "Đảo của PT-002" `neutral` | |
| Đối soát | `Badge` `neutral` "Chưa đối soát" (F-S4 thêm "Đã đối soát") | |
| Thẻ "Khoản thu tiếp theo" | nền `--accent-strong`, chữ `--accent-fg` (thẻ đậm như D1 tr. 10, đúng ở cả hai chế độ) | *Làm rõ 27/10 khi review:* bản đầu ghi `--navy`, nhưng ở chế độ sáng `--navy` là `#ffffff`, nên thẻ không đậm |
| Thanh tiến độ | đã thu `--series-1`, còn lại `--line` | token biểu đồ của B01 §5.3; dev-build thêm vào `index.css` nếu chưa có |

## 2. Màn hình

### 2.1 Sổ quỹ (`/exploitation/fund`)

```
Sổ quỹ khai thác                    [Tòa: Aqua 1 ▾] [Tháng 11/2026 ▾]
Aqua 1 · Tài khoản «số đầy đủ với kế toán và BQT» · Số liệu theo sổ, chưa đối soát sao kê
┌ Đầu kỳ 50 tr ┐ ┌ Thu 15 tr ┐ ┌ Chi 5 tr ┐ ┌ Cuối kỳ 60 tr ┐
  trong đó tiền cọc đang giữ: 0 ₫          Còn phải thu (theo dõi riêng): 5.000.000 ₫ ›
┌──────────┬──────────┬───────────────────────────────┬──────────┬─────────────┬──────────────┐
│ Ngày     │ Chứng từ │ Nội dung                      │ Nhóm     │ Số tiền     │ Đối soát     │
│ 01/11    │ —        │ Số dư đầu                     │          │ 50.000.000  │              │
│ 18/11    │ PT-001   │ DV-A · HĐ-001 · kỳ 16–30/11   │ Thu HĐ   │ +10.000.000 │ Chưa đối soát│
│ 22/11    │ PT-002   │ DV-A · HĐ-001                 │ Thu HĐ   │ +5.000.000  │ Chưa đối soát│
│ 22/11    │ GNT-001  │ Thuế tháng 11 · TH-001        │ Chi thuế │ −2.000.000  │ Chưa đối soát│
│ 23/11    │ PC-001   │ Chi dịch vụ vệ sinh           │ Chi DV   │ −3.000.000  │ Chưa đối soát│
│          │          │ Cuối kỳ                       │          │ 60.000.000  │              │
└──────────┴──────────┴───────────────────────────────┴──────────┴─────────────┴──────────────┘
```

- **Chưa có số dư đầu:** cả trang chỉ có một khối "Thiết lập quỹ": tài khoản, ngày bắt đầu sổ, số dư đầu theo sao kê, kèm một dòng giải thích ngắn.
- **Bảng:** dòng cuối là dòng tổng "Cuối kỳ". Mỗi mã chứng từ là liên kết tới chứng từ đó. Lọc được theo nhóm và theo chiều Thu/Chi.
- **"Còn phải thu"** là liên kết tới danh sách hợp đồng, đã lọc sẵn các hợp đồng còn nợ.

### 2.2 Tab "Khoản thu" trong trang hợp đồng (D1 tr. 10)

```
┌ Phải thu 20 tr ┐ ┌ Đã thu 15 tr ┐ ┌ Còn thu 5 tr ┐ ┌ Quá hạn 0 tr ┐                [Ghi nhận khoản thu]
┌ HĐ-001 · KỲ THU 16–30/11 ─────────────────────────┐ ┏ KHOẢN THU TIẾP THEO ━━━━━━━━━━━━━┓
│ Theo dõi từng khoản nhận                 ( 75% )  │ ┃ 5 triệu                          ┃
│ 15 / 20 triệu · Đã thu 75% nghĩa vụ kỳ            │ ┃ Hạn thanh toán · 25/11           ┃
│ ████████████████████░░░░░░  đã thu 15 · còn 5     │ ┃ (Chưa đến hạn)                   ┃
│ 18/11  PT-001 · 10 triệu · Thu lần 1 · ▢ chứng từ │ ┃ Tại 23/11/2026: 20 = 10 + 5 + 5   ┃
│ 22/11  PT-002 · 5 triệu  · Thu lần 2 · ▢ chứng từ │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
└───────────────────────────────────────────────────┘
Các kỳ: bảng kỳ · từ–đến · hạn · phải thu · đã thu · còn · trạng thái
Cọc: đã nhận 0 / 0 ₫
```

- Nút "Ghi nhận khoản thu" và "Nhận cọc" chỉ hiện cho kế toán. BQL chỉ xem.
- **Hộp thoại "Ghi nhận khoản thu":**
  - ngày nhận tiền, số tiền, chứng từ, ghi chú;
  - khối **"Phân bổ vào kỳ"**: bảng các kỳ còn phải thu, có cột "phân bổ" điền sẵn theo BR-F3-06 và sửa được;
  - dòng tổng "Đã phân bổ X / Y". Lệch thì báo đỏ, và nút lưu bị khóa;
  - nhập số tiền thì phần phân bổ tự tính lại, trừ khi kế toán đã sửa tay.
- Dòng kiểm "Tại «hôm nay»: phải thu = đã thu + còn thu" luôn hiện, như D1.

### 2.3 Thuế (`/exploitation/tax`, D1 tr. 11)

```
┌ Theo hồ sơ 2 tr ┐ ┌ Đã nộp 2 tr ┐ ┌ Còn nộp 0 tr ┐ ┌ Đối chiếu — ┐     [Tháng 11/2026 ▾] [+ Ghi nghĩa vụ thuế]
┌ TH-001 · THÁNG 11/2026 ──────────────────┐ ┌ CHỨNG TỪ NỘP THUẾ ─────────────────────┐
│ Hồ sơ nộp thuế                           │ │ GNT-001                                │
│ Theo hồ sơ kế toán          2.000.000 ₫  │ │ Hồ sơ nghĩa vụ TH-001                  │
│ Đã nộp                      2.000.000 ₫  │ │ Số tiền 2.000.000 đồng                 │
│ Còn phải nộp                        0 ₫  │ │ Ngày ghi nhận 22/11/2026               │
│ (Đã nộp đủ)                              │ │ Giao dịch sao kê: — (F-S4)             │
│ ▢ GNT-001 · Giấy nộp tiền · 22/11 · 2 tr │ │ Số tiền lấy từ hồ sơ kế toán, không tự │
└──────────────────────────────────────────┘ │ áp thuế suất.                          │
                                              └────────────────────────────────────────┘
```

- Dòng tham khảo "Thu theo hợp đồng trong tháng: 15.000.000 ₫" nằm dưới ô nhập số thuế, chữ `text-ink-3`, có ghi rõ "chỉ để tham khảo".

### 2.4 Phiếu chi (`/exploitation/vouchers`)

- **Ô số:** Chờ duyệt, Đã duyệt chờ chi, Đã chi trong tháng (số tiền), Bị từ chối.
- **Bảng:** mã, nhóm chi, nội dung, người nhận, số tiền, trạng thái.
- **Trang phiếu:**
  - thông tin, tệp đề nghị, lịch sử quyết định;
  - nút theo vai trò và trạng thái (BR-F3-12);
  - BQT thấy ba nút "Duyệt", "Yêu cầu sửa", "Từ chối" khi phiếu "Chờ duyệt".
- **Ghi đã chi:** hộp thoại gồm ngày chi, chứng từ chuyển khoản, và dòng xem trước "Số dư theo sổ sau khi chi: …". Nếu số dư thành âm thì hiện lỗi của BR-F3-13 ngay trong hộp thoại, và nút lưu bị khóa.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Như §2 |
| 768–1023px | Một cột. Bảng sổ quỹ bỏ cột "Đối soát", đưa nhãn đối soát xuống dưới nội dung |
| < 768px | Ô số 2 × 2. Sổ quỹ: mỗi dòng là một thẻ (ngày và mã ở trên; nội dung; số tiền lớn có dấu ở bên phải). Dòng tổng dính đáy danh sách. Bảng phân bổ trong hộp thoại thành danh sách kỳ, mỗi kỳ có ô nhập. Hộp thoại chiếm toàn màn. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và bảng; số không nhấp nháy từ 0 lên |
| Chưa thiết lập quỹ | Khối "Thiết lập quỹ" (§2.1). BQT, nếu chưa có quỹ, thấy "Kế toán chưa thiết lập quỹ khai thác của tòa này." |
| Rỗng | Tháng không có dòng: bảng chỉ có dòng "Đầu kỳ" và "Cuối kỳ" bằng nhau, kèm dòng "Không có khoản thu, chi nào trong tháng." |
| Lỗi tiền | Báo ngay dưới ô số tiền: "Vượt số còn phải thu (5.000.000 ₫)", "Số dư quỹ không đủ…". Lỗi phân bổ báo ở đúng kỳ. Dùng `aria-invalid` và `aria-describedby` |
| Xung đột phiên bản | `Notice warning` kèm nút "Tải lại"; dữ liệu đang nhập vẫn giữ |
| 403 / 404 | BQL mở "Sổ quỹ": "Bạn không có quyền xem sổ quỹ." Ngoài phạm vi tòa: "Không tìm thấy" |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại". Hộp thoại giữ nguyên dữ liệu; **không bao giờ báo "Đã ghi" khi chưa ghi** |
| Offline | `useOnline`: khóa mọi nút ghi tiền, kèm dòng "Đang mất kết nối — chưa ghi được chứng từ." |
| Accessibility | Số tiền đọc được đủ ("cộng mười triệu đồng"), không đọc "15 tr". Bảng có `<th scope>` và `<tfoot>` cho dòng tổng. Thanh tiến độ có `role="progressbar"` với `aria-valuenow` và nhãn "Đã thu 15 trên 20 triệu". Dòng đảo có tên đọc được "Dòng đảo của PT-002" |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn F.
