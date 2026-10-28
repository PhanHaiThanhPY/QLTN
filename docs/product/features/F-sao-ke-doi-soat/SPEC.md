---
id: F.S4
title: Nhập sao kê tài khoản quỹ và đối soát với sổ quỹ
status: Đã triển khai
owner: PM/BA
intent: "Kế toán nhập sao kê ngân hàng của tài khoản quỹ, ghép từng giao dịch với đúng một chứng từ trong sổ, và biết ngay sổ có khớp ngân hàng không, lệch ở dòng nào."
depends_on: [F.S3]
---

# SPEC: Nhập sao kê tài khoản quỹ và đối soát với sổ quỹ (F-S4)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã triển khai` (28/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-35), gồm 6 mặc định D-F4-1 đến D-F4-6 ở §6. Bắt đầu build sau khi F-S3 đạt review

**Nguồn:**
- Phân tích [F-quy-khai-thac.md](../../modules/F-quy-khai-thac.md), đã duyệt (PD-31): §2 F08, F07 (cờ "Đã đối chiếu"); FG-08, FG-09; mặc định FQ-09, FQ-10 (OD-26).
- D1 tr. 12 (F08 "Đối chiếu sao kê với từng khoản thu, chi"): tài khoản ****0001; đầu kỳ 50, thu 15, chi 5, cuối kỳ 60; GD-001 đến GD-004 ghép với PT-001, PT-002, chứng từ thuế, PC-001; "4/4 khớp"; "Chênh lệch 0 đ · Lệch/trùng: 0/0"; "Chỉ tính giao dịch thực nhận, thực chi".
- DF-26: **một** chức năng nhập sao kê dùng chung, gắn theo **tài khoản**, mỗi quỹ một tài khoản. Nhóm T sẽ đối chiếu lãi tiền gửi bằng chính chức năng này (T04, TQ-06). OD-07 (chưa có sao kê thật của khách).

**Nền:** [F-S3](../F-thu-chi-quy-khai-thac/SPEC.md): quỹ, tài khoản, sổ quỹ với dòng bất biến, dòng đảo, số dư theo sổ, trạng thái "Chưa đối soát". Slice này chỉ bắt đầu build **sau khi F-S3 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau F-S3, sổ quỹ có số dư "theo sổ", nhưng chưa ai biết số đó có khớp ngân hàng hay không. D1 tr. 12 yêu cầu ba việc:
- đối chiếu từng giao dịch với từng chứng từ;
- biết chênh lệch;
- biết dòng nào lệch hoặc trùng.

Sau slice này:
- Kế toán nhập sao kê của tài khoản quỹ từ tệp theo mẫu hoặc nhập tay. Nhập lại cùng tệp không tạo dòng trùng.
- Hệ thống đề xuất ghép từng giao dịch với một dòng sổ; kế toán xác nhận.
- Màn đối soát cho thấy số dư theo sao kê, chênh lệch với sổ, và danh sách dòng chưa ghép ở cả hai phía.

Báo cáo thu chi (F09) dùng số **theo sao kê** ở **F-S5**.

**Người dùng:**
- Chính: kế toán nhập sao kê và đối soát hằng tháng.
- Phụ: BQT xem tháng nào đã khớp, chênh lệch bao nhiêu.

