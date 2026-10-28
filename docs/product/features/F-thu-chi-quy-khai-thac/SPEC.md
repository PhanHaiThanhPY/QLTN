---
id: F.S3
title: Sổ quỹ khai thác, khoản thu, thuế và phiếu chi
status: Đã triển khai
owner: PM/BA
intent: "Mọi đồng tiền vào ra quỹ khai thác của một tòa đều có chứng từ và được ghi đúng một lần vào sổ quỹ, nên kế toán biết chính xác kỳ nào còn phải thu, thuế còn phải nộp bao nhiêu và số dư quỹ là bao nhiêu."
depends_on: [F.S2]
---

# SPEC: Sổ quỹ khai thác, khoản thu, thuế và phiếu chi (F-S3)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã triển khai` (28/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-34), gồm 7 mặc định D-F3-1 đến D-F3-7 ở §6. Bắt đầu build sau khi F-S2 đạt review

**Nguồn:**
- Phân tích [F-quy-khai-thac.md](../../modules/F-quy-khai-thac.md), đã duyệt (PD-31): §2 F06, F07; §1 "ví dụ xuyên suốt"; FG-02 (mô hình tiền), FG-03 (phiếu chi), FG-04 (mã giấy nộp thuế), FG-05 (chữ "thanh toán"), FG-07 (tiền cọc), FG-08 ("đã thu" tính từ lúc nào); mặc định FQ-06, FQ-07, FQ-08, FQ-10 (OD-26).
- D1 tr. 10 (F06 "Theo dõi từng kỳ thu và số tiền còn phải thu"), tr. 11 (F07 "Lưu đủ hồ sơ và chứng từ từng lần nộp thuế"), tr. 12–13 (số liệu sổ quỹ dùng làm kiểm chéo).
- DF-10 (Kế toán làm F06–F09), DF-20 (mỗi tòa một quỹ, một tài khoản), DF-26 (sao kê gắn theo tài khoản), DF-28 (tiền khai thác vào quỹ khai thác; chuyển quỹ là một khoản chi có duyệt). Review 23/10 H05, L01.
- Nhóm T ([T-tien-gui-quy-bao-tri.md](../../modules/T-tien-gui-quy-bao-tri.md)) sẽ dùng **cùng** mô hình quỹ, tài khoản và sổ quỹ. Slice này dựng nền đó.

**Nền:** [F-S2](../F-hop-dong-khai-thac/SPEC.md): hợp đồng "Hiệu lực", kỳ phải thu, tiền cọc là điều khoản. Slice này chỉ bắt đầu build **sau khi F-S2 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau F-S2, hợp đồng đã có lịch phải thu, nhưng chưa ghi được đồng tiền nào. Review 23/10 (H05) cảnh báo: thiếu một **mô hình tiền** rõ ràng thì màn hình có thể đúng mẫu, nhưng số dư vẫn sai hoặc bị cộng trùng.

Slice này chốt mô hình đó, rồi làm 3 loại chứng từ trên nền đó:
- **Khoản thu** theo hợp đồng (F06);
- **Thuế:** nghĩa vụ thuế và giấy nộp thuế (F07);
- **Phiếu chi** có duyệt (FG-03).

Mọi chứng từ đi vào một **sổ quỹ** duy nhất của quỹ khai thác mỗi tòa.

Đối chiếu với sao kê ngân hàng làm ở **F-S4**. Báo cáo thu chi (F09) và thanh lý (F10) làm ở **F-S5**.

**Người dùng:**
- Chính: kế toán ghi khoản thu, thuế, lập phiếu chi.
- Chính: BQT duyệt phiếu chi, xem sổ quỹ.
- Phụ: BQL xem hợp đồng đã thu bao nhiêu, còn nợ bao nhiêu, để nhắc đơn vị.

