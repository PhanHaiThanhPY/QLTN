---
id: F.S5
title: Báo cáo thu chi quỹ khai thác, chấm dứt và thanh lý hợp đồng
status: Đã duyệt
owner: PM/BA
intent: "BQT xem được dòng tiền quỹ khai thác của một tòa trong kỳ, kèm nguồn hình thành và công nợ tách riêng; mỗi hợp đồng chỉ được đóng khi đã bàn giao, có biên bản thanh lý và không còn nghĩa vụ tiền nào mở."
depends_on: [F.S4]
---

# SPEC: Báo cáo thu chi quỹ khai thác, chấm dứt và thanh lý hợp đồng (F-S5)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-36), gồm 7 mặc định D-F5-1 đến D-F5-7 ở §6. Bắt đầu build sau khi F-S4 đạt review

**Nguồn:**
- Phân tích [F-quy-khai-thac.md](../../modules/F-quy-khai-thac.md), đã duyệt (PD-31): §2 F09, F10; FG-07 (cọc), FG-08 (số theo sao kê), FG-10 (công nợ không thu được); mặc định FQ-06, FQ-10, FQ-13 (OD-26).
- D1 tr. 13 (F09 "Nhìn rõ số dư quỹ và nguồn hình thành"): thác nước 50 → +15 → −5 → 60; thu khai thác 15, chi thuế 2, chi dịch vụ 3; "Còn phải thu 5 triệu · Theo dõi riêng, chưa cộng vào tiền quỹ"; nút "Xuất thu chi".
- D1 tr. 14 (F10 "Khép hợp đồng với đầy đủ nghĩa vụ và hồ sơ"): TL-001 / HĐ-001; bàn giao khu vực BG-001 "Đạt"; biên bản thanh lý TL-001 "Đã lập"; công nợ "Còn 5 triệu"; "Chưa thể đóng"; nút "Đóng hồ sơ" bị khóa.
- Sơ đồ `02_Chu_trinh_quy.mmd` chặng 4: "Đủ điều kiện đóng hồ sơ?"; D1 tr. 3: "Phần còn thiếu được xử lý riêng."
- Hướng dẫn trực quan hóa dữ liệu (skill `dataviz`) và cặp màu biểu đồ đã kiểm ở [dashboard.md](../../modules/dashboard.md) §5.3.

**Nền:** [F-S3](../F-thu-chi-quy-khai-thac/SPEC.md) (sổ quỹ, nhóm dòng, số dư theo sổ, cọc, phiếu chi) và [F-S4](../F-sao-ke-doi-soat/SPEC.md) (số dư theo sao kê, tháng "Đã khớp"). Slice này chỉ bắt đầu build **sau khi F-S4 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Đây là slice cuối của nhóm F. Nó khép hai việc còn lại của chu trình quỹ:

- **F09 Báo cáo thu chi:** BQT xem quỹ khai thác của một tòa trong một kỳ, gồm:
  - đầu kỳ, các khoản thu và chi theo nguồn, cuối kỳ;
  - công nợ và tiền cọc đang giữ, **tách riêng** khỏi số dư;
  - xuất ra tệp và bản in.
- **F10 Chấm dứt và thanh lý:**
  - BQL lập hồ sơ thanh lý cho một hợp đồng.
  - Phần tiền còn mở được xử lý theo một trong ba cách: thu nốt, cấn trừ vào tiền cọc, hoặc ghi nhận không thu được (có BQT duyệt). Phần cọc còn thừa thì hoàn lại.
  - Hệ thống **chỉ cho đóng** khi đủ điều kiện, như D1 tr. 14.

**Người dùng:**
- Chính: BQT xem và xuất báo cáo; duyệt ghi nhận không thu được và phiếu hoàn cọc.
- Chính: BQL lập thanh lý, ghi bàn giao, đóng hồ sơ.
- Phụ: kế toán cấn trừ cọc, lập phiếu hoàn cọc, xem báo cáo.

