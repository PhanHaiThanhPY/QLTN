# Module B04: Lịch sửa chữa

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-18)**
**Code đã đọc** (commit `fb4fd7a`):
- Web: `web/src/features/records/RepairSchedulePage.tsx`, `components/schedule/*` (bảng, tuần, tháng, `repair-schedule-ui.ts`), `services/records-service.ts` (`listRepairSchedule`, dòng 191–235), `app/router.tsx` dòng 56, `app/navigation.ts` dòng 41, `mock/seed-repairs.ts`.
- API: `api-qltn/src/modules/records/records.controller.ts`, `records.service.ts` (`list`, dòng 396–450), `dto/list-records-query.dto.ts`, `construction.service.ts`, `entities/repair-construction.entity.ts`, `entities/repair-record.entity.ts`.
- Test: `records-list.e2e-spec.ts`, `records-summary.e2e-spec.ts`, `record-construction.e2e-spec.ts` (chỉ đọc tên ca).

**Liên quan nghiệp vụ:**
- D2 nhóm 04: "Xem công việc theo ngày, tuần, tháng hoặc danh sách; tra cứu thời điểm và người phụ trách để điều phối xử lý."
- D1 tr. 18 "Điều phối việc sửa chữa theo ngày và người" (đã xem hình, mục 4).
- Kiểm kê 26/10 (`reviews/2026-10-26/tong-quan-module-tinh-nang.md` dòng 68): B04 chỉ xem, 0 thao tác có backend, trạng thái Demo.
- Ranh giới: Lịch bảo trì là B14 (`/maintenance/schedule`), thuộc nhóm B10–B14. Tài liệu này không phân tích B14.

## 1. Tính năng và trạng thái

| # | Tính năng | API | Web `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| SC-01 | Mục menu "Lịch sửa chữa" trong nhóm Sửa chữa | — | menu vẫn hiện | — | Có ở menu. Ở chế độ `api` route trả màn "chưa nối API" (`connected()`) |
| SC-02 | Xem dạng danh sách, có phân trang: mã, nơi sửa chữa, công việc, BQL và KT phụ trách, thời gian, trạng thái, cờ quá hạn / cần phân công lại / khẩn cấp | không có | không | không | **Demo** (IndexedDB) |
| SC-03 | Xem theo tuần (Thứ 2 – CN) và theo tháng, chuyển tuần/tháng, nút "Tuần này"/"Tháng này" | không có | không | không | **Demo** |
| SC-04 | Lọc theo tòa, vị trí (lọc theo tòa đã chọn), nhóm trạng thái, khoảng ngày | `GET /records` có tòa, vị trí, nhóm trạng thái; **ngày lọc theo ngày tạo** | không | `records-list` | **Demo**; API chưa có lọc theo ngày thi công |
| SC-05 | Bấm một mục để mở chi tiết hồ sơ | — | có (chi tiết đã nối API) | — | Có ở demo |
| SC-06 | Thẻ tổng: việc mở, hôm nay, trễ lịch, xung đột giờ (D1 tr. 18) | không có | không | không | **Chưa có** |
| SC-07 | Khung giờ xử lý và người nhận việc, "Lưu lịch xử lý" (D1 tr. 18) | không có | không | không | **Chưa có** (B04 hiện chỉ xem) |
| SC-08 | Xuất lịch tuần và từng hồ sơ ra PDF (D1 tr. 18: "Lịch tuần.pdf", "SC-003.pdf") | không có | không | không | **Chưa có** |

**Dữ liệu API đã có cho lịch** (từ S3, `repair_constructions`, một dòng mỗi hồ sơ):
- `start_date`, `planned_end_date` (kiểu ngày, không có giờ), `completed_date`, `progress_percent`, `plan_note`, `started_by`.
- Hồ sơ có `executing_contractor_name`, người giữ bước (BQL, người xác nhận, TVKT, BQT), `task_due_days` (số ngày hạn từng bước, chụp từ cấu hình tòa).
- API **không** tính hạn xử lý theo thời điểm (`dueAt`) và không có bộ lọc `overdue` (`records-list` có ca "rejects filters the backend does not have (overdue)").
- `GET /records` trả danh sách hồ sơ nhưng **không** kèm dữ liệu thi công.

## 2. Quy tắc đang chạy (demo, IndexedDB)

