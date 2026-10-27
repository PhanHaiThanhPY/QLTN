---
id: B07.S1
title: Bản xem và in theo mẫu D5
status: Đã duyệt
owner: PM/BA
intent: "Mỗi tờ trình, biên bản nghiệm thu và thư đề nghị thanh toán có bản A4 in được theo đúng mẫu khách đang dùng, lấy từ dữ liệu và chữ ký đã có."
depends_on: []
---

# SPEC: Bản xem và in theo mẫu D5 (B7-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-20), gồm 3 lựa chọn: không in chức danh; "Kính gửi" tự điền BQT tòa; đợt quyết toán 0 đồng không có thư đề nghị

**Nguồn:**
- Phân tích [B07-ky-va-bieu-mau.md](../../modules/B07-ky-va-bieu-mau.md), đã duyệt (PD-18): B7G-01, B7G-02, B7G-07; các mặc định B7Q-01, B7Q-04.
- DF-07, DF-18. D2 nhóm 07: "xem bộ biểu mẫu hồ sơ theo nghiệp vụ". D1 tr. 21.
- Mẫu gốc trong `sources/customer/D5-bieu-mau/`:
  - `Số tờ trình.docx`
  - `BIÊN BẢN NGHIỆM THU.docx`
  - `BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`: thực chất là **thư đề nghị thanh toán**, dù tên tệp không nói vậy.

**Nền:** dữ liệu tờ trình, nghiệm thu, thanh toán và chữ ký của SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md) §4.1–4.4.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

BQL và BQT hiện vẫn làm tờ trình, biên bản và thư đề nghị bằng Word theo mẫu D5, dù hệ thống đã giữ đủ dữ liệu và chữ ký. Ở chế độ `api` chưa có bản xem hay bản in nào (B7G-01). Bản demo có một bản in, nhưng bố cục tự đặt, không theo mẫu D5 (B7G-02).

Sau slice này, từ chi tiết hồ sơ, người dùng mở được từng tài liệu đúng mẫu D5 và in ra A4 hoặc lưu PDF bằng trình duyệt.

**Người dùng:**
- Chính: BQL in hồ sơ để trình ký hoặc lưu.
- Phụ: BQT, TVKT và kế toán xem lại tài liệu đã ký.

**User story:**
- Là BQL, tôi muốn in tờ trình của từng lần trình theo đúng mẫu đang dùng, để không phải gõ lại trong Word.
- Là BQT, tôi muốn xem biên bản nghiệm thu từng lượt kèm chữ ký các bên, để đối chiếu trước khi duyệt thanh toán.
- Là kế toán, tôi muốn có thư đề nghị của từng đợt với số tiền bằng số và bằng chữ, để chuyển khoản đúng.

## 2. Phạm vi

**Trong phạm vi:**
1. Tab **"Biểu mẫu"** trong chi tiết hồ sơ ở chế độ `api`: liệt kê mọi tài liệu in được của hồ sơ (BR-B7-01).
2. Bản xem A4 cho 3 loại tài liệu, theo bố cục mẫu D5:
   - tờ trình: một bản cho mỗi lần trình;
   - biên bản nghiệm thu: một bản cho mỗi lượt;
   - thư đề nghị thanh toán: một bản cho mỗi đợt tạm ứng hoặc quyết toán.
3. In hoặc lưu PDF bằng chức năng in của trình duyệt, khổ A4 dọc.
4. Trường nào hệ thống chưa có thì in dòng chấm như trên mẫu (BR-B7-03).