**User story:**
- Là BQT, trước hội nghị tôi muốn in báo cáo quỹ khai thác tháng của Aqua 1: tiền từ đâu, chi vào đâu, còn bao nhiêu, ai còn nợ.
- Là BQL, khi hợp đồng hết hạn tôi muốn biết chính xác còn thiếu gì để đóng hồ sơ, và hệ thống không cho đóng khi còn nợ.
- Là kế toán, tôi muốn trừ khoản nợ cuối của đơn vị vào tiền cọc, rồi hoàn phần cọc còn lại bằng phiếu chi có duyệt.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Báo cáo thu chi** của quỹ khai thác một tòa, theo kỳ (tháng, quý, năm, khoảng tùy chọn): thác nước, nguồn hình thành, công nợ và cọc tách riêng, chi tiết theo hợp đồng. Xuất XLSX và bản in A4 (BR-F5-01 đến BR-F5-05).
2. **Hồ sơ thanh lý:** lập hồ sơ, chấm dứt sớm hoặc hết hạn, bàn giao khu vực, biên bản thanh lý (BR-F5-06 đến BR-F5-08).
3. **Xử lý tiền khi thanh lý:** thu nốt (dùng khoản thu của F-S3), cấn trừ cọc, ghi nhận không thu được có BQT duyệt, hoàn cọc bằng phiếu chi (BR-F5-09 đến BR-F5-11).
4. **Điều kiện đóng và đóng hồ sơ;** trạng thái mới của hợp đồng và gói (BR-F5-12, BR-F5-13).
5. **Cờ "Đã hết hạn, chưa thanh lý"** cho hợp đồng quá ngày kết thúc (BR-F5-14).
6. **Màn hình:**
   - "Báo cáo thu chi" trong nhóm "Quỹ khai thác";
   - tab "Thanh lý" trong trang hợp đồng.
7. **Seed demo** theo D1 tr. 13–14 (BR-F5-16).

**Ngoài phạm vi:**
- Báo cáo **gộp nhiều tòa** (DF-20 "Dashboard gộp được bốn tòa"). Làm cùng B01 hoặc B18, đều đã hoãn (PD-30). Slice này chỉ báo cáo **một tòa, một quỹ**.
- Khóa hoặc ký báo cáo (D-F4-5).
- Phạt chậm, giảm trừ (FQ-06). "Không thu được" không phải giảm trừ: đó là ghi nhận một khoản đã mất.
- Quỹ bảo trì (nhóm T).
- Sinh biên bản thanh lý từ mẫu (FQ-12): BQL tải tệp đã soạn sẵn.
- Thông báo nhắc hợp đồng sắp hết hạn (notifications làm sau).
- Chế độ `mock`: không có màn F.

## 3. Quy tắc nghiệp vụ

### 3.1 Báo cáo thu chi (F09)

- **BR-F5-01. Kỳ và nguồn số:**
  - **Kỳ:** tháng (mặc định là tháng trước), quý, năm, hoặc khoảng ngày tùy chọn. Mỗi báo cáo thuộc **một quỹ khai thác của một tòa**.
  - **Nguồn số:**
    - Mọi ngày trong kỳ đã có sao kê, và mọi tháng trong kỳ đều "Đã khớp" (BR-F4-10): báo cáo dùng số **theo sao kê**, kèm nhãn "Theo sao kê · Đã đối soát".
    - Ngược lại: báo cáo dùng số **theo sổ**, kèm cảnh báo "**Số liệu theo sổ, chưa đối soát xong**". Báo cáo liệt kê các tháng chưa khớp và chênh lệch của từng tháng (FQ-10, D-F5-1).
  - Mỗi báo cáo ghi "**Số liệu tính đến** HH:mm dd/mm/yyyy".
