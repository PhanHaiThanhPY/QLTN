---
spec: TK.S1
fidelity: Level 1 (ASCII) + brief
screens: [my-tasks-desktop, my-tasks-mobile]
---

# UI-UX brief: TK-S1 Công việc của tôi

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Dùng lại màn demo** `features/tasks/*` (`index.tsx`, `TaskTable`, `TaskCard`, `TaskMetricCard`, `TaskStatusBadge`, `SubjectTypeBadge`) cho cả `api` và `mock`. Sửa các chỗ SPEC khác demo; không vẽ lại màn hình.
- Ở chế độ `api`, bỏ lọc "Sửa chữa / Bảo trì" (chỉ có sửa chữa cho đến TK-S2). Giữ khối `AssistantInsight` như demo.
- Dùng lại `RepairStatusBadge`, `RecordFlags` (cờ Khẩn cấp, Quá hạn), `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `useOnline`.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Ô số | `TaskMetricCard`: Đang mở `neutral`, Quá hạn `crit`, Đến hạn hôm nay `warn`, Đã hoàn thành `good` | ô đang được chọn làm bộ lọc có viền `border-accent` |
| Hạn | chữ `text-ink-2`; quá hạn thì `text-crit font-semibold` kèm `Badge crit` "Quá hạn N ngày" (hoặc "Quá hạn N giờ" khi chưa đủ 1 ngày); đến hạn hôm nay thì `Badge warn` "Hôm nay HH:mm" | |
| Không có hạn | chữ `text-ink-3` "Không có hạn" | |
| Ưu tiên | `Badge`: "Ưu tiên khẩn cấp" `crit`, "Ưu tiên cao" `warn`; Bình thường và Thấp không hiện badge | theo mức ưu tiên của hồ sơ. Khác với cờ "Khẩn cấp" của `RecordFlags` (hồ sơ đi luồng B06), hai badge có thể cùng hiện |
| Cần phân công lại | `Badge warn` "Cần phân công lại" | |
| Thẻ "Tiếp tục công việc" | nền `bg-accent-soft`, viền trái 3px `border-accent` | chỉ trên điện thoại |

Không thêm token mới.

## 2. Màn hình

### 2.1 Màn rộng

```
Công việc của tôi                                         Hôm nay, 27/10/2026
5 việc đang chờ bạn tại 2 tòa nhà
┌ Đang mở 5 ┐ ┌ Quá hạn 1 ┐ ┌ Đến hạn hôm nay 1 ┐ ┌ Đã hoàn thành (30 ngày) 12 ┐
(Đang mở) (Đã hoàn thành)
[Tìm việc, mã hồ sơ…]  [Tòa ▾]  [Loại việc ▾]  [Hạn ▾]          Xóa bộ lọc
┌────────────────────┬───────────────────────────┬───────────┬───────────────┬──────────────┐
│ Việc               │ Hồ sơ                     │ Ưu tiên   │ Hạn           │ Trạng thái   │
├────────────────────┼───────────────────────────┼───────────┼───────────────┼──────────────┤
│ Xác nhận hồ sơ     │ SC-031 Rò ống cấp tầng 5  │ (Ưu tiên cao)│ 25/10 · 09:00 │ Chờ xác nhận │
│                    │ Tòa A · Tầng 5            │           │ (Quá hạn 2 ngày)│            │
│ Duyệt tờ trình     │ SC-028 Thay đèn sảnh      │           │ (Hôm nay 16:00)│ Chờ BQT duyệt│
│ Cần phân công lại  │ SC-020 Sửa bơm            │           │ Không có hạn  │ Chờ BQT duyệt│
│   Bước BQT duyệt · Nguyễn Văn X (đã khóa)      │           │               │              │
└────────────────────┴───────────────────────────┴───────────┴───────────────┴──────────────┘
```

- Cả dòng là một liên kết tới đúng tab của hồ sơ (BR-TK-05). Mã hồ sơ là chữ trong liên kết, không phải một liên kết riêng.
- Tab "Đã hoàn thành" dùng cột: Việc, Hồ sơ, Thời điểm, Kết quả. Không có cột hạn.
- Câu mô tả dưới tiêu đề: "«n» việc đang chờ bạn tại «k» tòa nhà". Không có việc thì: "Không có việc nào đang chờ bạn".

### 2.2 Điện thoại (< 768px)

```
Công việc của tôi
Hôm nay, 27/10/2026
┌ Đang mở 5 ┐ ┌ Quá hạn 1 ┐
┌ Hôm nay 1 ┐ ┌ Đã xong 12 ┐
┏ TIẾP TỤC CÔNG VIỆC ━━━━━━━━━━━━━━━━━━━━┓
┃ Xác nhận hồ sơ · (Quá hạn 2 ngày)       ┃
┃ SC-031 Rò ống cấp tầng 5               ┃
┃ Tòa A · Tầng 5 · (Ưu tiên cao)                  ┃
┃ [        Mở hồ sơ         ]             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Việc khác của bạn
┌ Duyệt tờ trình · (Hôm nay 16:00) ─────┐
│ SC-028 Thay đèn sảnh · Tòa A          │
└───────────────────────────────────────┘
```

- Thẻ "Tiếp tục công việc" là việc đứng đầu theo BR-TK-07 (D1 tr. 16). Thẻ chỉ có ở tab "Đang mở", khi không có bộ lọc nào.
- Bộ lọc gom vào nút "Lọc" mở một sheet; ô tìm kiếm vẫn ở ngoài.
- Thẻ việc dùng `TaskCard`, vùng bấm là cả thẻ (≥ 44px).

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | §2.1 |
| 768–1023px | Bảng bỏ cột Trạng thái, đưa trạng thái xuống dưới tên hồ sơ. Ô số 2 × 2 |
| < 768px | §2.2. Lề 16px. Không cuộn ngang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Ô số dạng khung xương; `LoadingState` 5 dòng |
| Rỗng, tab Đang mở, không lọc | `EmptyState` "Không có việc nào đang chờ bạn" kèm mô tả "Khi một hồ sơ sửa chữa đến bước của bạn, việc sẽ xuất hiện ở đây." |
| Rỗng do lọc | "Không có việc phù hợp." kèm nút "Xóa bộ lọc" |
| Rỗng, tab Đã hoàn thành | "Bạn chưa hoàn thành việc nào trong 30 ngày qua." |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại" |
| Offline | `useOnline`: dữ liệu đã tải vẫn hiện, kèm dòng "Đang mất kết nối, danh sách có thể chưa mới nhất." |
| Làm mới | Quay lại trang (focus cửa sổ) thì tải lại danh sách, để việc vừa làm xong ở tab khác biến mất |
| Accessibility | `h1` "Công việc của tôi". Ô số là nút bật/tắt (`aria-pressed`). Bảng có `<th scope>`. Mỗi dòng có tên đọc được: "Xác nhận hồ sơ SC-031, quá hạn 2 ngày, ưu tiên cao". Cờ luôn có chữ, không chỉ dựa vào màu |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): việc sửa chữa tính ở API; hạn tính ở API.
- Mock: giữ màn demo, gồm việc bảo trì. Áp dụng các sửa lỗi TD-01 đến TD-03 cho cả `mock`.