**Ngoài phạm vi:**
- Thêm trường mới: số tờ trình, ý kiến BQT khi duyệt, chức danh và tên tổ chức trong khối ký, "Kính gửi" và "Ghi chú" do người dùng nhập, chữ ký cột "Khác" (B7G-03). Lưu bản chụp mỗi lần sửa đợt thanh toán (B7G-04). Các việc này làm ở **B7-S2**.
- Thông báo chào thầu, mã băm nội dung lúc ký, tạo PDF phía máy chủ (B7G-05, 06): làm ở **B7-S3**.
- Màn tổng hợp "Ký và biểu mẫu" riêng như D1 tr. 21. Tab ở chi tiết hồ sơ là đủ (B7G-07).
- Chữ ký số.
- Xuất Word.
- Chế độ `mock`: giữ nút "Xem bộ biểu mẫu" của demo như hiện tại.
- **Không đổi API ghi** và không thêm migration. Nếu chi tiết hồ sơ còn thiếu một giá trị chỉ để đọc mà bản in cần (ví dụ họ tên người ký), dev-build được bổ sung vào view đọc của `GET /records/:id` và ghi lại vào phần bằng chứng.

## 3. Quy tắc nghiệp vụ

- **BR-B7-01. Danh sách tài liệu trong tab "Biểu mẫu"**, theo thứ tự thời gian:
  - **Tờ trình lần N:** mỗi lần trình đã gửi có một dòng. Nháp chưa trình thì không có dòng.
  - **Biên bản nghiệm thu lượt N:** mỗi lượt đã gửi nghiệm thu (T12, T16) có một dòng.
  - **Thư đề nghị thanh toán:** mỗi đợt đã gửi có một dòng, gồm cả tạm ứng và quyết toán. Đợt nháp thì không có dòng.
    - Đợt quyết toán **0 đồng** (FX-S2) không có thư đề nghị, vì không có khoản chuyển nào. Dòng của đợt này ghi "Không cần thư đề nghị: số của đợt bằng 0".
  - Mỗi dòng hiện: tên tài liệu, ngày, trạng thái ("Đã duyệt", "Chờ duyệt", "Bị từ chối", "Cần bổ sung", "Đạt", "Không đạt", "Đang nghiệm thu"), số chữ ký đã có trên tổng số ô ký, và nút **Xem / In**.
  - Hồ sơ chưa có tài liệu nào thì tab hiện dòng rỗng theo brief.
- **BR-B7-02. Quyền xem:** ai mở được chi tiết hồ sơ thì xem và in được mọi tài liệu của hồ sơ đó, như các dữ liệu khác trong chi tiết. Không cần quyền mới. Người ngoài phạm vi tòa nhận 404, như `GET /records/:id`.
- **BR-B7-03. Trường thiếu:** in dòng chấm `……………` đúng như trên mẫu. Không được in `undefined`, `null`, `—` hay để trống không có dấu.
- **BR-B7-04. Bản chưa có hiệu lực:**
  - Tài liệu chưa duyệt xong thì có chữ chìm chéo trang.
    - Tờ trình chưa được bước cuối duyệt, hoặc đã bị từ chối hay yêu cầu bổ sung: chữ chìm "CHƯA PHÊ DUYỆT".
    - Biên bản có lượt chưa đủ quyết định: chữ chìm "CHƯA HOÀN TẤT".
    - Thư đề nghị chưa được chuỗi PAYMENT duyệt xong: chữ chìm "CHƯA PHÊ DUYỆT".
  - Chữ chìm có trên cả màn hình lẫn bản in.
- **BR-B7-05. Chữ ký trên bản in:**
  - Ở mỗi ô ký có dữ liệu: ảnh chữ ký, họ tên người ký, và dòng nhỏ "Ký trên hệ thống QLTN lúc HH:mm dd/mm/yyyy". Dòng này thay cho chữ "(Đã ký)" của mẫu.
  - Ô ký chưa có dữ liệu thì để trống, đủ chỗ cho người ký tay.
  - Chức danh như "TRƯỞNG BAN" hay "GIÁM ĐỐC" **không** được in theo mặc định, vì người ký thật có thể không giữ chức danh đó. In dòng chấm thay vào (BR-B7-03); B7-S2 sẽ bổ sung chức danh.
