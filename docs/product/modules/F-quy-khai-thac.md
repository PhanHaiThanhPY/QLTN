# Phân tích nhóm F: Quỹ khai thác (F01–F10)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-31)**. Chưa phải SPEC

**Nguồn:**
- D1 tr. 3 (tổng quan "Quỹ khai thác, rõ từ hồ sơ đến tiền"), tr. 5–14 (hình F01–F10; PM/BA đã xem cả 10 hình ngày 27/10), tr. 2 ("Hai quỹ theo dõi riêng"), tr. 39 (cách viết tiêu chí nghiệm thu của nhóm T, dùng làm mẫu).
- Sơ đồ `sources/customer/D1-aqua-proposal/so-do-van-hanh/02_Chu_trinh_quy.mmd` ("10 phân hệ, một chu trình quỹ khép kín").
- D2 **không có** nhóm F (review 23/10 dòng 91–100: "Chưa nêu thành phân hệ").
- Review 23/10 §5.3 (quan hệ F05 và F04; phải thu tách với đã nhận; cọc, giảm trừ, hoàn trả, phạt), H05 (thiếu mô hình tiền), L01 (chữ "thanh toán" dùng cho hai nghĩa).
- Mặc định đã có: DF-10 (vai trò Kế toán làm F06–F09), DF-20 (quỹ theo tòa), DF-26 (dùng chung chức năng nhập sao kê, gắn theo tài khoản), DF-27 (hội nghị thông qua **trước** khi hợp đồng có hiệu lực), DF-28 (tiền khai thác ghi vào quỹ khai thác; chuyển sang quỹ khác là khoản chi có duyệt).
- Câu hỏi đang mở: OD-04 (thứ tự F03, F05, F04), OD-07 (mẫu biểu, sao kê thật).

**Hiện trạng code:** **chưa có gì**. Không có màn hình, endpoint hay bảng dữ liệu nào. API chỉ có sẵn vai trò Kế toán (`ACCOUNTANT`) với quyền `FUND_OPERATE` (`api-qltn/src/domain/permissions.ts` dòng 106), chưa được dùng ở đâu.

## 1. Bức tranh chung

- **Mục đích (D1 tr. 3):** quản lý khoản thu từ **khai thác khu vực chung**, ví dụ cho thuê quầy tiện ích ở sảnh dịch vụ. Đi từ lúc mời thầu đến lúc thanh lý hợp đồng. "Mỗi khoản thu gắn hồ sơ và chứng từ."
- **Bốn chặng** (sơ đồ 02):
  1. **Lựa chọn đơn vị:** F01 mời thầu → F02 dự thầu → F03 kết quả chọn.
  2. **Hoàn thiện hồ sơ hợp tác:** F04 hợp đồng, F05 hội nghị thông qua. Hồ sơ liên kết theo tòa, vị trí, đơn vị.
  3. **Ghi nhận từng nghĩa vụ:** F06 từng lần thu, F07 từng lần nộp thuế, F08 sao kê ghép giao dịch.
  4. **Kiểm soát và khép hồ sơ:** F09 báo cáo thu chi; F10 chấm dứt, thanh lý; câu hỏi "đủ điều kiện đóng hồ sơ?"
- **Hai nguyên tắc D1 nhắc lại nhiều lần:**
  - **Công nợ tách khỏi số tiền trong quỹ** (D1 tr. 3, F09 "Còn phải thu 5 triệu, theo dõi riêng, chưa cộng vào tiền quỹ").
  - **Chỉ tính giao dịch thực nhận, thực chi** (F08).
- **Người dùng trong hình:**
  - **BQL:** F01, F02, F04, F05, F10.
  - **"Vai trò duyệt":** F03.
  - **Kế toán:** F06, F07, F08.
  - **BQT:** F09.
- **Ngoài phạm vi (D1 tr. 45, giống nhóm T):** kết nối ngân hàng, chuyển tiền thật. Hệ thống chỉ ghi nhận và đối chiếu.
- **Theo tòa (DF-20):** mọi hình ghi "Aqua 1 · Quỹ khai thác". Mỗi tòa có một quỹ khai thác và một tài khoản riêng.