**User story:**
- Là kế toán, cuối tháng tôi tải sao kê ngân hàng lên, và muốn hệ thống tự ghép những dòng rõ ràng, để tôi chỉ phải xử lý vài dòng còn lệch.
- Là kế toán, tôi muốn bắt được một khoản tiền về tài khoản mà chưa ai ghi chứng từ, hoặc một chứng từ đã ghi mà ngân hàng chưa có.
- Là BQT, tôi muốn thấy "Chênh lệch 0 đ" trước khi ký báo cáo quỹ.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Nhập sao kê** cho một tài khoản quỹ: từ tệp theo mẫu cột chuẩn (CSV hoặc XLSX), hoặc nhập tay từng dòng. Kiểm sao kê khép số dư; chống trùng (BR-F4-01 đến BR-F4-04).
2. **Ghép** một dòng sao kê với một dòng sổ: đề xuất tự động, xác nhận, ghép tay, bỏ ghép (BR-F4-05 đến BR-F4-07).
3. **Ghi nhận từ sao kê** các giao dịch ngân hàng không có chứng từ trước: phí ngân hàng, lãi không kỳ hạn (BR-F4-08).
4. **Số dư theo sao kê, chênh lệch, lệch và trùng;** màn đối soát theo tháng (BR-F4-09, BR-F4-10).
5. **Chặn hủy chứng từ đã đối soát** (bổ sung cho BR-F3-04). Cờ "Đã đối chiếu k/n" cho nghĩa vụ thuế (BR-F4-11).
6. **Màn hình:** "Sao kê và đối soát" trong nhóm "Quỹ khai thác"; mã giao dịch và trạng thái đối soát hiện trên sổ quỹ (F-S3).
7. **Mẫu tệp** tải về được. **Seed demo** khớp D1 (BR-F4-13).

**Ngoài phạm vi:**
- Đọc định dạng sao kê riêng của từng ngân hàng (OD-07). Chỉ có **mẫu cột chuẩn** của hệ thống; kế toán chép dữ liệu vào mẫu.
- Kết nối ngân hàng hay lấy sao kê tự động (D1 tr. 45).
- Ghép một giao dịch với nhiều chứng từ, hay nhiều giao dịch với một chứng từ (D-F4-2).
- Quỹ bảo trì và lãi tiền gửi có kỳ hạn (nhóm T). Chức năng dựng **theo tài khoản**, để nhóm T dùng lại mà không phải đổi.
- Báo cáo thu chi, xuất tệp (F-S5).
- Chế độ `mock`: không có màn F.

## 3. Quy tắc nghiệp vụ

- **BR-F4-01. Một lần nhập sao kê** (kế toán, cho **một** tài khoản quỹ):
  - Gồm: kỳ sao kê (từ ngày, đến ngày), **số dư đầu kỳ** và **số dư cuối kỳ** theo ngân hàng, và các giao dịch.
  - **Sao kê phải khép:** số dư đầu kỳ + Σ giao dịch = số dư cuối kỳ. Không khép thì **chặn** và báo chênh lệch. Lý do: thiếu dòng hoặc nhập sai số (D-F4-1).
  - Mỗi lần nhập được lưu: người nhập, thời điểm, tệp gốc (nếu nhập từ tệp), số dòng mới, số dòng bỏ qua vì trùng.
  - **Hai lần nhập được phép chồng kỳ;** chống trùng xử lý phần chồng (BR-F4-03).
  - Ngày của mọi giao dịch phải nằm trong kỳ sao kê, và không trước ngày bắt đầu sổ của quỹ (BR-F3-02).
- **BR-F4-02. Mẫu cột chuẩn:**
  - **Tệp:** CSV mã UTF-8, hoặc XLSX trang đầu tiên; tối đa 5.000 dòng.
  - **Cột:**

    | Cột | Bắt buộc | Định dạng |
    |---|---|---|
    | Ngày giao dịch | có | `dd/mm/yyyy` |
    | Ghi có (tiền vào) | một trong hai | số nguyên VND ≥ 0, không có phần thập phân |
    | Ghi nợ (tiền ra) | một trong hai | như trên |
    | Nội dung | có | chữ, tối đa 500 ký tự |
    | Số tham chiếu | không | chữ, tối đa 100 ký tự |
    | Số tài khoản | không | nếu có, phải trùng số tài khoản của quỹ; không trùng thì chặn cả tệp |

  - Mỗi dòng có đúng một trong hai cột Ghi có, Ghi nợ là số > 0.
  - Dòng lỗi được báo theo **số dòng và tên cột**, ví dụ: "Dòng 7: Ghi nợ có phần thập phân." Có dòng lỗi thì không nhập dòng nào (D-F4-1).
  - Hệ thống có nút tải **mẫu tệp trống** kèm 2 dòng ví dụ.
  - **Nhập tay:** cùng các trường như trên, từng dòng một, trong một lần nhập có số dư đầu kỳ và cuối kỳ.
