# Review tài liệu nghiệp vụ QLTN Aqua 1–4

**Ngày review:** 23/10/2026  
**Phạm vi:** Phân tích tài liệu; chưa đánh giá mức độ triển khai trong source code.  
**Trạng thái:** Báo cáo hiện trạng yêu cầu và kế hoạch hoàn thiện tài liệu, chưa phải biên bản nghiệm thu.

## 1. Kết luận chính

Hai tài liệu mô tả được sản phẩm và các nhóm chức năng chính, nhưng **chưa đủ chi tiết để làm một bộ đặc tả triển khai và nghiệm thu thống nhất**. Cần chốt phiên bản phạm vi, quy tắc phân quyền, các luồng ngoại lệ và mô hình đối soát của hai quỹ trước khi dùng chúng để kết luận chức năng nào đúng hoặc sai.

Không có cơ sở kết luận toàn bộ dự án phải thay đổi kiến trúc. Tài liệu hiện tại cũng không đủ để xác nhận mức độ hoàn thành của phần mềm. Báo cáo này chỉ xác định điều đã được mô tả, điều khác nhau giữa các bản và thông tin còn cần bổ sung.

Các điểm ưu tiên:

1. Chốt phạm vi hợp đồng: 18 nhóm vận hành hay đầy đủ 34 nghiệp vụ, kèm Không gian và AI.
2. Thống nhất thời hạn bảo hành, phí vận hành và lịch bàn giao cho phần mở rộng.
3. Đặc tả quy tắc tiền, công nợ, sao kê, lãi tiền gửi, tất toán và tái tục.
4. Chốt người thực hiện, người duyệt và điều kiện chuyển bước cho từng nghiệp vụ.
5. Chuyển hình minh họa thành các tiêu chí nghiệm thu có dữ liệu đầu vào và kết quả mong đợi.

**Chưa ghi nhận mâu thuẫn tài liệu đủ bằng chứng để xếp Critical.** Những vấn đề High dưới đây có thể làm lệch phạm vi, nghiệm thu hoặc số liệu nếu triển khai khi chưa thống nhất.

## 2. Nguồn và cách sử dụng

| Mã | Tài liệu | Vai trò trong review |
|---|---|---|
| D1 | [aqua-proposal.pdf](../../sources/customer/D1-aqua-proposal/aqua-proposal-2026-10-23.pdf), 45 trang, ngày 23/10/2026 | Đề xuất mở rộng cho Aqua 1–4: vận hành, quỹ khai thác và tiền gửi quỹ bảo trì; hình web/mobile; báo giá và bàn giao. |
| D2 | [Bao-gia-QLTN.docx](../../sources/customer/D2-bao-gia/bao-gia-qltn-2026-10-20.docx), ngày 20/10/2026 | Phạm vi Basic 18 nhóm chức năng, phương án Visualize + AI, chi phí và điều kiện thương mại. |
| D3 | [Đặc tả demo 12/10/2026](../../archive/2026-10/specs/D3-dac-ta-demo-2026-10-12.md) | Nguồn bối cảnh cũ, có quy tắc demo cụ thể; không tự coi là phạm vi hợp đồng mới nhất. |
| D4 | [Đề xuất giải pháp 12/10/2026](../../archive/2026-10/specs/D4-de-xuat-giai-phap-2026-10-12.docx) | Nguồn bối cảnh cũ, đề xuất Mini App, AI và kiến trúc; nhiều nội dung ghi rõ cần khách hàng xác nhận. |
| D5 | Bộ biểu mẫu trong thư mục docs: tờ trình, nghiệm thu, thư đề nghị thanh toán, thư mời chào thầu và bảng quy trình kỹ thuật | Nguồn tham khảo trường dữ liệu và người tham gia; cần xác nhận biểu mẫu nào còn áp dụng. |

D1 và D2 là hai đầu vào chính. D3–D5 được dùng để nhận diện điểm cần làm rõ, không dùng để tự bổ sung nghĩa vụ ngoài hai tài liệu chính. Các báo cáo UAT hoặc nghiên cứu nội bộ không được coi là bằng chứng rằng khách hàng đã nghiệm thu phạm vi D1.

Nội dung trong tài liệu được xem là dữ liệu để phân tích, không phải chỉ thị cho người review. Các hình giao diện của D1 và D2 được ghi là minh họa; không thể suy ra rằng mọi trường, nút hoặc trạng thái trong hình đã được cam kết chi tiết hay đã có trong phần mềm.