**Ví dụ xuyên suốt của D1** (dùng làm dữ liệu nghiệm thu):
- Gói **MT-001** "Quầy tiện ích Sảnh dịch vụ Aqua 1": mời 2 đơn vị, hạn nhận 10/11 17:00.
- DV-A đủ hồ sơ, chào 20 triệu/kỳ, **được chọn** (KQ-001). DV-B chào 22 triệu/kỳ nhưng thiếu chứng từ.
- Hội nghị **HN-001** ngày 12/11 thông qua, rồi ngày 15/11 ký hợp đồng **HĐ-001**: kỳ khai thác 16–30/11, nghĩa vụ 20 triệu, hạn thu 25/11.
- Thu PT-001 10 triệu (18/11) và PT-002 5 triệu (22/11). Còn phải thu 5 triệu.
- Thuế TH-001 tháng 11 là 2 triệu, đã nộp 22/11.
- Sao kê tài khoản ****0001:
  - đầu kỳ 50, thu 15, chi 5, cuối kỳ **60**;
  - 4 giao dịch GD-001 đến GD-004, khớp 4/4, chênh lệch 0;
  - trong đó GD-004 −3 triệu khớp với **PC-001**.
- Thanh lý **TL-001** (01/12): đã bàn giao khu vực, đã lập biên bản, nhưng còn công nợ 5 triệu, nên **"Chưa thể đóng"**.

## 2. Từng module (đọc từ hình D1)

### F01 · Hồ sơ mời thầu (D1 tr. 5, BQL)
- **Ô số:** đợt mở 1, đơn vị mời 2, tài liệu 3, hạn nhận 10/11.
- **Gói MT-001** gồm:
  - tên, khu vực;
  - đơn vị được mời;
  - hạn tiếp nhận (ngày **và giờ**);
  - 3 tài liệu: "Thư mời · Phiên bản 01", "Yêu cầu khai thác", "Tiêu chí đánh giá", mỗi tài liệu có cờ "Đã đủ".
- **Bản xem thư mời:**
  - "Kính gửi: Đơn vị tham gia";
  - hồ sơ tiếp nhận: Năng lực · Phương án · Điều kiện;
  - hạn nhận.
- Gợi ý trong hình: "Lưu phiên bản thư và tài liệu cùng đợt phát hành." Thao tác chính: **"Ghi nhận phát hành"**.
- **Quy tắc đề xuất:**
  - Mỗi lần phát hành khóa một **phiên bản** của thư và tài liệu.
  - Sửa sau khi đã phát hành thì tạo phiên bản mới, và mọi đơn vị đã mời thấy phiên bản đang hiệu lực.

### F02 · Hồ sơ dự thầu (D1 tr. 6, BQL)
- **Ô số:** đã nhận 2, đủ hồ sơ 1, cần bổ sung 1, hạn nhận 10/11.
- **Mỗi đơn vị** có ngày tiếp nhận và một danh mục 4 tài liệu: Hồ sơ năng lực, Phương án khai thác, Tài liệu tiếp nhận, Chứng từ điều kiện. Mỗi mục là "Đã nhận" hoặc "Cần bổ sung". Có đếm "3/4 tài liệu".
- Có **hạn bổ sung** riêng (10/11 17:00). Thao tác: **"Ghi yêu cầu bổ sung"**.
- **Quy tắc đề xuất:**
  - Danh mục tài liệu lấy từ "Hồ sơ tiếp nhận" của F01.
  - Hết hạn nhận thì **khóa nhận** hồ sơ mới.
  - Hồ sơ nhận trễ được lưu và đánh dấu "trễ hạn", giống cách DF-25 xử lý bản chào trễ.

### F03 · Kết quả chọn thầu (D1 tr. 7, "Vai trò duyệt")
- **Ô số:** đơn vị 2, đủ điều kiện 1, được chọn 1, biên bản 1.
- **"Căn cứ chọn đơn vị":** mỗi đơn vị có giá chào "triệu đồng / kỳ" và tình trạng hồ sơ. Đơn vị được chọn có cờ "Được chọn"; đơn vị kia có cờ "Chưa đủ".
- **Tài liệu:** BB-001 Biên bản đánh giá, KQ-001 Kết quả lựa chọn.
- Câu trong hình: **"Giá chào cao hơn không thay thế điều kiện hồ sơ."**
- **Quy tắc đọc được:** chỉ đơn vị **đủ hồ sơ** mới được chọn, kể cả khi có đơn vị chào giá cao hơn.