- **BR-F5-02. Thác nước và các số chính** (D1 tr. 13):
  - Đầu kỳ → **+ Tổng thu** → **− Tổng chi** → Cuối kỳ, với Cuối kỳ = Đầu kỳ + Tổng thu − Tổng chi.
  - Dòng kiểm luôn hiện, ví dụ "50 + 15 − 5 = 60". Đơn vị ghi rõ: "triệu đồng" trên hình, "đồng" trong bảng.
  - **Tổng thu** và **Tổng chi** gồm mọi dòng sổ thực nhận, thực chi trong kỳ, kể cả nhận cọc, phí ngân hàng, lãi không kỳ hạn và dòng đảo.
  - **Dòng nội bộ không làm đổi tiền** (BR-F5-10) không tính vào thu, chi.
- **BR-F5-03. Nguồn hình thành:** bảng theo nhóm dòng sổ của F-S3 và F-S4.
  - **Thu:** Thu theo hợp đồng khai thác, Nhận tiền cọc, Lãi không kỳ hạn.
  - **Chi:** Chi thuế, Chi dịch vụ, Chuyển sang quỹ khác, Hoàn cọc, Phí ngân hàng, Chi khác.
  - Nhóm có số 0 trong kỳ thì không hiện.
  - Mỗi dòng mở ra được danh sách chứng từ của nhóm đó.
  - **Thu theo hợp đồng khai thác** chia tiếp theo từng hợp đồng: mã, đơn vị, số tiền.
- **BR-F5-04. Phần theo dõi riêng** (không cộng vào số dư):
  - **Còn phải thu** tại cuối kỳ: tổng còn phải thu của mọi kỳ phải thu có hạn ≤ cuối kỳ, chưa thu đủ và chưa ghi nhận không thu được. Chia theo hợp đồng, có cột "quá hạn bao nhiêu ngày".
  - **Tiền cọc đang giữ** tại cuối kỳ: số này **nằm trong** cuối kỳ, nhưng hiện riêng (BR-F3-05).
  - **Không thu được trong kỳ:** tổng các khoản được duyệt ghi nhận không thu được trong kỳ (BR-F5-11), chia theo hợp đồng.
  - Câu trên báo cáo: "Còn phải thu theo dõi riêng, chưa cộng vào tiền quỹ." (D1 tr. 13)
- **BR-F5-05. Xuất:**
  - **XLSX**, gồm 3 trang:
    1. "Tổng hợp": các số chính, nguồn hình thành, phần theo dõi riêng, nhãn nguồn số, thời điểm tính;
    2. "Chi tiết sổ": mọi dòng sổ trong kỳ, gồm mã chứng từ, mã GD nếu đã đối soát, và trạng thái đối soát;
    3. "Công nợ": theo hợp đồng và kỳ.

    Tiền là số nguyên, có định dạng hàng nghìn của Excel; không có công thức tính lại.
  - **Bản in A4** (chức năng in của trình duyệt, như B7-S1):
    - tiêu đề "Báo cáo thu chi quỹ khai thác · «tòa» · «kỳ»";
    - hình thác nước, các bảng, nhãn nguồn số;
    - chân trang "Bản in từ hệ thống QLTN · in lúc … · trang X/Y";
    - ô ký tay cho người lập và BQT, để trống.
  - Tên tệp: `bao-cao-thu-chi-«mã-tòa»-«yyyy-mm»` (hoặc theo kỳ).

### 3.2 Chấm dứt và thanh lý (F10)

- **BR-F5-06. Lập hồ sơ thanh lý** (BQL, hợp đồng "Hiệu lực"). Mã `TL-NNN`; mỗi hợp đồng có nhiều nhất một hồ sơ.
  - **Lý do chấm dứt:** Hết hạn, Chấm dứt sớm theo thỏa thuận, Chấm dứt do vi phạm. Mỗi lý do có ghi chú (≥ 10 ký tự).
  - **Ngày chấm dứt:**
    - Hết hạn: bằng ngày kết thúc của hợp đồng.
    - Chấm dứt sớm hoặc do vi phạm: từ ngày bắt đầu đến **trước** ngày kết thúc.
  - **Lập xong:** hợp đồng chuyển "**Đang thanh lý**".
    - Không làm phụ lục được nữa.
    - Vẫn ghi khoản thu được (F-S3), để thu nốt công nợ.
  - Hủy hồ sơ thanh lý (lý do) đưa hợp đồng về "Hiệu lực", và chỉ làm được khi chưa có xử lý tiền nào ở BR-F5-09 đến BR-F5-11.
