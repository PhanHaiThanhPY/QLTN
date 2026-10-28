---
id: T.S1
title: Thư mời chào lãi suất và chọn ngân hàng gửi tiền quỹ bảo trì
status: Đã triển khai
owner: PM/BA
intent: "Mỗi lần gửi tiền quỹ bảo trì đều bắt đầu bằng một thư mời chào lãi có hạn rõ ràng, các bản chào được so sánh cùng điều kiện, và ngân hàng được chọn có căn cứ do BQT duyệt."
depends_on: []
---

# SPEC: Thư mời chào lãi suất và chọn ngân hàng gửi tiền quỹ bảo trì (T-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 28/10/2026 · **Trạng thái:** `Đã triển khai` (28/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 28/10/2026 (PD-37), gồm 6 mặc định D-T1-1 đến D-T1-6 ở §6

**Nguồn:**
- Phân tích [T-tien-gui-quy-bao-tri.md](../../modules/T-tien-gui-quy-bao-tri.md) (26/10/2026): §2 T01, T02; §5 slice T-S1. Các câu hỏi TQ-01 đến TQ-06 (OD-16) đã có mặc định được duyệt ở PD-09: DF-20 đến DF-26.
- D1 tr. 4 (tổng quan "Tiền gửi liền mạch. Gốc, lãi tách rõ"), tr. 33 (T01 thư mời chào lãi suất MC-001), tr. 34 (T02 kết quả chọn ngân hàng KQ-TG01), tr. 39 (nghiệm thu: "Thư, phản hồi, số ngân hàng khớp dashboard"; "Biên bản và kết quả theo quyền; truy về bản chào").
- Sơ đồ `sources/customer/D1-aqua-proposal/so-do-quy-bao-tri/03_Tien_gui_bao_tri.mmd`.
- DF-20 (mỗi tòa có quỹ bảo trì và tài khoản riêng), DF-22 (quy ước tính ngày và làm tròn là trường bắt buộc của từng **hợp đồng**, không có mặc định chung), DF-25 (bản chào trễ hạn; đổi kết quả chỉ khi chưa có hợp đồng).
- Cách làm đã duyệt của nhóm F, dùng lại cho phần đề xuất và duyệt: F-S1 (gói, hạn nhận, trễ hạn) và F-S2 (kết quả chọn, BQT duyệt).

**Nền:**
- Mô hình quỹ của [F-S3](../F-thu-chi-quy-khai-thac/SPEC.md) BR-F3-01: loại quỹ là một trường, và nhóm T thêm loại `BAO_TRI`.
- Bộ lịch chạy dùng chung (F-S1).
- Module tệp (AT-S1) và nhật ký.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Nhóm T (tiền gửi quỹ bảo trì, 6 trên 34 phân hệ của D1) chưa có code. Hiện BQL mời ngân hàng chào lãi bằng thư rời, so lãi suất bằng bảng tính. Không có chỗ nào cho biết đã mời ai, ai đã trả lời, và vì sao chọn ngân hàng đó.

Sau slice này:
- BQL lập **thư mời chào lãi** cho quỹ bảo trì của một tòa: số tiền, kỳ hạn, hạn phản hồi, ngân hàng được mời.
- BQL ghi nhận **bản chào** của từng ngân hàng.
- Hệ thống **tính lãi cả kỳ** của từng bản chào theo cùng một công thức, để so sánh.
- BQL đề xuất ngân hàng được chọn kèm biên bản; **BQT duyệt**.

Hợp đồng tiền gửi và lịch lãi làm ở **T-S2**. Nhận lãi, tất toán, tái tục làm ở T-S3 và T-S4.

**Người dùng:**
- Chính: BQL lập thư mời, ghi bản chào, đề xuất kết quả.
- Chính: BQT duyệt ngân hàng được chọn.
- Phụ: kế toán xem kết quả để chuẩn bị hợp đồng (T-S2).