### F04 · Hợp đồng khai thác (D1 tr. 8, BQL)
- **Ô số:** hợp đồng 1, giá trị/kỳ 20 tr, bản ký 1, phụ lục 1.
- **Trường:** đơn vị, khu vực, kỳ khai thác (16–30/11/2026), nghĩa vụ kỳ (20 triệu đồng).
- **Tài liệu:** HĐ-001 hợp đồng, **PL-001 phụ lục thanh toán**.
- **"Mốc hồ sơ liên kết":**
  - 12/11 "Hội nghị thông qua · HN-001 · Lưu quyết nghị";
  - 15/11 "Hợp đồng được ký · Bản ký và phụ lục";
  - 25/11 "Đến hạn thu · 20 triệu đồng · Lịch phải thu".
- Thao tác: **"Mở lịch phải thu"**.
- **Quy tắc đọc được:** hội nghị diễn ra trước khi ký (12/11 trước 15/11), khớp DF-27. Hợp đồng sinh ra **lịch phải thu**.

### F05 · Trình hội nghị thông qua (D1 tr. 9, BQL)
- **Ô số:** hồ sơ trình 1, tài liệu đủ 3, còn thiếu 0, có biên bản 1.
- **HN-001** (12/11) "Khai thác quầy dịch vụ Aqua 1":
  - kết quả hội nghị **"Thông qua"**;
  - liên kết MT-001 và HĐ-001;
  - 3 tài liệu: Tờ trình khai thác TR-001, Biên bản hội nghị BB-HN01, Quyết nghị NQ-001.
- Câu trong hình: "Nội dung thông qua gắn trực tiếp vào hồ sơ khai thác." Thao tác: **"Lưu kết quả hội nghị"**.

### F06 · Từng lần thanh toán (thu) (D1 tr. 10, Kế toán)
- **Ô số:** phải thu 20 tr, đã thu 15 tr, còn thu 5 tr, quá hạn 0 tr.
- **Kỳ thu 16–30/11 của HĐ-001:** "15 / 20 triệu, đã thu 75% nghĩa vụ kỳ", kèm thanh tiến độ. Các lần thu: PT-001 10 triệu ngày 18/11 (thu lần 1, gắn chứng từ), PT-002 5 triệu ngày 22/11.
- **Thẻ "Khoản thu tiếp theo":** 5 triệu, hạn 25/11, "Chưa đến hạn"; dòng "Tại ngày 23/11/2026: 20 = 10 + 5 + 5 triệu".
- Thao tác: **"Ghi nhận khoản thu"**.
- **Quy tắc đọc được:**
  - Một kỳ phải thu được thu thành **nhiều lần**.
  - Phải thu = đã thu + còn thu.
  - Khoản chưa đến hạn **không** tính là quá hạn (giống T04).

### F07 · Từng lần nộp thuế (D1 tr. 11, Kế toán)
- **Ô số:** theo hồ sơ 2 tr, đã nộp 2 tr, còn nộp 0 tr, đối chiếu 1/1.
- **TH-001 tháng 11/2026:** "Theo hồ sơ kế toán 2.000.000 đ", đã nộp 2.000.000 đ, còn phải nộp 0 đ, cờ "Đã đối chiếu 1/1".
- **Chứng từ** "NT-001 · Giấy nộp tiền" ngày 22/11, 2.000.000 đ, giao dịch sao kê GD-003.
- Câu trong hình: **"Số tiền lấy từ hồ sơ kế toán, không tự áp thuế suất."**
- **Quy tắc đọc được:** hệ thống **không tính thuế**. Kế toán nhập số thuế theo hồ sơ kế toán; hệ thống theo dõi đã nộp, còn phải nộp, và đối chiếu với sao kê.

### F08 · Sao kê tài khoản quỹ (D1 tr. 12, Kế toán)
- **Tài khoản ****0001 của quỹ khai thác.** Ô số: đầu kỳ 50, thu 15, chi 5, cuối kỳ 60.
- **Danh sách giao dịch:**
  - GD-001 +10 triệu (18/11);
  - GD-002 +5 triệu (22/11);
  - GD-003 −2 triệu (22/11);
  - GD-004 −3 triệu (23/11).
