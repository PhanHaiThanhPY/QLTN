---
id: F.S2
title: Chọn đơn vị, hội nghị thông qua và hợp đồng khai thác
status: Đã duyệt
owner: PM/BA
intent: "Từ một gói đã đóng nhận, BQT duyệt đơn vị được chọn theo căn cứ rõ ràng, hội nghị thông qua, và hợp đồng chỉ có hiệu lực khi đủ quyết nghị, kèm lịch phải thu từng kỳ để kế toán theo dõi."
depends_on: [F.S1]
---

# SPEC: Chọn đơn vị, hội nghị thông qua và hợp đồng khai thác (F-S2)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-33), gồm 6 mặc định D-F2-1 đến D-F2-6 ở §6. Bắt đầu build sau khi F-S1 đạt review

**Nguồn:**
- Phân tích [F-quy-khai-thac.md](../../modules/F-quy-khai-thac.md), đã duyệt (PD-31): §2 F03, F04, F05; FG-06, FG-12; mặc định FQ-03, FQ-04, FQ-05, FQ-11, FQ-12 (OD-26).
- D1 tr. 7 (F03 "Lưu rõ căn cứ và kết quả lựa chọn"), tr. 8 (F04 "Theo dõi trọn vòng đời hợp đồng khai thác"), tr. 9 (F05 "Gắn quyết nghị hội nghị vào đúng hồ sơ").
- DF-25 (đổi kết quả chỉ khi chưa có hợp đồng; phụ lục tạo phiên bản mới; hồ sơ trễ chỉ được xét khi người duyệt cho phép), DF-27 (hợp đồng không "Hiệu lực" khi chưa có quyết nghị thông qua). OD-04.

**Nền:** [F-S1](../F-moi-thau-khai-thac/SPEC.md): đơn vị khai thác, gói và hồ sơ dự thầu, quyền `EXPLOITATION_VIEW` và `EXPLOITATION_MANAGE`, bộ lịch chạy dùng chung. Slice này chỉ bắt đầu build **sau khi F-S1 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau F-S1, một gói khai thác dừng ở "Đã đóng nhận". Slice này đưa gói đi tiếp tới hợp đồng có hiệu lực:
- **F03:** BQL đề xuất đơn vị được chọn, kèm biên bản đánh giá. BQT duyệt. Chỉ đơn vị đủ hồ sơ mới được chọn (D1 tr. 7).
- **F05:** BQL lập hồ sơ trình hội nghị và ghi kết quả, kèm tờ trình, biên bản và quyết nghị.
- **F04:** BQL soạn và ghi nhận ký hợp đồng. Hợp đồng chỉ chuyển "Hiệu lực" khi có quyết nghị **thông qua** (DF-27). Khi đó hệ thống sinh **lịch phải thu** từng kỳ.

Ghi nhận tiền thu, thuế, chi và sao kê làm ở **F-S3** và **F-S4**. Lịch phải thu ở slice này mới chỉ là **nghĩa vụ**, chưa có số đã thu.

**Người dùng:**
- Chính: BQL lập đề xuất, hồ sơ hội nghị, hợp đồng.
- Chính: BQT duyệt kết quả chọn.
- Phụ: kế toán xem hợp đồng và lịch phải thu để chuẩn bị thu (F-S3).

**User story:**
- Là BQT, tôi muốn duyệt đơn vị được chọn kèm biên bản đánh giá, và biết chắc hệ thống không cho chọn đơn vị thiếu hồ sơ, kể cả khi đơn vị đó chào giá cao hơn.
- Là BQL, tôi muốn hợp đồng chỉ có hiệu lực khi đã có quyết nghị hội nghị, để không ký sai quy trình.
- Là kế toán, tôi muốn thấy lịch phải thu từng kỳ của hợp đồng, gồm hạn và số tiền, để biết khi nào thu khoản nào.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Kết quả chọn (F03):** lập đề xuất, gửi duyệt, duyệt, từ chối hoặc yêu cầu sửa, đổi kết quả, "không chọn được đơn vị" (BR-F2-01 đến BR-F2-04).
2. **Hội nghị (F05):** lập hồ sơ trình, ghi kết quả "Thông qua" hoặc "Không thông qua", trình lại (BR-F2-05, BR-F2-06).
3. **Hợp đồng (F04):** soạn, ghi nhận ký, đưa vào hiệu lực, phụ lục sửa đổi có phiên bản, hủy hợp đồng chưa hiệu lực (BR-F2-07 đến BR-F2-10).
4. **Lịch phải thu:** sinh từ hợp đồng khi hiệu lực, sinh lại khi có phụ lục; trạng thái kỳ theo hạn (BR-F2-11, BR-F2-12).
5. **Màn hình:**
   - trong trang gói: tab "Kết quả chọn" và tab "Hội nghị";
   - menu mới **"Hợp đồng khai thác"**: danh sách và trang hợp đồng, gồm "Mốc hồ sơ liên kết" và tab "Lịch phải thu".
