# Module B07: Ký và biểu mẫu

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-18)**
**Code đã đọc** (commit `fb4fd7a`):
- API: `api-qltn/src/modules/records/signature.ts`, `entities/repair-signature.entity.ts`, `proposals.service.ts` (ký tờ trình, `boardEvidence`), `construction.service.ts` (ký quyết định nghiệm thu), `payments.service.ts` (ký đề nghị tạm ứng và quyết toán, `savePayment`), `proposal.types.ts`, `dto/proposal.dto.ts`, các entity proposal / acceptance / payment.
- Web: `components/common/SignaturePad.tsx`, `features/records/components/quote/*` (`QuoteSubmissionCard`, `QuoteDecisionDialog`), `execution/MinutesCard.tsx`, `execution/MemberDecisionDialog.tsx`, `instalments/PaymentRequestDialog.tsx`, `InstalmentCard.tsx`, `detail/record-document.ts`, `detail/RecordDocumentButton.tsx`, `detail/RecordDetailHeader.tsx`.
- Biểu mẫu khách: 4 tệp `.docx` trong `sources/customer/D5-bieu-mau/` (đã đọc chữ, mục 3).

**Liên quan nghiệp vụ:**
- D2 nhóm 07: "Ký nhanh bằng chuột hoặc cảm ứng; gắn người ký, thời điểm và phiên bản; xem bộ biểu mẫu hồ sơ theo nghiệp vụ." D2 mục 04: "Ký nhanh không bao gồm tích hợp chữ ký số."
- D1 tr. 21 "Ký nhanh, gắn đúng người và phiên bản" (đã xem hình).
- DF-07 (ký 4 tài liệu, sửa sau khi ký thì tạo phiên bản mới), DF-18 (4 mẫu D5 là mẫu mặc định, hệ thống sinh bản xem/in theo bố cục mẫu). DG-03, OD-07, OD-13.
- SPEC B03–B09 v2 §2 để **ngoài phạm vi** việc xuất PDF / bản in theo mẫu; §4.1–4.4 là dữ liệu đã lưu.

## 1. Tính năng và trạng thái

| # | Tính năng | API | Web `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| KY-01 | BQL ký khi trình tờ trình (T05/T06) | `submit-proposal`, `resubmit-proposal` | có | `record-proposals` | **Có** (S2) |
| KY-02 | BQT ký khi duyệt hoặc từ chối ở bước BQT, kèm biên bản họp BQT | `approve-proposal`, `reject-proposal` | có | `record-proposals` | **Có** (S2) |
| KY-03 | Mỗi thành phần nghiệm thu ký khi chọn ĐẠT / KHÔNG ĐẠT | `pass-acceptance`, `fail-acceptance` | có (`MemberDecisionDialog`) | `record-construction` | **Có** (S3) |
| KY-04 | BQL ký đề nghị tạm ứng và đề nghị quyết toán | `submit-advance-request`, `resubmit-advance-request`, `submit-payment-request` | có (`PaymentRequestDialog`) | `record-payments` | **Có** (S4) |
| KY-05 | Xem chữ ký trên màn: lần trình, biên bản nghiệm thu từng lượt, đợt thanh toán | trong `GET /records/:id` | có | — | **Có** |
| KY-06 | Biên bản nghiệm thu do hệ thống tạo từ dữ liệu, khóa khi mọi thành phần đã quyết định | có | `MinutesCard` | `record-construction` | **Có** (S3, đóng DG-03 phần "tạo và ký") |
| BM-01 | "Xem bộ biểu mẫu" (HTML in được, dàn A4, in ra PDF bằng trình duyệt) | không cần API | **ẩn ở chế độ `api`** | test web | **Demo**. Chỉ đọc dữ liệu mock; bố cục tự đặt, không theo mẫu D5 |
| BM-02 | In / PDF từng tài liệu theo đúng mẫu D5 (tờ trình, biên bản, thư đề nghị) | không có | không | không | **Chưa có** (DF-18) |
| BM-03 | Thông báo chào thầu (mẫu D5 thứ tư) | không có | không | không | **Chưa có**. D5-QT bước 3 hiện làm ngoài hệ thống |
| BM-04 | Màn "Ký và biểu mẫu" của D1 tr. 21: danh sách tài liệu, số trường đủ (4/4), số ảnh, số chữ ký, nút "Xác nhận ký" | không có | không | không | **Chưa có**. Hiện ký nằm trong từng hộp thoại thao tác |

## 2. Quy tắc đang chạy

