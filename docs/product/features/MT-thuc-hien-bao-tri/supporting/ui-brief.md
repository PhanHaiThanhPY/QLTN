---
spec: MT.S3
fidelity: Level 1 (ASCII) + brief
screens: [occurrence-mobile-work, occurrence-review, occurrence-desktop, my-occurrences-list]
---

# UI-UX brief: MT-S3 Thực hiện lượt bảo trì

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** đi kèm [SPEC](../SPEC.md), cùng trạng thái duyệt

## 0. Nguyên tắc

- **Thiết kế cho điện thoại trước** (D1 tr. 27: "ngay trên điện thoại"). Người thực hiện đứng cạnh thiết bị, một tay cầm máy, có thể đeo găng. Màn rộng chỉ là bản bày rộng ra của cùng một luồng.
- **Dùng lại màn demo** cho chế độ `api`:
  - trang: `OccurrenceDetailPage`;
  - component trong `components/occurrence/*`: `OccurrenceActions`, `OccurrenceNotices`, `OverviewTab`, `ChecklistTab`, `ChecklistWorkEditor`, `ChecklistEntryEditor`, `ChecklistEntriesView`, `CheckResultBadge`, `SubmissionRounds`, `ReviewPanel`, `ConfirmMaintenanceDialog`, `CreateRepairDialog`, `CancelOccurrenceButton`, `ReassignConfirmerButton` (mở rộng thành giao lại cả hai người);
  - trang `SchedulePage`, chỉ kiểu **Danh sách**.

  Ở chế độ `api`, bỏ `MaintenanceDocumentButton` (bản in) và các kiểu xem Tuần/Tháng (để MT-S4).
- Dùng lại `FileUploader` và `AttachmentList` của AT-S1 (báo cáo từng tệp, nén ảnh, tải xuống), `Notice`, `Dialog`, `useOnline`.
- Không thêm thông tin nào ngoài SPEC §3.

## 1. Token

| Dùng cho | Token | Ghi chú |
|---|---|---|
| Kết quả mục | `CheckResultBadge`: Đạt `good`, Lỗi `crit`, Không áp dụng `neutral`, Chưa kiểm `neutral` có viền nét đứt | như demo |
| Nút chọn kết quả | 3 nút lớn liền nhau, kiểu segmented: Đạt / Lỗi / Không áp dụng. Nút đang chọn tô nền theo tone của kết quả | vùng bấm ≥ 44px |
| Mục cần làm lại | viền trái 3px `border-warn`, nền `bg-warn-soft`, lý do `text-ink` | |
| Ngoài ngưỡng | dòng `text-crit` "Ngoài ngưỡng 2–6 bar" ngay dưới ô số | |
| Quá hạn | `Badge` `crit` "Quá hạn N ngày" / "Quá hạn xác nhận" | |
| Hồ sơ sửa chữa liên kết | `Badge` `info` "SC-031 · «trạng thái»" là liên kết | |

Không thêm token mới.

## 2. Màn hình

### 2.1 Trang lượt: người thực hiện, ở 375px

```
‹ Lượt bảo trì                               (Đang làm)
BT-0042 · Bơm B01
Tòa A · Tầng hầm · Hạn 12/11 · (Quá hạn 1 ngày)
Kế hoạch KH-007 · Xác nhận: KT02
──────────────────────────────────────────────
Đã kiểm 2/3 mục · 1 lỗi
┌──────────────────────────────────────────┐
│ 1. Vận hành *                            │
│ [  Đạt  ][  Lỗi  ][ Không áp dụng ]       │
│ Ghi chú (không bắt buộc)                 │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐  ← nền crit-soft khi Lỗi
│ 2. Rò rỉ * · Cần ảnh                     │
│ [  Đạt  ][■ Lỗi ■][ Không áp dụng ]       │
│ Ghi chú *  [Có rò tại khớp nối        ]  │
│ Ảnh *  [📷 Chụp / chọn ảnh]  ▢ ▢          │
│ Hồ sơ sửa chữa: (SC-031 · Nháp) ›        │  ← chỉ khi đã có
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ 3. Áp suất * · bar · ngưỡng 2–6          │
│ [ 7      ] bar                           │
│ ⚠ Ngoài ngưỡng 2–6 bar → Lỗi             │
└──────────────────────────────────────────┘
Kết quả chung *   [                       ]
Nhà thầu          [Công ty Nam Phát       ]
Người làm thực tế [                       ]
Ảnh chung *       [📷 Chụp / chọn ảnh]
══════════════════════════════════════════════
[ Lưu ]                    [ Gửi kết quả ]   ← thanh dính đáy màn, có safe-area
```