6. **Seed demo** nối tiếp MT-001 (BR-F2-14).

**Ngoài phạm vi:**
- Ghi nhận khoản thu, trạng thái "đã thu / còn thu", tiền cọc thực nhận, thuế, phiếu chi, sao kê (F-S3, F-S4).
- Chấm dứt và thanh lý hợp đồng (F-S5). Slice này chỉ có "Hủy" cho hợp đồng **chưa** hiệu lực.
- Giá trị theo % doanh thu (FQ-05). Chỉ có giá trị cố định mỗi kỳ.
- Phạt chậm, giảm trừ (FQ-06).
- Sinh văn bản hợp đồng hoặc biên bản từ mẫu (FQ-12). BQL tải tệp đã soạn sẵn.
- Gửi thông báo (notifications làm sau).
- Chế độ `mock`: không có màn F.

## 3. Quy tắc nghiệp vụ

### 3.1 Kết quả chọn (F03)

- **BR-F2-01. Lập đề xuất** (BQL, gói ở "Đã đóng nhận"). Mỗi gói có nhiều nhất **một** kết quả đang hiệu lực. Mã `KQ-NNN`.
  - **Đơn vị được chọn:** đúng một đơn vị có hồ sơ trong gói, ở tình trạng **Đủ hồ sơ**, và có giá chào.
    - Hồ sơ **trễ hạn** chỉ chọn được khi đề xuất có lý do riêng cho việc xét hồ sơ trễ, và người duyệt sẽ thấy lý do đó (DF-25).
    - Hồ sơ "Đang bổ sung", "Thiếu", "Quá hạn bổ sung" **không** chọn được (D1 tr. 7: "Giá chào cao hơn không thay thế điều kiện hồ sơ").
  - **Biên bản đánh giá:** một tệp, bắt buộc.
  - **Căn cứ:** ≥ 20 ký tự. Ví dụ: "Hồ sơ đủ điều kiện theo biên bản đánh giá BB-001."
  - **Bảng so sánh:** tự hiện mọi đơn vị có hồ sơ, gồm giá chào, tình trạng hồ sơ và cờ. Không sửa được; đây là bản chụp lúc gửi duyệt.
- **BR-F2-02. Duyệt** (một người **BQT** có phạm vi tòa của gói, theo FQ-04). Có 3 lựa chọn:
  - **Duyệt:** kết quả "Đã duyệt"; gói chuyển "**Đã chọn đơn vị**".
  - **Yêu cầu sửa** (lý do ≥ 10 ký tự): kết quả về "Cần sửa"; BQL sửa rồi gửi lại.
  - **Từ chối** (lý do): kết quả "Bị từ chối"; BQL lập đề xuất mới.

  Mỗi quyết định ghi người, thời điểm và lý do. Người lập đề xuất không được tự duyệt (BQL không có quyền duyệt).
- **BR-F2-03. Không chọn được đơn vị:**
  - Áp dụng khi không có đơn vị nào đủ hồ sơ, hoặc BQT quyết không chọn.
  - BQL đề xuất "**Không chọn được đơn vị**", kèm biên bản và căn cứ. BQT duyệt như BR-F2-02.
  - Duyệt xong thì gói chuyển "**Không có kết quả**". Đây là trạng thái kết thúc; muốn mời lại thì tạo gói mới (D-F1-2).