**User story:**
- Là BQL, tôi muốn gửi thư mời 3 ngân hàng chào lãi cho 1 tỷ đồng kỳ hạn 90 ngày, rồi theo dõi "2/3 ngân hàng đã phản hồi", để biết cần nhắc ai.
- Là BQT, tôi muốn thấy các bản chào được so sánh **cùng điều kiện**, có lãi cả kỳ tính sẵn, trước khi duyệt.
- Là BQT, tôi muốn biết nếu bản được đề xuất **không** phải bản có lãi cao nhất, và lý do vì sao.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Danh mục ngân hàng:** tạo, sửa, ngừng dùng (BR-T1-01).
2. **Quỹ bảo trì:** mỗi tòa có một quỹ loại `BAO_TRI`, tạo sẵn theo mô hình quỹ của F-S3 (BR-T1-02). Thiết lập tài khoản và số dư đầu của quỹ này làm ở T-S2.
3. **Thư mời chào lãi (T01):** soạn, ghi nhận gửi, gia hạn, tự hết hạn nhận, hủy (BR-T1-03 đến BR-T1-05).
4. **Bản chào:** ghi nhận theo từng ngân hàng, tình trạng hồ sơ, cờ trễ hạn (BR-T1-06, BR-T1-07).
5. **So sánh và tính lãi cả kỳ** (BR-T1-08).
6. **Kết quả chọn (T02):** đề xuất, BQT duyệt, yêu cầu sửa, từ chối; không chọn được ngân hàng; đổi kết quả (BR-T1-09 đến BR-T1-11).
7. **Màn hình:** nhóm menu mới "**Tiền gửi quỹ bảo trì**", gồm "Thư mời chào lãi" và "Ngân hàng".
8. **Seed demo** theo D1 tr. 33–34 (BR-T1-13).

**Ngoài phạm vi:**
- Hợp đồng tiền gửi, lịch trả lãi, quy ước tính ngày của hợp đồng (T-S2, DF-22).
- Quy chế thu chi của quỹ (DF-21: kỳ hạn cho phép, đồng chủ tài khoản) (T-S2).
- Nhận lãi, đối chiếu sao kê (T-S3, dùng F-S4).
- Tất toán, tái tục (T-S4).
- Tổng quan quỹ bảo trì (T-S5, cùng B01/B18 đang hoãn).
- **Gửi thư hay email cho ngân hàng.** Chưa có kênh gửi ra ngoài; "Ghi nhận gửi" chỉ ghi lại việc BQL đã gửi thư ngoài hệ thống (như D-F1-3).
- Ngân hàng tự nộp bản chào trên hệ thống.
- Chế độ `mock`: không có màn T.

## 3. Quy tắc nghiệp vụ

- **BR-T1-01. Ngân hàng (danh mục):**
  - **Trường:**
    - tên ngân hàng (bắt buộc, 2–200 ký tự);
    - tên viết tắt (không bắt buộc, tối đa 20 ký tự, ví dụ "VCB");
    - chi nhánh;
    - người liên hệ, điện thoại, email (đúng định dạng nếu có).
  - Mã `NH-NNN` do hệ thống cấp. Danh mục dùng **chung cho mọi tòa**.
  - Trùng tên **và** chi nhánh với một ngân hàng đang dùng thì báo lỗi.
  - Ngừng dùng cần lý do. Ngân hàng đã ngừng không mời được ở thư mới, nhưng vẫn hiện ở các thư cũ.
- **BR-T1-02. Quỹ bảo trì:**
  - Mỗi tòa có đúng **một** quỹ loại `BAO_TRI`. Quỹ được tạo khi chạy migration, và cho tòa mới khi tòa được tạo.
  - **Không bao giờ có số dư cộng chung** giữa quỹ bảo trì và quỹ khai thác (BR-F3-01).
  - Ở slice này, quỹ bảo trì chỉ dùng để gắn thư mời. Tài khoản và sổ của quỹ này làm từ T-S2.