**User story:**
- Là kế toán, khi DV-A chuyển 10 triệu, tôi muốn ghi một khoản thu kèm chứng từ, và thấy ngay kỳ 16–30/11 còn phải thu 5 triệu.
- Là kế toán, tôi muốn ghi số thuế tháng 11 theo hồ sơ kế toán và giấy nộp tiền, để biết còn phải nộp bao nhiêu.
- Là BQT, tôi muốn mọi khoản chi của quỹ phải qua tôi duyệt, và không có khoản chi nào làm quỹ âm.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Quỹ và tài khoản quỹ:** mỗi tòa có một quỹ khai thác, một tài khoản; số dư đầu tại ngày bắt đầu dùng hệ thống (BR-F3-01, BR-F3-02).
2. **Sổ quỹ:** dòng ghi sổ bất biến, sửa sai bằng dòng đảo; số dư theo sổ; số liệu theo tháng (BR-F3-03 đến BR-F3-05).
3. **Khoản thu (F06):** ghi theo hợp đồng, phân bổ vào kỳ, chứng từ, hủy bằng dòng đảo. Trạng thái kỳ thêm "Đã thu một phần", "Đã thu đủ" (BR-F3-06 đến BR-F3-08).
4. **Tiền cọc:** ghi nhận nhận cọc của hợp đồng, theo dõi riêng (BR-F3-09).
5. **Thuế (F07):** nghĩa vụ thuế theo tháng, giấy nộp thuế, điều chỉnh (BR-F3-10, BR-F3-11).
6. **Phiếu chi:** lập, duyệt (BQT), ghi đã chi kèm chứng từ, không chi vượt số dư (BR-F3-12, BR-F3-13).
7. **Màn hình** trong nhóm "Quỹ khai thác":
   - "Sổ quỹ";
   - tab "Khoản thu" trong trang hợp đồng;
   - "Thuế";
   - "Phiếu chi".
8. **Seed demo** theo đúng số của D1 (BR-F3-15).

**Ngoài phạm vi:**
- Nhập sao kê, ghép giao dịch, số dư theo sao kê, trạng thái "đã đối soát" (F-S4). Ở slice này, mọi dòng sổ đều là "Chưa đối soát".
- Báo cáo thu chi kiểu thác nước và xuất tệp (F09, F-S5). Hoàn cọc, ghi nhận không thu được, thanh lý (F10, F-S5).
- **Quỹ bảo trì** và tiền gửi (nhóm T). Mô hình được dựng sẵn để dùng chung, nhưng slice này chỉ tạo **quỹ khai thác**.
- Tiền mặt (BR-F3-06). Kết nối ngân hàng, chuyển tiền thật (D1 tr. 45).
- Tính thuế theo thuế suất (D1 tr. 11: "không tự áp thuế suất").
- Phạt chậm, giảm trừ (FQ-06). Thông báo nhắc thu (notifications làm sau).

## 3. Quy tắc nghiệp vụ

### 3.1 Mô hình tiền (chốt FG-02)

- **BR-F3-01. Quỹ:**
  - Mỗi tòa có **một** quỹ khai thác. Quỹ có loại (`KHAI_THAC`; nhóm T sẽ thêm `BAO_TRI`) và tòa.
  - **Không bao giờ có số dư cộng chung** giữa hai quỹ khác loại, hay giữa hai tòa (D1 tr. 2, DF-20). Mọi số liệu ở slice này luôn là của **một quỹ, một tòa**.
  - Quỹ được tạo sẵn cho mọi tòa khi chạy migration, và cho tòa mới khi tòa được tạo.
- **BR-F3-02. Tài khoản và số dư đầu:**
  - **Tài khoản của quỹ:** mỗi quỹ có **một** tài khoản (DF-26), gồm ngân hàng, số tài khoản, chủ tài khoản.
    - Số tài khoản chỉ hiện 4 số cuối ("****0001"), trừ với kế toán và BQT.
    - Kế toán nhập tài khoản; BQT xem được.
  - **Số dư đầu và ngày bắt đầu sổ:** kế toán nhập ngày hệ thống bắt đầu theo dõi quỹ, và số dư tài khoản **theo sao kê** tại đầu ngày đó.
    - Ví dụ D1: 01/11/2026, 50.000.000 đ.
    - Đây là một dòng sổ đặc biệt "Số dư đầu".
  - **Đổi số dư đầu:**
    - Khi sổ chưa có dòng nào khác: kế toán sửa được, kèm lý do.
    - Khi sổ đã có dòng: cần BQT duyệt (D-F3-5).
  - Chưa có số dư đầu thì **không ghi được** chứng từ nào vào quỹ.