- **BR-F2-04. Đổi kết quả đã duyệt:**
  - Chỉ được khi **chưa** có hợp đồng nào của gói được ký (DF-25).
  - BQL đề xuất đổi, kèm lý do (≥ 20 ký tự) và đề xuất mới. BQT duyệt.
  - Kết quả cũ chuyển "Đã thay thế", vẫn xem được. Hợp đồng nháp của kết quả cũ, nếu có, tự chuyển "Đã hủy" với lý do "Kết quả chọn đã được thay thế".

### 3.2 Hội nghị (F05)

- **BR-F2-05. Hồ sơ trình hội nghị** (BQL, khi gói đã "Đã chọn đơn vị"). Mã `HN-NNN`.
  - **Liên kết:** gói (bắt buộc) và hợp đồng (nếu đã soạn). D1 tr. 9 ghi "Liên kết MT-001 và HĐ-001".
  - **Ngày hội nghị:** bắt buộc.
  - **Nội dung trình:** ≥ 10 ký tự.
  - **Tài liệu:** tờ trình khai thác (tệp, bắt buộc khi lập).
- **BR-F2-06. Ghi kết quả hội nghị:**
  - Chỉ ghi được khi ngày hội nghị ≤ hôm nay.
  - **Thông qua:** cần biên bản hội nghị và quyết nghị (2 tệp), kèm số quyết nghị (chữ tự do, ví dụ "NQ-001").
  - **Không thông qua:** cần biên bản hội nghị và ghi chú.
    - Hợp đồng của gói **không** đưa vào hiệu lực được.
    - BQL lập hồ sơ trình lại (`HN` mới), hoặc hủy gói (lý do). Kết quả chọn giữ nguyên (FQ-11).
  - Kết quả đã ghi **không sửa được**. Ghi sai thì lập hồ sơ trình mới, kèm lý do; hồ sơ cũ chuyển "Đã thay thế".
  - Một gói có thể có nhiều hồ sơ hội nghị. Chỉ hồ sơ **mới nhất có kết quả** mới được tính.

### 3.3 Hợp đồng (F04)

- **BR-F2-07. Soạn hợp đồng** (BQL, từ kết quả chọn đã duyệt). Mã `HĐ-NNN`. Mỗi gói có nhiều nhất một hợp đồng chưa bị hủy.

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Đơn vị, khu vực, tòa | hệ thống | lấy từ kết quả chọn và gói; không sửa |
  | Ngày bắt đầu khai thác | có | |
  | Ngày kết thúc khai thác | có | sau ngày bắt đầu |
  | Giá trị mỗi kỳ | có | số nguyên VND, > 0. Mặc định là giá chào của đơn vị được chọn; được sửa, nhưng khác giá chào thì cần ghi chú |
  | Chu kỳ thu | có | **Tháng** hoặc **Quý** (FQ-05) |
  | Số ngày hạn thu | có | số ngày từ ngày đầu kỳ đến hạn thu, 0–60. Mặc định **9**, khớp D1: kỳ 16/11, hạn 25/11 |
  | Tiền cọc | không | số nguyên VND ≥ 0. Chỉ là điều khoản ở slice này; thu cọc ở F-S3 |
  | Điều khoản khác | không | tối đa 2.000 ký tự |

- **BR-F2-08. Ghi nhận ký:**
  - Cần tệp **bản ký** và **ngày ký** (≤ hôm nay). Thêm được tài liệu "Phụ lục kèm theo" lúc ký, ví dụ PL-001 "Phụ lục thanh toán" ở D1 tr. 8; tài liệu này không tạo phiên bản mới.
  - Hợp đồng chuyển "**Đã ký**". Ký được trước hoặc sau ngày hội nghị.
- **BR-F2-09. Đưa vào hiệu lực:**
  - BQL bấm "Đưa vào hiệu lực". Hệ thống kiểm đủ ba điều kiện:
    1. hợp đồng đã ký;
    2. hồ sơ hội nghị tính được của gói (BR-F2-06) có kết quả **Thông qua**;
    3. kết quả chọn của gói vẫn "Đã duyệt".
  - Thiếu điều kiện nào thì báo đúng điều kiện đó, ví dụ: "Chưa có quyết nghị hội nghị thông qua (DF-27)."
  - Đủ thì hợp đồng "**Hiệu lực**", và hệ thống sinh lịch phải thu (BR-F2-11).
