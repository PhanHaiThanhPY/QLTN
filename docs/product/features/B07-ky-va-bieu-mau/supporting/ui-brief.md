---
spec: B07.S1
fidelity: Level 1 (ASCII) + brief
screens: [documents-tab, print-preview-proposal, print-preview-minutes, print-preview-payment-letter]
---

# UI-UX brief: B7-S1 Bản xem và in theo mẫu D5

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- Có hai lớp giao diện, mỗi lớp theo một hệ khác nhau:
  - **Tab "Biểu mẫu"** dùng hệ giao diện của ứng dụng: token trong `index.css`, `Card`, `Badge`, `Button`.
  - **Trang xem/in** mô phỏng **văn bản hành chính giấy**: nền trắng, chữ đen, phông có chân, không dùng màu thương hiệu. Bố cục bám theo mẫu D5, không theo giao diện ứng dụng.
- Không thêm thông tin ngoài những gì SPEC §3 quy định.
- Dùng lại `RecordTabs` (thêm một tab) và các tiện ích định dạng có sẵn: `formatDateTime`, `formatVnd`, hàm đọc số bằng chữ của `web/domain/payment.ts`.

## 1. Token

| Lớp | Token / giá trị | Ghi chú |
|---|---|---|
| Tab "Biểu mẫu" | `--surface`, `--line`, `--ink`, `--ink-2`; `Badge` tone `good` (Đã duyệt, Đạt), `warn` (Chờ duyệt, Cần bổ sung, Đang nghiệm thu), `crit` (Bị từ chối, Không đạt) | không thêm token mới |
| Trang in: chữ | phông `"Times New Roman", Times, serif`; nội dung 13pt, tiêu đề văn bản 14pt in đậm in hoa, chân trang 9pt | quen thuộc với văn bản hành chính VN |
| Trang in: màu | chữ `#000`; viền bảng `#000` 0.5pt; chữ chìm `rgba(0,0,0,0.08)` | **không** dùng biến màu của theme, để bản in giống nhau dù đang ở chế độ sáng hay tối |
| Trang in: khổ | `@page { size: A4 portrait; margin: 20mm 15mm 20mm 25mm; }` | lề trái rộng hơn để đóng gáy |
| Ảnh chữ ký | cao tối đa 56px, rộng tối đa 180px, giữ tỉ lệ | |

## 2. Màn hình

### 2.1 Tab "Biểu mẫu" trong chi tiết hồ sơ (tab mới, đặt sau "Thanh toán", trước "Lịch sử")

```
┌ Biểu mẫu ─────────────────────────────────────────────────────────────────┐
│ Bản xem và in theo mẫu của Ban quản lý. Dùng "In" của trình duyệt để lưu   │
│ PDF. Bản in dùng để lưu và trình xem; văn bản chính thức ký ngoài hệ thống.│
├────────────────────────────────────────────────────────────────────────────┤
│ Tờ trình · lần 1            20/10/2026  [Bị từ chối]  Chữ ký 2/2  [Xem/In] │
│ Tờ trình · lần 2            22/10/2026  [Đã duyệt]    Chữ ký 2/2  [Xem/In] │
│ Biên bản nghiệm thu · lượt 1 24/10/2026 [Không đạt]   Chữ ký 2/3  [Xem/In] │
│ Biên bản nghiệm thu · lượt 2 25/10/2026 [Đạt]         Chữ ký 3/3  [Xem/In] │
│ Thư đề nghị · đợt 1 tạm ứng 23/10/2026  [Đã chuyển]   Chữ ký 1/1  [Xem/In] │
│ Thư đề nghị · đợt 2 quyết toán 26/10    [Đã duyệt]    Chữ ký 1/1  [Xem/In] │
└────────────────────────────────────────────────────────────────────────────┘
```
- Tab chỉ có ở chế độ `api`.
- "Xem/In" mở trang xem ở **tab trình duyệt mới**, với đường dẫn `/records/:id/documents/:kind/:docId`. Như vậy người dùng giữ được màn chi tiết đang mở.
- Đợt quyết toán 0 đồng: dòng của đợt không có nút, chữ màu `--ink-3`: "Không cần thư đề nghị: số của đợt bằng 0".

### 2.2 Trang xem/in: khung chung

```
┌ thanh công cụ (chỉ trên màn hình, ẩn khi in) ──────────────────────────────┐
│ ← Về hồ sơ SC-014     Tờ trình · lần 2                        [ 🖨 In ]   │
└────────────────────────────────────────────────────────────────────────────┘
        ┌──────────────── tờ A4 (210mm, bóng nhẹ trên màn hình) ───────────┐
        │                     (nội dung theo §2.3–2.5)                     │
        │                                                                  │
        │                 ╱ CHƯA PHÊ DUYỆT ╱  ← chữ chìm, xoay −30°        │
        │──────────────────────────────────────────────────────────────────│
        │ Bản in từ hệ thống QLTN · SC-014 · Tờ trình lần 2 · in lúc       │
        │ 27/10/2026 10:05 · trang 1/2                                     │
        └──────────────────────────────────────────────────────────────────┘
```
- Nền ngoài tờ giấy dùng `--bg`. Bản thân tờ giấy luôn trắng, kể cả ở chế độ tối.
- Nút **In** gọi `window.print()`.
- Số trang lấy từ bộ đếm trang CSS (`counter(page)`). Trình duyệt không hỗ trợ thì in "in lúc …" mà không có số trang. Trường hợp này được chấp nhận.

