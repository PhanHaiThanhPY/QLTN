---
id: MT.S1
title: Thiết bị trên dữ liệu thật, gắn với hồ sơ sửa chữa
status: Đã duyệt
owner: PM/BA
intent: "Mỗi tòa có danh mục thiết bị thật; hồ sơ sửa chữa gắn được với thiết bị, nên tra một thiết bị là thấy số lần hỏng, các hồ sơ sửa chữa và chi phí đã duyệt."
depends_on: []
---

# SPEC: Thiết bị trên dữ liệu thật, gắn với hồ sơ sửa chữa (MT-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-25), gồm 5 mặc định D-MT-1 đến D-MT-5 ở §6

**Nguồn:**
- Phân tích [maintenance.md](../../modules/maintenance.md), đã duyệt (PD-24): MG-01 (phần thiết bị), MG-02, MG-10 (dùng lại thiết bị), MD-06, MD-10 (mã thiết bị); mặc định MQ-01 đến MQ-07 (OD-23).
- D2 nhóm 10: "Mã, loại, model, vị trí, người phụ trách, thông tin kỹ thuật và tài liệu; tra lịch sử sửa chữa, bảo trì, số lần hỏng và chi phí liên quan." D1 tr. 24.
- Demo là tài liệu sống về hành vi: `web/src/services/handlers/maintenance-item-handlers.ts`, `features/maintenance/ItemsPage.tsx`, `ItemDetailPage.tsx`, `components/item/*`. Khi demo và SPEC này khác nhau, theo SPEC.

**Nền:** hồ sơ sửa chữa của SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md). Tệp đính kèm theo [attachments](../../modules/attachments.md) và AT-S1.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Ở chế độ `api`, cả nhóm Bảo trì bị ẩn và hệ thống không có thiết bị nào (MG-01). Mọi hồ sơ sửa chữa thật buộc phải chọn "Không thuộc thiết bị cụ thể", vì API chưa lưu được thiết bị của hồ sơ (MG-02). Vì vậy không tra được thiết bị nào hỏng bao nhiêu lần, tốn bao nhiêu tiền. Đây là điều D2 nhóm 10 hứa với khách.

Sau slice này:
- Mỗi tòa có danh mục thiết bị thật.
- Hồ sơ sửa chữa chọn được thiết bị.
- Trang thiết bị cho thấy các hồ sơ sửa chữa, số lần hỏng và chi phí đã duyệt của thiết bị đó.

Kế hoạch và lượt bảo trì làm ở MT-S2 và MT-S3.

**Người dùng:**
- Chính: BQL lập và giữ danh mục thiết bị của tòa, chọn thiết bị khi tạo hồ sơ sửa chữa.
- Phụ: KT, TVKT, BQT, kế toán tra lịch sử và chi phí của một thiết bị.

**User story:**
- Là BQL, tôi muốn có danh mục thiết bị của tòa với mã, vị trí, người phụ trách và hạn bảo hành, để mọi việc sửa chữa gắn đúng thiết bị.
- Là BQL, khi tạo hồ sơ sửa chữa, tôi muốn chọn thiết bị bị hỏng, để lịch sử của thiết bị tự đầy lên.
- Là BQT, tôi muốn mở một thiết bị và thấy nó đã hỏng mấy lần, mỗi lần tốn bao nhiêu, để quyết định sửa tiếp hay thay mới.

## 2. Phạm vi

**Trong phạm vi:**
1. **Thiết bị** ở API và web chế độ `api`: tạo, sửa, ngừng dùng, **dùng lại**, cập nhật tình trạng, tài liệu (BR-MT-01 đến BR-MT-06).
2. **Danh sách thiết bị** và **trang thiết bị** ở chế độ `api` (BR-MT-07, BR-MT-08).
3. **Gắn thiết bị vào hồ sơ sửa chữa**: thêm thiết bị vào dữ liệu hồ sơ (cần migration); form hồ sơ chọn được thiết bị; quy tắc khi gửi (BR-MT-09, BR-MT-10).
4. **Dữ liệu demo**: seed thêm thiết bị cho các tòa demo, theo `mock/seed-maintenance.ts` (16 thiết bị), để chủ dự án trình diễn được (BR-MT-12).
5. Menu "Thiết bị" hiện ở chế độ `api`. Các mục Kế hoạch, Lịch bảo trì và trang lượt bảo trì vẫn ẩn ở chế độ `api`, cho đến MT-S2 và MT-S3.

