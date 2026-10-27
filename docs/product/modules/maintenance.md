# Module `maintenance`: Thiết bị và bảo trì (B10–B13)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-24)**

**Nguồn đã đọc:**
- D1 tr. 24 (B10 Hồ sơ thiết bị), tr. 25 (B11 Bảo hành và cảnh báo), tr. 26 (B12 Kế hoạch bảo trì), tr. 27 (B13 Thực hiện bảo trì). Đã xem hình.
- D2 nhóm 10–13 (`bao-gia-qltn-2026-10-20.docx`).
- Review 23/10 (`reviews/2026-10-23/review-tai-lieu-nghiep-vu.md`) dòng 82–85, §5.2, dòng 201 (kịch bản nghiệm thu bảo trì).
- Kiểm kê 26/10 (`reviews/2026-10-26/tong-quan-module-tinh-nang.md`) dòng 74–78: B10–B13 đều là **Demo**, 0 thao tác có backend. Lộ trình L5: "Backend cho bảo trì và thiết bị (B10–B14), rồi B01, B02, B04 đọc dữ liệu thật".
- Đặc tả demo D3 (bối cảnh, không còn là phạm vi hiện hành).
- Code demo (commit `dc9d2f1`): `web/src/services/handlers/maintenance-*.ts`, `services/maintenance-service.ts`, `domain/maintenance-types.ts`, `domain/schedule.ts`, `domain/maintenance-rules.ts`, `features/maintenance/*`, `mock/seed-maintenance.ts`. Bản trích có dẫn file:dòng do một agent đọc code soạn; PM/BA tự kiểm lại MD-01, MD-06 và MG-02 trong code.
- API: `api-qltn/src/modules` **không có module bảo trì**. Đã có sẵn: loại chủ thể nhật ký `MAINTENANCE_ITEM/PLAN/OCCURRENCE`, quyền `MAINTENANCE_MANAGE`, `MAINTENANCE_REVIEW`, `ITEM_CONDITION`, và trường hạn `REVIEW_MAINTENANCE` (mặc định 2 ngày) trong cấu hình tòa.

**Ranh giới:** B14 (lịch bảo trì và thông báo) chỉ nêu ở mức ranh giới. Thông báo trong hệ thống đã có phần tối thiểu từ S3.

## 1. Khách yêu cầu gì (D1, D2)

| Mã | D2 (câu chữ, rút gọn) | D1 (hình) |
|---|---|---|
| **B10** Hồ sơ thiết bị | Mã, loại, model, vị trí, người phụ trách, thông tin kỹ thuật và tài liệu. Tra lịch sử sửa chữa, bảo trì, số lần hỏng và chi phí liên quan | Thẻ "B01 · Bơm nước", Aqua 1 · Tầng hầm, "Đang vận hành". Ô số: bảo trì kỳ này, số lần sửa chữa, chi phí đã duyệt (10 tr), đang vận hành. Chu kỳ mẫu "Hằng tháng", lần kế tiếp 12/12/2026. Tab "Lịch sử vận hành" trộn lượt bảo trì (BT-005 Đạt), hồ sơ sửa chữa (SC-001 "Ghi nhận lỗi"), nghiệm thu (NT-001 Đạt); tab "Tài liệu thiết bị" |
| **B11** Bảo hành và cảnh báo | Theo dõi thời hạn bảo hành, thiết bị sắp hết hoặc đã hết bảo hành. Nhận diện hỏng lặp lại, công việc quá hạn và bất thường cần rà soát | Ô số: sắp hết BH (2), lỗi lặp lại (1), bảo trì trễ (1), "Đã có đầu mối 4/4". Tab "Cần can thiệp / Bảo hành / Lỗi lặp lại". Ví dụ "TM01 · Aqua 3: Bảo trì trễ 1 ngày · Lỗi lặp lại 3 lần", gắn BT-004 và KT03, nhãn "Ưu tiên". Cửa sổ "30 ngày tới". Hai tab mobile "Cần xử lý / Đã phân công" |
| **B12** Kế hoạch bảo trì | Thiết lập chu kỳ và checklist, giao người thực hiện và người xác nhận. Tạo các lượt bảo trì, thay đổi lịch và ghi lý do điều chỉnh | Kế hoạch "BT-B01 · Bơm B01", chu kỳ "Hằng tháng", lịch tháng 12/2026 với ngày 12 được đánh dấu "Kế tiếp". Danh mục kiểm 3 mục, mỗi mục có kiểu kết quả và bằng chứng: Vận hành (Đạt/Lỗi, Nhật ký), Rò rỉ (Có/Không, Ảnh), Rung bất thường (Có/Không, Nhật ký). Người thực hiện KT01, tài liệu hướng dẫn. Nút "Lưu lịch định kỳ" |
| **B13** Thực hiện bảo trì | Nhận việc, điền checklist, số đo, ảnh và kết quả; gửi xác nhận hoặc bổ sung; liên kết tạo hồ sơ sửa chữa khi phát hiện hư hỏng | Lượt "BT-002 · Bơm B02", có "Hạn 17:00 hôm nay". Mỗi mục có Đạt/Lỗi và ghi chú; tổng "Đã kiểm tra 3/3 hạng mục, 2 đạt, 1 lỗi". Khung "Xử lý mục bất thường": ghi nhận hiện trường, ảnh, phiếu kiểm, nút "Tạo hồ sơ sửa chữa từ mục lỗi →". Tiêu đề D1: "Ghi nhận kết quả bảo trì **ngay trên điện thoại**" |

