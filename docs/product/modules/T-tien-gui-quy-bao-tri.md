# Phân tích nhóm T: Tiền gửi quỹ bảo trì (T01–T06)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** Phân tích lần 1, chưa phải SPEC

**Nguồn**
- D1 tr. 4 (tổng quan), tr. 33–38 (hình T01–T06), tr. 39 (nghiệm thu), tr. 42 (giá), tr. 44 (dữ liệu khách cung cấp), tr. 45 (loại trừ).
- Sơ đồ `sources/customer/D1-aqua-proposal/so-do-quy-bao-tri/03_Tien_gui_bao_tri.mmd`.
- D2 không có nhóm T.

**Hiện trạng code:** chưa có. Không có màn hình, endpoint, bảng dữ liệu hay đặc tả nào (kiểm kê 26/10, mục 3).

## 1. Bức tranh chung

- **Mục đích (D1 tr. 4):** theo dõi vòng đời tiền gửi của quỹ bảo trì, từ chào lãi suất đến tất toán hoặc tái tục, với gốc và lãi tách riêng.
- **Luồng (sơ đồ 03):**
  1. Chuẩn bị khoản gửi: T01 Thư mời chào lãi → T02 Chọn ngân hàng → T03 Hợp đồng.
  2. Theo dõi ngân hàng trả lãi: T04, gồm số phải nhận, thực nhận và phần còn thiếu, đối chiếu chứng từ và sao kê.
  3. Xử lý kết thúc kỳ gửi theo hồ sơ: hoặc T05 Tất toán, hoặc T06 Tái tục.
- **Kiểm soát xuyên suốt:** dashboard từng phân hệ trên web và điện thoại; gốc không cộng trùng; quỹ bảo trì và quỹ khai thác theo dõi riêng; phân quyền, nhật ký, lịch sử, chứng từ.
- **Ngoài phạm vi (D1 tr. 45):** kết nối ngân hàng và chuyển tiền thật. Giao dịch ngân hàng do người có thẩm quyền thực hiện ngoài hệ thống (D1 tr. 39); hệ thống chỉ ghi nhận và đối chiếu.
- **Người dùng trong hình:**
  - BQL lập thư mời và ghi nhận bản chào (T01).
  - "Vai trò duyệt" chọn ngân hàng (T02).
  - Kế toán làm T03–T06.

  Vai trò Kế toán chưa có trong hệ thống (OD-10).
- **Phạm vi tòa:** mọi màn hình ghi "Aqua 1 · Quỹ bảo trì", và D1 tr. 39 yêu cầu "lọc đúng tòa/ngân hàng". Nhiều khả năng mỗi tòa có một quỹ bảo trì riêng, nhưng cần xác nhận (TQ-01).

## 2. Từng module

### T01 · Thư mời chào lãi suất (D1 tr. 33)

**Hồ sơ trong hình:** MC-001, Quỹ bảo trì Aqua 1.
- Số tiền mời gửi 1.000 triệu, kỳ hạn 90 ngày.
- Hạn phản hồi 27/08 lúc 17:00; ngày theo dõi 25/08.
- Kèm tệp thư mời (PDF).
- Danh sách ngân hàng được mời. Mỗi ngân hàng có trạng thái phản hồi "Đã nhận" hoặc "Còn chờ"; tiến độ hiện "2/3 ngân hàng đã phản hồi".
- Thao tác chính: **Ghi nhận bản chào**, do BQL làm.

**Quy tắc**
- *Nguồn (D1 tr. 39):* số ngân hàng được mời và đã phản hồi phải khớp với dashboard.
- *Đề xuất:*
  - Thư mời có trạng thái Nháp → Đã gửi → Hết hạn nhận → Đã chuyển sang chọn. Hình có gợi ý "chưa sang chọn ngân hàng".
  - Bản chào nhận sau hạn được lưu nhưng đánh dấu trễ hạn. Có được xét hay không cần khách chốt (TQ-02).

### T02 · Kết quả chọn ngân hàng (D1 tr. 34)