- **BR-F4-03. Chống trùng:**
  - **Khóa của một giao dịch:**
    - có số tham chiếu: (tài khoản, ngày, số tiền có dấu, số tham chiếu);
    - không có số tham chiếu: (tài khoản, ngày, số tiền có dấu, nội dung đã chuẩn hóa: bỏ khoảng trắng thừa, không phân biệt hoa thường).
  - Giao dịch trùng khóa với giao dịch đã có thì **bỏ qua**, không nhập lại. Kết quả nhập báo "Bỏ qua n dòng trùng".
  - Trong **cùng một tệp** có hai dòng trùng khóa: cả hai vẫn được nhập, vì ngân hàng có thể có hai giao dịch giống hệt nhau trong một ngày. Hai dòng được đánh dấu "**Có thể trùng**", để kế toán xem lại; đây là con số "trùng" trên màn đối soát.
- **BR-F4-04. Dòng sao kê:** mã `GD-NNN` theo tài khoản.
  - **Trường:** ngày, chiều (Thu hoặc Chi), số tiền, nội dung, số tham chiếu.
  - **Trạng thái:** **Chưa ghép**, **Đã ghép**, hoặc **Đã ghi nhận từ sao kê** (BR-F4-08).
  - **Xóa:** dòng sao kê không sửa được. Xóa được **cả một lần nhập** khi chưa dòng nào của lần đó được ghép, kèm lý do. Đây là cách sửa khi nhập nhầm tệp.
- **BR-F4-05. Ghép:**
  - **Một** dòng sao kê ghép với đúng **một** dòng sổ (D1 "4/4 khớp"; D-F4-2).
  - **Điều kiện:**
    - cùng quỹ, cùng chiều;
    - **cùng số tiền tuyệt đối**;
    - dòng sổ chưa được ghép, và không phải dòng "Số dư đầu";
    - ngày sao kê cách ngày dòng sổ **không quá 5 ngày**. Lệch hơn thì vẫn ghép tay được, nhưng cần lý do (D-F4-3).
  - **Dòng đảo và dòng gốc của nó** (BR-F3-04) không cần sao kê, vì cặp này không làm tiền thật đi đâu. Hai dòng được tự đánh dấu "Tự khử", không tính là chưa ghép.
  - **Ghép xong:** dòng sổ chuyển "**Đã đối soát**", hiện mã GD tương ứng. Dòng sao kê hiện mã chứng từ, như D1 "PT-001 · Liên kết GD-001".
- **BR-F4-06. Đề xuất ghép tự động:**
  - Sau mỗi lần nhập, hệ thống **đề xuất** một cặp ghép khi dòng sao kê có **đúng một** dòng sổ ứng viên thỏa BR-F4-05, với ngày lệch ≤ 2 ngày.
  - Có từ hai ứng viên trở lên thì không đề xuất, mà liệt kê để kế toán chọn.
  - **Đề xuất chưa phải là ghép.** Kế toán xác nhận từng cặp, hoặc "Xác nhận tất cả đề xuất" (D-F4-4).
- **BR-F4-07. Bỏ ghép:**
  - Kế toán bỏ ghép một cặp, kèm lý do (≥ 10 ký tự). Hai dòng về "Chưa ghép" và "Chưa đối soát"; lịch sử ghép vẫn giữ.
  - **Chứng từ có dòng sổ "Đã đối soát" không hủy được** (bổ sung cho BR-F3-04): phải bỏ ghép trước. Báo: "Bỏ ghép GD-… trước khi hủy chứng từ này."