- **BR-F2-10. Trạng thái hợp đồng:**

  | Từ | Thao tác | Đến |
  |---|---|---|
  | — | Soạn | **Nháp** |
  | Nháp | Ghi nhận ký | **Đã ký** |
  | Đã ký | Đưa vào hiệu lực (BR-F2-09) | **Hiệu lực** |
  | Nháp, Đã ký | Hủy (lý do ≥ 10 ký tự) | **Đã hủy** |
  | Hiệu lực | Phụ lục sửa đổi (BR-F2-12) | **Hiệu lực**, phiên bản tăng |

  - Hợp đồng "Hiệu lực" **không hủy được**; kết thúc hợp đồng là F-S5 (thanh lý).
  - Nháp sửa được mọi trường. Đã ký thì chỉ thêm được tài liệu.
- **BR-F2-11. Lịch phải thu:**
  - **Các kỳ:** tính từ ngày bắt đầu khai thác. Mỗi kỳ dài 1 tháng (chu kỳ Tháng) hoặc 3 tháng (chu kỳ Quý), cho tới ngày kết thúc. Kỳ cuối có thể ngắn hơn.
  - **Số phải thu mỗi kỳ** = giá trị mỗi kỳ, **kể cả kỳ cuối ngắn hơn**. Không chia theo ngày (D-F2-3).
  - **Hạn thu** = ngày đầu kỳ + số ngày hạn thu. Nếu hạn rơi sau ngày cuối kỳ thì lấy ngày cuối kỳ.
  - **Ví dụ D1:** kỳ 16/11 → 30/11 (hợp đồng chỉ có một kỳ), hạn 25/11, phải thu 20.000.000 đ.
  - **Trạng thái kỳ ở slice này** (chưa có số đã thu):
    - **Chưa đến hạn**: hôm nay < hạn;
    - **Đến hạn**: hôm nay = hạn;
    - **Quá hạn**: hôm nay > hạn.

    F-S3 sẽ thêm "Đã thu đủ" và "Thu thiếu". Trạng thái được tính lại mỗi ngày bằng bộ lịch chạy dùng chung.
  - **Tổng của hợp đồng** = tổng số phải thu các kỳ. Hiện trên trang hợp đồng.
- **BR-F2-12. Phụ lục sửa đổi** (hợp đồng "Hiệu lực"; BQL). Mã `PL-NNN`.
  - **Được sửa:** giá trị mỗi kỳ, ngày kết thúc (chỉ gia hạn), số ngày hạn thu.
  - **Cần:** tệp phụ lục, ngày hiệu lực của phụ lục (≥ hôm nay), lý do.
  - **Tạo phiên bản hợp đồng mới.** Phiên bản cũ vẫn xem được.
  - **Sinh lại lịch phải thu:**
    - các kỳ có **hạn thu từ ngày hiệu lực của phụ lục trở đi** được sinh lại theo phiên bản mới;
    - các kỳ có hạn trước đó giữ nguyên.

    F-S3 sẽ thêm điều kiện: kỳ đã có khoản thu thì không sinh lại.
  - Mỗi kỳ ghi nó thuộc phiên bản nào.

### 3.4 Chung

- **BR-F2-13. Quyền:**
  - **Lập và sửa** đề xuất kết quả, hồ sơ hội nghị, hợp đồng, phụ lục: BQL (`EXPLOITATION_MANAGE`) có phạm vi tòa.
  - **Duyệt kết quả chọn:** BQT có phạm vi tòa. Cần một quyền mới cho việc duyệt; dev-build đặt tên và cập nhật ma trận quyền và tài liệu RM.
  - **Xem** kết quả chọn và hội nghị: BQL, BQT (`EXPLOITATION_VIEW`).
  - **Xem hợp đồng và lịch phải thu:** BQL, BQT, và **kế toán** có phạm vi tòa. Kế toán cần thông tin này để thu ở F-S3.
    - Kế toán **không** thấy bảng so sánh giá chào của các đơn vị khác (D-F1-5).
  - Ngoài phạm vi tòa: 404.
  - Mọi thao tác ghi có nhật ký kèm lý do (nếu có) và khóa phiên bản.
