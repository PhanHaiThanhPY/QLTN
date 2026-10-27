---
spec: MT.S2
fidelity: Level 1 (ASCII) + brief
screens: [plans-list, plan-form, plan-detail, item-maintenance-tab]
---

# UI-UX brief: MT-S2 Kế hoạch bảo trì

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Dùng lại màn demo** cho chế độ `api`:
  - trang: `PlansPage`, `PlanFormPage`, `PlanDetailPage`;
  - component: `PlanForm`, `PlanFormAside`, `ChecklistTemplateEditor`, `ChecklistTemplateCard`, `PlanActions`, `ChangeScheduleDialog`, `ScheduleVersionsCard`, `OccurrenceTable`, `OccurrenceDate`, `OccurrenceFlags`, `PlanTable`;
  - trong trang thiết bị: `components/item/ItemPlanList`, `UpcomingMaintenanceList`.

  Slice này nối dữ liệu thật, đổi những chỗ SPEC khác demo (§2), và **bỏ** `RefreshScheduleButton` ("Cập nhật lịch"), vì máy chủ tự sinh lượt.
- Ở chế độ `api`, lượt chưa có trang chi tiết (MT-S3). Dòng lượt **không** là liên kết; các thao tác của lượt nằm trong menu `⋯` của dòng.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Trạng thái kế hoạch | `Badge`: Nháp `neutral`, Đang chạy `good`, Tạm dừng `warn`, Đã kết thúc `neutral` có chữ `text-ink-3` | "Đã kết thúc" là mới |
| Trạng thái lượt | `Badge`: Đã lên lịch `info`, Đã hủy `neutral`; các trạng thái khác giữ như demo | |
| Cờ lượt | `Badge` tone `warn` "Lịch đã đổi"; `info` "Lượt bù"; `neutral` "Đã đổi lịch từ dd/mm" | |
| Cờ kế hoạch | `Badge` tone `warn` "Cần giao lại" (BR-MT2-02) | |
| Kỳ bỏ qua | chữ `text-ink-3`, gạch ngang ngày | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Danh sách kế hoạch (`/maintenance/plans`)

- Giữ các thẻ số của demo: Đang chạy, Sắp đến hạn (7 ngày), Tạm dừng, Cần cấu hình (Nháp). Thêm bộ lọc trạng thái "Đã kết thúc", mặc định **không** hiện các kế hoạch đã kết thúc.
- Cột "Chu kỳ" ghi bằng chữ: "Mỗi 2 tuần", "Mỗi tháng", "Mỗi 3 tháng".
- Cột "Lượt kế tiếp" là ngày của lượt "Đã lên lịch" gần nhất, chỉ có ở kế hoạch đang chạy.
- Nút "Tạo kế hoạch" chỉ hiện cho BQL.

### 2.2 Form kế hoạch

```
Thiết bị *            [BOM-A01 – Bơm nước sinh hoạt ▾]   (khóa sau khi kích hoạt)
Tên *                 [Kiểm tra bơm B01 hằng tháng]
Chu kỳ *              Mỗi [1] [tháng ▾]        (tuần: 1–8, tháng: 1–24)
Ngày bắt đầu *        [12/11/2026]   Ngày của lượt đầu tiên.
Người thực hiện *     [KT01 – Trần Văn B ▾]    KT hoặc BQL của vị trí
Người xác nhận *      [KT02 – Lê Thị C ▾]      KT khác người thực hiện
Nhà thầu              [                    ]
Danh mục kiểm *
 ┌────┬──────────────────┬────────────┬──────┬────────┬─────────────┬───┐
 │ #  │ Tên mục          │ Kiểu       │ Bắt buộc │ Cần ảnh │ Đơn vị · ngưỡng │   │
 │ 1  │ Vận hành         │ Kiểm tra   │ ☑    │ ☐      │             │ ⋯ │
 │ 2  │ Rò rỉ            │ Kiểm tra   │ ☐    │ ☑      │             │ ⋯ │
 │ 3  │ Áp suất          │ Số đo      │ ☑    │ ☐      │ bar · 2–6   │ ⋯ │
 └────┴──────────────────┴────────────┴──────┴────────┴─────────────┴───┘
 [+ Thêm mục]
```

- Dùng `ChecklistTemplateEditor` của demo, thêm cột "Cần ảnh". Thứ tự mục đổi được bằng nút lên/xuống (dùng được bằng bàn phím), không chỉ bằng kéo thả.
- Ô chọn người chỉ liệt kê người hợp lệ theo BR-MT2-02. Ô người xác nhận loại người đang được chọn làm người thực hiện.
- `PlanFormAside` bên phải: xem trước 3 ngày lượt đầu theo chu kỳ và ngày bắt đầu đang nhập, ví dụ "12/11 · 12/12 · 12/01".

### 2.3 Trang kế hoạch (`/maintenance/plans/:planId`)