**Câu hỏi đã nêu từ review 23/10** (§5.2, dòng 82–85, 201):
- Tách rõ bốn thứ: kế hoạch, từng lượt thực hiện, bản gửi kết quả, và kết luận kiểm tra.
- Đổi chu kỳ hoặc checklist thì các lượt đã sinh có đổi theo không? Ai xử lý kỳ bỏ lỡ?
- Một mục không đạt có **bắt buộc** tạo hồ sơ sửa chữa, hay ghi nhận được hướng xử lý khác?
- B11: ngưỡng cảnh báo, dữ liệu so sánh, người xác nhận, hướng xử lý.
- Kịch bản nghiệm thu: không sinh lượt trùng; giữ kết quả cũ; **không coi việc tạo hồ sơ sửa chữa là đã sửa xong**.
- Bàn giao: "Khách hàng cung cấp danh mục thiết bị, sơ đồ, dữ liệu" (D2 dòng 113). Như vậy cần đường **nhập danh mục thiết bị ban đầu**.

## 2. Hiện trạng code demo

Demo chạy hoàn toàn trong trình duyệt (IndexedDB). Ở chế độ `api`, cả 7 màn bảo trì hiện "chưa nối API" và nhóm menu Bảo trì bị ẩn (`router.tsx` dòng 63–70, `navigation.ts` dòng 61–76).

Dữ liệu mẫu:
- Tòa A: 7 thiết bị, 4 kế hoạch, 10 lượt.
- Tòa B: 3 thiết bị, 2 kế hoạch, 3 lượt.
- Tòa C và D: mỗi tòa 3 thiết bị, chưa có kế hoạch.

Có 10 file test; file chính là `acceptance-maintenance.test.ts` với 11 ca.