## 3. Tổng quan nghiệp vụ và kiến trúc được mô tả

### 3.1 Ba miền nghiệp vụ

| Miền | Mục tiêu | Hồ sơ chính |
|---|---|---|
| Vận hành tòa nhà — B01–B18 | Theo dõi sự cố, sửa chữa, bảo trì, thiết bị và người chịu trách nhiệm. | Hồ sơ sửa chữa, tờ trình, quyết định, thi công, nghiệm thu, thanh toán, thiết bị, kế hoạch và lượt bảo trì. |
| Quỹ khai thác — F01–F10 | Theo dõi quá trình khai thác và các nghĩa vụ thu, thuế, đối soát, thanh lý. | Mời thầu, dự thầu, kết quả, hội nghị, hợp đồng, kỳ thu, chứng từ thuế, sao kê và hồ sơ thanh lý. |
| Tiền gửi quỹ bảo trì — T01–T06 | Theo dõi lựa chọn ngân hàng và vòng đời tiền gửi, phân biệt gốc và lãi. | Chào lãi, kết quả lựa chọn, hợp đồng tiền gửi, kỳ lãi, tất toán hoặc tái tục. |

D1 trang 2 mô tả 18 + 10 + 6 = **34 nghiệp vụ**. Trang 40–41 giới thiệu thêm **S01 Không gian** và **A01 Trợ lý An Nhi**. Cần ghi rõ đây là hai năng lực dùng chung nằm ngoài cách đếm 34, hay được phân bổ vào các nhóm đã liệt kê; chưa có cơ sở xem đây là lỗi cộng số.

### 3.2 Nguyên tắc đã rõ trong tài liệu

- Cùng một nền tảng phục vụ bốn tòa, có phạm vi truy cập theo quyền.
- Hai quỹ theo dõi riêng; công nợ không đồng nhất với số tiền đang có trong quỹ.
- Dashboard cần truy ngược về hồ sơ và chứng từ nguồn.
- Gốc và lãi tiền gửi phải tách rõ; tất toán không ghi trùng lãi đã thu; tái tục không cộng trùng gốc.
- Mobile trong D1 là web thích ứng, không mặc định là ứng dụng cài đặt.
- Ký nhanh bằng chuột/cảm ứng không mặc định là chữ ký số có chứng thư.
- Nhập sao kê không mặc định là kết nối ngân hàng trực tiếp. Thuế được theo dõi theo hồ sơ kế toán, không mặc định có khai/nộp thuế trực tuyến.

Nguồn: D1 trang 2–4, 39 và 45; D2 mục 03–04.

### 3.3 Kiến trúc ở mức tài liệu

D1 trình bày một nền tảng có dữ liệu liên kết, hồ sơ/chứng từ dùng chung, dashboard, web/mobile và AI theo quyền. D2 tập trung mô tả nghiệp vụ và giao diện, chưa phải tài liệu thiết kế kỹ thuật.

D4 đề xuất một backend chia module, cơ sở dữ liệu quan hệ, kho tệp, hàng đợi và lớp AI qua backend. Đây là **kiến trúc đề xuất trong tài liệu cũ**, không đủ để xác nhận kiến trúc hiện tại hoặc buộc dự án phải áp dụng nguyên trạng. Lựa chọn framework, schema, API và hạ tầng cần được đánh giá ở bước review code sau.

## 4. Bảng đối chiếu phạm vi giữa hai tài liệu chính

Trạng thái trong bảng thể hiện **mức độ mô tả của tài liệu**, không thể hiện chức năng đã được lập trình.

