# Nhật ký quyết định sản phẩm QLTN

Quy ước:
- `Đã chốt`: có người quyết định và ngày; là chuẩn cho SPEC và nghiệm thu.
- `Chờ chốt`: câu hỏi mở; SPEC liên quan phải ghi rõ đang phụ thuộc mục này.
- `Thay thế bởi ADR-xx`: không còn hiệu lực, giữ lại làm lịch sử.

Không xóa mục cũ. Khi thay đổi, thêm mục mới và cập nhật trạng thái mục cũ.

## Đã chốt

| ID | Ngày | Quyết định | Người quyết định | Căn cứ |
|---|---|---|---|---|
| PD-01 | 26/10/2026 | Tài liệu sản phẩm đặt tại `docs/product/`; mỗi tính năng có đúng một `SPEC.md` làm hợp đồng yêu cầu. | PM/BA seat theo phân công vai trò | Phân công vai trò ngày 26/10/2026 |
| PD-02 | 26/10/2026 | Seat PM/BA không sửa code ứng dụng, schema, migration hay cấu hình deploy. Thay đổi kỹ thuật đi qua bàn giao cho dev-build. | Operator (phân công vai trò) | Phân công vai trò ngày 26/10/2026 |
| PD-06 | 26/10/2026 | Chưa có khách để hỏi: sản phẩm làm trước, chủ dự án đi chào khách sau. Mỗi OD-xx chưa có câu trả lời được thay bằng một **phương án mặc định có căn cứ** trong [PRODUCT-DEFAULTS.md](PRODUCT-DEFAULTS.md) (DF-01 đến DF-28). Căn cứ ưu tiên: biểu mẫu và quy trình D5, rồi TT 05/2024, rồi D1/D2. Khi viết SPEC, mặc định có giá trị như quyết định đã chốt. Khi có ghi chú của khách, PM/BA cập nhật DF và các SPEC liên quan. Các OD vẫn giữ trong danh sách "Chờ chốt" để đối chiếu khi đi chào khách. | Chủ dự án (người dùng) | Chỉ thị trong phiên PM/BA ngày 26/10/2026 |
| PD-05 | 26/10/2026 | Quy trình làm theo module: PM/BA phân tích từng module (flow, business rule, AC, checklist test). Khi module đủ rõ thì bàn giao cho dev-build qua workflow `qltn-pm-ba-review-loop`, rồi chuyển ngay sang phân tích module tiếp theo, không chờ module trước xong. Review lỗi thì trả dev-build sửa và review lại; đạt thì PM/BA cập nhật tài liệu. PM/BA **tự duyệt** SPEC khi SPEC không chứa quyết định phạm vi hoặc thương mại còn mở và không dựa vào OD chưa chốt. Trường hợp ngược lại vẫn cần chủ dự án duyệt (PROCESS.md bước 1b). PM/BA không sửa code, database hay deploy. Mọi seat làm theo phase nhỏ, không chạy toàn bộ test suite. | Chủ dự án (người dùng) | Chỉ thị dán vào phiên PM/BA ngày 26/10/2026 |
| PD-04 | 26/10/2026 | Duyệt [SPEC B03–B09](features/B03-B09-luong-sua-chua/SPEC.md) (bản đã sửa theo review kỹ thuật), gồm ba điểm phạm vi. (1) Xử lý khẩn cấp, thông báo chưa xử lý, giao lại người xử lý và việc còn tồn Đợt 1, hạn xử lý và công việc để sang SPEC riêng. (2) Dùng mã lỗi `details.reason` riêng. (3) Nghiệm thu song song hay tuần tự giữ như demo, chờ OD-12 chốt. Giao lần lượt từng slice cho dev-build qua hàng đợi, bắt đầu từ S1. | Chủ dự án (người dùng), dev-build chuyển lời lúc 07:13Z | Tin nhắn dev-build → dev-pm-ba 26/10/2026 07:13Z |
| PD-03 | 26/10/2026 | Viết SPEC B03–B09 ngay. Hành vi của web demo được dùng làm quy tắc tạm; mỗi quy tắc ghi rõ OD-xx sẽ thay nó (theo [PROCESS.md](../PROCESS.md) §2). Không chờ khách trả lời OD-05, OD-10–OD-13. | Chủ dự án (người dùng), dev-build chuyển lời lúc 07:00Z | Tin nhắn dev-build → dev-pm-ba 26/10/2026 07:00Z |

## Đối chiếu nguồn gốc D1/D2 với review 23/10 (26/10/2026)

**Đã đọc:**
- D1 `sources/customer/D1-aqua-proposal/aqua-proposal-2026-10-23.pdf`: toàn bộ chữ của 45 trang; phần hình của trang 17, 19–23 (B03, B05–B09).
- 5 sơ đồ `.mmd` kèm D1.
- D2 `sources/customer/D2-bao-gia/bao-gia-qltn-2026-10-20.docx`: toàn bộ chữ, mục 01–09.