| # | Tính năng | Mã D1 | Demo có | Trạng thái |
|---|---|---|---|---|
| MT-01 | Thiết bị: tạo, sửa, ngừng dùng, tài liệu, tình trạng (Tốt / Cần chú ý / Chưa rõ) | B10 | Có. Mã thiết bị duy nhất trong tòa; vị trí; BQL phụ trách; model; nhà cung cấp; ngày lắp; hạn bảo hành | **Demo** |
| MT-02 | Hồ sơ thiết bị: lịch sử bảo trì, sửa chữa liên kết, chi phí đã duyệt, lịch sử tình trạng | B10 | Có, gồm 5 tab | **Demo** |
| MT-03 | Kế hoạch: chu kỳ (1, 3, 6 hoặc 12 tháng), ngày neo, danh mục kiểm (mục bắt buộc; kiểu Kiểm tra hoặc Số đo, có đơn vị và ngưỡng min/max), người xác nhận, nhà thầu | B12 | Có. Trạng thái Nháp / Đang chạy / Tạm dừng | **Demo** |
| MT-04 | Sinh lượt: nhìn trước 30 ngày, tối đa 100 lượt mỗi lần, không sinh trùng (khóa kế hoạch + ngày gốc) | B12 | Có, nhưng **chỉ chạy khi có người mở màn hình**; không có lịch chạy tự động | **Demo** |
| MT-05 | Tạm dừng / chạy lại (kỳ bị bỏ khi tạm dừng được ghi là "bỏ qua", không thành việc quá hạn); đổi chu kỳ (lượt đã sinh bị đánh dấu để BQL chọn giữ hoặc hủy); tạo lượt bù | B12 | Có | **Demo** |
| MT-06 | Thực hiện lượt: bắt đầu, lưu, gửi kết quả (mỗi lần gửi là một bản chụp), yêu cầu làm lại theo từng mục, xác nhận, đổi lịch, hủy, giao lại người xác nhận | B13 | Có. Đủ 6 trạng thái: Đã lên lịch, Đang làm, Chờ kiểm tra, Làm lại, Hoàn thành, Đã hủy | **Demo** |
| MT-07 | Tạo hồ sơ sửa chữa từ lượt bảo trì: chép tòa, vị trí, thiết bị, ảnh; liên kết hai chiều | B13 | Có | **Demo**; **API sửa chữa chưa lưu được liên kết thiết bị** (MG-02) |
| MT-08 | Cảnh báo: bảo hành sắp hết (30 ngày) hoặc đã hết; lượt quá hạn; lượt gần nhất có mục lỗi; thiết bị "Cần chú ý"; đang có hồ sơ sửa chữa mở | B11 | Có, nhưng **chỉ hiển thị**, không gửi thông báo, không có người nhận xử lý | **Demo** |
| MT-09 | Việc và nhắc hạn: mỗi lượt sinh việc cho đúng người; nhắc trước hạn 24 giờ | B13, B14 | Có (bảng việc chung) | **Demo** |
| MT-10 | Lịch bảo trì: danh sách / tuần / tháng | B14 | Có | **Demo** (ngoài phạm vi tài liệu này) |

**Ai làm gì trong demo:**
- BQL (`MAINTENANCE_MANAGE`): tạo thiết bị và kế hoạch, **tự thực hiện lượt** (là "người quản lý" của lượt), tạo hồ sơ sửa chữa liên kết.
- KT (`MAINTENANCE_REVIEW`): xác nhận hoặc yêu cầu làm lại; được cập nhật tình trạng thiết bị khi xác nhận.
- ADMIN: thay người quản lý khi người cũ đã nghỉ.
- Các vai trò khác: chỉ xem.
- Tên "người thực hiện" là chữ tự do, không phải tài khoản.