- **BR-F3-03. Sổ quỹ:** mỗi đồng tiền vào hoặc ra tài khoản quỹ là **đúng một dòng sổ**.
  - **Mỗi dòng gồm:**
    - ngày;
    - chiều (Thu hoặc Chi);
    - số tiền (số nguyên VND, > 0);
    - nhóm (bảng dưới);
    - chứng từ nguồn (PT, GNT, PC, cọc);
    - người ghi, thời điểm ghi;
    - trạng thái đối soát. Ở slice này luôn là "Chưa đối soát"; F-S4 sẽ thêm "Đã đối soát".
  - **Nhóm của dòng:**

    | Nhóm | Chiều | Nguồn | Tính vào "thu khai thác"? |
    |---|---|---|---|
    | Thu theo hợp đồng khai thác | Thu | Khoản thu PT (BR-F3-06) | **Có** |
    | Nhận tiền cọc | Thu | Nhận cọc (BR-F3-09) | **Không**: tiền giữ hộ |
    | Chi thuế | Chi | Giấy nộp thuế GNT (BR-F3-11) | — |
    | Chi dịch vụ / Chuyển quỹ / Chi khác | Chi | Phiếu chi PC (BR-F3-12) | — |
    | Đảo dòng | ngược chiều dòng gốc | Hủy một chứng từ (BR-F3-04) | theo dòng gốc |

  - Dùng chữ "**Thu theo hợp đồng khai thác**", **không** dùng chữ "thanh toán", để không lẫn với "Chi thanh toán sửa chữa" của B09 (FG-05, L01). Tên màn F06 là "Khoản thu".
- **BR-F3-04. Bất biến và sửa sai:**
  - Dòng sổ **không sửa và không xóa được**.
  - Ghi nhầm thì **hủy chứng từ** (lý do ≥ 10 ký tự). Hệ thống thêm **một dòng đảo** cùng số tiền, ngược chiều, ngày đảo là hôm nay, và liên kết với dòng gốc. Cả hai dòng vẫn hiện trong sổ, kèm nhãn "Đã hủy" và "Đảo của …".
  - F-S4 sẽ chặn việc hủy chứng từ đã đối soát.
- **BR-F3-05. Số dư:**
  - **Số dư theo sổ** tại cuối một ngày D = số dư đầu + Σ Thu − Σ Chi của mọi dòng có ngày ≤ D, kể cả dòng đảo. Máy chủ tính; web không tự cộng.
  - **Số liệu của một tháng:**
    - Đầu kỳ = số dư theo sổ cuối ngày trước ngày 1.
    - Thu = Σ dòng Thu trong tháng; Chi = Σ dòng Chi trong tháng.
    - Cuối kỳ = đầu kỳ + thu − chi.
  - **Kiểm theo ví dụ D1:** đầu tháng 11 là 50; thu 15 (10 + 5); chi 5 (2 + 3); cuối kỳ **60**.
  - Mọi số liệu số dư ghi rõ "**theo sổ**". F-S4 thêm "theo sao kê" và phần chênh lệch.
  - **Còn phải thu** (công nợ) **không bao giờ** được cộng vào số dư (D1 tr. 3, 13).
  - **Tiền cọc đang giữ** nằm **trong** số dư theo sổ, vì đó là tiền thật trong tài khoản, nhưng luôn được hiện tách riêng: "trong đó tiền cọc đang giữ: …".

### 3.2 Khoản thu (F06)

- **BR-F3-06. Ghi khoản thu** (kế toán, hợp đồng "Hiệu lực"). Mã `PT-NNN`.
  - **Trường:** hợp đồng; ngày nhận tiền (≥ ngày bắt đầu sổ, ≤ hôm nay); số tiền (> 0); chứng từ (tệp, bắt buộc: ủy nhiệm chi hoặc giấy báo có); ghi chú.
  - **Chỉ nhận chuyển khoản vào tài khoản quỹ.** Đơn vị nộp tiền mặt thì BQL nộp tiền vào tài khoản trước, rồi kế toán ghi theo ngày tiền vào tài khoản (D-F3-1).
  - **Phân bổ vào kỳ:**
    - Mặc định vào các kỳ **còn phải thu, kỳ có hạn sớm nhất trước**. Kế toán sửa được phần phân bổ.
    - Tổng phân bổ = số tiền.
    - Mỗi kỳ không nhận quá phần còn phải thu của kỳ đó.
  - **Không thu vượt:** số tiền không được lớn hơn tổng còn phải thu của hợp đồng. Thu vượt thì báo lỗi (D-F3-2). Tiền cọc ghi riêng (BR-F3-09).
  - Mỗi khoản thu sinh đúng **một dòng sổ** "Thu theo hợp đồng khai thác".