- **"Chứng từ đã ghép"** (4/4 khớp): PT-001 ↔ GD-001, PT-002 ↔ GD-002, NT-001 ↔ GD-003, **PC-001 ↔ GD-004**. Dòng cuối: "Chênh lệch 0 đ · Lệch/trùng: 0/0".
- Câu trong hình: **"Chỉ tính giao dịch thực nhận, thực chi."**
- **Quy tắc đọc được:**
  - Cuối kỳ = đầu kỳ + thu − chi, theo sao kê.
  - Mỗi giao dịch ghép với đúng một chứng từ, và ngược lại.
  - Có đếm giao dịch lệch và giao dịch trùng.

### F09 · Báo cáo thu chi quỹ (D1 tr. 13, BQT)
- **Ô số:** đầu kỳ 50 tr, thu 15 tr, chi 5 tr, cuối kỳ 60 tr.
- **"Dòng tiền quỹ khai thác"** (Aqua 1, tháng 11/2026): biểu đồ **thác nước** 50 → +15 → −5 → 60, kèm dòng "Đơn vị: triệu đồng · 50 + 15 − 5 = 60".
- **Số dư cuối kỳ 60 triệu**, chia theo nguồn: Thu khai thác 15 triệu, Chi thuế 2 triệu, Chi dịch vụ 3 triệu.
- Khối **"Còn phải thu: 5 triệu"**: "Theo dõi riêng, chưa cộng vào tiền quỹ."
- Thao tác: **"Xuất thu chi"**.

### F10 · Chấm dứt và thanh lý (D1 tr. 14, BQL)
- **Ô số:** hồ sơ thanh lý 1, còn phải thu 5 tr, bàn giao 1/1, điều kiện thiếu 1.
- **"Điều kiện khép hồ sơ"** của TL-001 / HĐ-001:
  - Bàn giao khu vực BG-001: Đạt;
  - Biên bản thanh lý TL-001: Đã lập;
  - Công nợ hợp đồng: **Còn 5 triệu**.
- Thông báo "Còn nghĩa vụ cần xử lý · Hồ sơ được giữ mở đến khi xử lý xong công nợ."
- **"Trạng thái đóng": Chưa thể đóng**, khoản phải thu còn lại 5.000.000 đ, "Bàn giao ngày 30/11 · Rà soát 01/12".
- Nút **"Đóng hồ sơ" bị khóa**: "Khóa đóng khi còn nghĩa vụ chưa xử lý."

## 3. Dữ liệu cần có (mức nghiệp vụ, chưa phải thiết kế DB)

| Hồ sơ | Mã trong hình | Trường chính | Liên kết |
|---|---|---|---|
| Đơn vị khai thác (danh mục) | DV-x | tên, mã số thuế, người liên hệ | — |
| Gói khai thác / đợt mời | MT-xxx | tòa, khu vực/vị trí, loại khai thác, hạn nhận (ngày giờ), phiên bản thư, tài liệu, danh mục hồ sơ phải nộp, đơn vị được mời | — |
| Hồ sơ dự thầu | — | đơn vị, ngày tiếp nhận, trạng thái từng tài liệu, giá chào mỗi kỳ, yêu cầu bổ sung, hạn bổ sung, cờ trễ hạn | đợt mời |
| Kết quả chọn | KQ-xxx, biên bản BB-xxx | đơn vị được chọn, căn cứ, người duyệt, thời điểm | đợt mời, hồ sơ dự thầu |
| Hội nghị | HN-xxx; TR-xxx, BB-HNxx, NQ-xxx | ngày, nội dung, kết quả (thông qua / không), tài liệu | đợt mời, hợp đồng |
| Hợp đồng khai thác | HĐ-xxx, phụ lục PL-xxx | đơn vị, khu vực, thời hạn, giá trị mỗi kỳ, kỳ thu, bản ký, trạng thái, phiên bản | kết quả chọn, hội nghị |
| Kỳ phải thu | — | kỳ, hạn, số phải thu, đã thu, còn thu, trạng thái (chưa đến hạn, đến hạn, quá hạn, đủ, thiếu) | hợp đồng |
| Khoản thu | PT-xxx | ngày, số tiền, chứng từ, phân bổ vào kỳ | kỳ phải thu; giao dịch sao kê |
| Nghĩa vụ thuế | TH-xxx | kỳ (tháng), số theo hồ sơ kế toán, đã nộp, còn phải nộp | quỹ |
| Giấy nộp thuế | NT-xxx trong hình (xem FG-04) | ngày, số tiền, tệp | nghĩa vụ thuế; giao dịch sao kê |
| Phiếu chi | PC-xxx | ngày, số tiền, nội dung, người duyệt | quỹ; giao dịch sao kê |
| Tài khoản quỹ | ****0001 | tòa, loại quỹ, ngân hàng, số tài khoản (che số) | quỹ |
| Dòng sao kê | GD-xxx | ngày, số tiền (+/−), nội dung, số tham chiếu | tài khoản; chứng từ đã ghép |
| Thanh lý | TL-xxx, bàn giao BG-xxx | ngày bàn giao, biên bản, công nợ còn lại, trạng thái đóng | hợp đồng |