**Ngoài phạm vi:**
- Kế hoạch bảo trì, sinh lượt, thực hiện lượt (MT-S2, MT-S3). Ở chế độ `api`, trang thiết bị không có tab "Bảo trì" (brief §2.2).
- Cảnh báo có thông báo và đầu mối; nhập danh mục từ tệp (MT-S4).
- Tạo hồ sơ sửa chữa từ lượt bảo trì (MT-S3). Slice này chỉ lưu thiết bị của hồ sơ, chưa lưu lượt bảo trì nguồn.
- Phạm vi theo vị trí khi đọc (MG-11): đọc theo tòa, giống hồ sơ sửa chữa.
- Đổi thiết bị của hồ sơ sau khi hồ sơ đã qua bước xác nhận.
- Chế độ `mock`: giữ nguyên. Riêng lỗi MD-06 (sửa được mã) thì sửa luôn ở cả hai chế độ.

## 3. Quy tắc nghiệp vụ

- **BR-MT-01. Trường của thiết bị:**

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Mã | có | 2–30 ký tự, viết hoa, chỉ chữ, số và dấu `-`. **Duy nhất trong một tòa**, kiểm ở tầng dữ liệu. **Không đổi sau khi tạo** |
  | Tên | có | 3–120 ký tự |
  | Loại | có | 2–60 ký tự, chữ tự do (ví dụ "Bơm", "Thang máy"). Gợi ý từ các loại đã có trong tòa |
  | Tòa | có | trong phạm vi của người tạo. **Không đổi sau khi tạo** |
  | Vị trí | có | thuộc tòa; nằm trong phạm vi vị trí của người tạo, nếu người đó bị giới hạn vị trí |
  | Người phụ trách | có | BQL đang hoạt động, có phạm vi tòa và vị trí đó |
  | Model, nhà cung cấp | không | tối đa 120 ký tự |
  | Ngày lắp đặt | không | ngày hợp lệ, không sau hôm nay |
  | Bảo hành đến | không | ngày hợp lệ, không trước ngày lắp đặt |
  | Thông tin kỹ thuật | không | tối đa 2.000 ký tự |

- **BR-MT-02. Quyền:**
  - Tạo, sửa, ngừng dùng, dùng lại và quản lý tài liệu: người có `MAINTENANCE_MANAGE` (BQL), trong phạm vi tòa và vị trí của thiết bị.
  - Cập nhật tình trạng: người có `ITEM_CONDITION`.
  - Xem: mọi người có quyền xem, trong phạm vi tòa.
  - Ngoài phạm vi tòa: trả 404, như hồ sơ sửa chữa.
  - Mọi thao tác ghi đều có nhật ký (loại chủ thể `MAINTENANCE_ITEM` đã có) và khóa phiên bản (sửa đồng thời thì người sau nhận lỗi xung đột).
- **BR-MT-03. Ngừng dùng và dùng lại:**
  - Ngừng dùng cần lý do (≥ 5 ký tự).
  - Thiết bị đã ngừng: không sửa được; không chọn được cho hồ sơ sửa chữa **mới**; vẫn hiện ở các hồ sơ cũ và trong danh sách khi bật "Gồm thiết bị đã ngừng".
  - **Dùng lại** cần lý do, đưa thiết bị về trạng thái đang dùng.
  - Ở slice này chưa có kế hoạch, nên chưa có điều kiện chặn ngừng dùng. MT-S2 sẽ thêm điều kiện về kế hoạch.
- **BR-MT-04. Tình trạng:** "Chưa rõ" (mặc định khi tạo), "Tốt", "Cần chú ý".
  - Đổi tình trạng cần ghi chú (≥ 5 ký tự).
  - Mỗi lần đổi lưu tình trạng cũ, tình trạng mới, ghi chú, người đổi và thời điểm. Các lần đổi hiện ở tab "Lịch sử thay đổi".
  - Không đổi được tình trạng của thiết bị đã ngừng.