- **Chữ ký** là ảnh PNG vẽ bằng chuột hoặc cảm ứng, gửi dạng data URL. API kiểm: đúng tiền tố `data:image/png;base64,`, đúng mã PNG, 1 byte – 200 KB. Sai thì báo lỗi ở trường `signature`.
- Lưu ở bảng `repair_signatures`: hồ sơ, loại tài liệu, mã tài liệu, người ký, ảnh, thời điểm (`created_at`).
- **Loại tài liệu có ký:** `PROPOSAL` (lần trình), `BOARD_DECISION` (quyết định bước BQT), `ACCEPTANCE_DECISION` (quyết định của một thành phần), `PAYMENT_REQUEST` (đợt tạm ứng / quyết toán).
- **Không ký:** quyết định của bước TVKT, xác nhận chuyển khoản, đóng hồ sơ. Khớp DF-07 (4 tài liệu).
- **Phiên bản:**
  - Lần trình tờ trình là bản ghi **bất biến** (BR-S2-02). Trình lại = lần trình mới, ký lại. Đúng DF-07.
  - Quyết định nghiệm thu bất biến; lượt mới là biên bản mới, lượt cũ giữ nguyên.
  - Đợt thanh toán bị trả lại rồi gửi lại thì **ghi đè cùng dòng**, tăng `revision_no`, ký lại (`savePayment`). Chữ ký cũ vẫn còn, nhưng nội dung bản cũ không còn (B7G-04).
- Người ký luôn là người đăng nhập đang giữ bước. Không có chữ ký lưu sẵn theo tài khoản.

## 3. Đối chiếu biểu mẫu D5 với dữ liệu đã lưu

Tên tệp không khớp nội dung. Đã kiểm bằng chữ trong tệp:
- `BAN QUẢN LÝ KHU ĐÔ THỊ.docx` là **Thông báo chào thầu**.
- `BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx` là **Thư đề nghị chuyển khoản thanh toán**.

### 3.1 Tờ trình (`Số tờ trình.docx`, SPEC §4.1–4.2)

| Trường trên mẫu | Hệ thống | Ghi chú |
|---|---|---|
| Kính gửi, Người trình, Người làm tờ trình, Thẩm định nội dung, Loại tờ trình, Ngân sách, Ngày trình, Lần trình thứ | có | §4.1 |
| Nội dung xin phê duyệt; Đề xuất và đánh giá; hạn mong muốn duyệt | có | §4.1 |
| Bảng báo giá theo nhà thầu: STT, hạng mục, đơn vị, số lượng, đơn giá, thành tiền, chi phí, thuế, tổng | có | §4.2, tối đa 5 nhà thầu |
| Hồ sơ đính kèm: báo giá, biên bản ghi nhận sự việc | có | tệp `QUOTATION`, `INCIDENT_MINUTES` |
| **Số tờ trình** | **thiếu** | Không có số văn bản; chỉ có mã hồ sơ và lần trình |
| **Nội dung tờ trình** (dòng tóm tắt, tách khỏi "Nội dung xin phê duyệt") | thiếu | Mẫu ghi "tương tự", có thể dùng tên hồ sơ |
| **Cơ sở xin phê duyệt** (căn cứ TT05 Điều 34, 37; biên bản ghi nhận) | thiếu | Đoạn chữ cố định, sinh khi in |
| **Ý kiến của Ban quản trị** | thiếu khi **duyệt** | Duyệt chỉ có lý do chọn nhà thầu khác; lý do chỉ có khi từ chối / yêu cầu bổ sung |
| Khối ký: "TM. BQT – Trưởng ban", "TM. BQL – Giám đốc", họ tên, ngày | thiếu chức danh | Có người ký và thời điểm; không có chức danh, tên tổ chức BQL |

### 3.2 Biên bản nghiệm thu (`BIÊN BẢN NGHIỆM THU.docx`, SPEC §4.3)

| Trường trên mẫu | Hệ thống | Ghi chú |
|---|---|---|
| Giờ, ngày, địa điểm | có | `inspected_at`, `inspection_location` |
| Đại diện BQL, BQT, TVKT | có | thành phần bắt buộc theo bước `ACCEPTANCE` |
| Đại diện cư dân / cơ quan chức năng (nếu có) | có, chữ tự do | `other_members` |
| Nội dung: công việc / hạng mục | có | `content` |
| Đánh giá ĐẠT / KHÔNG ĐẠT; Điểm cần lưu ý | có | kết luận chung do hệ thống tính; điểm lưu ý theo từng người |
| Ô ký 4 cột: BQL, BQT, TVKT, **Khác** | thiếu cột "Khác" | Thành phần khác không ký được trong hệ thống |
| Số biên bản | mẫu không có | Hệ thống có "lượt" (D1 dùng mã NT-001, "Phiên bản 03") |