- Tiền lưu dạng **số nguyên VND** (bigint), như quy ước hiện có của API. Không dùng số thực.
- Mọi thay đổi ghi nhật ký. Chứng từ dùng module tệp (AT-S1).

## 4. Khoảng trống và rủi ro

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **FG-01** | Toàn bộ nhóm F **chưa có code**. Đây là 10 trên 34 phân hệ của D1 | kiểm kê 26/10 | **Cao** | Theo các slice ở §6 |
| **FG-02** | **Thiếu mô hình tiền** (H05): phải thu, đã thu, công nợ, số dư, đối soát. Màn hình có thể đúng mẫu nhưng số dư sai hoặc cộng trùng | review 23/10 H05 | **Cao** | Chốt ở SPEC đầu tiên có tiền, kèm công thức và test số liệu theo ví dụ D1 (§1) |
| **FG-03** | Sao kê và báo cáo có **khoản chi PC-001 "Chi dịch vụ" 3 triệu**, nhưng không phân hệ nào ghi nhận khoản chi của quỹ, trừ thuế (F07) | D1 tr. 12, 13 | **Cao** (thiếu một loại chứng từ) | Hỏi FQ-08. Mặc định: thêm **phiếu chi quỹ khai thác** có duyệt (theo DF-28) |
| FG-04 | Mã "**NT-001**" dùng cho giấy nộp thuế (F07), trùng với "NT-001" là **biên bản nghiệm thu** sửa chữa (D1 tr. 22, 24) | D1 tr. 11 và tr. 22 | Trung bình (gây nhầm khi tìm kiếm và ghép chứng từ) | Mặc định: giấy nộp thuế dùng mã **GNT-xxx**; biên bản nghiệm thu giữ NT |
| FG-05 | Chữ "**thanh toán**" ở F06 là tiền **thu** từ khai thác, còn ở B09 là tiền **chi** sửa chữa (L01) | review 23/10 L01 | Trung bình | Dùng nhãn "**Thu theo hợp đồng khai thác**" cho F06, "Chi thanh toán sửa chữa" cho B09. F06 gọi là "Khoản thu" |
| FG-06 | Chưa rõ thứ tự **F03 → F05 → F04** (OD-04). D1 F04 cho hội nghị (12/11) trước ký (15/11), nhưng sơ đồ xếp F04 trước F05 | sơ đồ 02; D1 tr. 8 | Trung bình | Theo DF-27: hợp đồng chỉ "Hiệu lực" khi đã có quyết nghị thông qua. Được soạn và ký trước; hiệu lực sau |
| FG-07 | **Cọc, giảm trừ, hoàn trả, phạt chậm** chưa có trong hình nào (review 23/10 §5.3) | review §5.3 | Trung bình | Hỏi FQ-06. Mặc định: có **tiền cọc** (không tính vào thu quỹ, hoàn khi thanh lý); không có phạt chậm ở giai đoạn 1 |
| FG-08 | **"Đã thu" tính từ lúc nào:** khi kế toán ghi nhận chứng từ, hay khi khớp sao kê? F06 đếm 15 đã thu; F09 đếm thu 15 theo sao kê. Hai số trùng nhau ở ví dụ, nhưng sẽ lệch khi có khoản chưa đối soát | D1 tr. 10, 12, 13 | Trung bình | Mặc định (FQ-10): F06 đếm theo chứng từ đã ghi nhận; F09 và số dư quỹ theo **sao kê**; báo cáo hiện riêng "chưa đối soát" |
| FG-09 | **Sao kê dùng chung** với nhóm T (DF-26), nhưng chưa có định dạng tệp thật (OD-07) | DF-26; OD-07 | Trung bình | Một chức năng nhập sao kê dùng chung, gắn theo tài khoản; nhập theo mẫu cột chuẩn hoặc nhập tay (FQ-09) |
| FG-10 | **Công nợ không thu được** khi thanh lý: D1 chỉ cho "Chưa thể đóng", không có lối ra | D1 tr. 14 | Trung bình | Hỏi FQ-13. Mặc định: "Ghi nhận không thu được", có lý do và BQT duyệt, rồi mới cho đóng |
| FG-11 | Việc, nhắc hạn, tổng quan quỹ (D1 tr. 2 "Dashboard từng phân hệ") | — | — | Làm cùng module notifications, B01 và B18 (đã hoãn, PD-28, PD-30) |
| FG-12 | Phân quyền: "Vai trò duyệt" (F03) chưa gán cho vai trò nào; BQT xem F09; Kế toán làm F06–F08 (DF-10) | D1 tr. 7, 13 | Trung bình | Mặc định (FQ-04): BQT duyệt kết quả chọn |