| Mã | Chức năng | D2 — Báo giá 20/10 | D1 — Proposal 23/10 | Điều cần làm rõ để triển khai/nghiệm thu |
|---|---|---|---|---|
| B01 | Tổng quan đa tòa | Có, nhóm 01 | Có, trang 15 | Công thức từng chỉ số, thời điểm chốt và phạm vi lọc. |
| B02 | Công việc cá nhân | Có, nhóm 02 | Có, trang 16 | Người giữ bước, hạn xử lý, giao lại và trường hợp người nhận ngừng hoạt động. |
| B03 | Hồ sơ sửa chữa | Có, nhóm 03 | Có, trang 17 | Trường bắt buộc khi lưu nháp/gửi; mã hồ sơ; liên kết thiết bị và vị trí. |
| B04 | Lịch sửa chữa | Có, nhóm 04 | Có, trang 18 | Lịch phản ánh hạn xử lý hay thời gian thi công; quy tắc việc kéo dài nhiều ngày. |
| B05 | Tờ trình và phê duyệt | Có, nhóm 05 | Có, trang 19 | Chuỗi duyệt từng tòa, người ký, số lần trình, trả bổ sung và từ chối. |
| B06 | Xử lý khẩn cấp | Có, nhóm 06 | Có, trang 20 | Người được cho phép, hạn mức, hạn bổ sung, vượt hạn và từ chối hậu kiểm. |
| B07 | Ký và biểu mẫu | Có, nhóm 07 | Có, trang 21 | Ai ký tài liệu nào; khóa phiên bản; thay nội dung sau ký; bộ mẫu chính thức. |
| B08 | Thi công và nghiệm thu | Có, nhóm 08 | Có, trang 22 | Người tham gia, điều kiện đạt, ảnh/biên bản bắt buộc, khắc phục và nghiệm thu lại. |
| B09 | Thanh toán hồ sơ | Có, nhóm 09, gồm tạm ứng/nhiều đợt | Có, trang 23 | Điều kiện tạm ứng, hạn mức, quyết toán, thanh toán thiếu/thừa và đóng hồ sơ. |
| B10 | Hồ sơ thiết bị | Có, nhóm 10 | Có, trang 24 | Định danh thiết bị, model, thay thế, tài liệu và liên kết lịch sử. |
| B11 | Bảo hành và cảnh báo | Có, nhóm 11 | Có, trang 25 | Ngưỡng cảnh báo, dữ liệu so sánh, người xác nhận và hướng xử lý. |
| B12 | Kế hoạch bảo trì | Có, nhóm 12 | Có, trang 26 | Chu kỳ hỗ trợ, checklist, ngày hiệu lực và xử lý kỳ bỏ lỡ. |
| B13 | Thực hiện bảo trì | Có, nhóm 13 | Có, trang 27 | Số đo, kết quả bất thường, người xác nhận và liên kết sửa chữa. |
| B14 | Lịch và thông báo | Có, nhóm 14 | Có, trang 28 | Kênh, thời điểm nhắc, chống trùng, thông báo thất bại và quyền xem liên kết. |
| B15 | Tòa nhà và vị trí | Có, nhóm 15 | Có, trang 29 | Danh mục Aqua chính thức, cấu trúc vị trí, ngừng dùng và bảo toàn hồ sơ cũ. |
| B16 | Thiết kế workflow | Có, nhóm 16 | Có, trang 30 | Phần nào cấu hình được; bước bắt buộc; phiên bản áp dụng cho hồ sơ đang chạy. |
| B17 | Nhân sự và phân quyền | Có, nhóm 17 | Có, trang 31 | Ma trận quyền, nhiều tòa, quyền theo bước, ủy quyền và chuyển giao. |
| B18 | Báo cáo và dữ liệu | Có, nhóm 18; Excel hoàn thiện khi triển khai | Có, trang 32 | Mẫu Excel, quy tắc nhập, đối soát số liệu và xuất theo quyền. |
| F01 | Hồ sơ mời thầu khai thác | Chưa nêu thành phân hệ | Có, trang 5 | Gói khai thác, hạn nhận, phiên bản và hồ sơ bắt buộc. |
| F02 | Hồ sơ dự thầu | Chưa nêu | Có, trang 6 | Nhiều đơn vị, hồ sơ bổ sung, đóng nhận và quyền xem. |
| F03 | Kết quả chọn thầu | Chưa nêu | Có, trang 7 | Tiêu chí, biên bản, người duyệt và thay đổi kết quả. |
| F04 | Hợp đồng khai thác | Chưa nêu | Có, trang 8 | Hiệu lực, phụ lục, giá trị, kỳ thu, gia hạn và sửa đổi. |
| F05 | Trình hội nghị thông qua | Chưa nêu | Có, trang 9 | Hội nghị là điều kiện trước/sau ký trong trường hợp nào; hồ sơ không được thông qua. |
| F06 | Từng lần thanh toán/thu | Chưa nêu | Có, trang 10 | Phải thu, thực thu, phân bổ kỳ, công nợ, đặt cọc và hoàn tiền nếu có. |
| F07 | Từng lần nộp thuế | Chưa nêu | Có, trang 11 | Người nhập, căn cứ số thuế, kỳ, chứng từ và điều chỉnh. |
| F08 | Sao kê tài khoản quỹ | Chưa nêu | Có, trang 12 | Định dạng nhập, ghép giao dịch, chống trùng và khoản chưa đối soát. |
| F09 | Báo cáo thu chi quỹ | Chưa nêu | Có, trang 13 | Số dư đầu/cuối, ngày ghi nhận, công nợ và số liệu đã/chưa đối soát. |
| F10 | Chấm dứt và thanh lý | Chưa nêu | Có, trang 14 | Nghĩa vụ đóng hợp đồng, công nợ còn mở, bàn giao và chứng từ thiếu. |
| T01 | Mời chào lãi suất | Chưa nêu | Có, trang 33 | Thư mời, các bản phản hồi, hiệu lực và điều kiện chào. |
| T02 | Kết quả chọn ngân hàng | Chưa nêu | Có, trang 34 | Tiêu chí, điều kiện so sánh, biên bản và thẩm quyền lựa chọn. |
| T03 | Hợp đồng tiền gửi | Chưa nêu | Có, trang 35 | Gốc, tài khoản nguồn/nhận, lãi suất, kỳ hạn và quy ước tính lãi. |
| T04 | Trả lãi tiền gửi | Chưa nêu | Có, trang 36 | Lịch phải nhận, thực nhận, nhận một phần, chậm trả và đối soát. |
| T05 | Tất toán | Chưa nêu | Có, trang 37 | Thu gốc/lãi còn lại, phí/điều chỉnh, tất toán trước hạn và khóa hợp đồng. |
| T06 | Tái tục | Chưa nêu | Có, trang 38 | Số gốc tái tục, xử lý lãi, liên kết kỳ cũ/mới và chống thao tác đồng thời với tất toán. |
| S01 | Không gian trực quan | Có trong gói đầy đủ | Có, trang 40 | Sơ đồ đầu vào, mức độ 2D/3D, ánh xạ vị trí/thiết bị và mở hồ sơ nguồn. |
| A01 | Trợ lý An Nhi | Có trong gói đầy đủ; demo mô phỏng | Có, trang 41 | Tác vụ AI phải làm thật, nguồn dẫn, phạm vi quyền và tiêu chí chất lượng. |

