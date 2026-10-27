---
spec: B04.S1
fidelity: Level 1 (ASCII) + brief
screens: [schedule-list, schedule-week, schedule-month, awaiting-schedule]
---

# UI-UX brief: B4-S1 Lịch thi công

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Giữ màn demo hiện có** (`RepairSchedulePage` và `components/schedule/*`): cùng bố cục, bộ lọc, `ViewSwitch` 3 kiểu xem, lưới tuần và lưới tháng. Slice này đổi **dữ liệu và quy tắc** (SPEC §3), không vẽ lại màn hình.
- Chỉ thêm 3 thứ:
  1. mục trên lưới hiện ở **mọi ngày** nó chiếm, có dấu nối giữa các ngày;
  2. cờ "Trễ thi công";
  3. khối "Chờ xếp lịch".
- Dùng lại `Card`, `Badge`, `RepairStatusBadge`, `RecordFlags`, `MaintenanceLocationTrail`, `LoadingState`, `EmptyState`, `ErrorState`, `Pagination`, `useOnline`. Không thêm component dùng chung mới nếu không cần.
- Không thêm thông tin nào ngoài SPEC BR-B4-07.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Mục bình thường | `border-accent/30 bg-accent-soft/70`, viền trái 3px | như demo |
| Mục trễ thi công | `border-crit/30 bg-crit-soft` | như demo, nhưng **chỉ** theo BR-B4-04 |
| Mục đã thi công xong (có ngày hoàn thành) | `border-good/30 bg-good-soft` | demo chỉ tô xanh khi `COMPLETED`; nay tô xanh khi có ngày hoàn thành |
| Mục "Cần khắc phục" | `border-warn/30 bg-warn-soft` | mới, dùng token có sẵn |
| Cờ | `Badge` tone `crit` "Trễ thi công"; tone `crit` "Khẩn cấp" (có sẵn ở `RecordFlags`) | chữ "Trễ thi công", **không** dùng chữ "Quá hạn" của demo, để không lẫn với hạn xử lý bước |
| Ngày hôm nay | `bg-accent text-accent-fg` ở số ngày | như demo |

Không thêm token mới. Màu không phải là cách duy nhất để nhận ra trạng thái: mỗi mục luôn có chữ trạng thái hoặc cờ.

## 2. Màn hình

### 2.1 Khung chung

```
┌ Lịch sửa chữa ────────────────────────────────────────────────────────┐
│ Theo dõi thời gian thi công của các hồ sơ sửa chữa.                     │
├────────────────────────────────────────────────────────────────────────┤
│ [Tòa ▾ Tất cả]  [Vị trí ▾]  [Nhóm trạng thái ▾]  [Từ ngày] [Đến ngày]  │  ← "Từ/Đến ngày" chỉ hiện ở Danh sách
├────────────────────────────────────────────────────────────────────────┤
│ ▸ Chờ xếp lịch (2)  — đã duyệt, chưa bắt đầu thi công                   │  ← khối thu gọn, §2.5
├────────────────────────────────────────────────────────────────────────┤
│ (Danh sách | Tuần | Tháng)                    Lịch thi công theo ngày   │
│  … nội dung kiểu xem …                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

- Mô tả dưới tiêu đề đổi thành: "Theo dõi thời gian thi công của các hồ sơ sửa chữa." Câu cũ có "hạn xử lý", không còn đúng vì lịch không có hạn xử lý nữa.
- Kiểu xem đang chọn được giữ khi đổi bộ lọc.

### 2.2 Danh sách

| Cột | Nội dung |
|---|---|
| Mã | liên kết tới hồ sơ |
| Nơi sửa chữa | `MaintenanceLocationTrail` |
| Công việc | tên hồ sơ; dòng nhỏ: "Nhà thầu: «tên»" nếu có |
| Phụ trách | "BQL: «họ tên»" |
| Thời gian | "20/11 – 26/11". Đã xong: "20/11 – 22/11 · xong 22/11". Trễ: chữ màu `text-crit` và "dự kiến 22/11" |
| Tiến độ | "60%" |
| Trạng thái | `RepairStatusBadge` và các cờ |

- Đầu bảng: "«n» hồ sơ", với n = tổng số theo bộ lọc.
- Màn hẹp (< 768px): mỗi hồ sơ một thẻ như demo, thêm dòng tiến độ và nhà thầu.

### 2.3 Tuần

```
 [Hôm nay] [‹] [›]         24/11 – 30/11/2026              3 hồ sơ trong tuần