- **BR-T1-03. Thư mời chào lãi** (`MC-NNN`, BQL):

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Quỹ | có | quỹ bảo trì của một tòa trong phạm vi người tạo. Không đổi sau khi tạo |
  | Số tiền mời gửi | có | số nguyên VND, > 0 |
  | Kỳ hạn | có | số ngày, 7–3.650. D1 dùng 90 ngày |
  | Hạn phản hồi | có | ngày và giờ (giờ VN), sau thời điểm ghi nhận gửi |
  | Ngày dự kiến gửi tiền | không | để ngân hàng chào đúng ngày |
  | Ghi chú điều kiện | không | tối đa 2.000 ký tự |
  | Tệp thư mời | có khi gửi | một tệp |
  | Ngân hàng được mời | có khi gửi | ít nhất 1 ngân hàng đang dùng |

- **BR-T1-04. Trạng thái thư mời:**

  | Từ | Thao tác | Đến |
  |---|---|---|
  | — | Soạn | **Nháp** |
  | Nháp | Ghi nhận gửi (ngày gửi ≤ hôm nay; đủ trường) | **Đang nhận bản chào** |
  | Đang nhận bản chào | Đến hạn phản hồi (máy chủ tự chuyển), hoặc đóng sớm khi mọi ngân hàng được mời đã có bản chào (lý do) | **Đã hết hạn nhận** |
  | Đã hết hạn nhận | Kết quả chọn được duyệt (BR-T1-09) | **Đã chọn ngân hàng** |
  | Đã hết hạn nhận | "Không chọn được ngân hàng" được duyệt | **Không có kết quả** |
  | Nháp, Đang nhận bản chào, Đã hết hạn nhận | Hủy (lý do ≥ 10 ký tự) | **Đã hủy** |

  - **Gia hạn** hạn phản hồi: được khi đang nhận bản chào, cần lý do. Hạn mới phải sau hạn cũ. **Không rút ngắn** (như D-F1-6).
  - Nháp sửa được mọi trường, và xóa được nếu chưa từng gửi.
  - Sau khi gửi, số tiền và kỳ hạn **không đổi được**. Muốn đổi thì hủy và lập thư mới, vì mọi bản chào phải cùng điều kiện.
- **BR-T1-05. Tiến độ phản hồi** (D1 tr. 33):
  - Thư mời hiện "**k/n ngân hàng đã phản hồi**", và trạng thái từng ngân hàng được mời: "Đã nhận" hoặc "Còn chờ".
  - Số k và n ở đây là nguồn cho tổng quan sau này. D1 tr. 39 yêu cầu "số ngân hàng khớp dashboard".
- **BR-T1-06. Bản chào** (BQL, khi thư "Đang nhận bản chào", hoặc sau đó nếu trễ):

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Ngân hàng | có | mỗi ngân hàng có nhiều nhất **một** bản chào trong một thư; nộp lại thì cập nhật bản đó |
  | Thời điểm nhận | có | ngày giờ, không sau bây giờ |
  | Lãi suất | có | %/năm, > 0 và ≤ 30, **tối đa 3 chữ số thập phân**, ví dụ 5,875. Lưu dạng **số nguyên** theo phần nghìn của phần trăm (5,875% → 5875), không dùng số thực |
  | Cơ sở tính ngày | có | 360 hoặc 365 ngày/năm, theo đúng bản chào của ngân hàng. Không có mặc định (DF-22) |
  | Cách trả lãi | có | Cuối kỳ, hoặc định kỳ (mỗi N tháng hoặc mỗi N ngày) |
  | Điều kiện kèm theo | không | tối đa 2.000 ký tự |
  | Tệp bản chào | có | một tệp |
  | Tình trạng hồ sơ | có | **Đủ hồ sơ**, hoặc **Thiếu** kèm ghi chú |

  - **Ngân hàng không được mời** vẫn ghi nhận được, kèm lý do. Bản chào có cờ "Ngoài danh sách mời".
- **BR-T1-07. Trễ hạn** (DF-25(1)):
  - Bản chào có **thời điểm nhận** sau hạn phản hồi thì được lưu, kèm cờ "**Trễ hạn**". Trễ hạn tính theo thời điểm nhận, không theo lúc nhập (như D-F1-4).
  - Bản chào trễ hạn chỉ được đưa vào xét khi đề xuất kết quả có lý do riêng (BR-T1-09).