- **BR-B7-06. Chân trang mỗi trang in:** "Bản in từ hệ thống QLTN · «mã hồ sơ» · «tên tài liệu» · in lúc «dd/mm/yyyy HH:mm» · trang X/Y". Theo B7Q-01, bản in dùng để lưu và trình xem; văn bản chính thức vẫn ký ngoài hệ thống. Chân trang **không** ghi thêm câu nào về giá trị pháp lý.
- **BR-B7-07. Tiền và ngày:**
  - Tiền in theo dạng `12.500.000`, kèm đơn vị như trên mẫu ("VNĐ" hoặc "đ"). Số bằng chữ dùng đúng hàm của S4 (`web/domain/payment.ts`).
  - Ngày in `dd/mm/yyyy` theo giờ Việt Nam. Riêng các dòng "Ngày … tháng … năm …" in theo đúng chữ của mẫu.

### 3.1 Tờ trình: gán trường vào mẫu `Số tờ trình.docx`

| Mục trên mẫu | Lấy từ | Ghi chú |
|---|---|---|
| Số tờ trình | — | dòng chấm (B7-S2) |
| Kính gửi, Người trình, Người làm tờ trình, Thẩm định nội dung, Loại tờ trình, Ngân sách, Ngày trình, Lần trình thứ | lần trình (§4.1) | Ngày trình là ngày gửi lần đó |
| Nội dung tờ trình | tên hồ sơ | giả định; mẫu ghi "tương tự" |
| NỘI DUNG XIN PHÊ DUYỆT | nội dung xin phê duyệt (§4.1) | |
| Cơ sở xin phê duyệt | **đoạn chữ cố định** chép nguyên văn từ mẫu (căn cứ Điều 34, 37 Thông tư 05/2024/TT-BXD). Dòng "Căn cứ theo biên bản ghi nhận sự việc (đính kèm)" chỉ in khi có tệp `INCIDENT_MINUTES` | |
| Bảng báo giá | báo giá của lần trình (§4.2) | Mẫu có 3 cột nhà thầu. Có 4–5 nhà thầu thì tách thành 2 bảng nối nhau (nhà thầu 1–3, rồi 4–5), mỗi bảng có lại cột Hạng mục. Mỗi nhà thầu có dòng Chi phí, Thuế, Tổng tiền |
| B. Đề xuất & đánh giá | "Kính trình Ban Quản Trị phê duyệt chi phí «tên hồ sơ» do đơn vị «nhà thầu đề xuất» thực hiện với chi phí: «tổng của nhà thầu đề xuất» (đã bao gồm VAT)", sau đó là phần "Đánh giá" (§4.1) | Dòng "BQT có thể lựa chọn đơn vị cung cấp khác…" chép nguyên văn từ mẫu |
| Các vấn đề cần lưu ý | đoạn chữ của mẫu, với "trước ngày" lấy hạn mong muốn duyệt | |
| Hồ sơ đính kèm | đánh dấu ✓ cho "Báo giá của nhà thầu" (có `QUOTATION`) và "Biên bản ghi nhận sự việc" (có `INCIDENT_MINUTES`) | |
| Ý KIẾN CỦA BAN QUẢN TRỊ | lý do từ chối hoặc yêu cầu bổ sung của lần trình đó; nếu duyệt với nhà thầu khác thì là lý do chọn nhà thầu khác; ngoài ra là dòng chấm | |
| Khối ký trái "TM. BAN QUẢN TRỊ / TÒA NHÀ «tên tòa»" | chữ ký ở bước BOARD của lần trình đó (BR-B7-05) | |
| Khối ký phải "TM. BAN QUẢN LÝ / ……" | chữ ký BQL lúc trình | Tên tổ chức BQL là dòng chấm (B7Q-06, làm ở B7-S2) |

### 3.2 Biên bản nghiệm thu: gán trường vào mẫu `BIÊN BẢN NGHIỆM THU.docx`