- **BR-F3-07. Trạng thái kỳ phải thu** (thay cho BR-F2-11 của F-S2):

  | Còn phải thu của kỳ | Hôm nay so với hạn | Trạng thái |
  |---|---|---|
  | = 0 | bất kỳ | **Đã thu đủ** |
  | > 0, đã thu một phần | < hạn | **Đã thu một phần** |
  | > 0, chưa thu gì | < hạn | **Chưa đến hạn** |
  | > 0 | = hạn | **Đến hạn** |
  | > 0 | > hạn | **Quá hạn**, kèm số quá hạn = còn phải thu |

  - Mỗi kỳ hiện: phải thu, đã thu, còn phải thu, và các khoản thu đã phân bổ vào kỳ.
  - **Ví dụ D1 tr. 10:** kỳ 16–30/11, phải thu 20, đã thu 15 (PT-001 10, PT-002 5), còn 5.
    - Tại 23/11: "Đã thu một phần", quá hạn 0.
    - Tại 26/11: "Quá hạn", quá hạn 5.
  - Phụ lục (BR-F2-12 của F-S2) **không sinh lại** những kỳ đã có khoản thu phân bổ.
- **BR-F3-08. Số liệu của hợp đồng** (D1 tr. 10): phải thu, đã thu, còn thu, quá hạn; "% đã thu của kỳ hiện tại"; "Khoản thu tiếp theo" là kỳ còn phải thu có hạn sớm nhất, gồm số tiền, hạn và trạng thái. Có dòng kiểm "phải thu = đã thu + còn thu".

### 3.3 Tiền cọc

- **BR-F3-09. Nhận cọc** (kế toán, khi hợp đồng có điều khoản tiền cọc > 0; trạng thái "Đã ký" hoặc "Hiệu lực"):
  - Ghi ngày nhận, số tiền, chứng từ.
  - Tổng cọc đã nhận không vượt số tiền cọc trong hợp đồng.
  - Sinh một dòng sổ "Nhận tiền cọc". Dòng này **không** tính vào "thu khai thác" (FQ-06).
  - Hợp đồng hiện "Cọc: đã nhận X / Y".
  - **Hoàn cọc** hoặc cấn trừ cọc vào công nợ làm ở F-S5.

### 3.4 Thuế (F07)

- **BR-F3-10. Nghĩa vụ thuế** (kế toán). Mã `TH-NNN`, mỗi quỹ mỗi tháng một nghĩa vụ (FQ-07).
  - **Trường:** tháng; số thuế **theo hồ sơ kế toán** (số nguyên VND ≥ 0); tệp hồ sơ kế toán (không bắt buộc); ghi chú.
  - **Hệ thống không tính thuế và không áp thuế suất** (D1 tr. 11). Hiện dòng gợi ý: "Thu theo hợp đồng trong tháng: …", chỉ để kế toán tham khảo.
  - **Điều chỉnh số thuế:** cần lý do; lưu lịch sử. Không được thấp hơn số đã nộp.
- **BR-F3-11. Giấy nộp thuế** (kế toán). Mã **`GNT-NNN`**, không dùng NT, vì NT là biên bản nghiệm thu (FG-04).
  - **Trường:** nghĩa vụ thuế; ngày nộp; số tiền (> 0); tệp giấy nộp tiền (bắt buộc).
  - **Không nộp vượt:** tổng đã nộp không vượt số thuế của nghĩa vụ. Nộp vượt thì phải điều chỉnh nghĩa vụ trước (D-F3-3).
  - **Không vượt số dư:** sinh một dòng sổ "Chi thuế". Không được làm số dư theo sổ tại ngày nộp **âm** (BR-F3-13).
  - **Nghĩa vụ hiện** (D1 tr. 11): theo hồ sơ, đã nộp, còn phải nộp, và cờ "Đã nộp đủ" khi còn phải nộp = 0. Cờ "Đã đối chiếu k/n" để F-S4 làm.

### 3.5 Phiếu chi (FG-03)