- **BR-MT-05. Tài liệu:** tải được tệp theo luật của module tệp (JPEG/PNG/WebP/PDF, ≤ 10 MB) với mục đích mới là "Tài liệu thiết bị".
  - Chỉ BQL có `MAINTENANCE_MANAGE` tải hoặc gỡ được, khi thiết bị đang dùng.
  - Gỡ tài liệu chỉ gỡ liên kết, không xóa tệp, giống các tệp khác.
- **BR-MT-06. Mã thiết bị:**
  - Sửa thiết bị mà gửi kèm mã khác thì API bỏ qua trường mã, mã giữ nguyên (sửa MD-06). Cách này đúng ở cả `api` và `mock`.
  - Mã trùng trong tòa thì báo lỗi ở trường mã: "Mã thiết bị đã có trong tòa này."
- **BR-MT-07. Danh sách thiết bị** (theo demo `ItemsPage`, bỏ các phần cần kế hoạch):
  - **Thẻ số:** Thiết bị (đang dùng), Cần xử lý, Đang sửa chữa.
  - **Lọc nhanh:** Tất cả, Cần xử lý, Đang sửa chữa, Sắp hết bảo hành.
  - **Bộ lọc:** tìm theo mã hoặc tên (không dấu), tòa, loại, "Gồm thiết bị đã ngừng".
  - **Sắp xếp:** theo mã hoặc tên.
  - **Phân trang:** có.
  - **"Cần xử lý"** khi có một trong ba: có hồ sơ sửa chữa đang mở, tình trạng "Cần chú ý", hoặc bảo hành sắp hết (BR-MT-11).
  - **"Đang sửa chữa"** khi có ít nhất một hồ sơ sửa chữa gắn thiết bị mà chưa kết thúc.
- **BR-MT-08. Trang thiết bị:**
  - **Đầu trang:** mã, tên, vị trí, tình trạng, trạng thái dùng hoặc ngừng.
  - **Thẻ số:** Số lần sửa chữa, Chi phí đã duyệt, Đang sửa chữa, Bảo hành (còn bao nhiêu ngày, hoặc đã hết, hoặc không có).
  - **Tab:** Tổng quan, Sửa chữa, Tài liệu, Lịch sử thay đổi. **Không** có tab "Bảo trì" ở chế độ `api`.
  - **Tab "Sửa chữa":** mỗi hồ sơ sửa chữa gắn thiết bị một dòng, gồm mã, tên, ngày tạo, trạng thái, chi phí đã duyệt (nếu có). Bấm vào để mở hồ sơ.
  - **Số lần sửa chữa:** số hồ sơ gắn thiết bị đã được gửi đi, tức không còn là nháp, trừ hồ sơ "Đóng vì không cần sửa" và "Đóng do rút hồ sơ".
  - **Chi phí đã duyệt:** tổng số tiền đã duyệt của các hồ sơ gắn thiết bị (trường `approved_amount_vnd` của hồ sơ, có sau khi tờ trình được duyệt xong). Mỗi hồ sơ tính **một lần**; lần trình bị từ chối không tính. Tiền hiện theo cách định dạng chung (`12.500.000 đ`), và tính bằng số nguyên, không dùng số thực.
  - **Khối "Cần chú ý"** liệt kê theo BR-MT-07: hồ sơ đang mở, tình trạng "Cần chú ý", bảo hành sắp hết hoặc đã hết.
- **BR-MT-09. Gắn thiết bị vào hồ sơ sửa chữa:**
  - Khi tạo hoặc sửa nháp, ở trạng thái `DRAFT` hoặc `NEEDS_RECORD_UPDATE`, BQL chọn **một** trong hai: một thiết bị đang dùng của **cùng tòa**, hoặc "Không thuộc thiết bị cụ thể".
  - Chọn thiết bị mà chưa chọn vị trí thì vị trí lấy theo thiết bị, như demo.
  - Vị trí của hồ sơ **được phép khác** vị trí của thiết bị, ví dụ ống của bơm hầm bị rò ở tầng 1.
  - Gửi hồ sơ (T02) mà chưa chọn một trong hai thì báo lỗi ở trường thiết bị, như hiện nay.
  - Chọn thiết bị khác tòa, thiết bị đã ngừng, hoặc thiết bị không tồn tại thì báo lỗi ở trường thiết bị.
  - Sau bước xác nhận, thiết bị của hồ sơ không đổi được nữa.
