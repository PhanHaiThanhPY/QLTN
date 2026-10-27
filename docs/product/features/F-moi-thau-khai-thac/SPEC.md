---
id: F.S1
title: Mời thầu và tiếp nhận hồ sơ dự thầu khai thác
status: Đã duyệt
owner: PM/BA
intent: "BQL phát hành một đợt mời thầu khai thác khu vực chung với bộ tài liệu có phiên bản và hạn nhận rõ ràng, rồi ghi nhận hồ sơ của từng đơn vị đến khi biết đơn vị nào đủ, đơn vị nào còn thiếu."
depends_on: []
---

# SPEC: Mời thầu và tiếp nhận hồ sơ dự thầu khai thác (F-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-32), gồm 6 mặc định D-F1-1 đến D-F1-6 ở §6

**Nguồn:**
- Phân tích [F-quy-khai-thac.md](../../modules/F-quy-khai-thac.md), đã duyệt (PD-31): §2 F01, F02; FG-01, FG-12; mặc định FQ-01, FQ-02, FQ-12 (OD-26).
- D1 tr. 5 (F01 "Chuẩn hóa hồ sơ mời thầu khai thác"), tr. 6 (F02 "Tập trung hồ sơ của từng đơn vị dự thầu"), tr. 3, sơ đồ `02_Chu_trinh_quy.mmd`.
- Review 23/10 dòng 91–92: "Gói khai thác, hạn nhận, phiên bản và hồ sơ bắt buộc"; "Nhiều đơn vị, hồ sơ bổ sung, đóng nhận và quyền xem."
- DF-20 (quỹ khai thác theo tòa), DF-25 (cách xử lý hồ sơ trễ hạn, dùng tương tự).

**Nền:** tòa và vị trí (`buildings`), tài khoản và vai trò (`users`, `roles`, ma trận quyền v2), tệp đính kèm (AT-S1), nhật ký (`audit`). Đây là slice đầu tiên của nhóm F; **chưa có tiền** (F-S3).

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Nhóm F chưa có code (FG-01). Hiện BQL mời thầu khai thác bằng thư và tệp rời, nên không có một chỗ cho biết:
- đợt mời nào đang mở và hạn nhận khi nào;
- đã gửi thư bản nào;
- đơn vị nào đã nộp, còn thiếu giấy tờ gì.

Sau slice này, BQL làm được những việc sau trên hệ thống:
- lập **gói khai thác**, ví dụ "Quầy tiện ích · Sảnh dịch vụ Aqua 1";
- **phát hành** đợt mời với bộ tài liệu được khóa phiên bản;
- **ghi nhận hồ sơ** của từng đơn vị theo danh mục, gửi yêu cầu bổ sung, và đóng nhận khi hết hạn.

Kết quả chọn, hội nghị và hợp đồng làm ở **F-S2**.

**Người dùng:**
- Chính: BQL của tòa lập gói, phát hành, ghi nhận hồ sơ.
- Phụ: BQT xem tiến độ và hồ sơ để chuẩn bị chọn (F-S2).

**User story:**
- Là BQL, tôi muốn phát hành thư mời kèm yêu cầu và tiêu chí, khóa thành "phiên bản 01", để sau này đối chiếu được đơn vị nào đã nhận bản nào.
- Là BQL, tôi muốn thấy ngay DV-B còn thiếu "Chứng từ điều kiện", để gửi yêu cầu bổ sung kèm hạn.
- Là BQT, tôi muốn biết khi hết hạn nhận có bao nhiêu đơn vị đủ hồ sơ, trước khi họp chọn.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Danh mục đơn vị khai thác:** tạo, sửa, ngừng dùng (BR-F1-01).
2. **Gói khai thác (F01):**
   - tạo và sửa nháp;
   - phát hành, với tài liệu và danh mục hồ sơ phải nộp;
   - phát hành bản sửa (phiên bản mới), gia hạn hạn nhận;
   - đóng nhận (tự động khi hết hạn, hoặc đóng sớm);
   - hủy đợt (BR-F1-02 đến BR-F1-06).
3. **Hồ sơ dự thầu (F02):**
   - ghi nhận tiếp nhận của từng đơn vị;
   - trạng thái từng tài liệu;
   - yêu cầu bổ sung có hạn;
   - đánh dấu trễ hạn;
   - giá chào mỗi kỳ (BR-F1-07 đến BR-F1-10).
