---
id: B04.S1
title: Lịch thi công đọc dữ liệu thật
status: Đã duyệt
owner: PM/BA
intent: "BQL và các bên xem được việc thi công nào đang chạy trong ngày, tuần, tháng của mỗi tòa từ dữ liệu thật, để điều phối và nhận ra việc trễ."
depends_on: []
---

# SPEC: Lịch thi công đọc dữ liệu thật (B4-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-21), gồm 4 mặc định D-B4-1 đến D-B4-4 ở §6

**Nguồn:**
- Phân tích [B04-lich-sua-chua.md](../../modules/B04-lich-sua-chua.md), đã duyệt (PD-18): B4G-01 đến B4G-05, B4G-07; mặc định B4Q-01 đến B4Q-04 (OD-20).
- D2 nhóm 04: "Xem công việc theo ngày, tuần, tháng hoặc danh sách; tra cứu thời điểm và người phụ trách để điều phối xử lý." D1 tr. 18.
- Thứ tự SPEC đã chốt ở PD-18: B06-S1 → B7-S1 → **B4-S1**.

**Nền:** dữ liệu thi công của SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md) (S3, bảng `repair_constructions`: ngày bắt đầu, ngày dự kiến xong, ngày hoàn thành, tiến độ) và hồ sơ khẩn cấp của [B06-S1](../B06-xu-ly-khan-cap/SPEC.md) (thi công bắt đầu ngay khi được cho làm trước).

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Ở chế độ `api`, menu "Lịch sửa chữa" vẫn hiện nhưng mở ra màn "chưa nối API" (B4G-01). Bản demo có lịch, nhưng sai ở ba chỗ:
- Một đợt thi công nhiều ngày chỉ hiện ở ngày bắt đầu. Việc bắt đầu tuần trước và còn chạy tuần này thì không thấy ở tuần này (B4G-03).
- Số đếm của tuần/tháng tính cả hồ sơ không được vẽ trên lưới (B4G-02).
- Hồ sơ đã thi công xong, đang chờ nghiệm thu hay thanh toán, vẫn bị tô đỏ là trễ (B4G-04).

Sau slice này, lịch đọc dữ liệu thi công thật, mỗi đợt thi công hiện ở mọi ngày nó chiếm, và cờ trễ chỉ bật cho việc thật sự chưa xong.

Slice này **chỉ xem**. Lịch theo ngày, không theo giờ. Không giao người thực hiện (B4Q-01, mặc định: không).

**Người dùng:**
- Chính: BQL điều phối việc thi công của tòa mình.
- Phụ: TVKT, BQT và người xác nhận tra cứu việc nào đang thi công, ở đâu, nhà thầu nào.

**User story:**
- Là BQL, tôi muốn thấy mọi việc thi công đang chạy trong tuần này, kể cả việc bắt đầu từ tuần trước, để biết nhà thầu nào đang có mặt ở đâu.
- Là BQL, tôi muốn biết ngay việc nào đã quá ngày dự kiến xong mà chưa xong, để nhắc nhà thầu.
- Là BQL, tôi muốn thấy các hồ sơ đã được duyệt nhưng chưa bắt đầu thi công, để xếp ngày cho chúng.

## 2. Phạm vi

**Trong phạm vi:**
1. Ở chế độ `api`, menu "Lịch sửa chữa" mở màn lịch đọc dữ liệu thật.
2. Ba kiểu xem, giữ như demo: **Danh sách** (có phân trang), **Tuần** (Thứ 2 – Chủ nhật), **Tháng**.
3. Bộ lọc: tòa, vị trí (theo tòa đã chọn), nhóm trạng thái, khoảng ngày. Lọc theo khoảng ngày dùng quy tắc **giao nhau** (BR-B4-02).
4. Cờ **Trễ thi công** (BR-B4-04) và cờ **Khẩn cấp** cho hồ sơ của B06.
5. Mục riêng **"Chờ xếp lịch"**: hồ sơ đã được duyệt nhưng chưa bắt đầu thi công (BR-B4-05).
6. Bấm một mục để mở chi tiết hồ sơ.
7. Một API đọc mới cho lịch. Dữ liệu đã có từ S3, nên **không cần migration**. Dev-build tự chọn hình dạng endpoint; đọc thêm ở §3.