- **Phạm vi:** chỉ hồ sơ thuộc tòa trong phạm vi người xem (`scopedBuildingIds`). Mọi vai trò có quyền xem đều thấy menu.
- **Ngày xếp lịch** của một hồ sơ: ngày bắt đầu thi công nếu có; nếu chưa thi công thì ngày của hạn xử lý (`dueAt`); không có cả hai thì "Chưa xếp lịch".
- **Hiển thị thời gian:** "dd/mm – dd/mm" (bắt đầu – dự kiến xong) hoặc "Hạn dd/mm hh:mm".
- **Quá hạn:** quá hạn xử lý, **hoặc** ngày dự kiến xong < hôm nay khi hồ sơ chưa ở trạng thái kết thúc.
- **Tuần/tháng:** lấy tối đa 1.000 hồ sơ; mỗi hồ sơ hiện **một lần, ở ngày bắt đầu**. Màu: đỏ khi quá hạn, xanh lá khi hoàn tất, còn lại màu chính.
- Sắp xếp theo ngày xếp lịch tăng dần; hồ sơ chưa xếp lịch nằm cuối.

## 3. Khoảng trống và lỗi

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **B4G-01** | Không có API cho lịch. Ở chế độ `api` menu vẫn hiện nhưng màn báo "chưa nối API" | `router.tsx` dòng 56; `navigation.ts` dòng 41 không có `apiOnly`/ẩn | **Cao** cho bản chào khách | B4-S1: endpoint lịch, nối web |
| B4G-02 | Hồ sơ chưa có ngày vẫn lọt qua bộ lọc ngày. Ở tuần/tháng, số đếm ("n lịch sửa chữa") tính cả các hồ sơ này nhưng lưới không vẽ chúng, nên **số đếm lệch với lưới** | `listRepairSchedule`: `!row.scheduledDate \|\|` ở bộ lọc ngày; `groupByDate` bỏ dòng không có ngày | Trung bình | Lịch chỉ lấy hồ sơ có khoảng thời gian; hồ sơ chưa xếp lịch là một danh sách riêng |
| B4G-03 | Đợt thi công nhiều ngày chỉ hiện ở ngày bắt đầu. Lọc theo khoảng ngày cũng so ngày bắt đầu, nên việc bắt đầu tuần trước, còn chạy tuần này **không hiện** ở tuần này | `repairScheduleDate`, `groupByDate` | **Cao** (sai nghiệp vụ "điều phối theo ngày") | Lọc theo **giao nhau** của [bắt đầu, dự kiến xong] với khoảng xem; vẽ thanh kéo dài qua các ngày |
| B4G-04 | Cờ "trễ" dùng `planned_end_date < hôm nay` khi hồ sơ chưa kết thúc. Hồ sơ đã thi công xong, đang chờ nghiệm thu hoặc thanh toán, vẫn bị tô đỏ | `listRepairSchedule` dòng `isOverdue` | Trung bình | Trễ thi công = chưa có `completed_date` và dự kiến xong < hôm nay (giờ VN) |
| B4G-05 | API không có hạn xử lý theo bước (`dueAt`). Hồ sơ chưa thi công không có mốc nào để đặt lên lịch | `repair-record.entity.ts`: chỉ có `task_due_days`; `records-list` từ chối `overdue` | Trung bình | Giai đoạn 1: lịch chỉ gồm thi công. Hạn xử lý theo bước làm cùng B02 Công việc cá nhân (OD mới, xem B4Q-03) |
| B4G-06 | D1 tr. 18 có khung **giờ**, **người nhận việc** (KT01, KT02), "Xung đột giờ" và nút "Lưu lịch xử lý". Hệ thống chỉ có ngày, không có giờ, không giao người thi công (chỉ có tên nhà thầu) | D1 tr. 18; `repair-construction.entity.ts` | Trung bình | Không làm ở B4-S1. Cần khách chốt có xếp lịch theo giờ/người hay không (B4Q-01) |
| B4G-07 | Lịch D1 tr. 18 trộn mã SC (sửa chữa), BT và KC trên cùng một lưới. Demo tách hai lịch: B04 chỉ sửa chữa, B14 chỉ bảo trì | D1 tr. 18; `navigation.ts` hai mục | Thấp | **Giả định:** giữ hai lịch riêng; ghi B4Q-02. Lịch chung làm sau khi B14 có API |
| B4G-08 | Không xuất PDF lịch tuần | D1 tr. 18 | Thấp | Gom vào B07 (in/PDF) hoặc báo cáo B18 |
| B4G-09 | Không có thẻ tổng (việc mở, hôm nay, trễ lịch) | D1 tr. 18 | Thấp | B4-S2; "việc mở" đã có ở `GET /records/summary` |

**Đối chiếu D1 tr. 18 (hình):**
- Màn chính là lưới **tuần theo giờ** (09:00, 12:00, 15:00, 16:00), Thứ 2 – Thứ 6. Mỗi ô ghi mã + giờ + người nhận.
- Khung "Đang chọn" bên phải: khung xử lý 16:00–17:00, địa điểm "Aqua 1 / Sảnh", người nhận KT01, hai tệp PDF.
- Gợi ý "BT-004 trễ lịch, cần bố trí lại." Bản mobile là dòng thời gian theo giờ trong ngày.
- Như vậy D1 coi B04 là màn **điều phối** (có lưu), demo chỉ làm màn **xem**. Đây là chỗ lệch lớn nhất.