- **BR-MT-10. Hồ sơ cũ:** mọi hồ sơ đã có đều giữ "Không thuộc thiết bị cụ thể". Không gắn ngược thiết bị cho hồ sơ cũ. Chi tiết hồ sơ hiện thiết bị kèm liên kết sang trang thiết bị, nếu hồ sơ có thiết bị.
- **BR-MT-11. Bảo hành:**
  - "Sắp hết" khi còn ≤ 30 ngày (MQ-05), tính theo ngày giờ Việt Nam.
  - "Đã hết" khi đã qua ngày bảo hành.
  - "Không có" khi không nhập ngày bảo hành.
  - Ngưỡng 30 ngày đặt ở một chỗ, để MT-S4 chuyển thành cấu hình theo tòa.
- **BR-MT-12. Seed demo:** thêm thiết bị cho các tòa demo theo `mock/seed-maintenance.ts`.
  - Chỉ thêm khi chưa có, dựa theo mã, như cách seed hiện có. Chỉ chạy khi bật seed demo, **không bao giờ ở production**.
  - Có ít nhất một thiết bị bảo hành còn ≤ 30 ngày, và một thiết bị đã hết bảo hành, để thấy được cảnh báo.

## 4. Tiêu chí nghiệm thu

Dữ liệu dùng tòa mẫu và tài khoản demo: `bql-a` (tòa A), `bql-b` (tòa B), một KT và một tài khoản chỉ xem.

**Thiết bị**
- **AC-MT.1** GIVEN `bql-a`, WHEN tạo thiết bị "BOM-A09 · Bơm tăng áp" ở tòa A, Tầng hầm, người phụ trách là `bql-a`, bảo hành đến sau hôm nay 20 ngày, THEN thiết bị có trong danh sách tòa A, có tình trạng "Chưa rõ", có cờ "Sắp hết bảo hành", và có một dòng nhật ký tạo.
- **AC-MT.2** GIVEN BOM-A09 đã có ở tòa A, WHEN tạo thêm "BOM-A09" ở tòa A, THEN bị từ chối ở trường mã với câu của BR-MT-06. Tạo "BOM-A09" ở tòa B thì được (người tạo có phạm vi tòa B).
- **AC-MT.3** WHEN sửa BOM-A09 mà gửi kèm mã "BOM-X", THEN mã vẫn là BOM-A09, còn các trường khác được lưu. Kiểm ở cả API và chế độ `mock`.
- **AC-MT.4** GIVEN `bql-b`, THEN không thấy BOM-A09 của tòa A trong danh sách. Mở thẳng đường dẫn của nó thì nhận "Không tìm thấy" (404).
- **AC-MT.5** GIVEN tài khoản chỉ xem, THEN xem được danh sách và trang thiết bị, nhưng không có nút tạo, sửa, ngừng dùng hay tải tài liệu. Gọi thẳng API ghi thì nhận 403.
- **AC-MT.6** Ngừng dùng BOM-A09 với lý do: thiết bị biến khỏi danh sách mặc định, hiện lại khi bật "Gồm thiết bị đã ngừng", không chọn được ở form hồ sơ mới. "Dùng lại" với lý do: thiết bị chọn được trở lại. Cả hai lần đều có nhật ký kèm lý do.
- **AC-MT.7** Đổi tình trạng từ "Chưa rõ" sang "Cần chú ý" với ghi chú: thiết bị có cờ "Cần xử lý", và tab "Lịch sử thay đổi" có dòng "Chưa rõ → Cần chú ý", kèm ghi chú, người đổi và thời điểm.
- **AC-MT.8** Tải tài liệu PDF "Hướng dẫn BOM-A09.pdf": tài liệu hiện ở tab "Tài liệu" với đúng tên gốc, mở và tải xuống được (theo AT-S1).