```
KH-007 · Kiểm tra bơm B01 hằng tháng     (Đang chạy)   [Sửa] [Đổi chu kỳ] [Tạo lượt bù] [⋯ Tạm dừng · Kết thúc]
BOM-A01 · Tòa A · Tầng hầm · Mỗi tháng · Thực hiện: KT01 · Xác nhận: KT02
┌ Notice warn: 2 lượt có lịch đã đổi. Chọn "Giữ lượt này" hoặc "Hủy" cho từng lượt. ┐
Lượt bảo trì
┌─────────┬────────────┬──────────────┬────────────────────┬───┐
│ BT-0042 │ 12/11/2026 │ Đã lên lịch  │ (Lịch đã đổi)      │ ⋯ │  ⋯ = Giữ lượt này · Đổi lịch · Hủy
│ BT-0043 │ 10/11/2026 │ Đã lên lịch  │                    │ ⋯ │
│ BT-0031 │ 12/10/2026 │ Đã hủy       │ Tạm dừng kế hoạch: … │   │
│ —       │ 12/09/2026 │ Bỏ qua do tạm dừng │              │   │
└─────────┴────────────┴──────────────┴────────────────────┴───┘
Lịch sử chu kỳ (ScheduleVersionsCard): mỗi lần đổi một dòng, gồm chu kỳ, hiệu lực từ, lượt đầu, người đổi, lý do. Lần bị thay thế ghi "Bị thay bởi lần đổi dd/mm".
Danh mục kiểm (ChecklistTemplateCard) · Nhật ký kế hoạch
```

- Các nút hiện theo trạng thái (BR-MT2-04) và chỉ cho người quản lý kế hoạch.
- "Tạm dừng" và "Kết thúc" mở hộp thoại có ô lý do. Hộp thoại nêu rõ hậu quả: "«n» lượt đã lên lịch sẽ bị hủy. Lượt đang làm không bị ảnh hưởng." Nút xác nhận dùng tone `danger` cho "Kết thúc".
- "Đổi chu kỳ" (`ChangeScheduleDialog`): chu kỳ mới, hiệu lực từ, lượt đầu, lý do. Hộp thoại có dòng xem trước "«n» lượt từ dd/mm sẽ được đánh dấu để bạn xem lại".
- "Đổi lịch" của lượt: ô ngày chỉ cho chọn trong khoảng từ hôm nay đến trước ngày của kỳ kế tiếp. Có gợi ý "Phải trước dd/mm (kỳ kế tiếp)."
- Kỳ bỏ qua do tạm dừng hiện xen trong bảng lượt theo ngày, không có mã và không có thao tác.

### 2.4 Tab "Bảo trì" trong trang thiết bị

- Có ở chế độ `api` từ slice này (MT-S1 đã ẩn tab này).
- Nội dung: `ItemPlanList` liệt kê kế hoạch của thiết bị (mã, tên, chu kỳ, trạng thái, lượt kế tiếp) và `UpcomingMaintenanceList` liệt kê các lượt "Đã lên lịch" trong 30 ngày tới.
- Nút "Tạo kế hoạch cho thiết bị này" mở form kế hoạch với thiết bị đã chọn sẵn.
- Thẻ số "Lần kế tiếp" trong trang thiết bị hiện lại, khi thiết bị có kế hoạch đang chạy.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Như §2. Form có cột xem trước bên phải |
| 768–1023px | Cột xem trước của form xuống dưới. Bảng danh mục kiểm cuộn ngang **bên trong khung bảng** |
| < 768px | Danh mục kiểm: mỗi mục là một thẻ (tên; kiểu; ô tích Bắt buộc, Cần ảnh; đơn vị và ngưỡng). Bảng lượt: mỗi lượt một thẻ, kèm nút `⋯`. Các nút đầu trang gom vào một menu "Thao tác". Hộp thoại chiếm toàn màn. Lề 16px, không cuộn ngang trang ở 375px |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | `LoadingState`. Trang kế hoạch: khung xương đầu trang và bảng lượt |
| Rỗng | Danh sách: "Chưa có kế hoạch bảo trì." kèm nút tạo (nếu có quyền). Kế hoạch nháp chưa có lượt: "Kích hoạt kế hoạch để hệ thống bắt đầu sinh lượt." Tab "Bảo trì" của thiết bị: "Thiết bị chưa có kế hoạch bảo trì." |
| 404 / ngoài phạm vi | "Không tìm thấy kế hoạch" kèm nút về danh sách |
| Lỗi mạng / 5xx | `ErrorState` kèm "Thử lại". Lỗi trong hộp thoại thì giữ nguyên dữ liệu đã nhập |
| Xung đột phiên bản | `Notice` warning: "Kế hoạch vừa được người khác cập nhật. Tải lại để xem bản mới." kèm nút "Tải lại" |
| Lỗi trường | Báo dưới đúng trường, kể cả lỗi ở một mục kiểm cụ thể ("Mục 3: cần đơn vị"); `aria-invalid` và `aria-describedby` |
| Offline | `useOnline`: khóa các nút ghi, kèm dòng "Đang mất kết nối — chưa lưu được thay đổi." |
| Accessibility | `h1` là "mã · tên". Bảng có `<th scope>`. Cờ luôn có chữ. Menu `⋯` có tên đọc được: "Thao tác cho lượt BT-0042, 12/11". Hộp thoại giữ focus bên trong và trả focus về nút đã mở |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): mọi phần ở §2. Lượt được sinh ở máy chủ.
- Mock: giữ màn demo, gồm nút "Cập nhật lịch" và cách sinh lượt khi mở màn hình.