4. **Quyền xem hồ sơ dự thầu** (BR-F1-11) và nhật ký mọi thao tác.
5. **Màn hình:** menu "Quỹ khai thác", gồm danh sách gói, trang gói (hồ sơ mời thầu, hồ sơ dự thầu, lịch sử) và danh mục đơn vị.
6. **Seed demo:** gói MT-001 theo ví dụ D1 cho tòa demo (BR-F1-12).

**Ngoài phạm vi:**
- Kết quả chọn, hội nghị, hợp đồng (F-S2). Ở slice này, gói dừng ở trạng thái "Đã đóng nhận".
- Mọi số tiền của quỹ: thu, thuế, chi, sao kê (F-S3, F-S4). Giá chào ở slice này chỉ là **thông tin của hồ sơ dự thầu**, chưa phải tiền của quỹ.
- **Gửi thư hoặc email cho đơn vị.** Hệ thống chưa có kênh gửi ra ngoài (notifications làm sau, PD-28). "Ghi nhận phát hành" chỉ ghi lại việc BQL đã gửi thư ngoài hệ thống.
- Đơn vị dự thầu tự đăng nhập hoặc tự nộp hồ sơ. BQL ghi nhận thay.
- Sinh thư mời từ mẫu (FQ-12): BQL tải tệp thư đã soạn sẵn.
- Việc và nhắc hạn (B02 TK-S2, notifications).
- Chế độ `mock`: không có màn F trong demo; ở chế độ `mock`, menu "Quỹ khai thác" vẫn ẩn.

## 3. Quy tắc nghiệp vụ

- **BR-F1-01. Đơn vị khai thác (danh mục):**
  - **Trường:**
    - tên (bắt buộc, 2–200 ký tự);
    - mã số thuế (không bắt buộc; 10 hoặc 13 chữ số, có thể có dấu `-`);
    - địa chỉ;
    - người liên hệ, điện thoại, email (không bắt buộc, đúng định dạng nếu có);
    - ghi chú.
  - **Phạm vi:** danh mục dùng **chung cho mọi tòa**, vì một đơn vị có thể khai thác ở nhiều tòa. Mã đơn vị `DV-NNN` do hệ thống cấp.
  - **Trùng:** trùng mã số thuế với một đơn vị đang dùng thì báo lỗi ở trường mã số thuế. Trùng tên thì chỉ cảnh báo, vẫn lưu được.
  - **Ngừng dùng:** cần lý do. Đơn vị đã ngừng không mời được ở đợt mới, nhưng vẫn hiện ở các đợt cũ.
  - Mọi BQL tạo được; mọi người có quyền xem khai thác đều xem được danh mục.
- **BR-F1-02. Gói khai thác** (`MT-NNN`, hệ thống cấp):
  - **Trường của gói:**

    | Trường | Bắt buộc | Quy tắc |
    |---|---|---|
    | Tòa | có | trong phạm vi của người tạo. Không đổi sau khi tạo |
    | Khu vực | có | một vị trí của tòa (danh mục vị trí hiện có), kèm mô tả tự do tối đa 200 ký tự (ví dụ "Quầy góc trái sảnh") |
    | Loại khai thác | có | Quầy tiện ích, Quảng cáo, Mặt bằng kinh doanh, Gửi xe, Khác (FQ-01). Chọn "Khác" thì phải ghi rõ |
    | Tên gói | có | 3–200 ký tự |
    | Mô tả yêu cầu | không | tối đa 2.000 ký tự |

  - **Đợt mời:** mỗi gói có **một** đợt mời ở slice này. Gói bị hủy thì tạo gói mới.
- **BR-F1-03. Điều kiện để phát hành** ("Ghi nhận phát hành"):
  - **3 tài liệu bắt buộc**, mỗi tài liệu là một tệp: **Thư mời**, **Yêu cầu khai thác**, **Tiêu chí đánh giá** (D1 tr. 5). Thêm được tài liệu khác (tối đa 10).
  - **Danh mục hồ sơ phải nộp:** từ 1 đến 20 mục. Mặc định có 4 mục theo D1 tr. 6, sửa được: Hồ sơ năng lực, Phương án khai thác, Tài liệu tiếp nhận, Chứng từ điều kiện.
  - **Hạn nhận:** ngày và giờ (giờ VN), sau thời điểm phát hành.
  - **Đơn vị được mời:** ít nhất 1 đơn vị đang dùng (FQ-02, mời đích danh).
  - **Ngày phát hành:** ngày BQL đã gửi thư, không sau hôm nay. Mặc định là hôm nay.
  - Thiếu điều kiện nào thì báo đúng chỗ đó.