## 3. Khoảng trống so với yêu cầu

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **MG-01** | **Không có API** cho thiết bị, kế hoạch, lượt bảo trì. Ở chế độ `api` cả nhóm B10–B13 không dùng được | `api-qltn/src/modules`; `router.tsx` dòng 63–70 | **Cao**: là 4/18 nhóm của gói Basic (D2), và L5 của lộ trình | Dựng API theo các slice §6, lấy demo làm tài liệu sống về hành vi (như đã làm với B03–B09) |
| **MG-02** | **Hồ sơ sửa chữa ở API không gắn được thiết bị.** Bảng `repair_records` chỉ có cờ `no_maintenance_item`. Lệnh gửi hồ sơ **bắt buộc** cờ này là đúng, nên mọi hồ sơ sửa chữa thật đều phải ghi "không thuộc thiết bị". Vì vậy B10 không tra được "lịch sử sửa chữa, số lần hỏng, chi phí" (D2 nhóm 10), và B13 không tạo được hồ sơ sửa chữa từ mục lỗi (D1 tr. 27) | `2026-10-23a-repair-records.sql` dòng 10; `records.service.ts` dòng 600–604 | **Cao** | Migration cho `repair_records`: thêm thiết bị và lượt bảo trì nguồn. Làm cùng slice thiết bị |
| **MG-03** | **Người thực hiện lệch với D1.** D1 tr. 27 cho thấy kỹ thuật viên "KT01" tự đăng nhập trên điện thoại để điền checklist. D2 nhóm 12 ghi "giao người thực hiện/xác nhận". Demo lại để **BQL** thực hiện, KT chỉ xác nhận, còn người thực hiện là chữ tự do | D1 tr. 26–27; D2 nhóm 12; demo `actions.ts` dòng 217–256 | **Cao** (đổi vai trò, quyền, việc) | Hỏi MQ-01. Mặc định: kế hoạch giao một **người thực hiện là tài khoản** (KT hoặc BQL) và một người xác nhận khác người đó |
| MG-04 | Không có cách **nhập danh mục thiết bị ban đầu**. D2 ghi khách sẽ cung cấp danh mục thiết bị lúc bàn giao; 4 tòa có thể có hàng trăm thiết bị | D2 dòng 113 | Trung bình | Nhập từ tệp theo mẫu (MQ-06) |
| MG-05 | Sinh lượt phụ thuộc vào việc có người mở màn hình. Bản API cần **lịch chạy hằng ngày** ở máy chủ, và phải chạy được mà không có ai mở web | demo `useAutoGenerateSchedule.ts` | Trung bình (bắt buộc khi làm API) | Đưa vào slice kế hoạch |
| MG-06 | Cảnh báo B11 chỉ hiển thị. D1 tr. 25 có "Đã có đầu mối 4/4", các tab "Cần xử lý / Đã phân công", và nút "Mở việc cảnh báo": mỗi cảnh báo có người chịu trách nhiệm | D1 tr. 25; demo `item-insights.ts` | Trung bình | Hỏi MQ-05. Mặc định: đầu mối là BQL phụ trách thiết bị; có thông báo khi bảo hành sắp hết và khi lượt quá hạn |
| MG-07 | Mỗi mục kiểm trong D1 có **kiểu bằng chứng** ("Nhật ký", "Ảnh") và kiểu kết quả ("Đạt/Lỗi", "Có/Không"). Demo chỉ có Kiểm tra / Số đo; ảnh bắt buộc cho mục lỗi và cho cả lượt | D1 tr. 26; demo `maintenance-types.ts` | Thấp | Thêm "cần ảnh" cho từng mục khi làm API |
| MG-08 | Chu kỳ chỉ có 1, 3, 6, 12 tháng. Không có chu kỳ theo tuần hay N tháng tùy chọn (thiết bị PCCC, thang máy thường kiểm hằng tuần hoặc 2 tuần) | demo `constants.ts` dòng 229–234 | Trung bình | Hỏi MQ-02 |
| MG-09 | Hạn theo **giờ** ("Hạn 17:00 hôm nay", D1 tr. 27). Demo chỉ có ngày | D1 tr. 27 | Thấp | Mặc định: hạn theo ngày (hết ngày theo giờ VN) |
| MG-10 | Kế hoạch không có ngày kết thúc, không lưu trữ hay xóa được. Thiết bị ngừng dùng thì không dùng lại được | demo `actions.ts` dòng 258–276 | Thấp | Thêm "Kết thúc kế hoạch" và "Dùng lại thiết bị" khi làm API |
| MG-11 | Đọc dữ liệu chỉ kiểm **tòa**, ghi thì kiểm cả **vị trí**. Giống hồ sơ sửa chữa và tệp (ATG-07) | demo `maintenance-service.ts` | Thấp | Gom vào câu hỏi phân quyền chung (RM); không tách riêng |

## 4. Lỗi trong demo (không được mang sang API)