- **BR-F2-14. Seed demo:** nối tiếp MT-001 của F-S1:
  - KQ-001 chọn DV-A, "Đã duyệt" (biên bản BB-001);
  - HN-001 "Thông qua" (TR-001, BB-HN01, NQ-001);
  - HĐ-001 "Hiệu lực": chu kỳ Tháng, 20.000.000 đ / kỳ, số ngày hạn thu 9, 3 kỳ bắt đầu từ đầu tháng hiện tại.

  Gói MT-001 vẫn phải có một bản sao ở "Đang nhận hồ sơ" để demo F-S1 vẫn xem được. Cách làm: thêm một gói MT-002 ở trạng thái đó, hoặc tương đương. Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu là gói MT-001 sau khi đóng nhận: DV-A đủ hồ sơ, 20 tr; DV-B "Đang bổ sung", 22 tr.

**Kết quả chọn**
- **AC-F2.1** BQL đề xuất chọn DV-B: bị từ chối, với câu "Chỉ chọn được đơn vị đủ hồ sơ." Đề xuất DV-A kèm biên bản và căn cứ: được. Kết quả ở "Chờ duyệt", và bảng so sánh có cả DV-A lẫn DV-B.
- **AC-F2.2** BQL thử tự duyệt: 403. BQT "Yêu cầu sửa" kèm lý do: kết quả về "Cần sửa". BQL gửi lại, BQT duyệt: gói thành "Đã chọn đơn vị".
- **AC-F2.3** Hồ sơ DV-C có cờ trễ hạn: chọn mà không có lý do xét trễ thì bị từ chối; có lý do thì được, và người duyệt thấy lý do đó.
- **AC-F2.4** Gói không có đơn vị nào đủ hồ sơ: đề xuất "Không chọn được đơn vị", BQT duyệt, gói thành "Không có kết quả", và không soạn được hợp đồng.
- **AC-F2.5** Đổi kết quả khi đã có hợp đồng **đã ký**: bị từ chối. Khi hợp đồng còn nháp: được. Hợp đồng nháp đó tự "Đã hủy" kèm lý do.

**Hội nghị**
- **AC-F2.6** Ghi kết quả hội nghị có ngày sau hôm nay: bị từ chối. Ghi "Thông qua" mà thiếu quyết nghị: bị từ chối.
- **AC-F2.7** Ghi "Không thông qua": hợp đồng đã ký không đưa vào hiệu lực được. Lập HN mới và ghi "Thông qua": đưa vào hiệu lực được, và hồ sơ HN cũ vẫn xem được.

**Hợp đồng và lịch phải thu**
- **AC-F2.8** Soạn HĐ-001 từ KQ-001: đơn vị DV-A, khu vực và tòa tự điền, giá trị mặc định 20.000.000. Đổi sang 21.000.000 mà không ghi chú: bị từ chối.
- **AC-F2.9** (DF-27) HĐ-001 đã ký (ngày 15/11) nhưng chưa có hội nghị "Thông qua": "Đưa vào hiệu lực" bị từ chối, với câu của BR-F2-09. Có HN-001 thông qua rồi thì được.
- **AC-F2.10** HĐ khai thác 16/11/2026 → 30/11/2026, chu kỳ Tháng, 20.000.000, số ngày hạn 9: lịch có **1 kỳ** 16/11 → 30/11, hạn 25/11, phải thu 20.000.000 đ.
- **AC-F2.11** HĐ 01/12/2026 → 15/02/2027, chu kỳ Tháng, 20.000.000, số ngày hạn 9: lịch có 3 kỳ:
  - 01/12 → 31/12, hạn 10/12;
  - 01/01 → 31/01, hạn 10/01;
  - 01/02 → 15/02, hạn 10/02.

  Mỗi kỳ phải thu 20.000.000. Tổng 60.000.000.