**Nhận định:** D1 mở rộng đáng kể so với D2. Việc F/T không xuất hiện trong D2 là khác biệt phạm vi giữa hai bản, chưa phải bằng chứng bỏ sót hay vi phạm cam kết của một bên.

## 5. Các quy trình cần chuẩn hóa

### 5.1 Sửa chữa và thanh toán

D2 mục 03 mô tả: ghi nhận → xác nhận → tờ trình/phê duyệt → thi công → nghiệm thu → thanh toán → hoàn tất. Cần có bảng chuyển trạng thái cho luồng thông thường, khẩn cấp, trả bổ sung, từ chối, khắc phục và các trường hợp dừng sau phê duyệt.

Thanh toán cần tách ít nhất số được duyệt, số đề nghị, số tạm ứng, số đã thanh toán và số còn lại. Tài liệu chưa chốt tạm ứng được thực hiện trước nghiệm thu trong điều kiện nào; không nên mặc định mọi khoản chi chỉ phát sinh sau nghiệm thu.

### 5.2 Bảo trì

Cần tách kế hoạch, từng lượt thực hiện, bản gửi kết quả và kết luận kiểm tra. Chốt rõ khi đổi chu kỳ/checklist thì lượt đã sinh có đổi theo không, ai xử lý kỳ bỏ lỡ, và một mục không đạt có bắt buộc tạo hồ sơ sửa chữa hay có thể ghi nhận hướng xử lý khác.

### 5.3 Quỹ khai thác

D1 trang 3 đã nêu quan hệ từ hồ sơ lựa chọn đến hợp đồng, ghi thu/thuế/sao kê và thanh lý. Cần bổ sung sơ đồ phụ thuộc, đặc biệt quan hệ giữa F05 hội nghị và F04 ký hợp đồng. Không lấy thứ tự mã F01–F10 làm thứ tự thực hiện bắt buộc.

Cần phân biệt khoản phải thu theo hợp đồng với khoản tiền đã nhận vào quỹ. Mỗi khoản thu phải có đối tượng, kỳ/nghĩa vụ, chứng từ và trạng thái đối soát. Các tình huống cọc, giảm trừ, hoàn trả hoặc phạt cần được xác nhận có thuộc phạm vi hay không.

### 5.4 Tiền gửi quỹ bảo trì