- **BR-T1-08. So sánh và lãi cả kỳ:**
  - **Bảng so sánh** gồm mọi bản chào của thư, với cùng **số tiền** và **kỳ hạn** của thư (D1 tr. 34: "cùng điều kiện").
  - **Lãi cả kỳ** của một bản chào = số tiền × lãi suất × kỳ hạn (ngày) ÷ cơ sở tính ngày.
    - Tính bằng số nguyên; **làm tròn đến đồng, nửa lên**.
    - Đây chỉ là số **để so sánh**. Lãi thật theo hợp đồng dùng quy ước làm tròn của hợp đồng (T-S2, DF-22).
  - **Kiểm theo D1:** 1.000.000.000 × 6,0% × 90 ÷ 360 = **15.000.000**. Tương tự, 5,8% ra 14.500.000 và 5,9% ra 14.750.000.
  - **Hai bản chào khác cơ sở tính ngày** (360 và 365): bảng có dòng cảnh báo "Các bản chào dùng cơ sở tính ngày khác nhau". Lãi cả kỳ vẫn tính theo cơ sở của từng bản, để so đúng số tiền thật.
  - **Xếp hạng** theo lãi cả kỳ, cao nhất lên đầu. Bản chào "Thiếu" và bản trễ hạn vẫn hiện, kèm nhãn.
- **BR-T1-09. Đề xuất kết quả chọn** (BQL, khi thư "Đã hết hạn nhận"). Mã `KQ-TGNN`; mỗi thư có nhiều nhất một kết quả đang hiệu lực.
  - **Ngân hàng được chọn:** đúng một ngân hàng có bản chào **Đủ hồ sơ**.
    - Bản trễ hạn chỉ chọn được khi có lý do xét trễ.
    - Bản "Thiếu" **không** chọn được.
  - **Biên bản** (mã `BB-TGNN`, tệp) và **căn cứ** (≥ 20 ký tự) bắt buộc.
  - **Nếu không chọn bản có lãi cả kỳ cao nhất** trong số các bản đủ hồ sơ:
    - đề xuất **bắt buộc** có thêm lý do (≥ 20 ký tự);
    - BQT thấy dòng cảnh báo "Không phải bản chào có lãi cả kỳ cao nhất (cao nhất: «ngân hàng» · «lãi cả kỳ»)" (D-T1-2).
  - Lúc gửi duyệt, hệ thống lưu một **bản chụp** của bảng so sánh, để kết quả luôn truy về được đúng các bản chào đã xét (D1 tr. 39).
- **BR-T1-10. Duyệt** (một BQT có phạm vi tòa):
  - **Duyệt:** kết quả "Đã duyệt", thư chuyển "Đã chọn ngân hàng".
  - **Yêu cầu sửa** (lý do): kết quả về "Cần sửa".
  - **Từ chối** (lý do): kết quả "Bị từ chối".
  - Người đề xuất không tự duyệt.
  - "**Không chọn được ngân hàng**" là một loại đề xuất, kèm biên bản và căn cứ, duyệt như trên. Duyệt xong thì thư chuyển "Không có kết quả".
- **BR-T1-11. Đổi kết quả đã duyệt:** chỉ được khi **chưa** có hợp đồng tiền gửi nào lập từ kết quả đó (T-S2, DF-25(2)). Cần lý do ≥ 20 ký tự và một đề xuất mới, BQT duyệt. Kết quả cũ chuyển "Đã thay thế".
- **BR-T1-12. Quyền:**
  - **Lập và sửa thư mời, ghi bản chào, đề xuất, hủy:** BQL có phạm vi tòa của quỹ.
  - **Duyệt:** BQT có phạm vi tòa.
  - **Xem thư, bản chào, bảng so sánh, kết quả:** BQL, BQT, và **kế toán** (cần cho T-S2), trong phạm vi tòa.
  - KT, TVKT: không thấy.
  - Ngoài phạm vi tòa: 404.
  - Cần các quyền mới cho tiền gửi. Dev-build đặt tên, cập nhật ma trận quyền và tài liệu RM.
  - Mọi thao tác ghi có nhật ký, kèm lý do nếu có, và khóa phiên bản.