**Chưa xem phần hình:** D1 trang 5–16, 18, 24–41 (F01–F10, B01–B02, B04, B10–B18, T01–T06, S01, A01) và ảnh minh họa trong D2. Kết luận về các trang đó chỉ dựa trên phần chữ.

### Chỗ review cần sửa

| ID | Mục review | Review ghi | Nguồn gốc cho thấy | Hệ quả |
|---|---|---|---|---|
| RC-01 | H01, OD-01 | Chưa có tài liệu xác định D1 thay thế hay bổ sung D2. | D1 tr. 42 ghi "20 triệu + 10 triệu = 30 triệu": nền tảng hiện hữu, cộng phần mở rộng mỗi tòa. D1 tr. 45 mục "Cơ sở phạm vi và báo giá" dẫn Báo giá 20/10 tr. 1–7 và "Yêu cầu ngày 23/10/2026: bổ sung 6 nghiệp vụ tiền gửi, giữ giá". Như vậy D1 **bổ sung** gói đầy đủ của D2 (D2 mục 06): +10 nghiệp vụ F với 10 triệu/tòa, +6 nghiệp vụ T không tăng giá. | Review nói quá mức. OD-01 thu hẹp lại, xem bản sửa bên dưới. |
| RC-02 | H03 | D2 "đầy đủ 20 triệu/tòa". | D2 mục 01 có **hai** phương án: Basic 16 triệu/tòa (tổng 64 triệu) hoặc Basic + Visualize + AI 20 triệu/tòa (tổng 80 triệu). D1 tr. 42 chỉ còn một mức "30 triệu mỗi tòa. Đầy đủ chức năng" (tổng 120 triệu). | Review bỏ sót phương án Basic. D1 không còn phương án Basic. |
| RC-03 | §3.1, L02 | Chưa rõ S01/A01 nằm trong hay ngoài 34. | D1 tr. 42 xếp "không gian trực quan và AI" vào phần nền tảng hiện hữu 20 triệu, tức gói đầy đủ của D2 (mục 06). D1 tr. 2 đếm 18 + 10 + 6 = 34, không có S/A. | S01/A01 nằm ngoài cách đếm 34 nhưng thuộc phạm vi qua gói đầy đủ của D2. L02 coi như đã có câu trả lời, chỉ cần khách xác nhận trong OD-01. |
| RC-04 | §3.1 | "34 nghiệp vụ". | D1 tr. 1–2 viết "34 phân hệ"; tr. 42 và 44 viết "nghiệp vụ". | Thuật ngữ. Không ảnh hưởng phạm vi; ghi vào bảng thuật ngữ sau. |
| RC-05 | H04, §9 | Chỉ nêu lịch tích hợp hai quỹ chưa có. | D1 tr. 44, bước "Nghiệm thu và bàn giao", chỉ liệt kê "Kiểm 10 nghiệp vụ khai thác + 6 tiền gửi; dashboard, web/mobile, quyền". Không nhắc B01–B18. D2 mục 03 ghi "Chi tiết quy trình và biểu mẫu được chốt trong phụ lục nghiệm thu"; phụ lục này chưa có. | Review bỏ sót: chưa có nguồn nào nêu tiêu chí nghiệm thu nhóm B. Mở OD-14. |
| RC-06 | H06, M01 | Vai trò trong chuỗi duyệt chưa đồng nhất giữa các tài liệu cũ. | D1 nêu vai trò người dùng, không nêu chuỗi duyệt: sơ đồ `01_He_phan_he.mmd` ghi "Ban quản trị · Ban quản lý · Kỹ thuật · Kế toán". Trong hình D1, Kế toán là người ghi nhận thanh toán (tr. 23); "Người nghiệm thu" là người nghiệm thu và ký biên bản (tr. 21–22). D1 và D2 không nhắc TVKT. Demo/API chỉ có BQL, KT, TVKT, BQT. | Review bỏ sót vai trò Kế toán và Người nghiệm thu. Mở OD-10. |
| RC-07 | H07 | Có tạm ứng/nhiều đợt. | Đúng. D2 mục 03 nhóm 09; D1 tr. 23: Đợt 1 tạm ứng 4 triệu "Đã trả", Đợt 2 quyết toán 6 triệu "Chờ chi", "10 − 4 = 6 triệu còn phải trả". Hình không cho biết tạm ứng xảy ra trước hay sau nghiệm thu. | Giữ H07 và OD-05. |
| RC-08 | H02, H04, M09, §7 | Bảo hành 6/12 tháng; mốc 3–4 tuần; web thích ứng; các mục loại trừ. | Khớp nguồn: D2 mục 09 (12 tháng) và D1 tr. 44 (6 tháng); D1 tr. 44 và D2 mục 07; D1 tr. 45 và D2 mục 04. | Không sửa. |