- **BR-F1-04. Phiên bản:**
  - Phát hành lần đầu khóa **phiên bản 01**, gồm thư, tài liệu, danh mục hồ sơ và hạn nhận.
  - Muốn sửa tài liệu hay danh mục sau khi đã phát hành thì dùng "**Phát hành bản sửa**":
    - phải có lý do (≥ 10 ký tự);
    - tạo phiên bản 02, 03…;
    - phiên bản cũ vẫn xem được, chỉ đọc.
  - Hồ sơ dự thầu đã nhận trước bản sửa giữ nguyên. Nếu bản sửa **thêm** mục vào danh mục, mục mới hiện ở mọi hồ sơ với trạng thái "Chưa nhận".
  - Mỗi hồ sơ dự thầu ghi **phiên bản đang hiệu lực lúc tiếp nhận**.
- **BR-F1-05. Hạn nhận và đóng nhận:**
  - **Gia hạn:** được, khi gói đang nhận, cần lý do. Hạn mới phải sau hạn cũ.
  - **Rút ngắn hạn:** không được.
  - **Tự đóng:** đến hạn nhận, gói **tự chuyển** "Đã đóng nhận" (máy chủ kiểm, không cần ai mở web).
  - **Đóng sớm:** BQL đóng sớm được, cần lý do, chỉ khi **mọi đơn vị được mời** đã có hồ sơ.
  - **Sau khi đóng nhận:**
    - không tiếp nhận thêm đơn vị nào;
    - chỉ cập nhật được các mục đang "Cần bổ sung", và chỉ trong hạn bổ sung của mục đó (BR-F1-09).
- **BR-F1-06. Trạng thái gói:**

  | Từ | Thao tác | Đến |
  |---|---|---|
  | — | Tạo | **Nháp** |
  | Nháp | Ghi nhận phát hành (BR-F1-03) | **Đang nhận hồ sơ** |
  | Đang nhận hồ sơ | Hết hạn nhận, hoặc đóng sớm | **Đã đóng nhận** |
  | Nháp, Đang nhận hồ sơ, Đã đóng nhận | Hủy (lý do ≥ 10 ký tự) | **Đã hủy** |

  - Nháp sửa được mọi trường, và xóa được nếu chưa từng phát hành.
  - Gói đã phát hành không xóa được, chỉ hủy được.
  - "Đã đóng nhận" là điểm vào của F-S2 (chọn đơn vị).
- **BR-F1-07. Ghi nhận hồ sơ dự thầu** (BQL, khi gói "Đang nhận hồ sơ"):
  - **Thông tin ghi nhận:** đơn vị, thời điểm tiếp nhận (ngày giờ, không sau bây giờ), giá chào mỗi kỳ, ghi chú.
    - Giá chào là số nguyên VND, > 0. **Bắt buộc** trước khi gói đóng nhận, để F-S2 so sánh được. Kèm đơn vị kỳ (tháng / quý / khác), như "20 triệu đồng / kỳ" ở D1 tr. 7.
  - **Mỗi đơn vị có nhiều nhất một hồ sơ** trong một gói. Đơn vị nộp lại thì cập nhật hồ sơ đó.
  - **Đơn vị không có trong danh sách mời** vẫn ghi nhận được, nhưng cần lý do (FQ-02). Hồ sơ có cờ "Ngoài danh sách mời".
  - **Tiếp nhận sau hạn nhận:** hồ sơ được lưu, có cờ "**Trễ hạn**". Việc có xét hồ sơ trễ hạn hay không quyết ở F-S2, như DF-25.
    - Trường hợp này chỉ xảy ra khi BQL ghi nhận muộn một hồ sơ đã nhận đúng hạn ngoài hệ thống: thời điểm tiếp nhận ≤ hạn nhận thì **không** bị đánh dấu trễ, kể cả khi BQL nhập sau.
- **BR-F1-08. Tài liệu của hồ sơ dự thầu:**
  - Mỗi mục của danh mục có một trạng thái:
    - **Chưa nhận**;
    - **Đã nhận**: cần ít nhất 1 tệp;
    - **Cần bổ sung**: cần ghi chú và hạn bổ sung.
  - Thay tệp của một mục đã nhận thì giữ lại tệp cũ trong lịch sử của mục đó.
  - **Tình trạng của hồ sơ:**
    - **Đủ hồ sơ**: mọi mục ở "Đã nhận";
    - **Đang bổ sung**: có ít nhất một mục "Cần bổ sung";
    - **Thiếu**: các trường hợp còn lại.
  - Đếm "k/n tài liệu" như D1 tr. 6.