**Hồ sơ trong hình:** KQ-TG01.
- Các bản chào được so sánh "cùng điều kiện": 1.000 triệu, 90 ngày, cơ sở 360 ngày/năm.
- Mỗi ngân hàng có lãi suất/năm, "lãi cả kỳ" do hệ thống tính và trạng thái "Đủ hồ sơ".
- Đánh dấu một ngân hàng "Được chọn".
- Căn cứ chọn lưu tại biên bản BB-TG01 và KQ-TG01. Người quyết định là "Vai trò duyệt".

**Kiểm số liệu trong hình:** lãi cả kỳ = gốc × lãi suất × số ngày / 360.
- 1.000 × 5,8% × 90/360 = 14,5 triệu
- 1.000 × 6,0% × 90/360 = 15 triệu
- 1.000 × 5,9% × 90/360 = 14,75 triệu

Cả ba số khớp hình.

**Quy tắc**
- *Nguồn (D1 tr. 39):* biên bản và kết quả xem theo quyền, truy ngược được về bản chào.
- *Đề xuất:*
  - Chỉ chọn được ngân hàng có bản chào "Đủ hồ sơ".
  - Mỗi thư mời có đúng một kết quả được chọn.
  - Đổi kết quả sau khi đã có hợp đồng thì không được phép, hoặc phải hủy hợp đồng trước (TQ-03).
  - Tiêu chí chọn và người có thẩm quyền cần khách chốt (phiếu L0, câu E4).

### T03 · Hợp đồng tiền gửi (D1 tr. 35)

**Hồ sơ trong hình:** TG-001, Ngân hàng B.
- Gốc 1.000 triệu, lãi suất 6%/năm, kỳ gửi 90 ngày.
- Ngày gửi 01/09/2026, đáo hạn 30/11/2026. 01/09 + 90 ngày = 30/11, khớp.
- Lãi theo hợp đồng = 1.000 × 6% × 90/360 = 15 triệu.
- Lịch trả lãi: 3 kỳ, mỗi 30 ngày, 5 triệu một kỳ.
- Liên kết: KQ-TG01 (28/08) và bản ký hợp đồng (PDF).
- Thao tác: **Mở lịch trả lãi**, do Kế toán làm.

**Quy tắc**
- *Nguồn (D1 tr. 39):* hợp đồng liên kết bản ký, gốc, lãi suất, ngày đáo hạn; lọc đúng tòa và ngân hàng.
- *Đề xuất:*
  - Hợp đồng phải trỏ về một kết quả chọn T02; ngân hàng và lãi suất mặc định lấy từ bản chào được chọn. Nếu khác bản chào thì phải ghi lý do.
  - Lịch trả lãi được sinh khi lưu hợp đồng, theo quy ước tính lãi và kỳ trả lãi của hợp đồng.
  - Sửa gốc, lãi suất hoặc ngày sau khi đã có khoản thực nhận thì không được phép; muốn đổi phải điều chỉnh bằng phụ lục (TQ-04).

**Rủi ro:** hình dùng cơ sở 360 ngày và ghi "lãi suất mẫu". Quy ước thật (365 hay 360, làm tròn, kỳ trả lãi) phải lấy theo hợp đồng thật của khách (OD-06, phiếu L0 câu E1). Không được mặc định 360.

### T04 · Trả lãi tiền gửi (D1 tr. 36)

**Hồ sơ trong hình:** lịch nhận lãi TG-001.

| Ngày đến hạn | Mã | Số tiền | Trạng thái |
|---|---|---|---|
| 01/10/2026 | L-001 | 5 triệu | Đã nhận |
| 31/10/2026 | L-002 | 5 triệu | Đã nhận |
| 30/11/2026 | Kỳ tiếp theo | 5 triệu | Chưa đến kỳ |

- Thẻ tổng: lãi cả kỳ 15, đã nhận 10, chưa đến kỳ 5, quá hạn 0.
- "2/2 khoản thực nhận đã khớp sao kê."
- "Còn 5 triệu, đến kỳ 30/11. Tại mốc 23/11, khoản này chưa quá hạn."
- Thao tác: **Ghi nhận lãi**, do Kế toán làm.