### 3.3 Thư đề nghị thanh toán (SPEC §4.4)

| Trường trên mẫu | Hệ thống | Ghi chú |
|---|---|---|
| Người hưởng: tên TK, số TK, ngân hàng; số tiền và bằng chữ | có | bằng chữ do web tính |
| Nội dung "BQT … THANH TOAN CHI PHI …" | có | mặc định theo mã tòa, mã hồ sơ |
| Bộ hồ sơ: công văn nhà thầu, tờ trình và báo giá đã duyệt, biên bản nghiệm thu, hóa đơn GTGT | có | tệp `PAYMENT_REQUEST`, `INVOICE`; phần còn lại tự liên kết |
| **Kính gửi** | thiếu | Ngầm là BQT |
| **Ghi chú (nếu có)** | thiếu | |
| Đầu thư "BAN QUẢN LÝ «tên»"; "Đại diện Ban quản lý" | thiếu tên tổ chức BQL | Có người ký, không có chức danh |

### 3.4 Thông báo chào thầu (chưa có trong hệ thống)

Trường của mẫu: số công văn, "V/v", ngày, nơi phát sinh, **hạng mục**, **yêu cầu**, **hồ sơ cần cung cấp**, hạn nhận hồ sơ, người liên hệ và số điện thoại, nơi nhận, người ký (Giám đốc BQL). Hệ thống chỉ có tên và mô tả hồ sơ; còn lại phải nhập thêm.

## 4. Khoảng trống

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **B7G-01** | Ở chế độ `api` không có bản xem / in / PDF nào. Nút "Xem bộ biểu mẫu" bị ẩn; nó đọc cấu trúc mock (`submissions`, `acceptances`, `paymentRequests`), các trường này rỗng ở `api` | `RecordDetailHeader.tsx` dòng 53–58; `mappers.ts` dòng 1104–1110 | **Cao** (D2 nhóm 07; DF-18) | B7-S1 |
| B7G-02 | Bố cục bản in demo là bố cục tự đặt, không theo 4 mẫu D5 | `record-document.ts` | Cao | B7-S1 dựng theo mẫu D5 |
| B7G-03 | Thiếu trường so với mẫu: số tờ trình, ý kiến BQT khi duyệt, chức danh và tên tổ chức trong khối ký, kính gửi và ghi chú của thư đề nghị, chữ ký "Khác" của biên bản | mục 3 | Trung bình | B7-S2 (cần migration nhỏ) |
| B7G-04 | Gửi lại đợt thanh toán ghi đè nội dung cũ. Trái DF-07 "phiên bản cũ giữ nguyên để tra cứu" và D2 "gắn … phiên bản". Nhật ký chỉ ghi lý do, không ghi giá trị cũ | `payments.service.ts` `savePayment` (dòng 606–608), `commit` | Trung bình | Lưu bản chụp mỗi revision, như lần trình tờ trình. B7-S2 |
| B7G-05 | Chữ ký không gắn với nội dung đã ký (không có dấu vân tay nội dung). Chỉ gắn với mã tài liệu | `repair-signature.entity.ts` | Thấp nay; Cao nếu cần giá trị chứng cứ | Lưu mã băm nội dung lúc ký, in trên bản PDF (B7-S3) |
| B7G-06 | Không có thông báo chào thầu | D5; DF-18; D5-QT bước 3 | Thấp | B7-S3; sinh từ hồ sơ + vài trường nhập thêm |
| B7G-07 | Không có màn tổng hợp "Ký và biểu mẫu" như D1 tr. 21 | D1 tr. 21 | Thấp | Một tab trong chi tiết hồ sơ ở B7-S1 là đủ |
| B7G-08 | D5-QT bước 4–5 nói BQL và BQT dùng **chữ ký số**; mẫu tờ trình ghi "(Đã ký)". Hệ thống dùng ảnh chữ ký (DF-07) | PRODUCT-DEFAULTS mục D5-QT; DF-07 | Cần cờ pháp lý | Xem mục 5 |

## 5. Giá trị pháp lý (chỉ nêu cờ, PM/BA không kết luận)