- **BR-F4-08. Ghi nhận từ sao kê:**
  - Dòng sao kê không có chứng từ nào vì là việc của ngân hàng thì kế toán chọn "Ghi nhận từ sao kê" với một trong hai nhóm:
    - **Phí ngân hàng:** chiều Chi;
    - **Lãi không kỳ hạn:** chiều Thu, ghi vào chính quỹ của tài khoản này.
  - Hệ thống tạo một dòng sổ mới cùng ngày, cùng số tiền, ghép sẵn với dòng sao kê.
  - Các khoản khác, như tiền đơn vị chuyển hay khoản chi, **không** ghi nhận theo cách này. Kế toán phải lập đúng chứng từ (khoản thu, phiếu chi), rồi ghép.
  - Ghi nhận từ sao kê vẫn chịu luật không âm (BR-F3-13).
- **BR-F4-09. Số dư theo sao kê và chênh lệch:**
  - **Số dư theo sao kê** cuối ngày D = số dư cuối của sao kê đã nhập có chứa ngày D. Tính ngày D bằng số dư đầu kỳ của sao kê đó cộng các giao dịch có ngày ≤ D.
  - Ngày không thuộc sao kê nào thì hiện "**Chưa có sao kê**", không đoán.
  - **Chênh lệch** tại ngày D = số dư theo sổ − số dư theo sao kê. Hiện cả dấu.
  - **Kiểm số dư đầu:** khi có sao kê chứa ngày bắt đầu sổ, mà số dư đầu kỳ của sao kê khác số dư đầu của sổ (BR-F3-02), thì hiện cảnh báo trên màn đối soát.
- **BR-F4-10. Màn đối soát của một tháng** (D1 tr. 12):
  - **Ô số theo sao kê:** đầu kỳ, thu, chi, cuối kỳ.
  - **Tình trạng:**
    - "k/n khớp": số dòng sao kê đã ghép hoặc đã ghi nhận, trên tổng dòng sao kê trong tháng;
    - "Chênh lệch X đ" tại ngày cuối tháng;
    - "**Lệch** a / **trùng** b". *a* = số dòng sao kê chưa ghép + số dòng sổ chưa đối soát trong tháng (trừ dòng tự khử). *b* = số dòng "Có thể trùng".
  - **"Tháng đã khớp"** khi đủ ba điều kiện: chênh lệch 0, lệch 0, trùng 0. Không có thao tác "khóa tháng" ở slice này (D-F4-5).
  - Câu trên màn: "Chỉ tính giao dịch thực nhận, thực chi."
- **BR-F4-11. Cờ đối chiếu ở các màn khác:**
  - **Nghĩa vụ thuế** (F07): "Đã đối chiếu k/n", với k là số giấy nộp thuế đã đối soát.
  - **Khoản thu ở hợp đồng** và **phiếu chi:** mỗi chứng từ hiện "Đã đối soát · GD-…" hoặc "Chưa đối soát".
  - **Sổ quỹ (F-S3):** thêm cột hoặc nhãn GD.
- **BR-F4-12. Quyền:**
  - **Kế toán** (`FUND_OPERATE`, phạm vi tòa): nhập, xóa lần nhập, ghép, bỏ ghép, ghi nhận từ sao kê.
  - **BQT:** xem màn đối soát và các lần nhập.
  - **BQL, KT, TVKT:** không thấy.
  - Ngoài phạm vi tòa: 404.
  - Mọi thao tác ghi có nhật ký, kèm lý do nếu có.
- **BR-F4-13. Seed demo:** nối tiếp seed của F-S3, cho tháng 11 của quỹ khai thác tòa demo:
  - một lần nhập sao kê: đầu kỳ 50.000.000, cuối kỳ 60.000.000;
  - giao dịch: GD-001 +10.000.000, GD-002 +5.000.000, GD-003 −2.000.000, GD-004 −3.000.000, cùng ngày với chứng từ tương ứng;
  - bốn cặp đã ghép.

  Màn đối soát tháng 11 ra **4/4 khớp, chênh lệch 0 đ, lệch/trùng 0/0**, đúng D1. Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu là sổ quỹ khai thác Aqua 1 tháng 11 sau F-S3: số dư đầu 50; PT-001 +10 (18/11); PT-002 +5 (22/11); GNT-001 −2 (22/11); PC-001 −3 (23/11).