### Khác biệt D1 so với demo trong luồng B03–B09 (review chưa nêu)

UAT 20/10 (34/34 đạt) đo trên demo. Cả bốn điểm dưới đây đều chưa có trong demo/API, nên kết quả UAT không chứng minh được các điểm này.

| ID | D1 (hình minh họa) | Demo/API hiện tại |
|---|---|---|
| DG-01 | Tờ trình TT-001 tách dự toán thành hạng mục (Phụ kiện 7 tr, Thi công 3 tr), mỗi hạng mục gắn báo giá BG-001, tổng 10 tr (tr. 19). | Một số tiền `amountVnd` và tên một nhà thầu. |
| DG-02 | Nghiệm thu theo từng hạng mục kiểm tra (Chạy thử, Kiểm tra rò, Bàn giao), mỗi mục có kết quả và căn cứ, kết luận "Đạt 3/3", lượt "Lần 02" (tr. 22). | Mỗi người duyệt (KT, TVKT) chọn đạt/không đạt kèm ghi chú và tệp biên bản. |
| DG-03 | Biên bản nghiệm thu NT-001 do hệ thống tạo, có phiên bản (Phiên bản 03) và kiểm đủ trường (4/4); Người nghiệm thu ký bằng chuột/cảm ứng (tr. 21). | Chỉ ký ở lần trình tờ trình; biên bản nghiệm thu là tệp tải lên. |
| DG-04 | Thanh toán nhiều đợt (tạm ứng, quyết toán), có số còn lại; người ghi nhận là Kế toán (tr. 23). | Một lần thanh toán đúng đủ; BQL ghi nhận. |

Hình D1 được ghi là "Giao diện và dữ liệu minh họa". Các điểm trên là câu hỏi cần khách chốt, chưa phải nghĩa vụ đã cam kết.

## Chờ chốt

Câu hỏi gửi khách cho các OD dưới đây nằm trong [phiếu khảo sát L0](../reviews/2026-10-26/khao-sat-L0-cau-hoi-khach-hang.md): A1–A2 (OD-01), A3 (OD-02), A4 (OD-14), B1–B3 (OD-03, OD-10), B4–B6 (OD-17), C1 (OD-11), C2 (OD-15), C3 (OD-12), C4 (OD-13), C5 (OD-05), D1–D5 (OD-04), E1–E4 (OD-06), E5–E9 (OD-16), F1–F3 (OD-07), F4 (OD-08). Phiếu soạn ngày 26/10/2026, chưa gửi. Khi có câu trả lời, ghi vào mục "Đã chốt" kèm số câu.

OD-01 đến OD-08 lấy từ [review 23/10 §10](../reviews/2026-10-23/review-tai-lieu-nghiep-vu.md). Người quyết định là khách hàng/chủ dự án trừ khi ghi khác.