## 4. Dữ liệu lịch cần có (mức nghiệp vụ)

| Mục trên lịch | Nguồn | Đã có ở API? |
|---|---|---|
| Đợt thi công | `start_date` → `planned_end_date`; xong thật `completed_date`; tiến độ % | Có (S3) |
| Mốc nghiệm thu | `repair_acceptances.inspected_at` (có giờ) | Có (S3), chưa dùng cho lịch |
| Hạn xử lý từng bước | thời điểm vào bước + `task_due_days` | **Chưa** (B4G-05) |
| Người phụ trách | BQL của hồ sơ; người giữ bước hiện tại; nhà thầu thực hiện | Có, trừ "người nhận việc" của D1 |
| Nơi sửa chữa | tòa, tầng, vị trí | Có |

## 5. Phân quyền và phạm vi (đề xuất)

- Xem lịch: mọi người có quyền xem hồ sơ (`VIEW`), chỉ trong tòa thuộc phạm vi. Giống `GET /records`; không thêm quyền mới.
- Không có thao tác ghi ở B4-S1. Đổi ngày thi công vẫn đi qua `update-construction` của S3 (người quản lý hồ sơ).

## 6. Câu hỏi cho khách

Đề xuất gom thành **OD-20** trong `DECISIONS.md` (OD-19 dành cho B06).

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| B4Q-01 | Có cần xếp lịch theo **giờ** và giao **người thực hiện** cụ thể (KT01, KT02) như D1 tr. 18 không? Ai được lưu lịch? | Không. Lịch theo ngày, người phụ trách là BQL và nhà thầu |
| B4Q-02 | Lịch sửa chữa và lịch bảo trì xem chung một lưới hay tách hai màn? | Tách hai màn, như demo |
| B4Q-03 | Hạn xử lý của các bước (xác nhận, duyệt tờ trình, nghiệm thu…) có cần hiện trên lịch không? | Không ở giai đoạn 1; hiện ở Công việc cá nhân (B02) |
| B4Q-04 | Cư dân hoặc BQT có cần nhận lịch thi công (ví dụ bản PDF tuần) không? | Không; BQT và TVKT đã nhận thông báo kế hoạch khi bắt đầu thi công (S3 BR-S3-01) |

## 7. Đề xuất slice

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **B4-S1** ([SPEC](../features/B04-lich-sua-chua/SPEC.md), đã duyệt PD-21) | Lịch thi công đọc dữ liệu thật: endpoint lịch, lọc giao nhau theo khoảng ngày, danh sách / tuần / tháng, đợt nhiều ngày vẽ qua các ngày, cờ trễ đúng, danh sách "chưa xếp lịch" riêng | Không. Dùng dữ liệu S3 có sẵn |
| B4-S2 | Thẻ tổng (đang thi công, bắt đầu hôm nay, trễ thi công, chờ nghiệm thu) và mốc nghiệm thu trên lịch | B4-S1 |
| B4-S3 | Xếp lịch theo giờ và người, phát hiện xung đột giờ, xuất PDF tuần | B4Q-01, B4G-08; chỉ làm nếu khách cần |

**AC nháp cho B4-S1:**
- **AC-1** Hồ sơ A thi công 20/11 – 26/11. Xem tuần 24/11 – 30/11: A hiện ở các ngày 24, 25, 26. Xem tuần 17/11 – 23/11: A hiện ở 20 – 23.
- **AC-2** Hồ sơ chưa bắt đầu thi công không có trên lưới tuần/tháng. Nó nằm ở danh sách "Chưa xếp lịch" khi lọc theo tòa.
- **AC-3** Số đếm của tuần/tháng bằng đúng số hồ sơ vẽ trên lưới.
- **AC-4** Hồ sơ có dự kiến xong 22/11, chưa có ngày hoàn thành, hôm nay 23/11 (giờ VN): có cờ "Trễ thi công". Cùng hồ sơ đã có ngày hoàn thành 22/11: không có cờ, dù chưa thanh toán.
- **AC-5** Người dùng chỉ có phạm vi tòa A: không thấy hồ sơ tòa B, kể cả khi gửi `buildingId` của tòa B (trả danh sách rỗng, như `GET /records`).
- **AC-6** Ở chế độ `api`, menu "Lịch sửa chữa" mở được màn lịch, không còn màn "chưa nối API".
- **AC-7** Lọc theo vị trí và nhóm trạng thái cho cùng kết quả như `GET /records` với cùng bộ lọc, trong khoảng ngày đang xem.
