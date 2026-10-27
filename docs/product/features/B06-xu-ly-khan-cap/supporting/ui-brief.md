---
spec: B06.S1
fidelity: Level 1 (ASCII) + brief
screens: [detail-header-start, emergency-dialog, emergency-card, list-flags, decision-dialog-post-review, post-review-rejected-card]
---

# UI-UX brief: B06-S1 Xử lý khẩn cấp

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- Mọi thành phần trong brief này **đã có ở bản demo**: `features/records/components/emergency/{EmergencyDialog,EmergencyCard,EmergencyDeadlineBadge}.tsx`, `list/RecordFlags.tsx`, nút `startEmergencyRepair` trong `detail/RecordDetailHeader.tsx`. Việc chính là nối chúng với chế độ `api`, cộng thêm hai chỗ mới ở §2.5 và §2.6.
- **Không tạo component UI mới** khi đã có component tương ứng: `Dialog`, `Field`, `Input`, `Notice`, `Badge`, `Card`, `SignaturePad`, `DialogActionButton`.
- Chỉ hiện những gì có trong SPEC.

## 1. Design token (lấy từ `web/src/index.css`, không thêm token mới)

| Ý nghĩa | Token | Dùng ở |
|---|---|---|
| Khẩn cấp, quá hạn, bị từ chối | `--crit`, `--crit-soft`; `Badge tone="crit"` | nút "Xử lý khẩn cấp" (`variant="danger"`), huy hiệu "Quá hạn bổ sung", thẻ "Không được duyệt hậu kiểm" |
| Còn hạn, cảnh báo hạn mức | `--warn`, `--warn-soft`; `Badge tone="warn"`, `Notice tone="warning"` | "Còn khoảng N giờ", "Bổ sung trễ hạn", ô hạn mức trong dialog, cảnh báo vượt hạn mức |
| Đã bổ sung đúng hạn, đã duyệt hậu kiểm | `--good`; `Badge tone="good"` | huy hiệu trạng thái hậu kiểm |
| Nền thẻ, viền | `--surface`, `--line`, `--radius` | như các thẻ khác ở chi tiết hồ sơ |

Chế độ tối dùng bộ token tối có sẵn trong `index.css`. Không viết mã màu cứng.

## 2. Màn hình