| ID | Câu hỏi | Ảnh hưởng | Liên quan |
|---|---|---|---|
| OD-01 | *(Sửa 26/10 theo RC-01, RC-03.)* D1 ghi rõ là bổ sung gói đầy đủ của D2 (D1 tr. 42, 45). Còn cần khách xác nhận ba điểm. (a) Hợp đồng theo D1, tức 30 triệu/tòa, đầy đủ 34 + S01 + A01; phương án Basic 16 triệu của D2 không còn áp dụng. (b) Ngoài phần giá, mục nào của D2 vẫn hiệu lực (bảo hành, phí vận hành, xem OD-02). (c) Hai tài liệu D1 tr. 45 dẫn nhưng repo chưa có: "Bộ màn hình QLTN, 9 trang" và "Proposal QLTN Aqua 1–4 ngày 23/10/2026, trang 34–36". | Toàn bộ phạm vi và nghiệm thu | H01, H04, L02, RC-01–03 |
| OD-02 | Bảo hành chính thức là 6 hay 12 tháng? Phí vận hành áp dụng theo mức và phạm vi nào? | Nghĩa vụ sau bàn giao | H02, H03 |
| OD-03 | Ai tạo, xác nhận, duyệt và ký từng loại hồ sơ ở từng tòa? Còn áp dụng vai trò CSH/CĐT không? | Ma trận quyền, workflow B03–B09 | H06, M01 |
| OD-04 | Hội nghị (F05), chọn đơn vị (F03) và ký hợp đồng khai thác (F04) có quan hệ điều kiện thế nào? | Luồng quỹ khai thác | §5.3 |
| OD-05 | Quy tắc tạm ứng, thanh toán nhiều đợt, công nợ còn lại và điều kiện đóng hồ sơ? | B09; quy tắc demo cũ "một lần đúng đủ" | H07 |
| OD-06 | Quy ước tính lãi, tất toán trước hạn, tái tục và lãi nhập gốc có thuộc phạm vi không? | T03–T06 | H05 |
| OD-07 | Mẫu biểu, Excel, sao kê, sơ đồ và dữ liệu thật nào dùng để nghiệm thu? | B07, B18, F08, S01 | M05, M10 |
| OD-08 | Tác vụ AI bắt buộc trong lần đầu là gì? Hạn mức và dữ liệu nguồn? | A01 | M07 |
| OD-10 | Danh sách vai trò chính thức cho luồng sửa chữa. Có vai trò Kế toán (ghi nhận thanh toán, D1 tr. 23) và "Người nghiệm thu" (D1 tr. 21–22) không? TVKT (có trong demo, không có trong D1/D2) còn nằm trong chuỗi duyệt không? Ai ghi nhận thanh toán: BQL như demo hay Kế toán như D1? | Ma trận quyền và người giữ bước B03–B09 | OD-03, RC-06, DG-04 |
| OD-11 | Tờ trình có bắt buộc chia hạng mục dự toán, mỗi hạng mục gắn báo giá, như D1 tr. 19 không? Có cần so sánh nhiều báo giá không? (D5 có bảng báo giá; D3 cũ đã bỏ so sánh báo giá.) | B05; dữ liệu tờ trình; số được duyệt dùng cho B09 | DG-01, M10 |
| OD-12 | Nghiệm thu có dùng danh sách hạng mục kiểm tra như D1 tr. 22 không? Nếu có: danh sách lấy từ đâu (mẫu theo loại việc, theo thiết bị hay nhập tay), và mọi hạng mục phải đạt mới qua? | B08; điều kiện chuyển sang thanh toán | DG-02 |
| OD-13 | Tài liệu nào được ký trong hệ thống và ai ký: tờ trình (demo), biên bản nghiệm thu do hệ thống tạo (D1 tr. 21), đề nghị thanh toán? Sau khi ký mà sửa nội dung thì xử lý phiên bản thế nào? | B07, B05, B08 | M04, DG-03 |
| OD-15 | Mỗi hồ sơ được trình tờ trình tối đa bao nhiêu lần? Hết số lần thì xử lý thế nào? Demo cho 3 lần; từ chối lần thứ 3 thì hồ sơ thành "Chưa xử lý" và kèm thông báo. D1 và D2 không nêu giới hạn này. | B05; trạng thái `UNRESOLVED` | SPEC B03–B09 TR-06 |
| OD-16 | Câu hỏi nhóm T (tiền gửi) TQ-01–TQ-06, chi tiết ở [modules/T-tien-gui-quy-bao-tri.md](modules/T-tien-gui-quy-bao-tri.md) §4: quỹ bảo trì theo tòa hay chung; bản chào trễ hạn; đổi kết quả chọn; phụ lục hợp đồng; ngân hàng trả thiếu lãi; sao kê dùng chung với F08. | T01–T06 | Phiếu L0 câu E5–E9 |
| OD-17 | Câu hỏi module users và roles: UQ-01 (xử lý việc đang giao khi nhân viên nghỉ hoặc bị khóa), UQ-02 (ai được thay người phụ trách), UQ-03 (đổi vị trí thì tạo tài khoản mới hay đổi vai trò), RQ-01 (**ai được sửa cấu hình tòa**: hiện BQL sửa được chuỗi duyệt, rủi ro tách bạch trách nhiệm), RQ-02 (ngừng dùng vai trò tùy chỉnh). Chi tiết ở [modules/users.md](modules/users.md) §4 và [modules/roles.md](modules/roles.md) §5. | B17, B16; US-S2, RO-S2 | Phiếu L0 câu B4–B6 |
| OD-14 | Tiêu chí nghiệm thu hợp đồng cho nhóm B01–B18 là gì? D1 tr. 44 chỉ nêu F và T; D2 mục 03 hẹn "phụ lục nghiệm thu" nhưng phụ lục này chưa có. | Điều kiện hoàn thành của mọi SPEC nhóm B | RC-05, H04 |

## Đã trả lời (không cần chốt thêm)

| ID | Câu hỏi | Trả lời | Nguồn |
|---|---|---|---|
| OD-09 | Mã task `D2-T*` trong commit lấy từ kế hoạch nào? | Không có file kế hoạch. Dấu vết duy nhất là các mục "Đợt 2 · T1/T2" trong `api-qltn/README.md` và nội dung commit (merge từ `origin/feature/api-dot2`, 23–24/10). Coi README và code là bản ghi việc đã làm, không phải kế hoạch. Từ nay phạm vi triển khai lấy theo `docs/product/features/*/SPEC.md`. | dev-build, 26/10/2026 |