## 5. Câu hỏi cho khách

Đã ghi thành **OD-26** trong `DECISIONS.md`. Mỗi câu có mặc định để làm trước (PD-06).

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| FQ-01 | Có những loại khai thác nào (quầy tiện ích, quảng cáo, mặt bằng, gửi xe, khác)? Loại có làm đổi quy trình không? | Một quy trình chung; "loại" là danh mục có sẵn kèm "Khác" |
| FQ-02 | Mời thầu đích danh hay công khai? Đơn vị không được mời có nộp được không? | Mời đích danh. Đơn vị ngoài danh sách vẫn ghi nhận được, kèm lý do |
| FQ-03 | Tiêu chí chọn là gì: giá cao nhất trong số đơn vị đủ hồ sơ, hay chấm điểm? | Người duyệt chọn kèm biên bản đánh giá. Chỉ đơn vị **đủ hồ sơ** mới được chọn (D1 tr. 7). Hệ thống không tự chọn |
| FQ-04 | Ai duyệt kết quả chọn ("Vai trò duyệt" ở F03)? | BQT |
| FQ-05 | Giá trị hợp đồng: cố định mỗi kỳ hay theo % doanh thu? Kỳ thu theo tháng hay quý? | Cố định mỗi kỳ; kỳ tháng hoặc quý tùy hợp đồng. Lịch phải thu sinh từ hợp đồng. Phụ lục tạo phiên bản mới (như DF-25) |
| FQ-06 | Có tiền cọc, giảm trừ, hoàn trả, phạt chậm không? | Có **cọc**: theo dõi riêng, không tính vào thu quỹ, hoàn hoặc cấn trừ khi thanh lý. Không có phạt chậm và giảm trừ ở giai đoạn 1 |
| FQ-07 | Thuế: theo kỳ nào? Ai tính số thuế? | Theo tháng. Kế toán nhập số theo hồ sơ kế toán; hệ thống không áp thuế suất (D1 tr. 11) |
| FQ-08 | Quỹ khai thác chi cho những gì ("Chi dịch vụ" ở D1)? Ai duyệt chi? | Có **phiếu chi quỹ khai thác**: kế toán lập, BQT duyệt, rồi ghép với sao kê |
| FQ-09 | Sao kê lấy từ ngân hàng nào, ở định dạng gì? | Nhập tệp theo mẫu cột chuẩn của hệ thống (ngày, số tiền, nội dung, số tham chiếu), hoặc nhập tay. Chống trùng theo ngày, số tiền và số tham chiếu |
| FQ-10 | Một khoản được tính là "đã thu" khi nào? | Khi kế toán ghi nhận kèm chứng từ. Số dư quỹ trong báo cáo tính theo sao kê; khoản chưa đối soát hiện riêng |
| FQ-11 | Hội nghị không thông qua thì sao? | Hợp đồng không được hiệu lực. Kết quả chọn giữ nguyên, có thể trình hội nghị lại hoặc hủy đợt mời (có lý do) |
| FQ-12 | Có mẫu biểu thật cho thư mời, biên bản đánh giá, hợp đồng, biên bản thanh lý không? (nối OD-07) | Dùng tệp khách tải lên; chưa sinh văn bản từ mẫu ở giai đoạn 1 |
| FQ-13 | Công nợ không thu được khi thanh lý xử lý thế nào? | "Ghi nhận không thu được", có lý do và BQT duyệt, rồi cho đóng |