**Ngoài phạm vi:**
- Thẻ tổng (đang thi công, bắt đầu hôm nay, trễ thi công, chờ nghiệm thu) và mốc nghiệm thu trên lịch: làm ở **B4-S2** (B4G-09).
- Xếp lịch theo giờ, giao người thực hiện, xung đột giờ, nút "Lưu lịch xử lý", xuất PDF lịch tuần: **B4-S3**, chỉ làm nếu khách cần (B4G-06, B4G-08, B4Q-01).
- Hạn xử lý của từng bước duyệt trên lịch (B4G-05, B4Q-03): làm ở B02 Công việc cá nhân.
- Lịch chung sửa chữa và bảo trì (B4G-07, B4Q-02): lịch này chỉ gồm hồ sơ sửa chữa và khẩn cấp; lịch bảo trì B14 giữ màn riêng.
- Sửa ngày thi công từ lịch. Đổi ngày vẫn đi qua màn thi công trong chi tiết hồ sơ (S3).
- Cờ "Cần phân công lại" của demo. API chưa có dữ liệu này cho lịch.
- Chế độ `mock`: lịch demo phải vẫn chạy và test hiện có vẫn đạt. **Không bắt buộc** sửa B4G-02 đến B4G-04 trong `mock`. Nếu dev-build dùng chung một hàm tính cho cả hai chế độ thì càng tốt, nhưng phải ghi vào bằng chứng.

## 3. Quy tắc nghiệp vụ

- **BR-B4-01. Mục trên lịch.** Mỗi hồ sơ **đã bắt đầu thi công** (có dòng thi công của S3, kể cả hồ sơ khẩn cấp của B06) là một mục. Mục chiếm một **khoảng ngày**:
  - **Ngày đầu** là ngày bắt đầu thi công.
  - **Ngày cuối** được tính như sau:

    | Tình trạng | Ngày cuối |
    |---|---|
    | Đã có ngày hoàn thành, và hồ sơ không ở "Cần khắc phục" | ngày hoàn thành |
    | Chưa có ngày hoàn thành, hồ sơ chưa kết thúc, ngày dự kiến xong ≥ hôm nay | ngày dự kiến xong |
    | Chưa có ngày hoàn thành, hồ sơ chưa kết thúc, ngày dự kiến xong < hôm nay | **hôm nay**: việc vẫn đang chạy, và đã trễ (BR-B4-04) |
    | Hồ sơ ở "Cần khắc phục" (nghiệm thu không đạt, đang làm lại) | **hôm nay** hoặc ngày dự kiến xong, lấy ngày muộn hơn |
    | Hồ sơ đã kết thúc (`COMPLETED` hoặc nhóm `CLOSED`) mà không có ngày hoàn thành | ngày dự kiến xong |

  - Ngày tính theo giờ Việt Nam.
- **BR-B4-02. Lọc theo khoảng ngày:** một mục khớp khi khoảng ngày của nó **giao** với khoảng đang xem, tức là ngày đầu ≤ ngày cuối của khoảng xem, và ngày cuối ≥ ngày đầu của khoảng xem. Ví dụ: đợt 20/11 – 26/11 có mặt ở tuần 17/11 – 23/11 và ở tuần 24/11 – 30/11.
  - Ở kiểu Danh sách, khoảng ngày là bộ lọc "Từ ngày" / "Đến ngày". Để trống thì không lọc theo ngày.
  - Ở kiểu Tuần và Tháng, khoảng ngày là tuần hoặc tháng đang xem. Bộ lọc "Từ ngày" / "Đến ngày" không áp dụng cho hai kiểu này, nên ẩn đi.
- **BR-B4-03. Các bộ lọc khác** (tòa, vị trí, nhóm trạng thái) có cùng nghĩa với `GET /records`. Nhóm trạng thái dùng đúng bảng nhóm hiện có (`record-status-groups.ts`), gồm cả các trạng thái mới của B06.
- **BR-B4-04. Trễ thi công:** một mục bị gắn cờ "Trễ thi công" khi đủ 3 điều kiện:
  - chưa có ngày hoàn thành;
  - hồ sơ chưa kết thúc và không ở "Cần khắc phục";
  - ngày dự kiến xong < hôm nay (giờ Việt Nam).

  Hồ sơ đã có ngày hoàn thành **không bao giờ** bị gắn cờ trễ, kể cả khi đang chờ nghiệm thu hay thanh toán. Hồ sơ ở "Cần khắc phục" cũng không bị gắn cờ, vì hệ thống chưa có hạn cho việc làm lại.
