---
spec: F.S1
fidelity: Level 1 (ASCII) + brief
screens: [exploitation-packages-list, package-detail-invitation, package-detail-bids, bid-detail, partners-catalog]
---

# UI-UX brief: F-S1 Mời thầu và hồ sơ dự thầu

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Không có màn demo để dùng lại.** Dựng mới theo bố cục D1 tr. 5–6, bằng các component chung của ứng dụng: `PageHeader`, `Card`, `Badge`, `Tabs`, `Dialog`, `Field`, `Notice`, `Table`, `FileUploader`, `AttachmentList`, `LoadingState`, `EmptyState`, `ErrorState`, `Pagination`, `useOnline`, `formatVnd`.
- **Theo nhịp của D1:** hàng 4 ô số ở đầu trang; bên trái là danh sách hoặc thẻ chính; bên phải là bản xem hoặc thẻ chi tiết; một nút chính.
- Không thêm thông tin nào ngoài SPEC §3. Không có khung AI.
- **Nhóm menu mới** "Quỹ khai thác" (biểu tượng `Landmark` hoặc `Store` của lucide), có các mục:
  - "Mời thầu khai thác";
  - "Đơn vị khai thác".

  Nhóm chỉ hiện ở chế độ `api`, và chỉ với người có quyền xem khai thác.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái gói | `Badge`: Nháp `neutral`, Đang nhận hồ sơ `info`, Đã đóng nhận `good`, Đã hủy `neutral` có chữ `text-ink-3` | |
| Tình trạng hồ sơ | `Badge`: Đủ hồ sơ `good`, Đang bổ sung `warn`, Thiếu `neutral` | luôn kèm "k/n tài liệu" |
| Trạng thái tài liệu | `Badge`: Đã nhận `good`, Chưa nhận `neutral`, Cần bổ sung `warn`, Quá hạn bổ sung `crit` | |
| Cờ hồ sơ | `Badge`: "Trễ hạn" `crit`; "Ngoài danh sách mời" `info`; "Thiếu giá chào" `warn` | |
| Hạn nhận còn ≤ 24 giờ | chữ `text-warn` kèm biểu tượng đồng hồ | |
| Thẻ hồ sơ đang chọn | viền `border-accent`; thẻ có hồ sơ cần bổ sung thì viền `border-warn/50`, như D1 tr. 6 | |
| Giá | `formatVnd`, `tabular-nums`; kèm "/ tháng" hoặc "/ quý" | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Danh sách gói (`/exploitation/packages`)

```
Mời thầu khai thác                                            [+ Tạo gói khai thác]
Các gói khai thác khu vực chung trong phạm vi của bạn.
┌ Đang nhận hồ sơ 1 ┐ ┌ Sắp hết hạn (≤3 ngày) 1 ┐ ┌ Đã đóng nhận 0 ┐ ┌ Nháp 0 ┐
[Tìm mã, tên…] [Tòa ▾] [Loại ▾] [Trạng thái ▾]
┌────────┬───────────────────────────────┬──────────────┬───────────────┬────────────┬──────────────┐
│ Mã     │ Gói                           │ Loại         │ Hạn nhận      │ Hồ sơ      │ Trạng thái   │
│ MT-001 │ Quầy tiện ích · Sảnh dịch vụ  │ Quầy tiện ích│ 10/11 · 17:00 │ 2 nhận · 1 đủ│ Đang nhận  │
│        │ Aqua 1                        │              │ còn 3 ngày    │            │              │
└────────┴───────────────────────────────┴──────────────┴───────────────┴────────────┴──────────────┘
```

### 2.2 Trang gói (`/exploitation/packages/:id`), tab "Hồ sơ mời thầu" (D1 tr. 5)

```
MT-001 · Quầy tiện ích Sảnh dịch vụ Aqua 1        (Đang nhận hồ sơ)   [Phát hành bản sửa] [⋯ Gia hạn · Đóng sớm · Hủy]
Aqua 1 · Sảnh dịch vụ · Quầy tiện ích · Phiên bản 01 phát hành 01/11/2026
┌ Đợt mở 1 ┐ ┌ Đơn vị mời 2 ┐ ┌ Tài liệu 3 ┐ ┌ Hạn nhận 10/11 · 17:00 ┐
(Hồ sơ mời thầu) (Hồ sơ dự thầu 2) (Lịch sử)
┌ MT-001 · HỒ SƠ PHÁT HÀNH ────────────┐ ┌ BẢN XEM HỒ SƠ ──────────────────────────┐
│ Đơn vị được mời: DV-A, DV-B           │ │ THƯ MỜI THẦU                              │
│ Hạn tiếp nhận: 10/11 · 17:00          │ │ Khai thác khu vực chung · MT-001          │
│ Thư mời · Phiên bản 01        (Đã đủ) │ │ (xem tệp thư mời, PDF nhúng hoặc ảnh)     │
│ Yêu cầu khai thác             (Đã đủ) │ │ Hồ sơ tiếp nhận: Năng lực · Phương án ·   │
│ Tiêu chí đánh giá             (Đã đủ) │ │   Tài liệu tiếp nhận · Chứng từ điều kiện │
│ Danh mục hồ sơ phải nộp (4 mục)       │ │ Hạn nhận 10/11/2026 · 17:00               │
│ [Phiên bản ▾ 01]                      │ │                                           │
└───────────────────────────────────────┘ └───────────────────────────────────────────┘
```