**Gắn với hồ sơ sửa chữa**
- **AC-MT.9** GIVEN BQL tạo hồ sơ sửa chữa ở tòa A, chọn thiết bị BOM-A09, chưa chọn vị trí, THEN vị trí tự điền là Tầng hầm. Hồ sơ gửi được. Chi tiết hồ sơ hiện "BOM-A09 · Bơm tăng áp" kèm liên kết sang trang thiết bị.
- **AC-MT.10** Hồ sơ chọn "Không thuộc thiết bị cụ thể" vẫn gửi được như hiện nay. Hồ sơ chưa chọn gì thì gửi bị từ chối ở trường thiết bị.
- **AC-MT.11** Gọi API sửa nháp với thiết bị của tòa B cho một hồ sơ tòa A, hoặc với thiết bị đã ngừng: bị từ chối ở trường thiết bị.
- **AC-MT.12** GIVEN BOM-A09 có 3 hồ sơ gắn vào: H1 đã hoàn tất với tờ trình được duyệt 12.500.000 đ; H2 đang thi công với tờ trình được duyệt 4.000.000 đ, trước đó lần trình 1 bị từ chối 6.000.000 đ; H3 còn nháp. THEN trang BOM-A09 hiện:
  - "Số lần sửa chữa: 2";
  - "Chi phí đã duyệt: 16.500.000 đ";
  - "Đang sửa chữa: 1";
  - tab "Sửa chữa" có H1 và H2, không có H3.
- **AC-MT.13** Hồ sơ cũ trên dữ liệu dev (tạo trước slice) vẫn mở được, và vẫn ghi "Không thuộc thiết bị cụ thể".

**Chung**
- **AC-MT.14** Ở chế độ `api`, menu có mục "Thiết bị" mở được danh sách thật. Kế hoạch, Lịch bảo trì và trang lượt bảo trì vẫn không hiện ở menu.
- **AC-MT.15** Seed demo tạo đủ các thiết bị theo BR-MT-12 trên một DB mới; chạy lại seed lần hai không tạo trùng.
- **AC-MT.16** Các trạng thái loading, rỗng, lỗi, offline, accessibility và responsive đúng như brief §3–§4. Chế độ `mock` vẫn chạy, các test hiện có của thiết bị và hồ sơ vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] e2e API thiết bị: tạo, mã trùng theo tòa, sửa có mã khác, ngừng dùng và dùng lại, tình trạng, tài liệu, phạm vi tòa và vị trí, 403 với người chỉ xem, khóa phiên bản.
- [ ] e2e API hồ sơ sửa chữa: gắn thiết bị, các ca bị từ chối của BR-MT-09, hồ sơ cũ, số liệu của AC-MT.12.
- [ ] Migration chạy được trên DB đã có dữ liệu (`qltn_dev`); chạy lại không lỗi.
- [ ] Test component: danh sách thiết bị (lọc nhanh, cờ), trang thiết bị (thẻ số, tab), form hồ sơ chọn thiết bị ở chế độ `api`.
- [ ] Ảnh chụp ở chế độ `api`: danh sách, trang thiết bị, form hồ sơ có chọn thiết bị, và màn rộng 375px. Chạy một phiên dev server.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-MT-1 | Số lần sửa chữa = số hồ sơ đã gửi, trừ "Đóng vì không cần sửa" và "Đóng do rút hồ sơ" | Nháp và hồ sơ rút chưa phải sự cố đã ghi nhận; "không cần sửa" nghĩa là thiết bị không hỏng |
| D-MT-2 | Chi phí đã duyệt = tổng số tiền đã duyệt của các hồ sơ, mỗi hồ sơ một lần | Đúng chữ "Chi phí duyệt" ở D1 tr. 24. Số đã thanh toán làm cùng báo cáo B18 |
| D-MT-3 | Vị trí của hồ sơ được khác vị trí của thiết bị | Hư hỏng có thể nằm ở chỗ khác chỗ đặt thiết bị (đường ống, dây dẫn) |
| D-MT-4 | Thiết bị không đổi được tòa | Đổi tòa sẽ kéo theo phạm vi xem của mọi hồ sơ đã gắn. Chuyển thiết bị sang tòa khác thì ngừng dùng thiết bị cũ và tạo mới |
| D-MT-5 | Có thêm "Dùng lại" thiết bị (demo không có) | Ngừng dùng nhầm thì không có đường sửa (MG-10) |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích maintenance (PD-24). |
| 27/10/2026 | Chủ dự án duyệt (PD-25), gồm D-MT-1 đến D-MT-5, và cho giao dev-build. |
| 27/10/2026 | Review PASS WITH RESIDUE trên `0202f29`; PM/BA đóng slice. Chờ chủ dự án cho merge (migration `2026-10-27c-maintenance-items.sql`). |