- **BR-B4-05. Chờ xếp lịch:** hồ sơ ở trạng thái `READY_FOR_CONSTRUCTION`, nhãn "Chờ thi công" (đã duyệt xong, chưa bấm bắt đầu thi công). Các hồ sơ này **không** có trên lưới tuần/tháng và không nằm trong danh sách lịch. Chúng nằm ở một mục riêng, theo bộ lọc tòa và vị trí đang chọn. Hồ sơ ở các bước trước nữa chưa đến lúc xếp lịch, nên không hiện.
- **BR-B4-06. Số đếm** của tuần hoặc tháng là **số hồ sơ khác nhau** có mặt trên lưới. Một đợt kéo dài 3 ngày vẫn chỉ tính là 1. Số này phải khớp đúng với những gì được vẽ.
  - Nếu tuần hoặc tháng có nhiều mục hơn mức API trả về một lần, màn hình phải báo rõ là "đang hiện n trên tổng m". Không được âm thầm cắt bớt. Mức trần do dev-build chọn và ghi vào bằng chứng.
- **BR-B4-07. Thông tin của mỗi mục:**
  - mã và tên hồ sơ;
  - tòa, tầng, vị trí;
  - nhà thầu thực hiện (nếu có);
  - BQL của hồ sơ;
  - khoảng ngày "dd/mm – dd/mm"; nếu đã xong thì thêm "xong dd/mm";
  - tiến độ %;
  - trạng thái;
  - các cờ "Trễ thi công" và "Khẩn cấp".

  Kiểu Tuần và Tháng chỉ cần mã, tên, trạng thái và cờ; phần còn lại hiện ở kiểu Danh sách (xem brief).
- **BR-B4-08. Sắp xếp:** Danh sách xếp theo ngày bắt đầu thi công tăng dần, cùng ngày thì theo mã hồ sơ. Mục "Chờ xếp lịch" xếp theo thời điểm hồ sơ vào trạng thái "Chờ thi công" (lấy từ lịch sử hồ sơ), cũ nhất lên đầu.
- **BR-B4-09. Quyền và phạm vi:** ai xem được danh sách hồ sơ thì xem được lịch, chỉ trong các tòa thuộc phạm vi của mình. Không thêm quyền mới. Gửi `buildingId` của tòa ngoài phạm vi thì nhận danh sách rỗng, giống `GET /records`.

## 4. Tiêu chí nghiệm thu

Dữ liệu dùng tòa mẫu AQUA và các tài khoản demo. Trong test, "hôm nay" được cố định. Các ngày dưới đây chỉ là ví dụ; dev-build dùng ngày tương đối theo "hôm nay" khi dựng dữ liệu.

**Vào màn lịch**
- **AC-B4.1** GIVEN web chạy ở chế độ `api`, WHEN `bql-a` bấm menu "Lịch sửa chữa", THEN màn lịch mở ra với dữ liệu thật, không còn màn "chưa nối API".

**Khoảng ngày**
- **AC-B4.2** GIVEN hồ sơ A thi công 20/11 – 26/11, chưa xong, hôm nay 21/11:
  - WHEN xem tuần 24/11 – 30/11, THEN A có mặt ở các ngày 24, 25, 26.
  - WHEN xem tuần 17/11 – 23/11, THEN A có mặt ở các ngày 20 đến 23.
  - WHEN ở kiểu Danh sách lọc "Từ ngày" 24/11, THEN A có trong danh sách.
- **AC-B4.3** GIVEN hồ sơ B dự kiến xong 22/11, chưa có ngày hoàn thành, hôm nay 25/11, WHEN xem tuần 24/11 – 30/11, THEN B có mặt ở 24 và 25, có cờ "Trễ thi công"; ngày 26 trở đi không có B.

**Cờ trễ**
- **AC-B4.4** GIVEN hồ sơ C dự kiến xong 22/11, đã gửi nghiệm thu với ngày hoàn thành 22/11, đang ở "Chờ nghiệm thu", hôm nay 25/11, THEN C **không** có cờ "Trễ thi công" và chỉ có mặt đến ngày 22/11. Kết quả như nhau khi C đang ở các bước thanh toán.
- **AC-B4.5** GIVEN hồ sơ D ở "Cần khắc phục", THEN D không có cờ trễ và có mặt trên lịch đến hôm nay.