D1 trang 39 có ví dụ nghiệm thu hữu ích: phải nhận 15 triệu = thực nhận 10 triệu + còn nhận 5 triệu; tất toán nhận thêm 1.005 triệu gồm gốc 1.000 triệu và lãi còn lại 5 triệu; tái tục giữ gốc 1.000 triệu, không cộng thành 2.000 triệu.

Các ví dụ này xác định được nguyên tắc không đếm trùng, nhưng chưa thay thế đặc tả tính lãi. Cần chốt cách tính ngày, lãi suất, làm tròn, kỳ trả, điều chỉnh, tất toán trước hạn và việc tái tục có nhập lãi vào gốc hay không. Tất toán và tái tục là hai nhánh thay thế theo D1 trang 4, 37–38; cần quy tắc khóa để không hoàn tất cả hai nhánh cho cùng một khoản gốc.

## 6. Vấn đề và rủi ro theo mức ưu tiên

### High

| ID | Vấn đề có bằng chứng | Tác động | Cách xử lý tài liệu |
|---|---|---|---|
| H01 | Chưa có tài liệu hợp nhất xác định D1 thay thế hay bổ sung D2. D1 trang 42 thêm phạm vi hai quỹ; D2 tập trung 18 nhóm Basic. | Hai bên có thể dùng hai phạm vi khác nhau để lập kế hoạch và nghiệm thu. | Lập một bảng phạm vi có phiên bản, mã B/F/T/S/A, phần bao gồm/loại trừ, đầu ra và tài liệu được thay thế. |
| H02 | Bảo hành khác nhau: D2 mục 09 là 12 tháng; D1 trang 44 là 6 tháng. | Không thống nhất nghĩa vụ sau bàn giao. | Chốt thời hạn chính thức, ngày bắt đầu và phân biệt bảo hành lỗi với dịch vụ vận hành. |
| H03 | Mức phí và phạm vi thương mại thay đổi: D2 đầy đủ 20 triệu/tòa, vận hành 8–12 triệu/tháng; D1 30 triệu/tòa, vận hành 8–16 triệu/tháng. | Dễ hiểu sai phần mở rộng và hạn mức dịch vụ. | Ghi rõ giá nào áp dụng cho phạm vi nào. Đây có thể là điều chỉnh phạm vi hợp lý, không tự kết luận sai báo giá. |
| H04 | D1 trang 44 vẫn nêu mốc nền 3–4 tuần, còn lịch tích hợp hai quỹ để trong phụ lục chưa được cung cấp. | Không đủ căn cứ khẳng định thời điểm bàn giao đủ 34 nghiệp vụ. | Có lịch riêng cho nền tảng, F, T và tích hợp; ghi đầu vào, phụ thuộc, thời gian phản hồi và điều kiện nghiệm thu từng mốc. |
| H05 | D1 mô tả tiền/công nợ/sao kê và có ví dụ, nhưng thiếu quy tắc ghi nhận, điều chỉnh và đối soát đầy đủ. | Có thể sai số dư hoặc đếm trùng dù màn hình đúng mẫu. | Tạo đặc tả F06–F10 và T03–T06: mô hình tiền, công thức, ngày ghi nhận, chứng từ, khóa kỳ, đảo/điều chỉnh và quyền thực hiện. |
| H06 | D2/D1 có yêu cầu phê duyệt theo bước và theo tòa, nhưng chưa có ma trận quyền thống nhất cho toàn bộ B/F/T. | Có thể cấu hình sai người duyệt, thiếu tách trách nhiệm hoặc lộ dữ liệu giữa các tòa/quỹ. | Chốt quyền xem/tạo/sửa/gửi/duyệt/ký/xuất/điều chỉnh; phạm vi tòa; người được giao; tự duyệt; ủy quyền và chuyển giao. |
| H07 | D2 nhóm 09 và D1 trang 23 có tạm ứng/nhiều đợt, trong khi D3 mục 5 giới hạn demo một lần đúng đủ. | Dùng kịch bản demo cũ làm tiêu chí sẽ bỏ qua yêu cầu thanh toán mới. | Đánh dấu quy tắc demo cũ đã hết hiệu lực ở phần này; bổ sung luồng tạm ứng, nhiều đợt, đối chiếu số còn lại và đóng hồ sơ. |

### Medium