- **Gói ở Nháp:** nút chính "Ghi nhận phát hành". Mở hộp thoại có ô ngày phát hành, và một danh sách kiểm (3 tài liệu, danh mục, hạn, đơn vị). Mục còn thiếu có dấu ✗ và liên kết tới chỗ cần sửa.
- **"Phát hành bản sửa":** hộp thoại có ô lý do. Hộp thoại nêu rõ: "Hồ sơ đã nhận giữ nguyên. Mục mới thêm vào danh mục sẽ ở trạng thái Chưa nhận cho mọi đơn vị."
- Ô chọn "Phiên bản" cho xem lại mọi phiên bản cũ, chỉ đọc, kèm lý do sửa.

### 2.3 Tab "Hồ sơ dự thầu" (D1 tr. 6)

```
┌ Đã nhận 2 ┐ ┌ Đủ hồ sơ 1 ┐ ┌ Cần bổ sung 1 ┐ ┌ Hạn nhận 10/11 ┐          [+ Ghi nhận hồ sơ]
┌ MT-001 · TIẾP NHẬN ─────────────────┐ ┌ ĐỐI CHIẾU DV-B ─────────────── (Thiếu 1) ┐
│ ┌ DV-A ─────────── (4/4 tài liệu) ┐ │ │ Giá chào: 22.000.000 ₫ / tháng            │
│ │ Tiếp nhận 08/11 · Đủ hồ sơ      │ │ │ Hồ sơ năng lực            (Đã nhận) ▢     │
│ └─────────────────────────────────┘ │ │ Phương án khai thác       (Đã nhận) ▢     │
│ ┏ DV-B ━━━━━━━━━━━ (3/4 tài liệu) ┓ │ │ Tài liệu tiếp nhận        (Đã nhận) ▢     │
│ ┃ Tiếp nhận 09/11 · Đang bổ sung  ┃ │ │ Chứng từ điều kiện        (Cần bổ sung)   │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │   "Thiếu giấy xác nhận…" · Hạn 10/11 17:00│
│ DV-C chưa nộp (được mời)            │ │ [Ghi yêu cầu bổ sung]  [Cập nhật tài liệu]│
└─────────────────────────────────────┘ └───────────────────────────────────────────┘
```

- Cột trái liệt kê mọi đơn vị **được mời**. Đơn vị chưa nộp hiện dòng mờ "chưa nộp". Đơn vị ngoài danh sách thì có cờ riêng.
- Bấm một đơn vị thì cột phải hiện phần đối chiếu của đơn vị đó (trên điện thoại thì mở trang riêng).
- **"Ghi nhận hồ sơ":** hộp thoại có ô đơn vị (ưu tiên đơn vị được mời chưa nộp), thời điểm tiếp nhận, giá chào và đơn vị kỳ, ghi chú, và ô lý do nếu đơn vị ngoài danh sách.
- **"Cập nhật tài liệu":** mỗi mục có ô chọn trạng thái kèm `FileUploader`.
- **"Ghi yêu cầu bổ sung":** chọn nhiều mục, ô ghi chú, ô hạn bổ sung.
- Ở trạng thái "Đã đóng nhận", nút "Ghi nhận hồ sơ" ẩn. Chỉ mục "Cần bổ sung" còn trong hạn mới sửa được.

### 2.4 Đơn vị khai thác (`/exploitation/partners`)

- Bảng: mã, tên, mã số thuế, người liên hệ, số gói đã tham gia, trạng thái.
- Hộp thoại thêm và sửa như SPEC BR-F1-01. Trùng tên thì hiện cảnh báo `Notice warning` ngay trong hộp thoại, vẫn cho lưu.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Hai cột như §2.2, §2.3 |
| 768–1023px | Một cột; bản xem thư và phần đối chiếu nằm dưới danh sách |
| < 768px | Ô số 2 × 2. Danh sách gói dùng thẻ. Ở tab "Hồ sơ dự thầu", mỗi đơn vị là một thẻ; bấm vào thì mở trang đối chiếu riêng, có nút quay lại. Nút chính dính đáy màn, như D1 mobile. Lề 16px, không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương ô số và hai cột |
| Rỗng | Danh sách: "Chưa có gói khai thác nào." kèm nút tạo (nếu có quyền). Tab hồ sơ khi chưa phát hành: "Phát hành gói để bắt đầu nhận hồ sơ." Đã phát hành mà chưa có hồ sơ: "Chưa có đơn vị nào nộp hồ sơ." |
| Lỗi trường | Báo dưới đúng trường; trong danh sách kiểm phát hành thì báo đúng mục; `aria-invalid` và `aria-describedby` |
| Xung đột phiên bản | `Notice warning`: "Gói vừa được người khác cập nhật. Tải lại để xem bản mới." kèm nút "Tải lại" |
| 404 / ngoài phạm vi | "Không tìm thấy gói khai thác" kèm nút về danh sách |
| Không có quyền xem giá | Không hiện cột giá, không hiện tài liệu; không để lộ dưới dạng ô trống có nhãn |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại"; lỗi trong hộp thoại thì giữ nguyên dữ liệu đã nhập |
| Offline | `useOnline`: khóa nút ghi, kèm dòng "Đang mất kết nối — chưa lưu được thay đổi." |
| Accessibility | `h1` "mã · tên gói". Ô số là `<dl>`. Danh sách kiểm phát hành là danh sách có trạng thái đọc được ("Tiêu chí đánh giá: thiếu"). Thẻ đơn vị là nút có `aria-pressed` khi đang chọn. Hạn nhận có `<time datetime>`. Cờ luôn có chữ |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): toàn bộ §2.
- Mock: không có màn F; menu "Quỹ khai thác" ẩn.