- **BR-T1-13. Seed demo** (theo D1, cho tòa demo):
  - ngân hàng A, B, C;
  - **MC-001** "Đã chọn ngân hàng": 1.000.000.000, 90 ngày, cả 3 ngân hàng có bản chào "Đủ hồ sơ" với cơ sở 360: A 5,8%, B 6,0%, C 5,9%. **KQ-TG01** chọn B, "Đã duyệt", biên bản BB-TG01;
  - **MC-002** "Đang nhận bản chào", hạn phản hồi hôm nay + 3 ngày, 2/3 ngân hàng đã phản hồi.

  Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "bây giờ" được cố định. Dữ liệu dùng tòa demo, tài khoản `bql-a`, BQT của tòa A và kế toán của tòa A.

**Ngân hàng và thư mời**
- **AC-T1.1** Tạo hai ngân hàng cùng tên và cùng chi nhánh: lần thứ hai bị từ chối. Cùng tên, khác chi nhánh: được.
- **AC-T1.2** BQL soạn MC thiếu tệp thư mời, hoặc không có ngân hàng nào: "Ghi nhận gửi" bị từ chối, báo đúng chỗ thiếu. Đủ trường thì thư "Đang nhận bản chào", có nhật ký.
- **AC-T1.3** Sửa số tiền hoặc kỳ hạn của thư đã gửi: bị từ chối. Gia hạn hạn phản hồi kèm lý do: được. Rút ngắn: bị từ chối.
- **AC-T1.4** Đến hạn phản hồi, thư tự chuyển "Đã hết hạn nhận" mà không cần ai mở web.

**Bản chào và so sánh**
- **AC-T1.5** (D1 tr. 33) Thư mời 3 ngân hàng, đã ghi 2 bản chào: thư hiện "2/3 ngân hàng đã phản hồi"; ngân hàng thứ ba "Còn chờ".
- **AC-T1.6** Lãi suất nhập "5,8755" (4 chữ số thập phân): bị từ chối. "5,875" thì được, và được lưu là 5875.
- **AC-T1.7** (D1 tr. 34) Thư 1.000.000.000, 90 ngày; ba bản chào cơ sở 360 là 5,8%, 6,0%, 5,9%: bảng so sánh có lãi cả kỳ **14.500.000; 15.000.000; 14.750.000**, xếp B (6,0%) lên đầu.
- **AC-T1.8** Một bản chào dùng cơ sở 365: lãi cả kỳ tính theo 365, và bảng có cảnh báo "khác cơ sở tính ngày".
- **AC-T1.9** Hạn phản hồi 27/08 17:00. Bản chào có thời điểm nhận 27/08 16:00 nhưng ghi ngày 28/08: không trễ hạn. Thời điểm nhận 27/08 18:00: có cờ "Trễ hạn".

**Kết quả chọn**
- **AC-T1.10** Đề xuất chọn một bản "Thiếu": bị từ chối. Chọn B (cao nhất, đủ hồ sơ) kèm biên bản và căn cứ: "Chờ duyệt", kèm bản chụp bảng so sánh. BQL tự duyệt: 403. BQT duyệt: thư "Đã chọn ngân hàng".
- **AC-T1.11** Đề xuất chọn C (5,9%, không phải cao nhất) mà không có lý do thêm: bị từ chối. Có lý do thì được, và BQT thấy cảnh báo "Không phải bản chào có lãi cả kỳ cao nhất (cao nhất: B · 15.000.000)".
- **AC-T1.12** Chọn bản trễ hạn mà không có lý do xét trễ: bị từ chối.
- **AC-T1.13** Thư không có bản nào đủ hồ sơ: đề xuất "Không chọn được ngân hàng", BQT duyệt, thư thành "Không có kết quả".
- **AC-T1.14** Đổi kết quả đã duyệt khi chưa có hợp đồng tiền gửi: được, kèm lý do; kết quả cũ "Đã thay thế". Chặn đổi khi đã có hợp đồng: chỉ có e2e sau khi có T-S2. Ở slice này dev-build ghi rõ là để dành cho T-S2.