| ID | Vấn đề | Bằng chứng/giới hạn kết luận | Cách xử lý tài liệu |
|---|---|---|---|
| M01 | Vai trò và chuỗi duyệt giữa các tài liệu cũ chưa đồng nhất. | D3 mô tả CSH/CĐT, bốn bước duyệt và ký quyết định; D5 có biểu mẫu BQL/BQT/TVKT. Hai tài liệu chính chưa chốt toàn bộ chi tiết. | Lập bảng vai trò theo từng tòa và từng loại hồ sơ; xác định quy tắc cũ nào còn áp dụng. Không tự bắt buộc khôi phục một chuỗi cũ. |
| M02 | Chưa mô tả đủ các ngoại lệ sửa chữa. | Chưa có quy tắc thống nhất về đổi giá/nhà thầu sau duyệt, hủy sau duyệt, nghiệm thu một phần và mở lại. | Bổ sung bảng ngoại lệ; mục ngoài phạm vi phải ghi rõ cách xử lý thủ công và lịch sử cần giữ. |
| M03 | Workflow Designer chưa có giới hạn cấu hình rõ. | D2 nhóm 16 và D1 trang 30 nêu cấu hình bước/phiên bản, chưa quy định những bước không được bỏ. | Chốt bước bắt buộc, quyền thay cấu hình, ngày hiệu lực, tác động lên hồ sơ đang chạy và kiểm tra cấu hình không hợp lệ. |
| M04 | Ký nhanh chưa gắn đủ tiêu chí nghiệm thu cho mọi loại tài liệu. | D2 nhóm 07 yêu cầu gắn người/thời điểm/phiên bản; chưa có danh mục người ký và quy tắc thay nội dung sau ký. | Chốt tài liệu ký, vai trò ký, phiên bản bất biến, ký lại và biểu diễn chữ ký trong bản xuất. |
| M05 | Chưa đủ đặc tả nhập/xuất Excel và dữ liệu cũ. | D2 mục 04 nói sẽ hoàn thiện Excel theo mẫu; demo hiện có CSV. | Chốt mẫu, trường bắt buộc, mã định danh, kiểm tra trùng, lỗi từng dòng, nhập lại và đối chiếu tổng sau nhập. |
| M06 | Chưa có hợp đồng dữ liệu rõ cho báo cáo. | D1 yêu cầu dashboard mở đến hồ sơ; chưa có từ điển chỉ số đầy đủ. | Với từng chỉ số, ghi công thức, bộ lọc, ngày dùng để tính, nguồn và ví dụ đối soát. |
| M07 | Phạm vi AI chưa đủ để đo mức hoàn thành. | D2 mục 05 ghi demo mô phỏng, nguồn/hạn mức chốt khi triển khai; D1 trang 41 minh họa hỏi số liệu quỹ. | Chọn tác vụ AI bắt buộc, nguồn trích dẫn, bộ câu hỏi kiểm thử, quy tắc thiếu dữ liệu và tách quyền truy xuất. |
| M08 | Hạn mức và điều kiện vận hành còn mở. | D1 trang 43 và D2 mục 08 để dung lượng, lưu sao lưu, AI và dịch vụ bên thứ ba cho hợp đồng. | Chốt dung lượng, retention, lịch sao lưu, kiểm tra phục hồi, thời gian hỗ trợ, cách đo AI và cảnh báo hạn mức. |
| M09 | Chưa có bộ tiêu chí web/mobile chi tiết. | D1 ghi web thích ứng; ảnh minh họa không xác định thiết bị/trình duyệt và hành vi upload/ký/xem tài liệu. | Chốt thiết bị/trình duyệt, các tác vụ bắt buộc trên điện thoại, mạng gián đoạn và thông báo lỗi. |
| M10 | Bộ biểu mẫu chưa có danh sách phiên bản chính thức. | D5 có trường người hưởng, tài khoản ngân hàng, hóa đơn, thành phần nghiệm thu và bảng báo giá; D3 lại ghi bỏ so sánh báo giá trong demo. | Chốt mẫu nào dùng cho sửa chữa, mẫu nào dùng cho khai thác; trường nào nhập có cấu trúc, trường nào chỉ đính kèm. |

### Low

| ID | Vấn đề | Đề xuất |
|---|---|---|
| L01 | Thuật ngữ “thanh toán” có thể là tiền chi sửa chữa ở B09 hoặc tiền thu khai thác ở F06. | Đặt nhãn “Chi thanh toán sửa chữa” và “Thu theo hợp đồng khai thác”; có bảng thuật ngữ chung. |
| L02 | Cách đếm 34 nghiệp vụ và hai năng lực S01/A01 chưa được giải thích trực tiếp. | Thêm một câu trong phạm vi: “34 nghiệp vụ, kèm Không gian và Trợ lý AI dùng chung” nếu đúng ý định các bên. |