| Mục trên mẫu | Lấy từ |
|---|---|
| "Hôm nay, vào lúc … giờ …, ngày … tháng … năm …, tại: …" | thời gian và địa điểm nghiệm thu của lượt (§4.3) |
| Đại diện Ban quản lý, Ban quản trị, Tư vấn kỹ thuật | họ tên người giữ từng bước ACCEPTANCE của lượt. Thành phần nào không có trong chuỗi của tòa thì in dòng chấm |
| Đại diện Cư dân/CQCN (nếu có) | thành phần khác (chữ tự do) |
| Nội dung làm việc, công việc / hạng mục | nội dung nghiệm thu |
| Đánh giá: ☐ ĐẠT ☐ KHÔNG ĐẠT | đánh dấu theo kết luận chung của lượt; lượt chưa xong thì không đánh dấu ô nào (và có chữ chìm theo BR-B7-04) |
| Điểm cần lưu ý | mỗi thành phần một dòng: "«Thành phần» («họ tên»): «điểm lưu ý hoặc điểm cần khắc phục»" |
| 4 cột ký: Đại diện BQL, BQT, TVKT, Khác | chữ ký của từng quyết định (BR-B7-05). Cột "Khác" luôn để trống để ký tay (B7Q-04). Tòa có bước tùy chỉnh ở ACCEPTANCE thì thêm cột mang nhãn bước, đặt trước cột "Khác" |

### 3.3 Thư đề nghị thanh toán: gán trường vào mẫu `BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`

| Mục trên mẫu | Lấy từ |
|---|---|
| Đầu thư "BAN QUẢN LÝ ……" | dòng chấm (B7-S2) |
| THƯ ĐỀ NGHỊ · V/v: Chuyển khoản thanh toán cho Nhà thầu bảo trì/sửa chữa | chữ cố định |
| Kính gửi | "Ban quản trị tòa nhà «tên tòa»" (giả định; mẫu viết "đề nghị Quý Ban quản trị") |
| Câu mở đầu | chép nguyên văn từ mẫu, nhưng thay tên tổ chức bằng "Ban Quản lý" |
| 1. Người hưởng: tên tài khoản, số tài khoản, ngân hàng; Số tiền … VNĐ (Bằng chữ: …) | đợt thanh toán (§4.4); số tiền là **số của đợt** |
| 2. Nội dung | nội dung chuyển khoản của đợt |
| 3. Bộ hồ sơ đính kèm | **Quyết toán:** 4 dòng của mẫu, đánh dấu ✓ khi có: công văn đề nghị (`PAYMENT_REQUEST`), tờ trình và báo giá đã duyệt (tự liên kết), biên bản nghiệm thu hoàn thành (lượt đạt), hóa đơn GTGT (`INVOICE`). **Tạm ứng:** "Đề nghị tạm ứng của nhà thầu" (`PAYMENT_REQUEST`), cộng "Tờ trình và báo giá đã được phê duyệt" |
| 4. Ghi chú (nếu có) | dòng chấm (B7-S2) |
| Đại diện Ban quản lý | chữ ký BQL của lần gửi gần nhất (BR-B7-05) |

Đợt quyết toán có tạm ứng trước: dưới số tiền thêm một dòng nhỏ "(Số quyết toán «X» − tạm ứng đã chuyển «Y»)". Đây là cách tính S4 đã hiện trên màn hình.

## 4. Tiêu chí nghiệm thu

Dữ liệu dùng tòa mẫu AQUA và tài khoản demo. Hồ sơ test đi qua: trình lần 1 bị từ chối, trình lần 2 được duyệt (TVKT rồi BQT, kèm biên bản họp), nghiệm thu lượt 1 KHÔNG ĐẠT, lượt 2 ĐẠT, tạm ứng 4 triệu, quyết toán 10 triệu.

**Danh sách**
- **AC-B7.1** GIVEN hồ sơ test ở trạng thái `COMPLETED`, WHEN `bql-a` mở tab "Biểu mẫu", THEN có đúng 6 dòng theo thứ tự thời gian: Tờ trình lần 1 (Bị từ chối), Tờ trình lần 2 (Đã duyệt), Biên bản lượt 1 (Không đạt), Biên bản lượt 2 (Đạt), Thư đề nghị đợt 1 tạm ứng, Thư đề nghị đợt 2 quyết toán. Mỗi dòng có số chữ ký đúng.
- **AC-B7.2** Hồ sơ ở `PENDING_PROPOSAL`, chưa trình lần nào: tab hiện trạng thái rỗng theo brief.
- **AC-B7.3** `bql-b` (chỉ có tòa B) mở đường dẫn bản in của hồ sơ tòa A: hiện trang "Không tìm thấy hồ sơ" (404). Không lộ dữ liệu nào.