**Nhập**
- **AC-F4.1** Nhập tệp mẫu kỳ 01/11–30/11, đầu kỳ 50.000.000, cuối kỳ 60.000.000, 4 dòng như D1: nhập được 4 dòng `GD-…`, "Bỏ qua 0 dòng trùng". Có 4 đề xuất ghép.
- **AC-F4.2** Cùng tệp nhưng cuối kỳ ghi 61.000.000: bị chặn, kèm câu "Sao kê không khép: lệch 1.000.000 đ". Không có dòng nào được nhập.
- **AC-F4.3** Tệp có một dòng "Ghi nợ 2.000.000,50": bị chặn, kèm câu "Dòng 4: Ghi nợ có phần thập phân." Tệp có cột "Số tài khoản" khác tài khoản quỹ: bị chặn cả tệp.
- **AC-F4.4** Nhập lại đúng tệp ở AC-F4.1: "Bỏ qua 4 dòng trùng", và không có dòng mới. Nhập một tệp kỳ 15/11–15/12 chồng nửa tháng: chỉ dòng mới được thêm.
- **AC-F4.5** Một tệp có hai dòng cùng ngày, cùng số tiền, cùng nội dung, không có số tham chiếu: cả hai được nhập, đều có nhãn "Có thể trùng", và màn đối soát ghi "trùng 2".

**Ghép**
- **AC-F4.6** "Xác nhận tất cả đề xuất" sau AC-F4.1:
  - 4 dòng sổ thành "Đã đối soát";
  - màn đối soát tháng 11 ra **đầu kỳ 50, thu 15, chi 5, cuối kỳ 60 (theo sao kê) · 4/4 khớp · Chênh lệch 0 đ · Lệch/trùng 0/0**;
  - TH-001 có "Đã đối chiếu 1/1".
- **AC-F4.7** Có hai khoản thu cùng 5.000.000 ở ngày 21/11 và 22/11, và một dòng sao kê +5.000.000 ngày 22/11: **không** có đề xuất tự động, vì có hai ứng viên. Kế toán chọn tay một trong hai: được.
- **AC-F4.8** Ghép tay một dòng sao kê +10.000.000 ngày 30/11 với PT-001 (ngày 18/11, lệch 12 ngày): bắt buộc lý do. Ghép dòng +10.000.000 với PC-001 (chiều Chi): bị từ chối. Ghép với khoản có số tiền khác: bị từ chối.
- **AC-F4.9** Hủy PT-002 khi đã đối soát: bị từ chối, kèm câu của BR-F4-07. Bỏ ghép kèm lý do rồi hủy: được. Dòng PT-002 và dòng đảo của nó thành "Tự khử", không tính vào "lệch". GD-002 trở về "Chưa ghép", nên lệch tăng lên 1.

**Ghi nhận từ sao kê, chênh lệch**
- **AC-F4.10** Dòng sao kê −11.000 "Phí SMS" ngày 30/11, không có chứng từ: "Ghi nhận từ sao kê · Phí ngân hàng" tạo dòng sổ Chi 11.000, ghép sẵn. Số dư theo sổ và theo sao kê cùng giảm 11.000; chênh lệch vẫn 0. Một dòng sao kê +5.000.000 thì không có lựa chọn "Ghi nhận từ sao kê" cho nhóm thu theo hợp đồng.
- **AC-F4.11** Ghi một khoản thu 1.000.000 vào sổ ngày 29/11 mà sao kê không có: chênh lệch tại 30/11 là **+1.000.000 đ**, "lệch 1", và tháng **không** "đã khớp".
- **AC-F4.12** Xem tháng 12 khi chưa nhập sao kê tháng 12: các ô theo sao kê ghi "Chưa có sao kê", không ghi 0.
- **AC-F4.13** Số dư đầu của sổ là 50.000.000, nhưng sao kê chứa ngày bắt đầu sổ có đầu kỳ 49.000.000: màn đối soát có cảnh báo về số dư đầu.