## 6. Đề xuất cắt slice khi viết SPEC

Đi theo vòng đời của D1. Riêng phần tiền (S3, S4) dùng chung nền với nhóm T (tài khoản quỹ, sao kê), nên chốt mô hình tiền một lần cho cả hai nhóm.

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **F-S1 Mời thầu và dự thầu** ([SPEC](../features/F-moi-thau-khai-thac/SPEC.md), đã triển khai 27/10) | Danh mục đơn vị khai thác; F01 gói và đợt mời (phiên bản, hạn nhận, tài liệu); F02 tiếp nhận hồ sơ (danh mục tài liệu, yêu cầu bổ sung, khóa nhận khi hết hạn, cờ trễ hạn) | FQ-01, FQ-02 (đã có mặc định) |
| F-S2 Chọn, hội nghị, hợp đồng ([SPEC](../features/F-hop-dong-khai-thac/SPEC.md), đã duyệt PD-33, chờ build) | F03 kết quả chọn có duyệt (chỉ đơn vị đủ hồ sơ); F05 hội nghị; F04 hợp đồng: soạn → ký → **hiệu lực chỉ khi có quyết nghị** (DF-27); phụ lục; **lịch phải thu** | F-S1; FQ-03 đến FQ-05, FQ-11 |
| F-S3 Quỹ, thu, thuế, chi | Tài khoản quỹ theo tòa (dùng chung với nhóm T); F06 khoản thu phân bổ vào kỳ; F07 nghĩa vụ thuế và giấy nộp; **phiếu chi** (FG-03); **mô hình tiền** (FG-02) | F-S2; FQ-06 đến FQ-08, FQ-10 |
| F-S4 Sao kê và đối soát | Nhập sao kê dùng chung F và T (DF-26); ghép giao dịch với chứng từ; lệch và trùng | F-S3; FQ-09 |
| F-S5 Báo cáo và thanh lý | F09 báo cáo thu chi (thác nước, theo nguồn, công nợ riêng, xuất); F10 thanh lý (điều kiện khép, ghi nhận không thu được) | F-S3, F-S4; FQ-13 |

**AC nháp, lấy đúng ví dụ D1** (dùng cho kịch bản nghiệm thu):
- **AC-1 (F02, F03):** DV-B thiếu "Chứng từ điều kiện" thì không chọn được, dù chào 22 triệu, cao hơn DV-A (20 triệu).
- **AC-2 (F04, F05):** HĐ-001 đã ký nhưng chưa có quyết nghị HN-001 "Thông qua" thì không chuyển được sang "Hiệu lực".
- **AC-3 (F06):** Kỳ 16–30/11 phải thu 20 triệu, đã thu 10 (18/11) + 5 (22/11). Tại 23/11: còn thu 5, quá hạn 0. Tại 26/11: quá hạn 5.
- **AC-4 (F07):** Nghĩa vụ thuế tháng 11 là 2.000.000 đ theo hồ sơ kế toán. Nộp đủ thì còn phải nộp 0 đ, kèm cờ "Đã đối chiếu 1/1" khi ghép với GD-003.
- **AC-5 (F08):** 4 giao dịch ghép đủ với PT-001, PT-002, chứng từ thuế và PC-001: khớp 4/4, chênh lệch 0. Nhập lại cùng tệp sao kê không tạo dòng trùng.
- **AC-6 (F09):** Báo cáo Aqua 1 tháng 11 có 50 + 15 − 5 = 60. "Còn phải thu 5 triệu" hiện riêng và **không** được cộng vào 60.
- **AC-7 (F10):** Còn công nợ 5 triệu thì "Đóng hồ sơ" bị khóa. Thu đủ, hoặc ghi nhận không thu được đã được duyệt, thì đóng được.
- **AC-8 (chung):** Người chỉ có phạm vi Aqua 2 không thấy gì của quỹ khai thác Aqua 1. Quỹ khai thác và quỹ bảo trì không bao giờ cộng chung một số dư.