**Tờ trình**
- **AC-B7.4** Bản Tờ trình lần 2 hiện đủ các trường ở §3.1, bảng báo giá có Chi phí, Thuế và Tổng tiền đúng của từng nhà thầu, khối ký BQL có ảnh chữ ký và giờ ký của lần 2, khối ký BQT có chữ ký bước BOARD. Không có chữ chìm.
- **AC-B7.5** Bản Tờ trình lần 1 có chữ chìm "CHƯA PHÊ DUYỆT", mục "Ý KIẾN CỦA BAN QUẢN TRỊ" là lý do từ chối, và khối ký BQT có chữ ký của quyết định từ chối.
- **AC-B7.6** Lần trình có 5 nhà thầu được in thành 2 bảng (3 + 2 nhà thầu). Số liệu khớp màn báo giá.
- **AC-B7.7** "Số tờ trình", chức danh và tên tổ chức BQL in thành dòng chấm. Trong cả trang không có chữ `undefined`, `null` hay `NaN` (có test tự động quét chữ của trang).

**Biên bản**
- **AC-B7.8** Biên bản lượt 1 đánh dấu ô KHÔNG ĐẠT và có điểm cần khắc phục của người chọn KHÔNG ĐẠT. Biên bản lượt 2 đánh dấu ô ĐẠT và có đủ 3 chữ ký BQL, BQT, TVKT; cột "Khác" để trống.
- **AC-B7.9** Lượt đang nghiệm thu, mới có 1 trên 3 quyết định: có chữ chìm "CHƯA HOÀN TẤT", không ô đánh giá nào được đánh dấu, chỉ ô ký của người đã quyết định có chữ ký.

**Thư đề nghị**
- **AC-B7.10** Thư đợt 2 quyết toán: số tiền 6.000.000 kèm bằng chữ "Sáu triệu đồng", dòng cách tính "(Số quyết toán 10.000.000 − tạm ứng đã chuyển 4.000.000)", người hưởng và nội dung đúng của đợt, cả 4 mục hồ sơ đính kèm có ✓, có chữ ký BQL.
- **AC-B7.11** Thư đợt 1 tạm ứng có danh sách hồ sơ theo dạng tạm ứng ở §3.3.
- **AC-B7.12** Đợt đang chờ duyệt có chữ chìm "CHƯA PHÊ DUYỆT". Đợt quyết toán 0 đồng không có nút Xem / In, mà có dòng chữ theo BR-B7-01.

**In**
- **AC-B7.13** Bấm **In** mở hộp in của trình duyệt với khổ A4 dọc. Thanh công cụ, menu và nút không xuất hiện trên bản in. Mỗi trang có chân trang theo BR-B7-06. Không dòng nào của bảng báo giá bị cắt ngang giữa hai trang, và tiêu đề bảng được lặp lại ở trang sau. Kiểm bằng ảnh chụp "Lưu thành PDF" của 3 loại tài liệu trên Chrome.
- **AC-B7.14** Chế độ `mock` không đổi: test hiện có của `RecordDocumentButton` vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Test component cho từng bản in (dữ liệu đủ, dữ liệu thiếu, chưa duyệt xong) và cho danh sách tab.
- [ ] Unit test cho phần gán dữ liệu vào mẫu (§3.1–3.3): tách bảng 5 nhà thầu, điểm cần lưu ý, danh sách hồ sơ đính kèm, quyết toán 0 đồng.
- [ ] Nếu có thêm trường đọc vào `GET /records/:id`: chạy e2e `records` và `record-*` liên quan.
- [ ] Ảnh chụp và bản PDF của AC-B7.13, chạy một phiên dev server.

## 6. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích B07 (PD-18). |
| 27/10/2026 | Chủ dự án duyệt (PD-20) và cho giao dev-build. |