- **BR-F5-07. Kỳ phải thu khi chấm dứt sớm:**
  - **Kỳ bắt đầu sau ngày chấm dứt:** chuyển "**Hủy do chấm dứt**". Không còn phải thu; kỳ đã có khoản thu thì không được hủy.
  - **Kỳ chứa ngày chấm dứt:** giữ nguyên số phải thu, không chia theo ngày (cùng nguyên tắc với D-F2-3).
  - Muốn thu ít hơn thì ghi nhận không thu được, có BQT duyệt (BR-F5-11).
- **BR-F5-08. Bàn giao và biên bản:**
  - **Bàn giao khu vực** (BQL): ngày bàn giao, kết quả **Đạt** hoặc **Không đạt**, ghi chú (bắt buộc khi Không đạt), biên bản bàn giao (tệp).
    - Mã `BG-NNN`. Mỗi lần bàn giao là một bản ghi.
    - Không đạt thì ghi một lần bàn giao mới khi đã khắc phục.
  - **Biên bản thanh lý** (BQL): tệp ký, kèm ngày ký. Thay được tệp; tệp cũ vẫn lưu trong lịch sử.
- **BR-F5-09. Thu nốt:** dùng "Ghi nhận khoản thu" của F-S3 (BR-F3-06), không có gì mới. Công nợ giảm theo.
- **BR-F5-10. Cấn trừ cọc** (kế toán, hợp đồng "Đang thanh lý", có tiền cọc đang giữ):
  - Chọn số tiền ≤ min(tiền cọc đang giữ, còn phải thu), phân bổ vào các kỳ như một khoản thu, kèm ghi chú.
  - **Hệ thống ghi hai dòng sổ nội bộ cùng ngày, cùng số tiền:**
    - "Cấn trừ cọc · giảm cọc" (Chi, nhóm Nhận tiền cọc);
    - "Cấn trừ cọc · thu theo hợp đồng" (Thu, nhóm Thu theo hợp đồng khai thác).

    Hai dòng gắn nhãn **Nội bộ**.
  - **Hệ quả:**
    - số dư quỹ không đổi;
    - tiền cọc đang giữ giảm;
    - công nợ giảm;
    - thu khai thác tăng;
    - hai dòng này không cần ghép sao kê và không tính là "lệch" (F-S4). Tương tự dòng tự khử.
  - Hủy cấn trừ (lý do) tạo hai dòng đảo, theo BR-F3-04.
- **BR-F5-11. Ghi nhận không thu được** (FQ-13):
  - BQL hoặc kế toán đề xuất, hợp đồng "Đang thanh lý": số tiền ≤ còn phải thu, phân bổ vào kỳ, lý do (≥ 20 ký tự), tệp căn cứ (không bắt buộc).
  - **BQT duyệt**, yêu cầu sửa, hoặc từ chối. Người đề xuất không tự duyệt.
  - **Duyệt xong:** phần phân bổ của mỗi kỳ được ghi "Không thu được". Kỳ có còn phải thu = 0 nhờ ghi nhận này thì chuyển "**Không thu được**".
  - **Không có dòng sổ:** không có tiền nào đi đâu. Số tiền hiện ở báo cáo, phần "Không thu được trong kỳ" (BR-F5-04).
- **BR-F5-12. Hoàn cọc:**
  - Phần cọc còn giữ sau khi cấn trừ được hoàn bằng **phiếu chi nhóm "Hoàn cọc"** (F-S3 BR-F3-12): kế toán lập, BQT duyệt, kế toán ghi đã chi.
  - Số tiền ≤ tiền cọc đang giữ của hợp đồng đó. Phiếu ghi rõ hợp đồng.
  - Đã chi xong thì tiền cọc đang giữ giảm tương ứng.