- **AC-F2.12** Với lịch ở AC-F2.11, hôm nay 10/01: kỳ 1 "Quá hạn", kỳ 2 "Đến hạn", kỳ 3 "Chưa đến hạn". Lần chạy hằng ngày cập nhật trạng thái mà không cần ai mở web.
- **AC-F2.13** Phụ lục sửa giá trị thành 25.000.000, hiệu lực 01/01:
  - hợp đồng có phiên bản 2;
  - kỳ 1 (hạn 10/12) giữ 20.000.000; kỳ 2 và kỳ 3 thành 25.000.000, ghi "phiên bản 2";
  - tổng 70.000.000.

  Phụ lục rút ngắn ngày kết thúc: bị từ chối.
- **AC-F2.14** Hủy hợp đồng "Hiệu lực": không có nút, và gọi API thì bị từ chối. Hủy hợp đồng "Đã ký" kèm lý do: được.

**Quyền và chung**
- **AC-F2.15**
  - Kế toán tòa A xem được HĐ-001 và lịch phải thu, nhưng **không** thấy bảng so sánh giá chào và không có nút ghi.
  - KT không thấy gì của nhóm F.
  - `bql-b` mở HĐ-001 của tòa A: 404.
- **AC-F2.16** Seed demo tạo đúng BR-F2-14 trên DB mới; chạy lại không tạo trùng. Màn F-S1 vẫn có một gói "Đang nhận hồ sơ" để xem.
- **AC-F2.17** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Test của F-S1 vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test lịch phải thu: chu kỳ Tháng và Quý, kỳ cuối ngắn, hạn vượt cuối kỳ, cuối tháng 31/28; sinh lại theo phụ lục (AC-F2.10, AC-F2.11, AC-F2.13).
- [ ] e2e API:
  - kết quả chọn: chỉ đơn vị đủ hồ sơ, tự duyệt 403, yêu cầu sửa, từ chối, không chọn được, đổi kết quả khi có hoặc không có hợp đồng đã ký, hồ sơ trễ hạn;
  - hội nghị: ngày tương lai, thiếu quyết nghị, không thông qua, trình lại;
  - hợp đồng: điều kiện hiệu lực DF-27, các trạng thái, hủy, phụ lục;
  - quyền: kế toán, KT, phạm vi tòa.
- [ ] Lần chạy hằng ngày cập nhật trạng thái kỳ, gọi trực tiếp được trong test.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của F-S1.
- [ ] Test component: form đề xuất (chặn đơn vị không đủ), danh sách kiểm "Đưa vào hiệu lực", bảng lịch phải thu.
- [ ] Ảnh chụp ở chế độ `api`: tab Kết quả chọn (chờ duyệt, đã duyệt), tab Hội nghị, trang hợp đồng (mốc và lịch phải thu), màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-F2-1 | Một người BQT có phạm vi tòa duyệt kết quả chọn (một bước) | FQ-04. Chuỗi duyệt nhiều bước làm sau nếu khách cần |
| D-F2-2 | Ký được trước hoặc sau hội nghị; chỉ **hiệu lực** mới cần quyết nghị thông qua | DF-27. D1 có hội nghị trước ký, nhưng sơ đồ xếp F04 trước F05 (FG-06) |
| D-F2-3 | Kỳ cuối ngắn vẫn phải thu đủ giá trị kỳ, không chia theo ngày | Đơn giản, dễ đối chiếu với hợp đồng. Muốn khác thì làm phụ lục. **Cần khách xác nhận** (thêm vào OD-26) |
| D-F2-4 | Hạn thu = ngày đầu kỳ + N ngày, mặc định N = 9 | Khớp ví dụ D1 (16/11 → 25/11) |
| D-F2-5 | Phụ lục chỉ được gia hạn, không rút ngắn hợp đồng | Rút ngắn thực chất là chấm dứt sớm, thuộc F-S5 |
| D-F2-6 | Kế toán xem hợp đồng và lịch phải thu, nhưng không xem giá chào của đơn vị khác | Cần cho F-S3; giữ D-F1-5 |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích nhóm F (PD-31), sau F-S1 (PD-32). |
| 27/10/2026 | Chủ dự án duyệt (PD-33), gồm D-F2-1 đến D-F2-6, và cho giao dev-build (bắt đầu sau khi F-S1 đạt review). |
| 27/10/2026 | Review PASS WITH RESIDUE trên `64d6a62`; PM/BA đóng slice. Chờ merge (migration `2026-10-27h-exploitation-contracts.sql`). |