### 2.3 Tờ trình (theo `Số tờ trình.docx`)

```
 Số tờ trình: …………………………
                              TỜ TRÌNH
 Kính gửi            : Ban quản trị tòa nhà Aqua 2
 Người trình         : Nguyễn Văn Quản          Ngày trình   : 22/10/2026
 Người làm tờ trình  : Nguyễn Văn Quản          Lần trình thứ: 2
 Thẩm định nội dung  : Lê Minh Tư vấn           Ngân sách    : Quỹ bảo trì
 Loại tờ trình       : Sửa chữa
 Nội dung tờ trình   : Thay bơm tăng áp tầng mái
 NỘI DUNG XIN PHÊ DUYỆT: …
 ĐỀ XUẤT VÀ CƠ SỞ XIN PHÊ DUYỆT:
   Cơ sở xin phê duyệt: Căn cứ vào Điều 34 và Điều 37, Thông tư số 05/2024/…
 Báo giá:
 ┌───┬──────────┬────┬────┬─ Nhà thầu A ──┬─ Nhà thầu B ──┬─ Nhà thầu C ──┐
 │STT│ Hạng mục │ĐVT │ SL │Đơn giá│T.tiền │Đơn giá│T.tiền │Đơn giá│T.tiền │
 ├───┼──────────┼────┼────┼───────┼───────┼───────┼───────┼───────┼───────┤
 │ 1 │ Bơm 5HP  │cái │ 1  │8.000.0│8.000.0│ …                             │
 │   │ Chi phí  │    │    │       │8.000.0│       │ …                     │
 │   │ Thuế     │    │    │       │  640.0│                               │
 │   │ Tổng tiền│    │    │       │8.640.0│                               │
 └───┴──────────┴────┴────┴───────┴───────┴───────┴───────┴───────┴───────┘
 B. Đề xuất & đánh giá: - Kính trình Ban Quản Trị phê duyệt chi phí …
 CÁC VẤN ĐỀ CẦN LƯU Ý … trước ngày 30/10/2026
 Hồ sơ đính kèm: ✓ Báo giá của nhà thầu   ✓ Biên bản ghi nhận sự việc
 Ý KIẾN CỦA BAN QUẢN TRỊ: ………………………………
 Kính trình Ban Quản trị xem xét và phê duyệt … Trân trọng cảm ơn!
   Ngày 22 tháng 10 năm 2026                  Ngày 22 tháng 10 năm 2026
   TM. BAN QUẢN TRỊ                           TM. BAN QUẢN LÝ
   TÒA NHÀ AQUA 2                             ……………………
   ……………… (chức danh)                         ……………… (chức danh)
   [ảnh chữ ký]                                [ảnh chữ ký]
   Trần Thị Bảo                                Nguyễn Văn Quản
   Ký trên hệ thống QLTN lúc 14:02 22/10/2026  Ký trên hệ thống QLTN lúc 09:15 22/10/2026
```
- Hai khối ký đặt cạnh nhau như trên mẫu: BQT bên trái, BQL bên phải. Khi in, hai khối luôn nằm cùng trang (`break-inside: avoid`).
- Cột tiền canh phải. Bảng có `thead` lặp lại ở mỗi trang, và các dòng không bị cắt ngang (`tr { break-inside: avoid }`).
- Có 4–5 nhà thầu thì có bảng thứ hai, tiêu đề "Báo giá (tiếp)".

### 2.4 Biên bản nghiệm thu (theo `BIÊN BẢN NGHIỆM THU.docx`)

```
                         BIÊN BẢN NGHIỆM THU
 Hôm nay, vào lúc 09 giờ 30, ngày 25 tháng 10 năm 2026, tại: Tầng mái Aqua 2
 Chúng tôi gồm có:
   Đại diện Ban quản lý: Nguyễn Văn Quản
   Đại diện Ban quản trị: Trần Thị Bảo
   Đại diện Tư vấn Kỹ thuật (nếu có): Lê Minh Tư vấn
   Đại diện Cư dân/ CQCN (nếu có): ………………
 Nội dung làm việc: … nghiệm thu công việc/ hạng mục: Thay bơm tăng áp tầng mái
 Đánh giá:  ☒ ĐẠT   ☐ KHÔNG ĐẠT
 Điểm cần lưu ý:
   - Ban quản trị (Trần Thị Bảo): Vệ sinh khu vực sau thi công
 ┌ Đại diện BQL ─┬ Đại diện BQT ─┬ Đại diện TVKT ┬ Khác ─────────┐
 │ [chữ ký]      │ [chữ ký]      │ [chữ ký]      │               │
 │ Nguyễn Văn Quản│ Trần Thị Bảo │ Lê Minh Tư vấn│               │
 │ Ký … 09:41    │ Ký … 09:45    │ Ký … 09:50    │               │
 └───────────────┴───────────────┴───────────────┴───────────────┘
```
- Ô ĐẠT / KHÔNG ĐẠT dùng ký tự `☒`/`☐`, kèm chữ, để không phụ thuộc màu.