- Ảnh chữ ký vẽ tay trên hệ thống **không phải chữ ký số**. Nó chứng minh tài khoản nào đã bấm ký, lúc nào. Nó không chứng minh nội dung chưa bị sửa sau đó (B7G-05).
- D1 tr. 45 và D2 mục 04 loại chữ ký số khỏi phạm vi. DF-07 chọn ký nhanh vì lý do đó.
- Hệ quả cần chủ dự án biết khi chào khách: bản in từ hệ thống có thể vẫn phải **ký tay hoặc ký số ngoài hệ thống** nếu ngân hàng, kiểm toán hoặc hội nghị nhà chung cư đòi bản có giá trị pháp lý. Cần luật sư hoặc đơn vị vận hành xác nhận (lưu ý pháp lý của PRODUCT-DEFAULTS).

## 6. Câu hỏi cho khách

Đề xuất gom thành **OD-21** trong `DECISIONS.md`, nối với OD-07 và OD-13.

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| B7Q-01 | Bản in từ hệ thống có được dùng làm văn bản chính thức, hay vẫn ký tay / ký số bản giấy? | Dùng để lưu và trình xem; bản chính thức ký ngoài hệ thống |
| B7Q-02 | Số tờ trình và số công văn đánh theo quy tắc nào (theo tòa, theo năm, ví dụ "12/2026/TT-BQL")? | Số tăng dần theo tòa và năm, cấp khi trình lần 1 |
| B7Q-03 | Người ký tờ trình là Giám đốc BQL (D5-QT bước 4) hay người quản lý hồ sơ? | Người quản lý hồ sơ, như hiện tại; in chức danh theo vai trò |
| B7Q-04 | Thành phần "Khác" của biên bản (cư dân, cơ quan chức năng) có cần ký trên hệ thống không? | Không; in ô ký trống để ký tay |
| B7Q-05 | Có dùng thông báo chào thầu trong hệ thống không? Gửi nhà thầu bằng cách nào? | Có, chỉ sinh bản in; gửi ngoài hệ thống |
| B7Q-06 | Tên tổ chức BQL, logo, chức danh người ký lấy từ đâu (theo tòa hay toàn khu)? | Cấu hình theo tòa |

## 7. Đề xuất slice

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **B7-S1** ([SPEC](../features/B07-ky-va-bieu-mau/SPEC.md), đã triển khai 27/10) | Bản xem / in (A4, in ra PDF bằng trình duyệt) theo đúng bố cục 3 mẫu D5: tờ trình (mỗi lần trình), biên bản nghiệm thu (mỗi lượt), thư đề nghị (mỗi đợt). Dùng dữ liệu `api` đã có; trường chưa có thì để dòng trống như mẫu. Thay nút demo | Không. Dữ liệu S2–S4 đã đủ cho phần lớn trường |
| B7-S2 | Bổ sung trường thiếu (B7G-03), lưu bản chụp mỗi revision thanh toán (B7G-04) | B7Q-02, B7Q-03, B7Q-06 |
| B7-S3 | Thông báo chào thầu; mã băm nội dung lúc ký và in trên bản PDF; tạo PDF phía máy chủ nếu cần lưu kèm hồ sơ | B7Q-01, B7Q-05 |

**AC nháp cho B7-S1:**
- **AC-1** Ở chế độ `api`, hồ sơ đã trình 2 lần có 2 bản xem tờ trình. Mỗi bản hiện đúng trường §4.1, bảng báo giá với tổng từng nhà thầu, ảnh chữ ký BQL và thời điểm ký của lần đó.
- **AC-2** Tờ trình đã được BQT duyệt hiện chữ ký BQT và thời điểm trong khối "TM. Ban quản trị". Lần trình bị từ chối hiện lý do ở mục "Ý kiến của Ban quản trị".
- **AC-3** Biên bản lượt 1 KHÔNG ĐẠT và lượt 2 ĐẠT là hai bản riêng. Mỗi bản có đủ thành phần, kết luận, điểm lưu ý và chữ ký từng người; ô "Khác" để trống.
- **AC-4** Thư đề nghị quyết toán hiện số tiền bằng số và bằng chữ khớp nhau, người hưởng, nội dung chuyển khoản và danh sách 4 loại hồ sơ đính kèm.
- **AC-5** Trường chưa có dữ liệu (ví dụ số tờ trình) in thành dòng chấm như mẫu, không in "undefined" hay "—".
- **AC-6** Người ngoài phạm vi tòa không mở được bản xem (404 như `GET /records/:id`).
- **AC-7** Bấm In trên trình duyệt ra đúng khổ A4, không cắt bảng báo giá giữa một dòng.