**Quy tắc**
- *Nguồn (D1 tr. 39):* phải nhận 15 = đã nhận 10 + còn nhận 5; khớp sao kê. *Nguồn (D1 tr. 36):* khoản chưa đến ngày đến hạn không tính là quá hạn.
- *Đề xuất:*
  - Mỗi kỳ lãi có trạng thái: Chưa đến kỳ → Đến hạn → Đã nhận (đủ) / Nhận thiếu / Quá hạn.
  - "Quá hạn" = đã qua ngày đến hạn mà thực nhận nhỏ hơn số phải nhận.
  - Mỗi khoản thực nhận có ngày, số tiền và chứng từ, và có thể ghép với một dòng sao kê.
  - Tổng thực nhận của một kỳ không được vượt số phải nhận nếu không có lý do điều chỉnh.

**Sửa cách hiểu của review 23/10 (§5.4, §9):** review gọi ví dụ "15 = 10 + 5" là "lãi nhận một phần". Theo D1 tr. 36, đó là 2/3 kỳ đã nhận đủ và 1 kỳ chưa đến hạn. Chưa có nguồn nào mô tả trường hợp một kỳ được trả thiếu. Cách xử lý trường hợp này cần khách chốt (TQ-05).

**Phụ thuộc:** "khớp sao kê" cần chức năng nhập sao kê. Trong D1, nhập sao kê là F08 (quỹ khai thác, tr. 12). Cần chốt quỹ bảo trì dùng chung chức năng sao kê hay có tài khoản và sao kê riêng (TQ-06).

### T05 · Tất toán, phương án A (D1 tr. 37)

**Hồ sơ trong hình:** TT-TG01 cho TG-001, ngày 30/11/2026.
- Gốc thu hồi 1.000, lãi nhận thêm 5, thu lần này 1.005 (giao dịch GD-TT01).
- Đối chiếu toàn kỳ: lãi đã nhận trước 10 + lãi nhận khi tất toán 5 = tổng lãi 15; gốc và lãi toàn kỳ 1.015.
- "Không ghi lại 10 triệu lãi đã nhận."
- Thao tác: **Đóng hợp đồng**, do Kế toán làm.

**Quy tắc**
- *Nguồn (D1 tr. 39):* tất toán nhận thêm 1.005 = gốc 1.000 + lãi 5, không ghi lại lãi đã thu.
- *Đề xuất:*
  - Lãi nhận khi tất toán chính là kỳ lãi cuối còn mở trong T04. Tất toán **đóng** kỳ đó, không tạo thêm một khoản lãi mới, để tổng lãi không bị đếm trùng.
  - Sau khi tất toán, hợp đồng bị khóa: không ghi nhận thêm lãi, không tái tục.
  - Tất toán trước hạn: chưa có nguồn mô tả (phiếu L0 câu E2).

### T06 · Tái tục, phương án B (D1 tr. 38)

**Hồ sơ trong hình:** TG-002, tái tục từ TG-001.
- Kỳ cũ TG-001 "Kết thúc kỳ": gốc còn hiệu lực 0, lãi cả kỳ đã nhận 10 + 5 = 15, ngày chuyển kỳ 30/11/2026.
- Kỳ mới TG-002 "Đang gửi": gốc 1.000, kỳ 30/11/2026 – 28/02/2027, điều kiện 6%/năm theo cơ sở 90/360 ngày.
- Thẻ tổng: gốc kỳ mới 1.000, lãi trả thêm 5, gốc cũ còn hiệu lực 0, gốc đang gửi 1.000.
- "Thay phương án A; lãi cũ 10 + 5 = 15, không tăng gốc."
- Thao tác: **Mở kỳ gửi mới**, do Kế toán làm.