| ID | Lỗi | Căn cứ | Mức |
|---|---|---|---|
| **MD-01** | Hạn xác nhận lượt bảo trì luôn là 2 ngày; **bỏ qua cấu hình hạn của tòa** (trường `REVIEW_MAINTENANCE` có trong cấu hình nhưng không được dùng). PM/BA đã kiểm lại trong code | `maintenance-occurrence-handlers.ts` dòng 168; `command-context.ts` dòng 64–68 | Trung bình |
| **MD-02** | Thứ tự các phiên bản chu kỳ xếp theo số phiên bản, không theo ngày hiệu lực. Đổi chu kỳ hai lần mà ngày hiệu lực đảo thứ tự thì hai chu kỳ **chồng ngày**, sinh lượt thừa. Chưa có test | `domain/schedule.ts` dòng 13–33 | Trung bình |
| MD-03 | Kích hoạt kế hoạch nháp có ngày neo đã qua thì sinh ngay các lượt trong quá khứ, quá hạn ngay lập tức | `maintenance-plan-handlers.ts` dòng 124–135 | Trung bình |
| MD-04 | Tạm dừng kế hoạch không đụng tới các lượt đã sinh trong 30 ngày tới. Chúng vẫn ở "Đã lên lịch", vẫn có việc và nhắc hạn, rồi thành quá hạn trong lúc tạm dừng | `maintenance-plan-handlers.ts` dòng 137–143 | Trung bình |
| MD-05 | Ngừng dùng thiết bị chỉ chặn khi có kế hoạch **đang chạy**. Kế hoạch tạm dừng vẫn để lại lượt mở trên thiết bị đã ngừng, và vẫn tạo lượt bù được | `maintenance-item-handlers.ts` dòng 124–133; `maintenance-plan-handlers.ts` dòng 181–192 | Thấp |
| MD-06 | Màn sửa ghi "Mã không đổi sau khi tạo", nhưng lệnh sửa **vẫn nhận mã mới** nếu gửi kèm. PM/BA đã kiểm lại trong code | `maintenance-item-handlers.ts` dòng 114 | Thấp |
| MD-07 | Quy tắc "mục lỗi phải có hướng xử lý" so **số lượng**: số mục lỗi so với số hồ sơ sửa chữa liên kết. Một hồ sơ đã rút hoặc đóng không sửa, hay một hồ sơ cho mục khác, vẫn được tính | `domain/maintenance-rules.ts` dòng 3–11 | Trung bình (review 23/10: "không coi tạo hồ sơ sửa chữa là đã sửa xong") |
| MD-08 | Đổi người xác nhận hay danh mục kiểm của kế hoạch không áp vào các lượt đang mở. Thay người quản lý cũng phải làm từng lượt một | `maintenance-plan-handlers.ts` dòng 96–98; `link-and-assignment-handlers.ts` dòng 158–163 | Thấp (cần chốt cách làm) |
| MD-09 | Bắt đầu được một lượt còn 30 ngày nữa mới đến hạn; đổi lịch được sang sau cả kỳ kế tiếp | `maintenance-occurrence-handlers.ts` dòng 133–141, 246–258 | Thấp |
| MD-10 | Mã kế hoạch `KH-NN` (2 chữ số) và mã lượt `BT-NNN` đánh số chung cho mọi tòa. Mã thiết bị không có ràng buộc duy nhất ở tầng dữ liệu | `maintenance-plan-handlers.ts` dòng 66; `maintenance-generation.ts` dòng 23 | Thấp |

## 5. Câu hỏi cho khách

Đã ghi thành **OD-23** trong `DECISIONS.md`. Mỗi câu có mặc định để làm trước (PD-06).

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| MQ-01 | Ai thực hiện bảo trì và điền checklist: kỹ thuật viên nội bộ (có tài khoản), BQL, hay nhà thầu ngoài? Ai xác nhận? | Kế hoạch giao **người thực hiện** là tài khoản (KT hoặc BQL), và **người xác nhận** là tài khoản khác. Nhà thầu ngoài chỉ ghi tên; người của BQL điền thay |
| MQ-02 | Cần những chu kỳ nào? Có chu kỳ tuần hay 2 tuần không? | Mỗi N tuần (1–8) hoặc mỗi N tháng (1–24) |
| MQ-03 | Mục kiểm không đạt có bắt buộc tạo hồ sơ sửa chữa không? | Không bắt buộc. **Từng** mục lỗi phải có một trong hai: hồ sơ sửa chữa liên kết với đúng mục đó, hoặc ghi hướng xử lý. Xét theo từng mục, không theo số lượng (sửa MD-07) |
| MQ-04 | Đổi chu kỳ hay tạm dừng kế hoạch thì các lượt đã sinh mà chưa làm xử lý thế nào? Ai xử lý kỳ bị bỏ lỡ? | Đổi chu kỳ: giữ cách của demo, đánh dấu để BQL chọn giữ hoặc hủy. Tạm dừng: **tự hủy** các lượt chưa bắt đầu, lý do "Tạm dừng kế hoạch"; lượt đang làm thì giữ (sửa MD-04). Kỳ bị bỏ lỡ do quá hạn vẫn là việc quá hạn của người thực hiện, cho đến khi làm xong hoặc BQL hủy kèm lý do |
| MQ-05 | Cảnh báo (B11): ngưỡng "sắp hết bảo hành" bao nhiêu ngày? Thế nào là "lỗi lặp lại"? Mỗi cảnh báo có người chịu trách nhiệm không, và có cần thông báo không? | Sắp hết bảo hành: 30 ngày, cấu hình được theo tòa. Lỗi lặp lại: ≥ 2 hồ sơ sửa chữa trên cùng thiết bị trong 365 ngày (đã có tham số theo tòa ở cảnh báo sửa chữa). Đầu mối: BQL phụ trách thiết bị. Thông báo trong hệ thống khi bảo hành còn 30 ngày và khi lượt quá hạn |
| MQ-06 | Danh mục thiết bị ban đầu được giao ở dạng nào (Excel theo mẫu riêng của khách, hay mẫu của hệ thống)? Khoảng bao nhiêu thiết bị mỗi tòa? | Hệ thống cung cấp mẫu Excel/CSV; một lần nhập có kiểm lỗi từng dòng |
| MQ-07 | Hạn của lượt bảo trì theo ngày hay theo giờ (D1 có "Hạn 17:00")? | Theo ngày |