**Số đếm và chờ xếp lịch**
- **AC-B4.6** GIVEN tuần đang xem có 3 hồ sơ đang thi công, một trong số đó kéo dài 4 ngày, THEN số đếm ghi đúng "3 hồ sơ", và lưới có đúng 3 hồ sơ khác nhau.
- **AC-B4.7** GIVEN hồ sơ E ở `READY_FOR_CONSTRUCTION`, THEN E không có trên lưới tuần/tháng và không có trong danh sách lịch, mà có trong mục "Chờ xếp lịch". Khi BQL bắt đầu thi công E từ hôm nay, E rời mục "Chờ xếp lịch" và có mặt trên lịch từ hôm nay. Kiểm bằng cách tải lại màn lịch.
- **AC-B4.8** GIVEN hồ sơ khẩn cấp F được cho làm trước (B06-S1), THEN F có mặt trên lịch từ ngày được cho làm, có cờ "Khẩn cấp".

**Lọc và phạm vi**
- **AC-B4.9** Lọc theo vị trí và theo nhóm trạng thái chọn ra đúng các hồ sơ mà `GET /records` chọn với cùng bộ lọc, trong số các hồ sơ có mặt ở khoảng ngày đang xem.
- **AC-B4.10** GIVEN `bql-b` chỉ có phạm vi tòa B, THEN lịch không có hồ sơ nào của tòa A, kể cả khi gọi API với `buildingId` của tòa A (danh sách rỗng). Mục "Chờ xếp lịch" cũng theo đúng phạm vi đó.

**Giao diện**
- **AC-B4.11** Các trạng thái loading, rỗng, lỗi, offline và responsive đúng như brief §3–§4. Mục trên lịch mở được bằng bàn phím và có tên đọc được cho trình đọc màn hình theo brief.
- **AC-B4.12** Chế độ `mock` vẫn mở được lịch demo, test hiện có của lịch vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test cho phần tính khoảng ngày, giao nhau và cờ trễ (BR-B4-01, 02, 04), gồm các ca: chưa xong và chưa quá hạn; chưa xong và đã quá hạn; đã xong; "Cần khắc phục"; đã kết thúc mà không có ngày hoàn thành; khoảng ngày chạm đúng mép tuần.
- [ ] e2e API cho endpoint lịch: lọc giao nhau, phạm vi tòa (AC-B4.10), "Chờ xếp lịch", bộ lọc vị trí và nhóm trạng thái so với `GET /records`.
- [ ] Test component cho kiểu Tuần và Tháng: đợt nhiều ngày có mặt ở mỗi ngày, số đếm (AC-B4.6), cờ trễ.
- [ ] Ảnh chụp màn lịch ở chế độ `api` (Danh sách, Tuần, Tháng, và màn rộng 375px), chạy một phiên dev server.

## 6. Mặc định PM/BA dùng trong SPEC này

Đây là các giả định, vì chưa có khách để hỏi (PD-06). Chủ dự án có thể đổi khi duyệt.

| ID | Mặc định | Lý do |
|---|---|---|
| D-B4-1 | Việc chưa xong mà đã quá ngày dự kiến xong thì kéo dài trên lịch đến hôm nay | Việc vẫn đang chạy. Nếu dừng ở ngày dự kiến xong, việc trễ sẽ biến khỏi tuần hiện tại, đúng lúc cần nhắc nhất |
| D-B4-2 | "Cần khắc phục" kéo dài đến hôm nay và không bị gắn cờ trễ | Hệ thống chưa có hạn cho việc làm lại (S3 chỉ có một ngày dự kiến xong) |
| D-B4-3 | "Chờ xếp lịch" chỉ gồm `READY_FOR_CONSTRUCTION` | Đây là lúc BQL cần xếp ngày. Hồ sơ ở các bước trước chưa đến lúc xếp lịch; hạn của chúng thuộc B02 |
| D-B4-4 | Kiểu Tuần và Tháng không dùng bộ lọc "Từ ngày" / "Đến ngày" | Tránh hai khoảng ngày chồng nhau gây khó hiểu; tuần hoặc tháng đang xem đã là khoảng ngày |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích B04 (PD-18). |
| 27/10/2026 | Chủ dự án duyệt (PD-21), gồm D-B4-1 đến D-B4-4, và cho giao dev-build. |