- **BR-F5-13. Điều kiện đóng và đóng hồ sơ** (BQL), D1 tr. 14:

  | Điều kiện | Đạt khi |
  |---|---|
  | Bàn giao khu vực | lần bàn giao mới nhất là "Đạt" |
  | Biên bản thanh lý | đã có tệp và ngày ký |
  | Công nợ hợp đồng | còn phải thu của mọi kỳ chưa hủy = 0 (đã thu, đã cấn trừ, hoặc đã duyệt không thu được) |
  | Tiền cọc | tiền cọc đang giữ của hợp đồng = 0 (đã cấn trừ hoặc đã hoàn) |
  | Đề xuất đang chờ | không còn đề xuất "không thu được" hay phiếu hoàn cọc nào đang chờ duyệt hoặc chờ chi |

  - **"Đóng hồ sơ"** chỉ bấm được khi đủ mọi điều kiện. Thiếu điều kiện nào thì hiện đúng điều kiện đó và số tiền còn lại, ví dụ "**Chưa thể đóng** · Khoản phải thu còn lại 5.000.000 đ".
  - **Đóng xong:**
    - hợp đồng chuyển "**Đã thanh lý**"; gói chuyển "**Đã đóng**";
    - mọi thao tác ghi trên hợp đồng, kỳ và hồ sơ thanh lý bị khóa, chỉ còn xem;
    - quỹ và sổ quỹ vẫn hoạt động bình thường.
  - Hồ sơ "Đã thanh lý" **không mở lại được** ở slice này (D-F5-4).
- **BR-F5-14. Hợp đồng hết hạn chưa thanh lý:** lần chạy hằng ngày (bộ lịch chạy dùng chung) gắn cờ "**Đã hết hạn, chưa thanh lý**" cho hợp đồng "Hiệu lực" đã qua ngày kết thúc. Cờ hiện ở danh sách và trang hợp đồng, kèm nút "Lập hồ sơ thanh lý". Hợp đồng không tự chuyển trạng thái.

### 3.3 Chung

- **BR-F5-15. Quyền:**
  - **Báo cáo:** xem và xuất: BQT, kế toán. **BQL không xem** báo cáo quỹ (cùng nguyên tắc D-F3-6).
  - **Thanh lý:** BQL lập, hủy, ghi bàn giao, tải biên bản, đóng. Kế toán cấn trừ cọc, lập phiếu hoàn cọc, đề xuất không thu được. BQT duyệt không thu được và phiếu hoàn cọc.
  - BQL, BQT và kế toán xem được tab "Thanh lý".
  - KT, TVKT: không thấy.
  - Ngoài phạm vi tòa: 404.
  - Cần quyền mới cho việc xem và xuất báo cáo quỹ. Dev-build đặt tên, cập nhật ma trận quyền và tài liệu RM.
  - Mọi thao tác ghi có nhật ký, kèm lý do nếu có, và khóa phiên bản.
- **BR-F5-16. Seed demo:** nối tiếp seed của F-S2 đến F-S4.
  - **Báo cáo:** tháng 11 của quỹ Aqua 1 ra đúng D1 tr. 13. "Theo sao kê · Đã đối soát"; 50 + 15 − 5 = 60; thu theo hợp đồng 15, chi thuế 2, chi dịch vụ 3; còn phải thu 5 tách riêng.
  - **Thanh lý:** HĐ-001 có hồ sơ TL-001 "Đang thanh lý", đúng D1 tr. 14: bàn giao BG-001 "Đạt", biên bản thanh lý đã có, công nợ 5.000.000, nên "Chưa thể đóng".

  Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu dùng quỹ khai thác Aqua 1 và HĐ-001, theo seed của F-S2 đến F-S4: tháng 11 có số dư đầu 50, thu 15, chi 5, sao kê 4/4 khớp; HĐ-001 kỳ 16–30/11, phải thu 20, đã thu 15, cọc 0.