- **BR-F3-12. Phiếu chi** (`PC-NNN`):
  - **Trường:**
    - nhóm chi: Chi dịch vụ, Chuyển sang quỹ khác (DF-28), Chi khác. Chọn "Chuyển sang quỹ khác" thì phải chọn quỹ nhận;
    - nội dung (≥ 10 ký tự);
    - người nhận tiền (tên, số tài khoản nếu có);
    - số tiền (> 0);
    - tệp đề nghị chi (bắt buộc).
  - **Trạng thái:**

    | Từ | Thao tác | Ai | Đến |
    |---|---|---|---|
    | — | Lập | kế toán | **Nháp** |
    | Nháp, Cần sửa | Gửi duyệt | kế toán | **Chờ duyệt** |
    | Chờ duyệt | Duyệt | BQT | **Đã duyệt** |
    | Chờ duyệt | Yêu cầu sửa (lý do) | BQT | **Cần sửa** |
    | Chờ duyệt | Từ chối (lý do) | BQT | **Bị từ chối** |
    | Đã duyệt | Ghi đã chi: ngày chi (≥ ngày duyệt, ≤ hôm nay) và chứng từ chuyển khoản | kế toán | **Đã chi** |
    | Nháp, Cần sửa, Đã duyệt | Hủy (lý do) | kế toán | **Đã hủy** |

  - Chỉ phiếu "**Đã chi**" mới sinh dòng sổ, với nhóm theo nhóm chi.
  - Hủy một phiếu "Đã chi" (ghi nhầm) dùng BR-F3-04 (dòng đảo), và cần BQT duyệt.
  - **"Chuyển sang quỹ khác":** dòng Chi ở quỹ này. Vì quỹ nhận là quỹ bảo trì (nhóm T, chưa có), slice này chỉ ghi phía chi kèm tên quỹ nhận. Phía nhận làm khi có nhóm T (D-F3-4).
- **BR-F3-13. Không làm quỹ âm:**
  - Ghi "Đã chi" phiếu chi, hoặc ghi giấy nộp thuế, mà làm **số dư theo sổ tại ngày chi** hoặc **tại bất kỳ ngày nào sau đó** nhỏ hơn 0 thì **bị chặn**. Câu báo: "Số dư quỹ không đủ: còn «X» đ tại «ngày»."
  - Cũng chặn việc hủy một khoản thu nếu dòng đảo làm số dư âm ở một ngày nào đó.

### 3.6 Chung

- **BR-F3-14. Quyền:**
  - **Kế toán** (`FUND_OPERATE`, phạm vi tòa):
    - nhập tài khoản và số dư đầu;
    - ghi khoản thu, nhận cọc, nghĩa vụ thuế, giấy nộp thuế;
    - lập, gửi duyệt và ghi đã chi phiếu chi;
    - hủy chứng từ.
  - **BQT** (phạm vi tòa): duyệt, yêu cầu sửa, từ chối phiếu chi; duyệt hủy phiếu đã chi và đổi số dư đầu; xem toàn bộ sổ quỹ, thuế, phiếu chi.
  - **BQL:** chỉ xem số liệu thu theo hợp đồng của mình (phải thu, đã thu, còn thu, quá hạn), để nhắc đơn vị. **Không** xem sổ quỹ, thuế, phiếu chi (D-F3-6).
  - **KT, TVKT:** không thấy gì của quỹ.
  - Cần quyền mới cho việc duyệt phiếu chi và việc xem sổ quỹ. Dev-build đặt tên, rồi cập nhật ma trận quyền và tài liệu RM.
  - Ngoài phạm vi tòa: 404.
  - Mọi thao tác ghi có nhật ký kèm lý do (nếu có) và khóa phiên bản. Mỗi dòng sổ lưu người ghi.
- **BR-F3-15. Seed demo:** theo đúng ví dụ D1 cho quỹ khai thác của tòa demo, nối tiếp HĐ-001 của F-S2:
  - số dư đầu 01/11: 50.000.000;
  - PT-001: 10.000.000 ngày 18/11; PT-002: 5.000.000 ngày 22/11;
  - TH-001 tháng 11: 2.000.000, kèm GNT-001 2.000.000 ngày 22/11;
  - PC-001 "Chi dịch vụ" 3.000.000, "Đã chi" ngày 23/11.

  Tháng 11 phải ra **50 + 15 − 5 = 60**, và HĐ-001 còn phải thu **5.000.000**. Ngày trong seed được dời theo ngày chạy seed, nhưng giữ đúng thứ tự và số tiền. Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu dùng quỹ khai thác Aqua 1 (tòa demo), HĐ-001 "Hiệu lực", kỳ 16–30/11, hạn 25/11, phải thu 20.000.000.