## 7. Các nội dung không nên tự đưa thêm vào phạm vi

D1 trang 45 và D2 mục 04 xác định riêng ứng dụng cài đặt, chữ ký số, kết nối ngân hàng, khai/nộp thuế, hóa đơn điện tử và kênh nhắn tin ngoài. D4 cũ có đề xuất Zalo Mini App và Zalo OA, nhưng chưa đủ căn cứ để coi chúng vẫn nằm trong giá/phạm vi D1.

Không nên tự yêu cầu cổng cư dân, tài khoản nhà thầu, kế toán tổng hợp, chuyển tiền ngân hàng thật, IoT hoặc một hệ thống ERP mới chỉ vì chúng có thể liên quan đến quản lý tòa nhà. Nếu cần, đưa vào danh sách mở rộng và chốt riêng.

Đồng thời, việc một chức năng được loại khỏi demo cũ không đồng nghĩa nó bị loại khỏi gói triển khai mới. Cần đối chiếu theo phiên bản và phạm vi đã thống nhất.

## 8. Kế hoạch hoàn thiện tài liệu theo thứ tự

| Thứ tự | Đầu ra cần hoàn thiện | Nội dung chính | Điều kiện kết thúc |
|---|---|---|---|
| 1 | Phụ lục phạm vi và phiên bản | Giải quyết H01–H04, H07; phạm vi B/F/T/S/A, bảo hành, phí, lịch và loại trừ. | Có một bản được hai bên xác nhận làm chuẩn. |
| 2 | Từ điển nghiệp vụ và danh mục dữ liệu | Tòa, vị trí, thiết bị, hồ sơ, hợp đồng, quỹ, ngân hàng, kỳ thu/lãi, chứng từ và mã liên kết. | Mỗi khái niệm có định nghĩa, định danh và quan hệ rõ. |
| 3 | Workflow và ma trận quyền | Luồng chính, ngoại lệ, vai trò, người được giao, ký, phiên bản, chuyển giao và audit. | Mỗi hành động xác định được ai làm, khi nào được làm và dữ liệu nào thay đổi. |
| 4 | Đặc tả thanh toán và hai quỹ | H05; tạm ứng/nhiều đợt, thu/công nợ, thuế theo hồ sơ, sao kê, lãi, tất toán/tái tục. | Các trường hợp thường và ngoại lệ có kết quả số liệu kiểm chứng được. |
| 5 | Biểu mẫu, Excel, báo cáo và AI | Mẫu đầu vào/đầu ra; công thức chỉ số; tác vụ AI; hạn mức và vận hành. | Có mẫu chính thức và dữ liệu kiểm thử đại diện. |
| 6 | Bộ nghiệm thu nghiệp vụ | Gắn từng mã B/F/T/S/A với kịch bản, dữ liệu, kết quả và chứng từ. | Không dùng “giống ảnh demo” hoặc “có màn hình” làm tiêu chí duy nhất. |
| 7 | Review source code theo bộ chuẩn | Đối chiếu chức năng, API, database, quyền, UI và kiểm thử hiện có. | Báo cáo riêng về đã làm/thiếu/sai, có bằng chứng file/module. Bước này chưa nằm trong báo cáo hiện tại. |

Không chốt thời lượng phát triển mới chỉ từ hai tài liệu hiện có. Ước lượng cần dựa trên phạm vi đã thống nhất, dữ liệu đầu vào và kết quả review source ở bước sau.

## 9. Bộ tiêu chí nghiệm thu tối thiểu nên bổ sung