**Báo cáo**
- **AC-F5.1** (D1 tr. 13) BQT mở báo cáo tháng 11 Aqua 1:
  - "Theo sao kê · Đã đối soát";
  - thác nước **50 → +15 → −5 → 60**, kèm dòng kiểm "50 + 15 − 5 = 60";
  - nguồn hình thành: Thu theo hợp đồng khai thác 15.000.000, Chi thuế 2.000.000, Chi dịch vụ 3.000.000;
  - "Còn phải thu: 5.000.000", hiện riêng, không cộng vào 60.
- **AC-F5.2** Thêm một khoản thu 1.000.000 ngày 29/11 vào sổ mà không có trên sao kê, rồi mở lại báo cáo:
  - nguồn số chuyển "**Số liệu theo sổ, chưa đối soát xong**", kèm "Tháng 11 · chênh lệch +1.000.000";
  - cuối kỳ là 61.000.000.
- **AC-F5.3** Báo cáo quý 4: đầu kỳ là số dư đầu 01/10 (hoặc ngày bắt đầu sổ, nếu muộn hơn); thu và chi cộng đủ cả 3 tháng; dòng kiểm đúng.
- **AC-F5.4** Xuất XLSX tháng 11: có 3 trang. Trang "Tổng hợp" có đúng các số của AC-F5.1. Trang "Chi tiết sổ" có 5 dòng (gồm số dư đầu) kèm mã GD. Ô tiền là số, không phải chữ.
- **AC-F5.5** Bản in tháng 11: A4 dọc, có thác nước, bảng, nhãn nguồn số, chân trang có số trang; không có thanh công cụ.
- **AC-F5.6** BQL mở báo cáo: 403. Kế toán tòa B mở báo cáo tòa A: 404.

**Thanh lý**
- **AC-F5.7** (D1 tr. 14) Lập TL-001 cho HĐ-001 với lý do "Hết hạn"; bàn giao BG-001 "Đạt"; tải biên bản thanh lý: tab Thanh lý hiện **"Chưa thể đóng · Khoản phải thu còn lại 5.000.000 đ"**, và nút "Đóng hồ sơ" bị khóa.
- **AC-F5.8** Ghi khoản thu PT-003 5.000.000: mọi điều kiện đạt, "Đóng hồ sơ" bấm được. Đóng: HĐ-001 "Đã thanh lý", gói MT-001 "Đã đóng". Không còn nút ghi nào trên hợp đồng.
- **AC-F5.9** Cách khác: đề xuất "không thu được" 5.000.000 kèm lý do. Người đề xuất tự duyệt: 403. BQT duyệt:
  - kỳ thành "Không thu được";
  - công nợ = 0, đóng được;
  - sổ quỹ **không** có dòng mới;
  - báo cáo tháng có "Không thu được trong kỳ: 5.000.000".
- **AC-F5.10** Hợp đồng có cọc 40.000.000 đã nhận, còn phải thu 5.000.000.
  - Cấn trừ 5.000.000: sổ có 2 dòng **Nội bộ**, số dư quỹ không đổi, cọc đang giữ còn 35.000.000, công nợ 0. Màn đối soát (F-S4) không tính 2 dòng này là lệch.
  - Lập phiếu hoàn cọc 35.000.000, BQT duyệt, kế toán ghi đã chi: cọc đang giữ = 0, đóng được.
  - Hoàn cọc 36.000.000: bị từ chối.
- **AC-F5.11** Chấm dứt sớm ngày 10/01 một hợp đồng 3 kỳ (tháng 12, tháng 1, tháng 2), chưa thu kỳ 3: kỳ 2 (chứa 10/01) giữ nguyên số phải thu; kỳ 3 "Hủy do chấm dứt". Chấm dứt sớm khi kỳ 3 đã có khoản thu: bị từ chối, kèm câu báo rõ kỳ nào.
- **AC-F5.12** Bàn giao "Không đạt" rồi mới "Đạt": điều kiện bàn giao lấy lần mới nhất. Chỉ có lần "Không đạt" thì chưa đóng được.
- **AC-F5.13** Có một phiếu hoàn cọc đang "Chờ duyệt" thì chưa đóng được, kể cả khi số tiền đã đủ.
- **AC-F5.14** Hợp đồng "Hiệu lực" quá ngày kết thúc 1 ngày: có cờ "Đã hết hạn, chưa thanh lý" sau lần chạy hằng ngày, mà trạng thái hợp đồng không đổi.
- **AC-F5.15** Hủy hồ sơ thanh lý khi đã có cấn trừ cọc: bị từ chối. Hủy khi chưa có xử lý tiền nào: hợp đồng về "Hiệu lực".