### 2.1 Nút bắt đầu ở đầu chi tiết hồ sơ

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SC-020 · Vỡ ống cấp nước chính hầm B1          [Chờ lập tờ trình]        │
│ Aqua 2 · Tầng hầm B1 · BQL: Nguyễn Văn Quản                               │
│                                    [ Lập tờ trình ]  [ ⚠ Xử lý khẩn cấp ] │ ← danger
└──────────────────────────────────────────────────────────────────────────┘
```
- Nút chỉ hiện khi hồ sơ ở `DRAFT`, `PENDING_CONFIRMATION` hoặc `PENDING_PROPOSAL`, **và** người xem là manager có `EMERGENCY_START`. Ai không đủ điều kiện thì không thấy nút; không dùng nút bị làm mờ.

### 2.2 Dialog "Sửa chữa khẩn cấp" (dùng `EmergencyDialog`)

```
┌─ Sửa chữa khẩn cấp ─────────────────────────────────────── ✕ ┐
│ ┌ ⚠ Hạn mức khẩn cấp của tòa: 15.000.000 đ ──────────────────┐ │
│ │ Vượt hạn mức thì đi quy trình duyệt thông thường. Tờ trình │ │
│ │ phải nộp bổ sung trong 24 giờ.                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Lý do phải xử lý ngay *                                          │
│ [ Ống cấp chính vỡ, nước tràn hầm B1, nguy cơ ngập tủ điện  ]    │
│ Nhà thầu thực hiện *          Chi phí dự kiến *                  │
│ [ Cty TNHH Bình An       ]    [ 12.500.000        ] đ            │
│                               Mười hai triệu năm trăm nghìn đồng │
│ Ngày dự kiến xong *                                              │
│ [ 28/10/2026 ]                                                   │
│                                   [ Hủy ]  [ Bắt đầu xử lý ]     │
└──────────────────────────────────────────────────────────────────┘
```
- Hạn mức và số giờ lấy từ cấu hình tòa qua API, **không** lấy từ dữ liệu mock.
- Lỗi theo trường hiện ngay dưới ô: `estimatedAmountVnd` (vượt hạn mức, nội dung đúng BR-E-02), `plannedEndDate`, `reason`, `contractorName`.
- Ô tiền nhập chuỗi số; hiện số tiền bằng chữ như ở phần thanh toán S4 (`web/domain/payment.ts`).
- Khi đang gửi thì nút chính hiện loading và cả dialog bị khóa. Thành công thì đóng dialog, toast "Đã bắt đầu xử lý khẩn cấp. Đã báo BQT và TVKT.", rồi làm mới chi tiết hồ sơ.

### 2.3 Thẻ "Sửa chữa khẩn cấp" ở tab Tổng quan (dùng `EmergencyCard`)

```
┌ Sửa chữa khẩn cấp ─────────────── [Còn khoảng 18 giờ để bổ sung hồ sơ] ┐
│ Đã cho làm trước khi duyệt; tờ trình vẫn đi đủ chuỗi duyệt sau đó.      │
│ Lý do      Ống cấp chính vỡ, nước tràn hầm B1…                          │
│ Nhà thầu   Cty TNHH Bình An        Chi phí dự kiến  12.500.000 đ        │
│ Hạn mức đã áp 15.000.000 đ         Hạn bổ sung      28/10/2026 09:10    │
│ Bắt đầu    27/10/2026 09:10 · Nguyễn Văn Quản                            │
│ Hậu kiểm   [Chờ duyệt hậu kiểm] / [Đã duyệt hậu kiểm] / [Không được…]   │
│ ┌ ⚠ Báo giá được chọn 16.000.000 đ vượt hạn mức khẩn cấp 15.000.000 đ ┐ │ ← chỉ khi overEmergencyLimit
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```
- Huy hiệu (`EmergencyDeadlineBadge`) có 4 dạng:
  - "Còn khoảng N giờ để bổ sung hồ sơ" (warn);
  - "Quá hạn bổ sung N giờ" (crit);
  - "Đã bổ sung đúng hạn" (good);
  - "Bổ sung trễ hạn" (warn, di chuột vào thì hiện lý do trễ).
- Số giờ lấy theo `hoursLeft` và `docsOverdue` do API tính. Web không tự tính từ đồng hồ máy, để tránh lệch giờ.

### 2.4 Cờ ở danh sách hồ sơ (dùng `RecordFlags`)

```
│ SC-020  Vỡ ống cấp nước chính…   [Đang xử lý khẩn cấp] [Khẩn cấp] [Quá hạn bổ sung] │
```
- Cờ "Khẩn cấp" hiện cho mọi hồ sơ khẩn cấp, kể cả khi đã đóng.
- Cờ "Quá hạn bổ sung" chỉ hiện khi `docsOverdue=true` và chưa nộp tờ trình.

### 2.5 Hộp quyết định ở bước BQT: thêm lựa chọn "Không duyệt hậu kiểm" (mới, trong `QuoteDecisionDialog`)

```
┌─ Từ chối · BQT duyệt ──────────────────────────────────── ✕ ┐
│ Lý do *  [ Chi phí không hợp lý, không có biên bản hiện trường ] │
│ ☐ Không duyệt hậu kiểm (kết thúc, không trình lại được)          │
│   ┌ ✕ Hồ sơ sẽ chuyển sang "Không được duyệt hậu kiểm". Không   ┐ │ ← crit, chỉ khi đã tick
│   │   có khoản thanh toán nào trong hệ thống cho hồ sơ này.     │ │
│   └─────────────────────────────────────────────────────────────┘ │
│ Biên bản họp BQT *   [ Tải tệp ]                                 │
│ Chữ ký BQT *         [ SignaturePad ]                            │
│                                     [ Hủy ]  [ Xác nhận từ chối ]│
└──────────────────────────────────────────────────────────────────┘
```
- Ô tick chỉ hiện khi **cả hai** điều kiện đúng: hồ sơ là hồ sơ khẩn cấp, và người xem là người giữ bước BOARD.
- Ở lần trình thứ 3, ô tick luôn được tick và khóa lại, kèm dòng "Lần trình cuối: từ chối sẽ kết thúc hậu kiểm."
- Khi đã tick, nút chính đổi chữ thành "Không duyệt hậu kiểm", dùng `variant="danger"`.

### 2.6 Hồ sơ "Không được duyệt hậu kiểm" (mới)

```
┌ Không được duyệt hậu kiểm ─────────────────────────────── [crit] ┐
│ BQT không chấp nhận việc sửa khẩn cấp. Không có thanh toán trong   │
│ hệ thống. BQT ghi quyết định xử lý chi phí rồi đóng hồ sơ.         │
│ Lý do từ chối   Chi phí không hợp lý…  · Trần Thị Bảo · 28/10 14:00│
│                                       [ Ghi quyết định và đóng ]   │ ← chỉ người giữ BOARD
└────────────────────────────────────────────────────────────────────┘
```
- Dialog "Ghi quyết định và đóng" gồm: quyết định xử lý (bắt buộc, 5–1000 ký tự), tệp đính kèm (tùy chọn, `BOARD_DECISION`), và nút "Đóng hồ sơ".
- Sau khi đóng, thẻ chỉ còn để đọc và hiện thêm quyết định, người quyết, thời điểm.
- Tab Thanh toán ở hai trạng thái mới chỉ hiện `Notice`: "Hồ sơ không được duyệt hậu kiểm: không có thanh toán." Không có nút nào.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Dialog rộng tối đa `max-w-lg`; các ô "Nhà thầu" và "Chi phí" nằm trên 2 cột; thẻ khẩn cấp xếp nhãn và giá trị thành 2 cột |
| 640–1023px | Như trên, nhưng thẻ khẩn cấp chỉ có 1 cột giá trị |
| < 640px | Dialog chiếm toàn màn hình (cách các dialog hiện có đang làm); mọi ô 1 cột; nút ở đầu chi tiết xuống dòng, nút "Xử lý khẩn cấp" rộng hết dòng; cờ ở danh sách thẻ (`RecordCardList`) tự xuống dòng; lề trang 16px, không có thanh cuộn ngang |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Lúc mở dialog: khung xương (skeleton) cho ô hạn mức đến khi có cấu hình tòa, và nút chính bị khóa. Lúc gửi: nút chính hiện loading, dialog bị khóa. Thẻ khẩn cấp loading cùng lúc với chi tiết hồ sơ |
| Rỗng | Hồ sơ thường không hiện thẻ khẩn cấp; không có khung trống nào |
| Lỗi 400 | Lỗi hiện tại từng trường; dialog vẫn mở và giữ dữ liệu đã nhập |
| Lỗi 403/409 | Toast với nội dung từ API, ví dụ "Hồ sơ đã đổi trạng thái…". Đóng dialog và làm mới chi tiết hồ sơ (cách `useCommand` đang làm) |
| Lỗi mạng hoặc 5xx | Toast "Không kết nối được máy chủ, vui lòng thử lại." Dialog vẫn mở, giữ dữ liệu, cho gửi lại |
| Offline | Khi trình duyệt báo offline (`navigator.onLine=false`): khóa nút gửi và hiện dòng "Đang mất kết nối — chưa gửi được." Không xếp hàng gửi sau, vì đây là thao tác tiền bạc |
| Accessibility | Mọi ô có `label` gắn `htmlFor`; ô có lỗi có `aria-invalid` và `aria-describedby` trỏ tới dòng lỗi. Huy hiệu hạn không chỉ dựa vào màu: luôn có chữ. Ô tick ở §2.5 dùng được bằng bàn phím, và cảnh báo đi kèm có `role="alert"`. Dialog bẫy focus, Esc thì đóng, và trả focus về nút đã mở. Độ tương phản chữ trên nền `*-soft` ≥ 4.5:1 ở cả chế độ sáng lẫn tối |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): mọi dữ liệu và lệnh ở §2.
- Chế độ `mock`: giữ nguyên như demo hiện tại. Riêng §2.5 và §2.6 chỉ cần có ở `api`; nếu làm thêm cho `mock` thì không được làm sai test mock hiện có.