- Mỗi mục là một thẻ. Mục bắt buộc có dấu `*`.
- Ô ghi chú và ô ảnh của mục **chỉ hiện khi cần**: khi chọn Lỗi hoặc Không áp dụng, khi mục "Cần ảnh", hoặc khi người làm bấm "Thêm ghi chú/ảnh".
- Ô số dùng `inputmode="decimal"`. Ra ngoài ngưỡng thì nút kết quả tự chuyển sang Lỗi và bị khóa ở Lỗi (BR-MT3-03).
- Nút ảnh dùng `FileUploader` với `accept="image/*"`, để điện thoại cho chọn "Chụp ảnh" hoặc "Thư viện".
- Dòng tiến độ "Đã kiểm k/n mục · m lỗi" cập nhật ngay khi chọn kết quả.
- **Thanh nút dính đáy màn** luôn hiện. Bấm "Gửi kết quả" mà còn thiếu thì cuộn tới mục thiếu **đầu tiên**, đưa focus vào đó, và hiện lỗi ngay tại mục (BR-MT3-04).
- Khi rời trang mà còn thay đổi chưa lưu: hỏi "Bạn có thay đổi chưa lưu. Rời trang?". Dùng hộp thoại của ứng dụng, không dùng `window.confirm`.

### 2.2 Trang lượt: người xác nhận

```
BT-0042 · Bơm B01                           (Chờ xác nhận)  Hạn xác nhận 13/11 09:00
Lần gửi 2 · KT01 · 10/11 09:00   [Xem lần 1]
┌ 2. Rò rỉ · (Lỗi) ──────────────────────────┐
│ "Có rò tại khớp nối"  ▢ ▢                  │
│ Hướng xử lý:  (SC-031 · Nháp) ›            │  ← đã có hồ sơ: đủ điều kiện
│ [☐ Cần làm lại]                            │
└────────────────────────────────────────────┘
┌ 3. Áp suất · 7 bar · (Lỗi) ───────────────┐
│ Hướng xử lý *  [ Ghi hướng xử lý…       ]  │  ← chưa có hồ sơ: phải ghi (≥ 10 ký tự)
│ [☐ Cần làm lại]                            │
└────────────────────────────────────────────┘
[ Yêu cầu làm lại ]            [ Xác nhận hoàn thành ]
```

- Đánh dấu "Cần làm lại" ở một mục thì mở ô lý do của mục đó. Khi đã có mục bị đánh dấu, nút "Xác nhận hoàn thành" bị khóa, kèm gợi ý "Bỏ đánh dấu «Cần làm lại» để xác nhận."
- "Xác nhận hoàn thành" mở `ConfirmMaintenanceDialog`: tình trạng thiết bị (Giữ nguyên / Tốt / Cần chú ý), kèm ghi chú nếu đổi.
- "Yêu cầu làm lại" mở hộp thoại có ô lý do chung.
- `SubmissionRounds`: các lần gửi trước mở ra ở dạng chỉ đọc, và có ghi lý do làm lại của từng lần.

### 2.3 Trang lượt: BQL quản lý kế hoạch

- Đầu trang có menu "Thao tác": Giao lại người thực hiện, Giao lại người xác nhận, Hủy lượt. Mục nào hiện là tùy theo trạng thái (BR-MT3-01).
- Ở mục Lỗi chưa có hồ sơ còn hiệu lực: nút "Tạo hồ sơ sửa chữa từ mục này" mở `CreateRepairDialog`, với dữ liệu điền sẵn theo BR-MT3-08. Tạo xong thì chuyển tới form hồ sơ (Nháp) vừa tạo; nút "Quay lại lượt" đưa về lượt.
- Mục đã có hồ sơ thì hiện badge hồ sơ kèm trạng thái hiện tại, không hiện nút tạo.

### 2.4 Trang lượt ở màn rộng (≥ 1024px)

- Hai cột: bên trái là danh sách mục (§2.1 hoặc §2.2); bên phải (sticky) là thông tin lượt, kết quả chung, ảnh chung, các lần gửi, nhật ký.
- Các nút thao tác ở đầu cột phải, không dính đáy màn.

### 2.5 Danh sách "Lượt bảo trì" (`/maintenance/schedule`, kiểu Danh sách)