**Chung**
- **AC-F5.16** Seed demo cho ra đúng AC-F5.1 và AC-F5.7 trên DB mới; chạy lại không tạo trùng.
- **AC-F5.17** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Màu thác nước đạt `validate_palette.js` ở chế độ sáng và tối (lưu kết quả vào bằng chứng). Test của F-S1 đến F-S4 vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test:
  - số của báo cáo theo kỳ (tháng, quý, khoảng) và chọn nguồn số (sao kê hay sổ);
  - nguồn hình thành; công nợ tại cuối kỳ; dòng nội bộ không vào thu, chi;
  - điều kiện đóng.
- [ ] e2e API:
  - báo cáo D1 (AC-F5.1), chuyển sang theo sổ khi lệch (AC-F5.2);
  - xuất XLSX (đọc lại tệp và so số);
  - thanh lý: hết hạn, chấm dứt sớm (hủy kỳ), bàn giao;
  - thu nốt; cấn trừ cọc (2 dòng nội bộ, không lệch F-S4); không thu được (BQT duyệt, tự duyệt 403); hoàn cọc (giới hạn);
  - điều kiện đóng, đóng, khóa sau đóng;
  - cờ hết hạn; quyền.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của F-S4.
- [ ] Test component: thác nước (bản dạng bảng có cùng số), danh sách điều kiện đóng, hộp thoại cấn trừ và không thu được.
- [ ] Ảnh chụp ở chế độ `api`: báo cáo tháng 11 (sáng và tối), bản in, tab Thanh lý "Chưa thể đóng" và "Đủ điều kiện", màn rộng 375px. Kèm kết quả `validate_palette.js`.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-F5-1 | Báo cáo dùng số theo sao kê khi mọi tháng trong kỳ đã khớp; nếu không thì dùng số theo sổ, kèm cảnh báo | FQ-10: "chỉ tính thực nhận, thực chi". Không bao giờ hiện một con số mà không nói rõ nó từ đâu |
| D-F5-2 | Cấn trừ cọc ghi 2 dòng sổ nội bộ, không làm đổi số dư | Tiền không ra khỏi tài khoản; chỉ đổi từ "giữ hộ" sang "thu khai thác". Vẫn truy được trên sổ |
| D-F5-3 | "Không thu được" cần BQT duyệt và không có dòng sổ | FQ-13. Không có tiền nào đi đâu; chỉ là khép một nghĩa vụ |
| D-F5-4 | Hồ sơ đã thanh lý không mở lại được | Hồ sơ đã khép là hồ sơ để lưu. Có sai sót thì xử lý bằng chứng từ mới ở quỹ |
| D-F5-5 | BQL không xem báo cáo quỹ | Cùng nguyên tắc D-F3-6; D1 tr. 13 dùng vai BQT |
| D-F5-6 | Chấm dứt sớm: kỳ chứa ngày chấm dứt giữ nguyên số phải thu | Cùng nguyên tắc D-F2-3 (không chia theo ngày). Thu ít hơn thì ghi nhận không thu được, có BQT duyệt |
| D-F5-7 | Báo cáo chỉ cho một tòa; gộp bốn tòa để sau | DF-20 gộp ở tầng tổng quan (B01/B18), đang hoãn (PD-30) |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích nhóm F (PD-31), sau F-S4 (PD-35). |
| 27/10/2026 | Chủ dự án duyệt (PD-36), gồm D-F5-1 đến D-F5-7, và cho giao dev-build (bắt đầu sau khi F-S4 đạt review). |