### 2.5 Thư đề nghị thanh toán (theo `BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`)

```
 BAN QUẢN LÝ ……………………
                              THƯ ĐỀ NGHỊ
           V/v: Chuyển khoản thanh toán cho Nhà thầu bảo trì/sửa chữa
 Kính gửi: Ban quản trị tòa nhà Aqua 2
 Ban Quản lý trân trọng đề nghị Quý Ban quản trị chuyển khoản thanh toán …
 1. Người hưởng:
    Tên tài khoản: CONG TY TNHH BINH AN
    Số tài khoản:  0123456789          Ngân hàng: Vietcombank
    Số tiền: 6.000.000 VNĐ (Bằng chữ: Sáu triệu đồng)
             (Số quyết toán 10.000.000 − tạm ứng đã chuyển 4.000.000)
 2. Nội dung: BQT AQUA2 THANH TOAN CHI PHI SC-014
 3. Bộ hồ sơ đính kèm:
    ✓ Công văn đề nghị thanh toán của nhà thầu
    ✓ Tờ trình và báo giá đã được phê duyệt
    ✓ Biên bản nghiệm thu hoàn thành
    ✓ Hóa đơn GTGT
 4. Ghi chú (nếu có): ………………
 Trân trọng,
                                                Đại diện Ban quản lý
                                                [ảnh chữ ký]
                                                Nguyễn Văn Quản
                                                Ký trên hệ thống QLTN lúc …
```
- Mục chưa có tệp thì in `☐` thay cho `✓`. Không ẩn dòng đó, vì người đọc cần thấy còn thiếu gì.

## 3. Responsive

| Độ rộng | Tab "Biểu mẫu" | Trang xem |
|---|---|---|
| ≥ 1024px | Mỗi tài liệu một dòng, 5 cột như §2.1 | Tờ A4 rộng 210mm, căn giữa |
| 640–1023px | Dòng xuống 2 hàng: tên + ngày ở hàng trên; trạng thái, số chữ ký và nút ở hàng dưới | Tờ giấy co theo `width: min(210mm, 100% − 32px)`; bảng báo giá cuộn ngang **bên trong khung bảng**, không làm trang cuộn ngang |
| < 640px | Mỗi tài liệu là một thẻ xếp dọc; nút "Xem/In" rộng hết thẻ; lề 16px | Như trên. Nút In vẫn có; khi in luôn ra A4 bất kể màn hình nhỏ hay lớn |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Tab: 3 dòng khung xương. Trang xem: khung xương hình tờ A4; nút In bị khóa đến khi có dữ liệu **và** mọi ảnh chữ ký đã tải xong (để bản in không thiếu chữ ký) |
| Lỗi tải ảnh chữ ký | Nút In vẫn bị khóa. Trên tờ giấy hiện `Notice` tone danger: "Không tải được chữ ký của «họ tên». Tải lại trang để in đủ chữ ký.", kèm nút "Tải lại". Ô ký lỗi hiện họ tên và dòng "Không tải được ảnh chữ ký". Không bao giờ in một tài liệu mà chữ ký đã có lại bị thiếu (làm rõ 27/10 khi review B7-S1) |
| Rỗng | Tab: "Chưa có tài liệu nào để in. Tài liệu xuất hiện khi hồ sơ được trình, nghiệm thu hoặc đề nghị thanh toán." |
| Lỗi 404 / ngoài phạm vi | Trang xem: "Không tìm thấy hồ sơ hoặc tài liệu" kèm nút "Về danh sách hồ sơ". Không hiện bất kỳ dữ liệu nào |
| Lỗi mạng / 5xx | Tab và trang xem: `Notice` lỗi kèm nút "Thử lại". Toast theo cách chung của ứng dụng |
| Offline | Trang đã tải xong vẫn xem và in được, vì không cần gọi thêm API. Nếu chưa tải xong: "Đang mất kết nối — không tải được tài liệu." |
| Accessibility | Trang xem có `<main>` với tiêu đề `h1` là tên tài liệu. Bảng có `<th scope>`. Ảnh chữ ký có `alt="Chữ ký của «họ tên»"`. Chữ chìm có `aria-hidden`, còn trạng thái được đọc qua một dòng ẩn chỉ dành cho trình đọc màn hình, khớp đúng chữ chìm đang hiện ("Bản chưa phê duyệt" hoặc "Bản chưa hoàn tất"). Nút In và liên kết "Về hồ sơ" dùng được bằng bàn phím. Độ tương phản chữ trên tờ giấy là đen trên trắng |

## 5. Phân biệt thật và mock

- Thật: mọi dữ liệu lấy từ `GET /records/:id` ở chế độ `api`.
- Mock: không đổi; vẫn dùng nút demo "Xem bộ biểu mẫu" (AC-B7.14).