┌──────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────┬────────┐
│ Ngày │ T2 24   │ T3 25   │ T4 26   │ T5 27   │ T6 28   │ T7 29  │ CN 30  │
├──────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────┼────────┤
│ Cả   │◂SC-031  │ SC-031  │ SC-031▸ │         │         │        │        │  ← ◂ đã bắt đầu từ trước tuần
│ ngày │ Thay ống│ (nối)   │ (nối)   │         │         │        │        │     ▸ kết thúc ngày này
│      │ ⚠ Trễ   │         │         │         │         │        │        │
│      │ SC-034  │ SC-034▸ │ SC-036  │ SC-036  │ SC-036  │ SC-036 │ SC-036…│  ← … còn kéo dài sang tuần sau
└──────┴─────────┴─────────┴─────────┴─────────┴─────────┴────────┴────────┘
```

- Mỗi hồ sơ có một ô ở **mỗi ngày** nó chiếm (BR-B4-01, BR-B4-02). Một hồ sơ luôn ở **cùng một hàng** trong cả tuần, để mắt dò theo hàng được. Xếp hàng theo BR-B4-08.
- Ô ở ngày đầu tiên của hồ sơ trong tuần ghi đủ: mã, tên (2 dòng), trạng thái và cờ. Các ô nối tiếp chỉ ghi mã, với nền cùng màu, để lưới không bị rối.
- Nếu hồ sơ bắt đầu từ trước tuần thì ô ngày Thứ 2 có dấu `◂`. Nếu còn kéo dài sang tuần sau thì ô Chủ nhật có dấu `…`. Hai dấu này có `aria-hidden`; ý nghĩa được đọc qua tên của liên kết (§4).
- Số đếm "«n» hồ sơ trong tuần" theo BR-B4-06 (đếm hồ sơ khác nhau).
- Bỏ chữ "lịch sửa chữa trong tuần" của demo, thay bằng "hồ sơ trong tuần".

### 2.4 Tháng

- Lưới 7 cột như demo. Mỗi ngày liệt kê các hồ sơ có mặt ngày đó, mỗi hồ sơ một dòng "SC-031 · Thay ống…".
- Mỗi ô ngày hiện tối đa **3 dòng**. Còn nữa thì có nút "+n" mở danh sách đầy đủ của ngày đó: popover trên màn rộng, sheet trên màn hẹp. Danh sách này có nút đóng và đóng được bằng Esc.
- Số đếm "«n» hồ sơ trong tháng" theo BR-B4-06.
- Màn hẹp (< 768px): như demo, chỉ liệt kê các ngày có việc. Ngày hiện "T2 24/11", không hiện dạng `2026-11-24` như demo.

### 2.5 Chờ xếp lịch

```
▾ Chờ xếp lịch (2) — đã duyệt, chưa bắt đầu thi công
  SC-029  Sơn lại hành lang tầng 12 · AQUA 1 / Tầng 12     Duyệt xong 18/11 · Nhà thầu: Hòa Phát
  SC-033  Thay đèn sảnh                · AQUA 2 / Sảnh      Duyệt xong 21/11
```

- Là một khối thu gọn được, đặt **trên** khu kiểu xem. Mặc định thu gọn nếu rỗng, mở nếu có hồ sơ. Khối có `aria-expanded`.
- Mỗi dòng là liên kết tới hồ sơ. Theo bộ lọc tòa và vị trí (BR-B4-05). Không áp dụng bộ lọc ngày và nhóm trạng thái.
- Có nhiều hơn 10 hồ sơ thì hiện 10 dòng đầu, kèm liên kết "Xem tất cả" mở danh sách hồ sơ (`/records`) đã lọc sẵn trạng thái "Chờ thi công" và tòa đang chọn.
- Rỗng: dòng "Không có hồ sơ nào đang chờ xếp lịch."

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| ≥ 1024px | Bộ lọc 5 cột trên một hàng. Lưới tuần đủ 7 cột |
| 768–1023px | Bộ lọc 2–3 cột. Lưới tuần cuộn ngang **bên trong khung lưới** (như demo `min-w-[980px]`); trang không cuộn ngang |
| < 768px | Bộ lọc xếp dọc, lề 16px. Kiểu Tuần thành danh sách dọc theo ngày (T2 → CN), mỗi ngày liệt kê các hồ sơ có mặt; ngày không có việc ghi "Không có việc". Kiểu Tháng như §2.4. Danh sách dùng thẻ. Khối "Chờ xếp lịch" giữ nguyên, các dòng xuống hàng |

Kiểm ở 375px: không có thanh cuộn ngang của trang.

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | `LoadingState`: Danh sách 5 dòng, Tuần và Tháng 3–4 dòng. Bộ lọc vẫn dùng được |
| Rỗng | Danh sách: "Chưa có việc thi công phù hợp". Mô tả: "Hồ sơ xuất hiện trên lịch khi bắt đầu thi công." Tuần và Tháng: lưới vẫn vẽ, số đếm "0 hồ sơ", và dưới lưới có một dòng mô tả như trên |
| Lỗi mạng hoặc 5xx | `ErrorState` kèm nút "Thử lại" ở khu kiểu xem. Khối "Chờ xếp lịch" có lỗi riêng của nó, không chặn lịch |
| Offline | Dùng `useOnline`. Mất mạng khi chưa có dữ liệu: "Đang mất kết nối — không tải được lịch." Đã có dữ liệu: vẫn hiện, kèm dòng nhỏ "Đang mất kết nối, lịch có thể chưa mới nhất." |
| Bị cắt bớt (BR-B4-06) | Dòng `Notice` tone warn trên lưới: "Đang hiện «n» trên «m» hồ sơ. Chọn tòa hoặc nhóm trạng thái để thu hẹp." |
| Accessibility | Mỗi mục trên lưới là một `<a>` có tên đọc được, ví dụ: "SC-031 Thay ống cấp nước, 20/11 đến 26/11, Đang thi công, trễ thi công". Ô nối tiếp có cùng đích nhưng `tabIndex={-1}` và `aria-hidden`, để mỗi hồ sơ chỉ được Tab tới **một lần mỗi tuần**. Tiêu đề cột ngày có `<abbr>` hoặc chữ đầy đủ ("Thứ Hai 24/11"). Ngày hôm nay có `aria-current="date"`. Nút "Tuần trước" và "Tuần sau" giữ `aria-label` như demo |

## 5. Phân biệt thật và mock

- Thật: ở chế độ `api`, lịch và khối "Chờ xếp lịch" đọc từ API mới (SPEC §2 mục 7), áp dụng đủ BR-B4-01 đến BR-B4-09.
- Mock: giữ lịch demo chạy được (AC-B4.12). Không bắt buộc áp dụng quy tắc mới (SPEC §2 Ngoài phạm vi).