- **BR-F1-09. Yêu cầu bổ sung:**
  - BQL chọn một hoặc nhiều mục, ghi chú (≥ 10 ký tự) và **hạn bổ sung** (ngày giờ, sau bây giờ).
  - Mỗi yêu cầu được lưu: mục nào, ghi chú, hạn, người yêu cầu, thời điểm.
  - **Hết hạn bổ sung** mà mục vẫn chưa "Đã nhận" thì mục chuyển "**Quá hạn bổ sung**". Hồ sơ vẫn ở "Đang bổ sung", F-S2 sẽ xét.
- **BR-F1-10. Ô số của gói** (D1 tr. 5, 6):
  - **Trước khi phát hành:** đơn vị mời, tài liệu, hạn nhận.
  - **Sau khi phát hành:** Đã nhận (số hồ sơ), Đủ hồ sơ, Cần bổ sung, Hạn nhận (kèm "còn N ngày / N giờ").
- **BR-F1-11. Quyền:**
  - **Tạo, sửa, phát hành, ghi nhận, yêu cầu bổ sung, đóng, hủy:** BQL có phạm vi tòa của gói. Chỉ trong tòa đó.
  - **Xem gói, danh sách hồ sơ và giá chào:** BQL và BQT có phạm vi tòa đó.
  - **Vai trò khác** (KT, TVKT, kế toán) **không thấy** giá chào và tài liệu dự thầu ở slice này.
  - Quản trị (ADMIN) không thao tác nghiệp vụ, theo ma trận quyền v2.
  - Ngoài phạm vi tòa: 404.
  - Ma trận quyền v2 cần thêm quyền cho các việc trên. Dev-build đặt tên quyền, rồi cập nhật ma trận và tài liệu RM.
  - Mọi thao tác ghi có nhật ký kèm lý do (nếu có) và khóa phiên bản.
- **BR-F1-12. Seed demo:** cho tòa đầu tiên của seed:
  - đơn vị DV-A, DV-B;
  - gói MT-001 "Quầy tiện ích · Sảnh dịch vụ", **Đang nhận hồ sơ**, hạn nhận là hôm nay + 10 ngày;
  - DV-A đủ 4/4 tài liệu, giá chào 20.000.000 đ / tháng;
  - DV-B 3/4 tài liệu, "Chứng từ điều kiện" đang "Cần bổ sung", giá chào 22.000.000 đ / tháng.

  Tệp mẫu là PDF nhỏ. Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Dữ liệu dùng tòa mẫu và tài khoản demo. Trong test, "bây giờ" được cố định.

**Danh mục đơn vị**
- **AC-F1.1** BQL tạo DV-A, có mã số thuế 0312345678: có mã `DV-…`. Tạo đơn vị khác với cùng mã số thuế: bị từ chối ở trường mã số thuế. Cùng tên nhưng khác mã số thuế: lưu được, kèm cảnh báo.

**Phát hành**
- **AC-F1.2** GIVEN gói MT-001 ở Nháp, thiếu tệp "Tiêu chí đánh giá", WHEN "Ghi nhận phát hành", THEN bị từ chối và báo đúng ở tài liệu đó. Đủ 3 tệp, 2 đơn vị, hạn 10/11 17:00: gói thành "Đang nhận hồ sơ", có phiên bản 01, và có nhật ký.
- **AC-F1.3** Đặt hạn nhận trước thời điểm phát hành: bị từ chối. Gia hạn từ 10/11 sang 12/11 kèm lý do: được. Rút ngắn về 08/11: bị từ chối.
- **AC-F1.4** "Phát hành bản sửa" thay tệp "Yêu cầu khai thác" và thêm mục "Giấy phép kinh doanh", kèm lý do:
  - gói có phiên bản 02, và phiên bản 01 vẫn xem được;
  - hồ sơ DV-A nhận trước đó vẫn ghi "phiên bản 01", và có thêm mục "Giấy phép kinh doanh · Chưa nhận";
  - DV-A thành "Thiếu".