```
Lượt bảo trì                                  [● Việc của tôi] [Tất cả]
┌ Quá hạn 1 ┐ ┌ Hôm nay 2 ┐ ┌ 7 ngày tới 5 ┐ ┌ Chờ xác nhận 1 ┐
[Tòa ▾] [Trạng thái ▾] [Từ ngày] [Đến ngày]
BT-0042  12/11  Bơm B01 · Tầng hầm     Đang làm   (Quá hạn 1 ngày)   KT01 → KT02
BT-0045  13/11  Thang máy 1 · Sảnh     Đã lên lịch                    KT01 → KT02
```

- Mặc định chọn "Việc của tôi" nếu người dùng là người thực hiện hoặc người xác nhận của ít nhất một lượt đang mở. Nếu không, mặc định chọn "Tất cả".
- Thẻ số là bộ lọc: bấm vào thì lọc danh sách theo thẻ đó.
- Sắp xếp: quá hạn trước, rồi theo ngày lịch tăng dần.
- Mỗi dòng là liên kết tới trang lượt.
- Menu "Lịch bảo trì" hiện ở chế độ `api`, với tên trang "Lượt bảo trì". Các kiểu Tuần/Tháng để MT-S4.

## 3. Responsive

| Độ rộng | Hành vi |
|---|---|
| < 768px | Như §2.1, §2.2. Thanh nút dính đáy màn, có `padding-bottom: env(safe-area-inset-bottom)`, và không che ô cuối (nội dung có khoảng đệm bằng chiều cao thanh nút). Danh sách §2.5 dùng thẻ. Lề 16px. Không cuộn ngang ở 375px |
| 768–1023px | Một cột như điện thoại, nhưng rộng tối đa 720px, căn giữa |
| ≥ 1024px | §2.4 |

## 4. Trạng thái

| Trạng thái | Hành vi |
|---|---|
| Loading | Khung xương đầu trang và 3 thẻ mục |
| Đang lưu, đang gửi | Nút ở trạng thái đang tải; các ô vẫn nhìn thấy nhưng không sửa được cho đến khi xong |
| Lưu xong | Toast "Đã lưu" ngắn. Không chuyển trang |
| **Lỗi mạng khi lưu hoặc gửi** | **Giữ nguyên mọi dữ liệu đang nhập**. `Notice` danger "Chưa lưu được vì mất kết nối. Dữ liệu vẫn còn trên màn hình — bấm Lưu lại khi có mạng." Không bao giờ báo "Đã lưu" khi chưa lưu (review 23/10 dòng 207) |
| Offline (`useOnline`) | Dải trên cùng: "Đang mất kết nối." Nút Lưu và Gửi bị khóa; vẫn điền được. Có mạng lại thì mở khóa |
| Lỗi tại mục | Viền `border-crit` cho thẻ mục, kèm dòng lỗi trong thẻ; `aria-invalid` và `aria-describedby` cho ô liên quan. Trên đầu trang có tóm tắt "Còn 2 mục chưa đủ: Rò rỉ, Áp suất", mỗi tên là liên kết cuộn tới mục đó |
| Xung đột | `Notice` warning: "Lượt vừa được người khác cập nhật. Tải lại để xem bản mới." kèm nút "Tải lại". Dữ liệu đang nhập vẫn giữ cho đến khi người dùng bấm tải lại |
| Không phải lượt của bạn | Xem được, ở dạng chỉ đọc, kèm dòng "Bạn đang xem. Người thực hiện: KT01." Không có nút ghi |
| 404 / ngoài phạm vi | "Không tìm thấy lượt bảo trì" kèm nút "Về danh sách" |
| Rỗng | "Việc của tôi" rỗng: "Bạn không có lượt bảo trì nào đang mở." Lọc không ra kết quả: "Không có lượt phù hợp." kèm nút "Xóa bộ lọc" |
| Accessibility | Nhóm nút kết quả là `radiogroup` có tên là tên mục, mỗi nút là `radio`, chọn được bằng phím mũi tên. Ô số có nhãn kèm đơn vị và ngưỡng. Dòng tiến độ có `aria-live="polite"`. Thanh nút dính đáy màn nằm sau nội dung trong thứ tự Tab. Ảnh có `alt` là tên tệp. Vùng bấm ≥ 44 × 44px |

## 5. Phân biệt thật và mock

- Thật (chế độ `api`): mọi phần ở §2.
- Mock: giữ màn demo, gồm bản in và các kiểu Tuần/Tháng.