**Mô hình tiền**
- **AC-F3.1** Chưa có số dư đầu: ghi khoản thu bị từ chối, kèm câu "Nhập số dư đầu của quỹ trước." Nhập số dư đầu 50.000.000 ngày 01/11: sổ có dòng "Số dư đầu", và số dư theo sổ là 50.000.000.
- **AC-F3.2** (ví dụ D1) Ghi đủ các chứng từ của BR-F3-15 rồi xem tháng 11: **đầu kỳ 50.000.000, thu 15.000.000, chi 5.000.000, cuối kỳ 60.000.000**. Có 5 dòng sổ: số dư đầu, PT-001, PT-002, GNT-001, PC-001. Số còn phải thu 5.000.000 **không** được cộng vào 60.000.000.
- **AC-F3.3** Hủy PT-002 kèm lý do:
  - sổ có thêm dòng đảo −5.000.000 ngày hôm nay;
  - PT-002 có nhãn "Đã hủy";
  - kỳ 16–30/11 còn phải thu 10.000.000;
  - cuối kỳ tháng của ngày hủy giảm 5.000.000.

  Không có nút xóa hay sửa dòng sổ, và gọi API để làm việc đó thì bị từ chối.
- **AC-F3.4** Quỹ khai thác Aqua 1 và Aqua 2 có số liệu riêng. Không màn hình hay API nào trả về một số dư cộng hai tòa.

**Khoản thu**
- **AC-F3.5** Ghi PT-001 10.000.000 ngày 18/11: phân bổ mặc định vào kỳ 16–30/11. Kỳ thành "Đã thu một phần", đã thu 10.000.000, còn 10.000.000.
- **AC-F3.6** Tại 23/11, sau PT-002: kỳ có phải thu 20, đã thu 15, còn 5, "Đã thu một phần", quá hạn 0. Tại 26/11: "Quá hạn", quá hạn 5.000.000. Thẻ "Khoản thu tiếp theo" ghi 5.000.000, hạn 25/11.
- **AC-F3.7** Ghi một khoản 6.000.000 khi hợp đồng chỉ còn phải thu 5.000.000: bị từ chối ở trường số tiền. Ghi khoản thu thiếu chứng từ: bị từ chối.
- **AC-F3.8** Hợp đồng 3 kỳ, mỗi kỳ 20.000.000, chưa thu gì. Ghi một khoản 30.000.000: kỳ 1 đủ 20, kỳ 2 nhận 10. Kế toán sửa phân bổ thành 15 + 15: được. Phân bổ 25 vào kỳ 1: bị từ chối.
- **AC-F3.9** Phụ lục của HĐ-001 không đổi kỳ đã có khoản thu phân bổ.

**Tiền cọc**
- **AC-F3.10** Hợp đồng có cọc 40.000.000. Nhận cọc 40.000.000: sổ có dòng "Nhận tiền cọc", và số dư tăng 40.000.000, kèm dòng "trong đó tiền cọc đang giữ: 40.000.000". Thu khai thác của tháng không đổi. Nhận thêm 1 đồng: bị từ chối.

**Thuế**
- **AC-F3.11** TH-001 tháng 11, số theo hồ sơ 2.000.000; GNT-001 2.000.000 ngày 22/11: còn phải nộp 0, cờ "Đã nộp đủ"; sổ có dòng "Chi thuế" 2.000.000. Ghi thêm một giấy nộp 1 đồng: bị từ chối. Điều chỉnh TH-001 xuống 1.500.000: bị từ chối, vì thấp hơn số đã nộp.
- **AC-F3.12** Mã giấy nộp thuế có dạng `GNT-…`; tìm "NT-001" không ra giấy nộp thuế.

**Phiếu chi và không âm quỹ**
- **AC-F3.13** Kế toán lập PC-001 "Chi dịch vụ" 3.000.000, gửi duyệt. Kế toán thử tự duyệt: 403. BQT duyệt; kế toán ghi đã chi ngày 23/11 kèm chứng từ: sổ có dòng Chi 3.000.000. Phiếu chưa "Đã chi" thì không có dòng sổ.
- **AC-F3.14** Quỹ có số dư theo sổ 2.000.000. Ghi đã chi một phiếu 3.000.000: bị chặn, kèm câu của BR-F3-13. Ghi chi lùi ngày, làm số dư một ngày trong quá khứ âm dù hôm nay vẫn dương: cũng bị chặn.
- **AC-F3.15** Phiếu "Chuyển sang quỹ khác" bắt buộc chọn quỹ nhận, và sinh dòng Chi ở quỹ khai thác.