**Hồ sơ dự thầu**
- **AC-F1.5** Ghi nhận DV-A lúc 08/11 09:00, giá 20.000.000 đ / tháng, đủ 4 tài liệu: hồ sơ "Đủ hồ sơ · 4/4". Ghi nhận lần hai cho DV-A trong cùng gói: không tạo hồ sơ thứ hai, chỉ mở hồ sơ đã có.
- **AC-F1.6** DV-B có 3/4, gửi yêu cầu bổ sung "Chứng từ điều kiện" hạn 10/11 17:00: hồ sơ "Đang bổ sung · 3/4". Qua 17:01 ngày 10/11 mà chưa nhận: mục thành "Quá hạn bổ sung".
- **AC-F1.7** Ghi nhận DV-C, không có trong danh sách mời: bắt buộc lý do; hồ sơ có cờ "Ngoài danh sách mời".
- **AC-F1.8** Hạn nhận 10/11 17:00. Ghi nhận ngày 11/11 một hồ sơ có thời điểm tiếp nhận 10/11 16:00: **không** trễ hạn. Ghi nhận một hồ sơ tiếp nhận 10/11 18:00: có cờ "Trễ hạn".

**Đóng nhận, hủy**
- **AC-F1.9** Đến 10/11 17:00, gói tự chuyển "Đã đóng nhận" mà không cần ai mở web. Sau đó:
  - không thêm được hồ sơ mới;
  - vẫn cập nhật được mục "Cần bổ sung" của DV-B trước hạn bổ sung;
  - sau hạn bổ sung thì không cập nhật được nữa.
- **AC-F1.10** Đóng sớm khi DV-B chưa có hồ sơ: bị từ chối. Hủy gói đã phát hành kèm lý do: được. Xóa gói đã phát hành: không có nút xóa, và gọi API xóa thì bị từ chối.
- **AC-F1.11** Giá chào chưa nhập thì gói không đóng sớm được, và khi tự đóng thì hồ sơ đó có cờ "Thiếu giá chào".

**Quyền và chung**
- **AC-F1.12**
  - BQT của tòa xem được gói, hồ sơ và giá chào, nhưng không có nút ghi nào.
  - KT và kế toán không thấy giá chào và tài liệu dự thầu. Gọi API thì nhận 403.
  - `bql-b` mở gói của tòa A: 404.
- **AC-F1.13** Seed demo tạo đúng dữ liệu BR-F1-12 trên DB mới; chạy lại không tạo trùng.
- **AC-F1.14** Trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Ở chế độ `mock`, menu "Quỹ khai thác" vẫn ẩn và test hiện có vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] e2e API:
  - danh mục đơn vị (trùng mã số thuế);
  - phát hành (từng điều kiện thiếu); phiên bản; gia hạn, rút ngắn;
  - tự đóng nhận và đóng sớm; hủy;
  - ghi nhận hồ sơ (một hồ sơ mỗi đơn vị, ngoài danh sách, trễ hạn theo thời điểm tiếp nhận);
  - yêu cầu bổ sung và quá hạn bổ sung;
  - quyền (BQT xem, KT và kế toán 403, phạm vi tòa).
- [ ] Việc tự đóng nhận và tự chuyển quá hạn bổ sung chạy được khi gọi trực tiếp trong test.
- [ ] Migration mới chạy được trên `qltn_dev`.
- [ ] Test component: form phát hành (thiếu tài liệu), danh mục hồ sơ, bảng hồ sơ dự thầu (k/n, cờ).
- [ ] Ảnh chụp ở chế độ `api`: danh sách gói, trang gói ở 2 trạng thái (Đang nhận, Đã đóng nhận), hồ sơ DV-B, màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-F1-1 | Danh mục đơn vị dùng chung mọi tòa | Một đơn vị có thể khai thác ở nhiều tòa; tránh nhập trùng |
| D-F1-2 | Một gói có một đợt mời; hủy thì tạo gói mới | Đơn giản, đủ cho ví dụ D1. Mời lại nhiều vòng làm sau nếu khách cần |
| D-F1-3 | "Ghi nhận phát hành" không gửi thư; BQL gửi ngoài hệ thống | Chưa có kênh gửi ra ngoài (notifications làm sau) |
| D-F1-4 | Trễ hạn tính theo **thời điểm tiếp nhận**, không theo lúc nhập | BQL có thể nhập muộn một hồ sơ đã nhận đúng hạn |
| D-F1-5 | Giá chào và tài liệu dự thầu chỉ BQL và BQT xem | Thông tin cạnh tranh của đơn vị; review 23/10 nêu "quyền xem" |
| D-F1-6 | Chỉ được gia hạn, không rút ngắn hạn nhận | Rút ngắn gây bất lợi cho đơn vị đã nhận thư |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích nhóm F (PD-31). |
| 27/10/2026 | Chủ dự án duyệt (PD-32), gồm D-F1-1 đến D-F1-6, và cho giao dev-build. |
