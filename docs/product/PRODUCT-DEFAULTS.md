# Phương án mặc định của sản phẩm cho các câu hỏi chưa có khách trả lời

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Hiệu lực:** theo [PD-06](DECISIONS.md)

## Vì sao có file này

- Chủ dự án làm sản phẩm trước, rồi mới đi chào khách. Vì vậy mỗi câu hỏi OD-xx chưa có khách trả lời được thay bằng một **phương án mặc định có căn cứ**.
- Khi có ghi chú của khách, PM/BA cập nhật file này và các SPEC liên quan.
- Mặc định có **giá trị như quyết định đã chốt** khi viết SPEC. Trong SPEC, quy tắc lấy từ mặc định dẫn mã `DF-xx`.

**Thứ tự ưu tiên căn cứ**
1. Biểu mẫu và quy trình thật của khách (D5).
2. Văn bản pháp luật.
3. Proposal D1 và báo giá D2.
4. Thực hành phổ biến.

Mỗi dòng ghi rõ căn cứ thuộc loại nào. Ghi "**giả định**" khi không tìm được căn cứ trực tiếp.

## Nguồn đã đọc

| Mã | Nguồn | Vị trí |
|---|---|---|
| D5-TT | Mẫu tờ trình | `sources/customer/D5-bieu-mau/Số tờ trình.docx` |
| D5-NT | Mẫu biên bản nghiệm thu | `…/BIÊN BẢN NGHIỆM THU.docx` |
| D5-TDN | Mẫu thư đề nghị chuyển khoản thanh toán cho nhà thầu | `…/BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx` |
| D5-CT | Mẫu thông báo chào thầu sửa chữa | `…/BAN QUẢN LÝ KHU ĐÔ THỊ.docx` |
| D5-QT | Quy trình hồ sơ kỹ thuật, 10 bước (bảng Excel) | `…/Thông tin quy trình hồ sơ KT.xlsx` |
| TT05 | Thông tư 05/2024/TT-BXD và Quy chế quản lý, sử dụng nhà chung cư kèm theo. Đọc bản đăng tại [vcci.com.vn](https://www.vcci.com.vn/en/legal-document/05-2024-tt-bxd), vì trang moc.gov.vn lỗi chứng chỉ. Mẫu D5-TT dẫn Điều 34 và 37 của văn bản này | Quy chế Điều 25.3a, 31.7, 32.5, 33.1, 34, 35.4, 36.1, 37 |
| LNO | Luật Nhà ở 2023, Điều 152–153: mở tài khoản và bàn giao kinh phí bảo trì. Đọc qua bài tổng hợp, **chưa đọc nguyên văn** | — |

**Lưu ý pháp lý:** PM/BA không phải luật sư. Các dòng dựa trên TT05 hoặc LNO là căn cứ để thiết kế, cần đơn vị vận hành hoặc luật sư xác nhận trước khi đưa vào vận hành thật.

**Quy trình thật của khách (D5-QT, 10 bước):**
1. NVKT của BQL ghi nhận hư hỏng kèm hình ảnh, gửi BQT và TVKT.
2. BQT hoặc TVKT kiểm tra thực tế và xác nhận. Bảng ghi chú: "Gộp chung bước 1, xác nhận online".
3. BQL gửi chào thầu và xin báo giá từ các nhà thầu.
4. BQL trình tờ trình **kèm 03 báo giá** và biên bản ghi nhận sự việc; Giám đốc BQL ký.
5. BQT phê duyệt, hoặc từ chối kèm lý do; BQT ký.
6. BQL thông báo nhà thầu và kế hoạch thực hiện cho BQT và cư dân.
7. BQL thông báo hoàn tất sửa chữa, đề nghị nghiệm thu.
8. Lập biên bản nghiệm thu.
9. BQL đề nghị BQT thanh toán.
10. **BQT xác nhận đã thanh toán.**

Nhánh không được duyệt: bổ sung và trình lại lần 2, rồi lần 3. Sau lần 3 vẫn không duyệt thì **thông báo toàn cư dân** việc chưa xử lý, kèm nguyên nhân.

## Phương án mặc định

### Luồng sửa chữa (ảnh hưởng SPEC B03–B09 S2–S4)

| ID | Câu hỏi | Mặc định | Căn cứ | Khác demo/SPEC hiện tại? |
|---|---|---|---|---|
| DF-01 | Ai xác nhận hiện trạng (OD-03, OD-10) | Người xác nhận được cấu hình theo tòa. Mẫu cấu hình "Aqua" dùng **TVKT**. Không có TVKT thì dùng **BQT** | D5-QT bước 2 | **Có.** Demo dùng KT (`TECH_CONFIRMER`). Cần cho TVKT/BQT quyền xác nhận (`RECORD_CONFIRM`) hoặc cho phép cấu hình người xác nhận |
| DF-02 | Chuỗi duyệt tờ trình (OD-03) | TVKT thẩm định nội dung → BQT phê duyệt. Quyết định của BQT được ghi bởi **một đại diện BQT** (người được giao), **kèm biên bản họp BQT** (bắt buộc đính kèm khi duyệt) | D5-TT có ô "Thẩm định nội dung", "Kính gửi BQT", "Ý kiến BQT"; TT05 Điều 25.3a (75% thành viên BQT đồng ý) | Có một phần: thêm tệp bắt buộc "biên bản họp BQT" ở bước BQT duyệt |
| DF-03 | Nội dung tờ trình (OD-11) | Tờ trình có các trường: kính gửi, người trình, người lập, người thẩm định, loại tờ trình, ngân sách, ngày trình, lần trình, nội dung xin duyệt, đề xuất và đánh giá, hạn mong muốn duyệt. **Bảng báo giá theo hạng mục** gồm STT, hạng mục, đơn vị, số lượng, đơn giá, thành tiền, cùng chi phí khác, thuế và tổng (đã gồm VAT). Mỗi nhà thầu một cột, **mặc định 3 nhà thầu**. Ít hơn 3 thì bắt buộc ghi lý do. BQL đề xuất một nhà thầu; **BQT có thể chọn nhà thầu khác** trong các báo giá. Đính kèm bắt buộc: báo giá của từng nhà thầu, biên bản ghi nhận sự việc | D5-TT; D5-QT bước 4 "03 báo giá"; TT05 Điều 31.7 (chào giá cạnh tranh); D1 tr. 19 | **Có.** Demo chỉ có 1 số tiền và 1 nhà thầu |
| DF-04 | Số lần trình (OD-15) | Tối đa 3 lần. Sau lần không duyệt thứ 3, hồ sơ chuyển "Chưa xử lý" và hệ thống soạn **thông báo gửi toàn cư dân**, kèm nguyên nhân | D5-QT bước 6–10 (nhánh không duyệt) | Không. Đây là quy tắc demo, **nay đã có căn cứ** |
| DF-05 | Thông báo nhà thầu và kế hoạch (D5-QT bước 6) | Sau khi duyệt, BQL ghi ngày dự kiến thi công và nhà thầu, rồi phát hành thông báo kế hoạch cho BQT và cư dân (thông báo trong hệ thống) | D5-QT bước 6 | **Có,** thêm một bước nhỏ trước "Bắt đầu thi công" |
| DF-06 | Cách nghiệm thu (OD-12) | Mỗi lượt nghiệm thu có một **biên bản theo mẫu D5-NT**: thời gian, địa điểm, thành phần (đại diện BQL, BQT, TVKT nếu có, cư dân hoặc cơ quan chức năng nếu có), nội dung, kết luận ĐẠT/KHÔNG ĐẠT, điểm cần lưu ý. Thành phần bắt buộc cấu hình theo tòa; mẫu "Aqua" là **BQL + BQT + TVKT**. Lượt chỉ đạt khi mọi thành phần bắt buộc xác nhận ĐẠT. Danh sách hạng mục kiểm tra như D1 tr. 22 là **tùy chọn**, không bắt buộc | D5-NT; D5-QT bước 8; TT05 Điều 35.4 | **Có.** Demo dùng KT + TVKT. BQT cần quyền nghiệm thu (`ACCEPTANCE_DECIDE`) |
| DF-07 | Ký trên hệ thống (OD-13) | Ký nhanh bằng chuột hoặc cảm ứng, **không phải chữ ký số**, ở bốn tài liệu: (1) tờ trình, BQL ký khi trình; (2) quyết định duyệt hoặc từ chối của BQT; (3) biên bản nghiệm thu, mỗi thành phần ký; (4) đề nghị thanh toán, BQL ký. Sửa nội dung sau khi ký thì tạo **phiên bản mới** và phải ký lại; phiên bản cũ giữ nguyên để tra cứu | D5-QT bước 4–5 nêu chữ ký số; D1 tr. 45 và D2 mục 04 loại trừ chữ ký số, nên dùng ký nhanh; D5-NT có ô ký các bên | **Có.** Demo chỉ ký khi trình tờ trình |
| DF-08 | Thanh toán (OD-05) | Một hồ sơ có **nhiều đợt thanh toán**. Mỗi đợt: BQL lập đề nghị theo mẫu D5-TDN (người hưởng, tài khoản, ngân hàng, số tiền bằng số và chữ, nội dung) → BQT duyệt → **BQT (hoặc Kế toán, DF-10) xác nhận đã chuyển khoản**, kèm chứng từ. **Đợt tạm ứng** được phép trước nghiệm thu, cần đề nghị của nhà thầu. Đợt **quyết toán** chỉ lập được sau nghiệm thu đạt, và bắt buộc đủ bộ hồ sơ D5-TDN: công văn đề nghị thanh toán của nhà thầu, tờ trình và báo giá đã duyệt, biên bản nghiệm thu hoàn thành, hóa đơn GTGT. Tổng các đợt không vượt số được duyệt; vượt thì phải trình bổ sung (một lần trình mới). Hồ sơ hoàn tất khi tổng đã chi bằng số quyết toán | D5-TDN; D5-QT bước 9–10; D2 nhóm 09; D1 tr. 23; TT05 Điều 35.4, 37.3–37.4 | **Có.** Demo chỉ một lần, đúng đủ, BQL ghi nhận |
| DF-09 | Xử lý khẩn cấp (B06) | BQL bắt đầu xử lý khẩn cấp trong hạn mức tiền của tòa (`emergencyLimitVnd`); BQT được thông báo ngay. Tờ trình phải nộp bổ sung trong `emergencyDocHours`. BQT duyệt hậu kiểm. Nếu không duyệt: hồ sơ ghi "Không được duyệt hậu kiểm", chặn thanh toán, chuyển BQT xử lý. Mọi hồ sơ khẩn cấp có cờ "báo cáo hội nghị gần nhất" | TT05 Điều 32.5, 37.5; D2 nhóm 06 | Không lệch so với cấu hình đã có; quy tắc hậu kiểm là phần mới (SPEC B06) |

### Vai trò, phân quyền, tài khoản

| ID | Câu hỏi | Mặc định | Căn cứ | Khác hiện tại? |
|---|---|---|---|---|
| DF-10 | Vai trò Kế toán, Người nghiệm thu (OD-10) | Thêm vai trò hệ thống **Kế toán** thuộc phía BQT: xác nhận đã chuyển khoản (B09) và làm toàn bộ nghiệp vụ tiền của F06–F09 và T03–T06. Không thêm vai trò "Người nghiệm thu" riêng: đó là các thành phần trong biên bản (DF-06) | D1 tr. 23, 35–38 (Kế toán); D5-NT (thành phần nghiệm thu); sơ đồ D1 "Kỹ thuật · Kế toán" | **Có.** Vai trò mới phải sửa code (roles RG-02), cần ADR |
| DF-11 | Ai sửa cấu hình tòa (OD-17 RQ-01) | **Chỉ Quản trị hệ thống** (bỏ quyền `BUILDING_CONFIG` khỏi BQL). BQL đề xuất thay đổi ngoài hệ thống | Tách bạch trách nhiệm; TT05 Điều 25 (BQT quyết định chi, không phải BQL) | **Có** (roles RG-01) |
| DF-12 | Nhân viên nghỉ hoặc bị thu hẹp quyền (OD-17 UQ-01, UQ-02) | Không chặn việc khóa tài khoản. Mọi bước đang mở mà người đó không còn làm được thì chuyển vào danh sách **"Cần phân công lại"** của tòa; Quản trị và BQL được thông báo. Quản trị (`REPLACE_MANAGER`) và BQL (`REASSIGN`) chọn người mới; bắt buộc ghi lý do; ghi audit | D2 nhóm 02 "phân công lại khi thay đổi nhân sự", nhóm 17 "thay người phụ trách và chuyển giao công việc" | Có (users UG-03, UG-04) |
| DF-13 | Đổi vị trí (OD-17 UQ-03) | Giữ cách hiện tại: đổi vai trò gốc thì tạo tài khoản mới. Tài khoản cũ được khóa, bước đang mở đi theo DF-12 | Code hiện tại; **giả định** | Không |
| DF-14 | Vai trò tự đặt (OD-17 RQ-02) | Cho phép ngừng dùng vai trò tự đặt khi **không còn ai giữ**. Không xóa, để giữ lịch sử | **Giả định** (thực hành chung) | Có, nhỏ |
| DF-15 | Đăng nhập và mật khẩu (AQ-01–AQ-04) | (1) **Bắt đổi mật khẩu** ở lần đăng nhập đầu và sau khi quản trị đặt lại. (2) Chưa có "quên mật khẩu" tự phục vụ: chưa có kênh, vì kênh nhắn tin ngoài bị loại trừ (D1 tr. 45) và email chưa được xác nhận; quản trị đặt lại. (3) Mật khẩu 8–72 ký tự, không trùng tên đăng nhập hoặc mã. (4) Sai 5 lần liên tiếp thì khóa tạm tài khoản 15 phút. (5) Quản trị xem được lịch sử đăng nhập. (6) Cho phép đăng nhập nhiều thiết bị | **Giả định** (thực hành bảo mật phổ biến) | Có (auth AG-02, AG-05, AG-09) |

### Phạm vi, nghiệm thu, dữ liệu

| ID | Câu hỏi | Mặc định | Căn cứ |
|---|---|---|---|
| DF-16 | Phạm vi sản phẩm (OD-01) | Làm đủ phạm vi D1: 34 nghiệp vụ + S01 + A01. Giá, gói và bảo hành (OD-01 phần thương mại, OD-02) **không phải quyết định sản phẩm**; chủ dự án tự chốt khi chào khách | D1 tr. 2, 42 |
| DF-17 | Tiêu chí nghiệm thu nhóm B (OD-14) | Bộ AC trong từng SPEC, cộng bộ kịch bản nghiệm thu tổng do PM/BA soạn theo mẫu review 23/10 §9, là tiêu chí mặc định để chủ dự án trình khách | review 23/10 §9; D1 tr. 39 (cách viết kịch bản cho nhóm T) |
| DF-18 | Biểu mẫu chính thức (OD-07) | Bốn mẫu D5 (tờ trình, biên bản nghiệm thu, thư đề nghị thanh toán, thông báo chào thầu) là mẫu mặc định. Hệ thống sinh bản xem hoặc in theo đúng bố cục và các trường của mẫu. Mẫu cho F và T: PM/BA soạn từ các trường thấy trong hình D1 | D5; D1 |
| DF-19 | Trợ lý AI lần đầu (OD-08) | Chỉ đọc, theo quyền của người hỏi. Ba tác vụ: (1) tóm tắt một hồ sơ; (2) tổng hợp việc ưu tiên của tôi; (3) trả lời số liệu (sửa chữa, quỹ) **kèm link về hồ sơ nguồn**. Không thay người quyết định nghiệp vụ. Thiếu dữ liệu thì nói rõ là không có, không suy đoán | D2 mục 05; D1 tr. 41 "Mở ngay căn cứ" |

### Quỹ khai thác và tiền gửi

| ID | Câu hỏi | Mặc định | Căn cứ |
|---|---|---|---|
| DF-20 | Quỹ theo tòa (OD-16 TQ-01) | **Mỗi tòa có quỹ bảo trì và tài khoản riêng.** Quỹ khai thác cũng theo tòa. Dashboard gộp được bốn tòa | D1 (mọi màn hình ghi "Aqua 1 · Quỹ…"); TT05 Điều 36–37 (tài khoản theo nhà chung cư) |
| DF-21 | Kỳ hạn gửi, chủ tài khoản | Mỗi quỹ có hồ sơ "Quy chế thu chi" gồm kỳ hạn cho phép, người đứng tên đồng chủ tài khoản và tệp quy chế đã được hội nghị thông qua. Hợp đồng tiền gửi kiểm theo quy chế này | TT05 Điều 36.1 |
| DF-22 | Cách tính lãi (OD-06 E1) | Quy ước tính ngày (365 hay 360) và cách làm tròn là **trường bắt buộc của từng hợp đồng tiền gửi**, không có mặc định chung. Hình D1 dùng 360 chỉ là minh họa | D1 tr. 34–35 ghi "lãi suất mẫu" |
| DF-23 | Lãi tiền gửi dùng vào đâu | Lãi thực nhận ghi tăng số dư **quỹ bảo trì** của tòa | **Giả định.** Chưa tìm thấy điều khoản trong TT05 (bản đã đọc); cần xác nhận pháp lý |
| DF-24 | Tái tục và tất toán trước hạn (OD-06 E2, E3) | Tái tục mặc định chỉ tái tục gốc; lãi kỳ cũ trả về tài khoản quỹ. Cho phép tùy chọn "nhập lãi vào gốc", phải ghi lý do. Tất toán trước hạn: kế toán nhập **lãi thực nhận theo chứng từ ngân hàng**; hệ thống không tự tính lại | D1 tr. 38; **giả định** cho phần trước hạn |
| DF-25 | Bản chào trễ, đổi kết quả, phụ lục, trả thiếu (OD-16 TQ-02–TQ-05) | (1) Bản chào trễ hạn được lưu và đánh dấu "trễ hạn"; chỉ đưa vào so sánh khi người duyệt cho phép, kèm lý do. (2) Đổi kết quả chọn chỉ khi chưa có hợp đồng, kèm lý do. (3) Phụ lục tạo phiên bản mới của hợp đồng; các kỳ lãi chưa nhận được sinh lại. (4) Ngân hàng trả thiếu thì kỳ lãi chuyển "Nhận thiếu", phần còn lại được theo dõi đến khi nhận đủ hoặc được điều chỉnh (có lý do) | **Giả định** (an toàn, có audit) |
| DF-26 | Sao kê (OD-16 TQ-06) | Dùng **chung một chức năng nhập sao kê** (F08). Sao kê gắn với **tài khoản**, mỗi quỹ một tài khoản. Lãi tiền gửi đối chiếu với sao kê của tài khoản quỹ bảo trì | TT05 Điều 37.1 (tài khoản riêng, cố định); D1 tr. 12, 36 |
| DF-27 | Trình tự quỹ khai thác (OD-04) | Hội nghị nhà chung cư thông qua **trước** khi BQT ký hợp đồng khai thác. Hợp đồng không được ở trạng thái "Hiệu lực" khi chưa có quyết nghị hội nghị đính kèm | **Giả định thận trọng.** TT05 Điều 24.2c cho BQT ký hợp đồng khai thác tiện ích; chưa tìm thấy quy định về thứ tự |
| DF-28 | Tiền thu từ khai thác dùng vào đâu | Ghi vào **quỹ khai thác** của tòa, tách khỏi quỹ bảo trì. Việc chuyển sang quỹ khác là một khoản chi có duyệt | **Giả định.** Chưa tìm thấy điều khoản (cần xác nhận pháp lý); D1 tr. 2 "hai quỹ theo dõi riêng" |

## Hệ quả cho công việc

1. **SPEC B03–B09 cần phiên bản 2 cho S2–S4.** Các quy tắc tạm TR-01 đến TR-06 được thay bằng DF-01 đến DF-08 và DF-10:
   - chuỗi người, vai trò Kế toán;
   - tờ trình nhiều nhà thầu theo hạng mục;
   - biên bản nghiệm thu theo thành phần;
   - ký 4 loại tài liệu;
   - thanh toán nhiều đợt.

   Riêng TR-06 về giới hạn 3 lần trình được **giữ** (DF-04). Slice S1 đã xong không bị ảnh hưởng; chỉ DF-01 làm đổi người xác nhận mặc định, và việc này đi qua cấu hình.
2. **Ma trận quyền phải sửa:** TVKT và BQT được xác nhận hiện trạng và nghiệm thu; BQL mất `BUILDING_CONFIG`; thêm vai trò Kế toán. Dev-build cần ADR.
3. **Thêm SPEC mới:**
   - B06 khẩn cấp (DF-09);
   - US-S2 phân công lại (DF-12);
   - AU-S2 bắt đổi mật khẩu, khóa tạm, lịch sử đăng nhập (DF-15);
   - nhóm T (DF-20 đến DF-26);
   - nhóm F (DF-26 đến DF-28).
4. **Phiếu khảo sát L0** vẫn giữ nguyên, để chủ dự án dùng khi đi chào khách. Mỗi câu trả lời của khách sẽ đối chiếu với DF-xx tương ứng.