**Quyền và chung**
- **AC-T1.15**
  - Kế toán tòa A xem được MC-001, bảng so sánh và KQ-TG01, nhưng không có nút ghi.
  - KT không thấy gì của nhóm T.
  - `bql-b` mở MC-001 của tòa A: 404.
- **AC-T1.16** Mỗi tòa có đúng một quỹ `BAO_TRI` sau migration. Không có API nào trả số dư cộng quỹ bảo trì với quỹ khai thác.
- **AC-T1.17** Seed demo tạo đúng BR-T1-13 trên DB mới; chạy lại không tạo trùng.
- **AC-T1.18** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Test của nhóm F vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test lãi cả kỳ: ví dụ D1, cơ sở 365, làm tròn nửa lên, số lớn (không tràn), lãi suất 3 chữ số thập phân lưu dạng số nguyên.
- [ ] e2e API:
  - ngân hàng (trùng tên và chi nhánh);
  - thư mời: các trạng thái, gửi thiếu trường, sửa sau khi gửi, gia hạn, rút ngắn, tự hết hạn;
  - bản chào: một bản mỗi ngân hàng, ngoài danh sách, trễ hạn theo thời điểm nhận;
  - so sánh;
  - kết quả: bản thiếu, không cao nhất cần lý do, trễ hạn, tự duyệt 403, yêu cầu sửa, từ chối, không chọn được, đổi kết quả;
  - quyền; quỹ `BAO_TRI` mỗi tòa một.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của F-S4.
- [ ] Test component: tiến độ "k/n", bảng so sánh (xếp hạng, cảnh báo cơ sở), form đề xuất (cảnh báo không cao nhất).
- [ ] Ảnh chụp ở chế độ `api`: thư mời đang nhận (2/3), bảng so sánh, kết quả chờ duyệt (góc nhìn BQT), màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-T1-1 | BQL lập thư mời và đề xuất; một BQT duyệt | Theo D1 (BQL làm T01; "Vai trò duyệt" ở T02) và cách đã duyệt ở F-S2 (D-F2-1) |
| D-T1-2 | Không bắt buộc chọn lãi cao nhất; nhưng không chọn bản cao nhất thì phải có lý do, và BQT thấy cảnh báo | Lãi suất không phải tiêu chí duy nhất (độ an toàn của ngân hàng, điều kiện rút trước hạn), nhưng lệch khỏi bản cao nhất phải có căn cứ |
| D-T1-3 | Lãi cả kỳ ở bảng so sánh làm tròn đến đồng, nửa lên; chỉ để so sánh | Quy ước làm tròn thật thuộc hợp đồng (DF-22, T-S2) |
| D-T1-4 | Số tiền và kỳ hạn của thư không đổi sau khi gửi | Mọi bản chào phải cùng điều kiện (D1 tr. 34) |
| D-T1-5 | Kỳ hạn tính bằng ngày | D1 dùng "90 ngày"; lãi tính theo ngày ÷ cơ sở |
| D-T1-6 | Kế toán xem được thư, bản chào và kết quả | Kế toán lập hợp đồng ở T-S2. Lãi suất chào không phải thông tin cạnh tranh như giá chào khai thác |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 28/10/2026 | Viết từ phân tích nhóm T (26/10) và các mặc định DF-20 đến DF-26 (PD-09), theo yêu cầu của chủ dự án. |
| 28/10/2026 | Chủ dự án duyệt (PD-37), gồm D-T1-1 đến D-T1-6, và cho giao dev-build. |
| 28/10/2026 | Merge vào `main` (`e8183ed`, cùng T-S1 và RM-S2); trạng thái `Đã triển khai`. |