## 6. Đề xuất slice

Đi theo đường đã làm với B03–B09: API trước, web chế độ `api` nối theo, demo là tài liệu sống về hành vi. Mỗi slice đi qua workflow review như thường lệ.

**MT-S1 Thiết bị** ([SPEC](../features/MT-thiet-bi-bao-tri/SPEC.md), đã triển khai 27/10; không phụ thuộc slice nào; nên làm trước vì mở khóa MG-02 cho cả B03). API và web `api` cho B10:
- tạo, sửa, ngừng dùng và dùng lại thiết bị; tài liệu; tình trạng; danh sách và hồ sơ thiết bị;
- **migration gắn thiết bị vào hồ sơ sửa chữa** (MG-02): form hồ sơ chọn được thiết bị, và hồ sơ thiết bị hiện lịch sử sửa chữa, số lần hỏng, chi phí đã duyệt;
- sửa MD-06.

**MT-S2 Kế hoạch** ([SPEC](../features/MT-ke-hoach-bao-tri/SPEC.md), đã triển khai 27/10). API và web `api` cho B12:
- kế hoạch và danh mục kiểm; chu kỳ theo MQ-02; người thực hiện và người xác nhận theo MQ-01;
- kích hoạt, tạm dừng theo MQ-04, đổi chu kỳ, lượt bù;
- **sinh lượt bằng lịch chạy hằng ngày ở máy chủ** (MG-05);
- sửa MD-02, MD-03, MD-04, MD-10.

**MT-S3 Thực hiện** ([SPEC](../features/MT-thuc-hien-bao-tri/SPEC.md), đã triển khai 27/10). API và web `api` cho B13:
- bắt đầu, lưu, gửi, làm lại, xác nhận, đổi lịch, hủy, giao lại;
- việc và nhắc hạn theo hạn của tòa (sửa MD-01);
- tạo hồ sơ sửa chữa từ **từng** mục lỗi (MQ-03, sửa MD-07);
- dùng tốt trên điện thoại (D1 tr. 27).

**MT-S4 Cảnh báo và nhập liệu** (sau MT-S1 đến S3):
- B11 theo MQ-05 (thông báo, đầu mối);
- nhập danh mục thiết bị (MG-04, MQ-06);
- lịch bảo trì B14 đọc dữ liệu thật.

**AC nháp cho MT-S1:**
- **AC-1** BQL tòa A tạo thiết bị "BOM-A02 · Bơm tăng áp" ở Tầng hầm: thiết bị có trong danh sách của tòa A, và BQL tòa B không thấy.
- **AC-2** Tạo hai thiết bị cùng mã trong một tòa: lần thứ hai bị từ chối ở trường mã. Cùng mã ở hai tòa khác nhau thì được.
- **AC-3** Sửa thiết bị mà gửi kèm mã mới: mã không đổi (MD-06).
- **AC-4** Tạo hồ sơ sửa chữa và chọn thiết bị BOM-A02: hồ sơ gửi được. Trang thiết bị hiện hồ sơ đó trong "Sửa chữa", và sau khi tờ trình được duyệt thì hiện chi phí đã duyệt.
- **AC-5** Hồ sơ chọn "Không thuộc thiết bị cụ thể" vẫn gửi được như hiện nay.
- **AC-6** Ngừng dùng thiết bị cần lý do; thiết bị đã ngừng không chọn được ở form hồ sơ mới, nhưng vẫn hiện ở hồ sơ cũ. "Dùng lại" đưa thiết bị về danh sách chọn.
- **AC-7** Ở chế độ `api`, menu "Thiết bị" mở được danh sách và hồ sơ thiết bị thật, không còn màn "chưa nối API".