**Quyền và chung**
- **AC-F3.16**
  - BQL xem được tab "Khoản thu" của hợp đồng (phải thu, đã thu, còn thu), nhưng không mở được "Sổ quỹ", "Thuế", "Phiếu chi". Gọi API thì nhận 403.
  - KT không thấy gì của quỹ.
  - Kế toán tòa B mở sổ quỹ tòa A: 404.
- **AC-F3.17** Seed demo trên DB mới cho đúng số của AC-F3.2; chạy lại không tạo trùng.
- **AC-F3.18** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Test của F-S1 và F-S2 vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test cho số dư và số liệu tháng:
  - đầu kỳ, thu, chi, cuối kỳ; dòng đảo;
  - chặn âm ở mọi ngày sau (BR-F3-13);
  - phân bổ khoản thu vào kỳ: mặc định, sửa tay, không vượt;
  - trạng thái kỳ (BR-F3-07).
- [ ] e2e API:
  - số dư đầu (chưa có thì chặn; đổi khi đã có dòng thì cần BQT);
  - khoản thu: phân bổ, vượt, hủy, dòng đảo;
  - cọc; thuế: nghĩa vụ, giấy nộp, vượt, điều chỉnh;
  - phiếu chi: đủ trạng thái, tự duyệt 403, không âm, chuyển quỹ;
  - quyền: BQL, KT, phạm vi tòa;
  - ví dụ D1 ra đúng 60 (AC-F3.2).
- [ ] Tiền là số nguyên trên mọi đường (DB bigint, API, web). Không có phép tính số thực nào trên tiền.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của F-S2.
- [ ] Test component: form khoản thu (phân bổ), thẻ hợp đồng (phải thu = đã thu + còn thu), sổ quỹ (tháng, dòng đảo), phiếu chi (nút theo trạng thái và vai trò).
- [ ] Ảnh chụp ở chế độ `api`: sổ quỹ tháng 11 (ra 60), tab Khoản thu của HĐ-001, Thuế, phiếu chi chờ duyệt (góc nhìn BQT), màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-F3-1 | Chỉ nhận chuyển khoản vào tài khoản quỹ; tiền mặt phải nộp vào tài khoản trước | Mỗi đồng tiền đều có trên sao kê, nên đối soát được ở F-S4. **Cần khách xác nhận** (thêm vào OD-26) |
| D-F3-2 | Không cho thu vượt tổng còn phải thu của hợp đồng | Tránh số dư có tiền không rõ nghĩa vụ. Thu trước kỳ vẫn được, nhờ phân bổ vào kỳ sau |
| D-F3-3 | Không cho nộp thuế vượt nghĩa vụ; muốn nộp thêm thì điều chỉnh nghĩa vụ trước | Số trên hệ thống luôn khớp hồ sơ kế toán |
| D-F3-4 | "Chuyển sang quỹ khác" chỉ ghi phía chi cho đến khi có nhóm T | Quỹ bảo trì chưa có trên hệ thống |
| D-F3-5 | Đổi số dư đầu khi sổ đã có dòng cần BQT duyệt | Số dư đầu ảnh hưởng mọi số liệu về sau |
| D-F3-6 | BQL chỉ xem phần thu theo hợp đồng, không xem sổ quỹ | D1 giao sổ quỹ cho kế toán và BQT (tr. 10–13). BQL cần biết công nợ để nhắc đơn vị |
| D-F3-7 | Chi không được làm số dư theo sổ âm ở bất kỳ ngày nào | Không thể chi tiền mà tài khoản không có; chặn cả khi ghi lùi ngày |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích nhóm F (PD-31), sau F-S2 (PD-33). |
| 27/10/2026 | Chủ dự án duyệt (PD-34), gồm D-F3-1 đến D-F3-7, và cho giao dev-build (bắt đầu sau khi F-S2 đạt review). |
| 27/10/2026 | Review lần 1 FAILED (F3-1: số tài khoản luôn bị che, trái BR-F3-02). Làm rõ brief: thẻ "Khoản thu tiếp theo" dùng `--accent-strong` / `--accent-fg` thay cho `--navy`. |
| 28/10/2026 | Merge vào `main` (`3b08be1`, cùng F-S3 và F-S4); trạng thái `Đã triển khai`. |