**Quy tắc**
- *Nguồn (D1 tr. 39):* liên kết hai kỳ; gốc 1.000 triệu, không cộng trùng thành 2.000 triệu.
- *Nguồn (D1 tr. 4):* tất toán và tái tục là hai phương án thay thế.
- *Đề xuất:*
  - Một hợp đồng đến hạn chỉ có **một** cách xử lý cuối kỳ, hoặc tất toán hoặc tái tục. Hệ thống chặn việc làm cả hai, kể cả khi hai người thao tác cùng lúc.
  - Tái tục chuyển gốc còn hiệu lực của kỳ cũ về 0 và mở kỳ mới với gốc bằng số tái tục.
  - "Gốc đang gửi" của quỹ = tổng gốc các hợp đồng "Đang gửi"; một khoản gốc không bao giờ được tính ở hai hợp đồng.
  - Trong hình, lãi kỳ cũ được trả ra, không nhập gốc. Trường hợp nhập lãi vào gốc, hoặc tái tục với số gốc khác, cần khách chốt (phiếu L0 câu E3).

## 3. Dữ liệu cần có (mức nghiệp vụ, chưa phải thiết kế DB)

| Hồ sơ | Mã trong hình | Trường chính | Liên kết |
|---|---|---|---|
| Thư mời chào lãi | MC-xxx | tòa/quỹ, số tiền, kỳ hạn, hạn phản hồi, tệp thư | ngân hàng được mời |
| Bản chào | — | ngân hàng, lãi suất/năm, điều kiện, ngày nhận, tình trạng hồ sơ, tệp | thư mời |
| Kết quả chọn | KQ-TGxx | bản chào được chọn, căn cứ, người duyệt, biên bản BB-TGxx | thư mời |
| Hợp đồng tiền gửi | TG-xxx | ngân hàng, gốc, lãi suất, quy ước ngày, ngày gửi, đáo hạn, kỳ trả lãi, bản ký | kết quả chọn; kỳ trước (khi tái tục) |
| Kỳ lãi | L-xxx | ngày đến hạn, số phải nhận, trạng thái | hợp đồng |
| Khoản thực nhận | — | ngày, số tiền, chứng từ, dòng sao kê | kỳ lãi |
| Tất toán | TT-TGxx | gốc thu hồi, lãi nhận thêm, giao dịch GD-xx, hồ sơ | hợp đồng; kỳ lãi cuối |
| Tái tục | — | ngày chuyển kỳ, gốc tái tục, xử lý lãi | hợp đồng cũ → hợp đồng mới |

Tiền lưu dạng số nguyên VND, như quy ước hiện có của API. Mọi thay đổi ghi audit.

## 4. Câu hỏi mới của nhóm T

Các câu này chưa có trong phiếu L0; sẽ bổ sung vào phiếu và `DECISIONS.md` dưới mã OD-16.

| ID | Câu hỏi |
|---|---|
| TQ-01 | Mỗi tòa có một quỹ bảo trì và tài khoản riêng, hay bốn tòa dùng chung một quỹ? |
| TQ-02 | Bản chào nhận sau hạn phản hồi có được đưa vào so sánh không? |
| TQ-03 | Sau khi đã chọn ngân hàng, có được đổi kết quả không? Ai được đổi và với điều kiện gì? |
| TQ-04 | Khi hợp đồng thay đổi (phụ lục, đổi lãi suất), ghi nhận thế nào? Lịch lãi cũ xử lý ra sao? |
| TQ-05 | Ngân hàng có bao giờ trả thiếu một kỳ lãi không? Nếu có, phần thiếu được theo dõi và đòi thế nào? |
| TQ-06 | Đối chiếu lãi với sao kê dùng chung chức năng nhập sao kê của quỹ khai thác (F08), hay quỹ bảo trì có tài khoản và sao kê riêng? |

## 5. Đề xuất cắt slice khi viết SPEC

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| T-S1 | Danh mục ngân hàng; T01 thư mời và bản chào; T02 so sánh và chọn | TQ-01–TQ-03; vai trò duyệt (OD-10) |
| T-S2 | T03 hợp đồng và sinh lịch lãi | OD-06 câu E1; mẫu hợp đồng thật (OD-07) |
| T-S3 | T04 ghi nhận lãi, trạng thái kỳ, quá hạn | TQ-05; sao kê (TQ-06) |
| T-S4 | T05 tất toán và T06 tái tục, có khóa loại trừ lẫn nhau | phiếu L0 câu E2, E3 |
| T-S5 | Dashboard quỹ bảo trì và kịch bản nghiệm thu D1 tr. 39 | toàn bộ các slice trên |