**Quyền và chung**
- **AC-F4.14** Xóa một lần nhập khi chưa có dòng nào được ghép: được, kèm lý do. Khi đã có một dòng được ghép: bị từ chối.
- **AC-F4.15** BQT xem được màn đối soát nhưng không có nút ghi nào. BQL và KT nhận 403. Kế toán tòa B mở tài khoản tòa A: 404.
- **AC-F4.16** Seed demo cho ra đúng AC-F4.6 trên DB mới; chạy lại không tạo trùng.
- **AC-F4.17** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Test của F-S1 đến F-S3 vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test:
  - đọc tệp mẫu: CSV và XLSX, dòng lỗi theo số dòng và cột, phần thập phân, số tài khoản sai;
  - khóa chống trùng, trùng trong cùng tệp;
  - sao kê khép;
  - đề xuất ghép: một ứng viên, nhiều ứng viên, ngày lệch;
  - số dư theo sao kê, chênh lệch, đếm lệch và trùng, dòng tự khử.
- [ ] e2e API:
  - nhập, nhập lại, nhập chồng kỳ;
  - xác nhận đề xuất; ghép tay có và không có lý do; bỏ ghép;
  - chặn hủy chứng từ đã đối soát;
  - ghi nhận phí và lãi;
  - xóa lần nhập;
  - quyền;
  - ví dụ D1 ra đúng 4/4, chênh lệch 0 (AC-F4.6).
- [ ] Tiền là số nguyên trên mọi đường. Tệp có số thực thì bị chặn, không bao giờ làm tròn ngầm.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của F-S3.
- [ ] Test component: kết quả nhập (lỗi theo dòng), bảng ghép hai cột, ô số và tình trạng tháng.
- [ ] Ảnh chụp ở chế độ `api`: màn đối soát tháng 11 (4/4, chênh lệch 0), một tháng có dòng lệch, hộp thoại nhập có lỗi, màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-F4-1 | Sao kê phải khép số dư, và có một dòng lỗi thì không nhập dòng nào | Sao kê ngân hàng luôn khép; không khép nghĩa là thiếu dòng. Nhập dở dang khó sửa hơn nhập lại |
| D-F4-2 | Chỉ ghép một giao dịch với một chứng từ | Mỗi khoản thu hoặc chi ở F-S3 ứng với một lần chuyển tiền thật. Muốn khớp thì sửa chứng từ cho đúng ngân hàng |
| D-F4-3 | Ngày lệch ≤ 5 ngày thì ghép thường; lệch hơn cần lý do | Tiền có thể về tài khoản sau ngày ghi chứng từ vài ngày làm việc |
| D-F4-4 | Hệ thống chỉ **đề xuất**; kế toán xác nhận, kể cả xác nhận cả lô | Ghép sai thì làm sai cờ đối soát; người chịu trách nhiệm vẫn là kế toán |
| D-F4-5 | Chưa có "khóa tháng" | Chưa có yêu cầu từ D1. Làm cùng báo cáo F-S5 nếu khách cần |
| D-F4-6 | Chỉ nhận mẫu cột chuẩn, chưa đọc định dạng riêng của ngân hàng | OD-07 chưa có sao kê thật. Thêm bộ đọc từng ngân hàng khi khách gửi mẫu |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích nhóm F (PD-31), sau F-S3 (PD-34). |
| 27/10/2026 | Chủ dự án duyệt (PD-35), gồm D-F4-1 đến D-F4-6, và cho giao dev-build (bắt đầu sau khi F-S3 đạt review). |
| 28/10/2026 | Merge vào `main` (`3b08be1`, cùng F-S3 và F-S4); trạng thái `Đã triển khai`. |