| Nhóm | Kịch bản tối thiểu | Kết quả cần chứng minh |
|---|---|---|
| Sửa chữa | Một hồ sơ thường đi hết luồng; một hồ sơ trả bổ sung; một lần nghiệm thu không đạt rồi khắc phục. | Đúng người giữ bước, giữ phiên bản cũ và đủ bằng chứng trước chuyển bước. |
| Khẩn cấp | Trong/vượt hạn mức; bổ sung đúng/trễ hạn; hậu kiểm không được duyệt. | Không mất dấu người cho phép; ngoại lệ có quyết định và hướng xử lý rõ. |
| Thanh toán | Tạm ứng và thanh toán phần còn lại; nhập trùng; thanh toán vượt mức; đóng hồ sơ khi chưa đủ. | Số được duyệt, đã trả và còn lại đối chiếu được; không ghi nhận trùng. |
| Bảo trì | Sinh lượt, đổi lịch, tạm dừng, kỳ bỏ lỡ, checklist không đạt và tạo sửa chữa liên kết. | Không sinh trùng; giữ kết quả cũ; không coi tạo hồ sơ sửa chữa là đã sửa xong. |
| Quỹ khai thác | Hợp đồng có nhiều kỳ thu; thu một phần; nhập sao kê trùng; khoản chưa ghép; thanh lý còn công nợ. | Phải thu khác thực thu; số dư và chứng từ truy ngược được; không xóa nghĩa vụ còn mở. |
| Tiền gửi | Kịch bản số liệu D1 trang 39; lãi nhận một phần; tất toán; tái tục. | 15 = 10 + 5; tất toán thêm 1.005 = 1.000 + 5; không đếm trùng gốc/lãi. |
| Quyền | Người tòa A truy cập trực tiếp hồ sơ, tệp, báo cáo và AI thuộc tòa B; người chưa được giao cố quyết định. | Hành vi đúng ma trận đã chốt, áp dụng nhất quán trên mọi kênh. |
| Phiên bản/ký | Sửa nội dung sau ký; trình lại; xuất hồ sơ cũ và mới. | Chữ ký và quyết định gắn đúng phiên bản, không bị hiểu là ký cho nội dung khác. |
| Dữ liệu/báo cáo | Nhập dữ liệu lỗi/trùng; lọc kỳ/tòa; đối chiếu tổng và danh sách nguồn. | Có thông báo lỗi cụ thể; tổng khớp chi tiết; kết quả xuất giữ đúng phạm vi. |
| Mobile/vận hành | Chụp ảnh, tải tệp, ký cảm ứng, xem hồ sơ; lỗi mạng; phục hồi bản sao lưu thử nghiệm. | Tác vụ hoàn thành được trên thiết bị đã chốt, không báo thành công khi chưa lưu; có bằng chứng phục hồi. |

## 10. Các quyết định cần khách hàng/chủ dự án xác nhận

1. D1 ngày 23/10 thay thế D2 ở những mục nào; 34 nghiệp vụ và S01/A01 có cùng nằm trong lần bàn giao này không?
2. Bảo hành chính thức là 6 hay 12 tháng; phí vận hành áp dụng theo mức/phạm vi nào?
3. Ai tạo, xác nhận, duyệt và ký từng loại hồ sơ ở từng tòa; còn áp dụng vai trò CSH/CĐT không?
4. Hội nghị, chọn đơn vị và ký hợp đồng khai thác có quan hệ điều kiện như thế nào?
5. Quy tắc tạm ứng/nhiều đợt, công nợ còn lại và đóng hồ sơ là gì?
6. Quy ước tính lãi, tất toán trước hạn, tái tục và xử lý lãi nhập gốc có thuộc phạm vi không?
7. Mẫu biểu, Excel, sao kê, sơ đồ và dữ liệu thật nào sẽ được dùng để nghiệm thu?
8. Tác vụ AI bắt buộc trong lần đầu và hạn mức/dữ liệu nguồn là gì?

Các câu hỏi này dành cho bước chốt tài liệu; chưa phải yêu cầu sửa code hoặc thay đổi kiến trúc.

## 11. Giới hạn và bước tiếp theo

Báo cáo dựa trên hai tài liệu được cung cấp và đối chiếu bối cảnh nội bộ có sẵn. Chưa có hợp đồng/phụ lục đã ký, lịch tích hợp hai quỹ, ma trận quyền chính thức và đầy đủ dữ liệu nghiệm thu thật. Không xác định tài liệu nào có hiệu lực pháp lý cao hơn chỉ từ ngày phát hành.

Phần kiến trúc trong báo cáo là kiến trúc được tài liệu mô tả, không phải kết luận về source hiện tại. Chưa đánh giá tính tuân thủ pháp lý của biểu mẫu hay cách tính thuế. Việc review code, xác định chức năng đã hoàn thành và lập kế hoạch sửa theo file/module được để sang bước sau theo yêu cầu của người dùng.

**Đề xuất bước kế tiếp:** Chốt phụ lục phạm vi và phiên bản trước, sau đó hoàn thiện workflow/quyền và quy tắc tiền. Giữ nguyên source code trong giai đoạn này.
