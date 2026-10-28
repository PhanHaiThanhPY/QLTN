---
id: T.S2
title: Quỹ bảo trì, quy chế và hợp đồng tiền gửi có lịch lãi
status: Đã duyệt
owner: PM/BA
intent: "Tiền quỹ bảo trì chỉ được gửi có kỳ hạn theo quy chế đã thông qua; mỗi hợp đồng tiền gửi có gốc, lãi suất, quy ước tính lãi và lịch lãi rõ ràng, và gốc đang gửi không bao giờ bị cộng trùng với tiền trên tài khoản."
depends_on: [T.S1]
---

# SPEC: Quỹ bảo trì, quy chế và hợp đồng tiền gửi có lịch lãi (T-S2)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 28/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 28/10/2026 (PD-39), gồm 6 mặc định D-T2-1 đến D-T2-6 ở §6. Bắt đầu build sau khi T-S1 đạt review

**Nguồn:**
- Phân tích [T-tien-gui-quy-bao-tri.md](../../modules/T-tien-gui-quy-bao-tri.md): §2 T03 (và T04 phần lịch lãi), §3 dữ liệu, §5 slice T-S2.
- D1 tr. 35 (T03 "Hợp đồng tiền gửi": TG-001, Ngân hàng B, gốc 1.000 triệu, 6%/năm, 90 ngày, gửi 01/09/2026, đáo hạn 30/11/2026, lãi 15 triệu, 3 kỳ trả lãi mỗi 30 ngày, mỗi kỳ 5 triệu); tr. 36 (lịch nhận lãi: L-001 01/10, L-002 31/10, kỳ cuối 30/11); tr. 4 ("Không cộng trùng tiền gốc"); tr. 39 ("Liên kết bản ký, gốc, lãi suất, đáo hạn; lọc đúng tòa/ngân hàng").
- Mặc định đã duyệt (PD-09):
  - DF-20: mỗi tòa có quỹ bảo trì và tài khoản riêng;
  - DF-21: quy chế thu chi của quỹ (kỳ hạn cho phép, đồng chủ tài khoản, tệp quy chế đã được hội nghị thông qua); hợp đồng kiểm theo quy chế;
  - DF-22: **quy ước tính ngày và cách làm tròn là trường bắt buộc của từng hợp đồng**, không có mặc định chung;
  - DF-23: lãi tiền gửi ghi tăng quỹ bảo trì;
  - DF-25(3): phụ lục tạo phiên bản mới, kỳ lãi chưa nhận được sinh lại;
  - DF-26: sao kê gắn theo tài khoản.
- Mô hình tiền đã duyệt ở F-S3 (PD-34) và F-S4 (PD-35); D-F3-4 ("Chuyển sang quỹ khác" chỉ ghi phía chi cho đến khi có nhóm T).

**Nền:** [T-S1](../T-chao-lai-chon-ngan-hang/SPEC.md) (ngân hàng, quỹ `BAO_TRI`, kết quả chọn KQ-TG), [F-S3](../F-thu-chi-quy-khai-thac/SPEC.md) (quỹ, tài khoản, sổ quỹ, không âm), [F-S4](../F-sao-ke-doi-soat/SPEC.md) (sao kê theo tài khoản). Slice này chỉ bắt đầu build **sau khi T-S1 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau T-S1, đã chọn được ngân hàng nhưng chưa ghi được hợp đồng tiền gửi nào. Quỹ bảo trì cũng chưa có tài khoản và sổ.

Slice này làm bốn việc:
- **Kích hoạt quỹ bảo trì:** tài khoản, số dư đầu và sổ quỹ, dùng nguyên mô hình của F-S3.
- **Quy chế thu chi** của quỹ (DF-21): kỳ hạn được phép gửi, đồng chủ tài khoản, tệp quy chế.
- **Hợp đồng tiền gửi (T03)** lập từ kết quả chọn, có quy ước tính lãi riêng và **lịch lãi** sinh tự động. Khi ghi nhận gửi tiền, tiền ra khỏi tài khoản và trở thành **gốc đang gửi**.
- Ghi nhận **tiền chuyển đến** quỹ bảo trì từ quỹ khai thác, khép nốt D-F3-4.

Nhận lãi và đối chiếu sao kê làm ở **T-S3**. Tất toán và tái tục làm ở **T-S4**.

**Người dùng:**
- Chính: kế toán thiết lập quỹ, nhập quy chế, lập hợp đồng và ghi nhận gửi tiền.
- Chính: BQT duyệt quy chế, và duyệt hợp đồng khi điều khoản khác kết quả chọn.
- Phụ: BQL xem.

**User story:**
- Là kế toán, tôi muốn lập hợp đồng TG-001 từ kết quả chọn Ngân hàng B, và hệ thống tự ra lịch 3 kỳ lãi, mỗi kỳ 5 triệu.
- Là BQT, tôi muốn hệ thống không cho gửi kỳ hạn dài hơn quy chế cho phép.
- Là BQT, tôi muốn thấy tài sản quỹ bảo trì gồm tiền trên tài khoản và gốc đang gửi, không bao giờ cộng trùng.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Quỹ bảo trì:** tài khoản, số dư đầu, sổ quỹ, dùng nguyên chức năng của F-S3, chọn được loại quỹ (BR-T2-01).
2. **Quy chế thu chi:** nhập, BQT duyệt, có phiên bản (BR-T2-02).
3. **Hợp đồng tiền gửi (T03):** soạn từ kết quả chọn, kiểm theo quy chế, BQT duyệt khi khác kết quả chọn, ghi ký, ghi nhận gửi tiền, hủy nháp (BR-T2-03 đến BR-T2-07).
4. **Lịch lãi:** sinh khi hợp đồng có hiệu lực; trạng thái kỳ theo ngày đến hạn (BR-T2-08, BR-T2-09).
5. **Phụ lục:** đổi lãi suất hoặc cách trả lãi từ một ngày hiệu lực, sinh lại kỳ chưa đến hạn (BR-T2-10).
6. **Gốc đang gửi và tài sản quỹ** (BR-T2-11).
7. **Tiền chuyển đến** quỹ bảo trì từ một phiếu chi "Chuyển sang quỹ khác" của quỹ khai thác (BR-T2-12).
8. **Màn hình:**
   - trong nhóm "Tiền gửi quỹ bảo trì": "Sổ quỹ bảo trì", "Quy chế", "Hợp đồng tiền gửi";
   - trang hợp đồng có tab "Lịch lãi".
9. **Chặn đổi kết quả chọn** của T-S1 khi đã có hợp đồng (AC-T1.14).
10. **Seed demo** theo D1 tr. 35–36 (BR-T2-14).

**Ngoài phạm vi:**
- Ghi nhận lãi thực nhận, nhận thiếu, đối chiếu lãi với sao kê (T-S3). Ở slice này kỳ lãi chỉ có trạng thái theo ngày.
- Tất toán, tất toán trước hạn, tái tục (T-S4, DF-24).
- Tổng quan và báo cáo quỹ bảo trì (T-S5).
- Lãi nhập gốc (DF-24, làm cùng tái tục).
- Chi từ quỹ bảo trì cho sửa chữa (nối B09 với quỹ). Chưa có yêu cầu trong D1 cho nhóm T. Ghi vào câu hỏi TQ-07 (§6).
- Kết nối ngân hàng, chuyển tiền thật (D1 tr. 45).
- Chế độ `mock`: không có màn T.

## 3. Quy tắc nghiệp vụ

### 3.1 Quỹ và quy chế

- **BR-T2-01. Quỹ bảo trì dùng nguyên mô hình F-S3:**
  - tài khoản (số tài khoản đầy đủ với kế toán và BQT);
  - số dư đầu theo sao kê tại ngày bắt đầu sổ;
  - sổ với dòng bất biến và dòng đảo;
  - số dư theo sổ;
  - **không âm ở bất kỳ ngày nào** (BR-F3-13);
  - sao kê và đối soát của F-S4.

  Màn "Sổ quỹ" có ô chọn **loại quỹ** (Khai thác / Bảo trì). Không có màn hay bảng riêng cho quỹ bảo trì.
  - **Nhóm dòng mới** cho quỹ bảo trì:

    | Nhóm | Chiều | Nguồn |
    |---|---|---|
    | Gửi tiền có kỳ hạn | Chi | ghi nhận gửi tiền của hợp đồng (BR-T2-07) |
    | Nhận chuyển từ quỹ khác | Thu | tiền chuyển đến (BR-T2-12) |
    | Thu hồi gốc, Lãi tiền gửi | Thu | T-S3, T-S4 (chưa dùng ở slice này) |

- **BR-T2-02. Quy chế thu chi** (DF-21), mỗi quỹ bảo trì có **một quy chế đang hiệu lực**:
  - **Trường:**
    - kỳ hạn gửi được phép: **tối thiểu** và **tối đa**, tính bằng ngày;
    - đồng chủ tài khoản: 1–5 người, gồm họ tên và chức danh;
    - ngày hội nghị thông qua;
    - tệp quy chế (bắt buộc);
    - ghi chú.
  - **Duyệt:** kế toán nhập; **BQT duyệt** thì quy chế mới có hiệu lực. Sửa quy chế đang hiệu lực tạo **phiên bản mới**, cũng phải BQT duyệt. Phiên bản cũ vẫn xem được.
  - **Chưa có quy chế hiệu lực** thì không lập được hợp đồng tiền gửi cho quỹ đó.

### 3.2 Hợp đồng tiền gửi (T03)

- **BR-T2-03. Soạn hợp đồng** (kế toán, từ một kết quả chọn KQ-TG "Đã duyệt"). Mã `TG-NNN`. Một kết quả chọn có nhiều nhất một hợp đồng chưa hủy.

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Quỹ, ngân hàng | hệ thống | lấy từ thư mời và kết quả chọn; không sửa |
  | Gốc | có | số nguyên VND, > 0. Mặc định là số tiền của thư mời |
  | Lãi suất | có | %/năm, tối đa 3 chữ số thập phân, lưu dạng số nguyên (như T-S1). Mặc định lấy từ bản chào được chọn |
  | Cơ sở tính ngày | có | 360 hoặc 365. Mặc định lấy từ bản chào; **không có mặc định chung** (DF-22) |
  | Cách làm tròn tiền lãi | có | **Làm tròn đến đồng, nửa lên** hoặc **Làm tròn xuống đến đồng**. **Không có mặc định**; kế toán chọn theo hợp đồng thật (DF-22) |
  | Ngày gửi | có | ngày tiền rời tài khoản quỹ |
  | Kỳ hạn | có | số ngày. Mặc định lấy từ thư mời. Phải nằm trong khoảng quy chế cho phép (BR-T2-02) |
  | Ngày đáo hạn | hệ thống | ngày gửi + kỳ hạn. Ví dụ D1: 01/09/2026 + 90 ngày = **30/11/2026** |
  | Cách trả lãi | có | **Cuối kỳ**, hoặc **định kỳ mỗi N ngày** (1–365), hoặc **mỗi N tháng** (1–12). Mặc định lấy từ bản chào |
  | Số hợp đồng hoặc số tài khoản tiền gửi tại ngân hàng | không | chữ, tối đa 100 ký tự |
  | Ghi chú | không | |

- **BR-T2-04. Khác kết quả chọn:**
  - Hợp đồng có **gốc, lãi suất, cơ sở tính ngày, kỳ hạn hoặc cách trả lãi** khác bản chào được chọn hay thư mời thì:
    - kế toán phải ghi lý do (≥ 20 ký tự);
    - hợp đồng cần **BQT duyệt** trước khi ghi ký.
  - Giống hệt bản chào thì không cần duyệt thêm, vì kết quả chọn đã được BQT duyệt (D-T2-1).
- **BR-T2-05. Lãi theo hợp đồng:**
  - Lãi cả kỳ = gốc × lãi suất × kỳ hạn (ngày) ÷ cơ sở, **làm tròn theo cách của hợp đồng**.
  - Tính hoàn toàn bằng số nguyên.
  - Ví dụ D1: 1.000.000.000 × 6,0% × 90 ÷ 360 = **15.000.000**.
- **BR-T2-06. Trạng thái hợp đồng:**

  | Từ | Thao tác | Ai | Đến |
  |---|---|---|---|
  | — | Soạn | kế toán | **Nháp** |
  | Nháp (có khác biệt) | Gửi duyệt | kế toán | **Chờ duyệt** |
  | Chờ duyệt | Duyệt / Yêu cầu sửa / Từ chối (lý do) | BQT | **Đã duyệt** / **Nháp** / **Bị từ chối** |
  | Nháp (không khác biệt), Đã duyệt | Ghi ký: tệp bản ký, ngày ký ≤ hôm nay | kế toán | **Đã ký** |
  | Đã ký | Ghi nhận gửi tiền (BR-T2-07) | kế toán | **Đang gửi** |
  | Nháp, Chờ duyệt, Đã duyệt, Đã ký | Hủy (lý do ≥ 10 ký tự) | kế toán | **Đã hủy** |

  - **"Đang gửi" không hủy được.** Kết thúc hợp đồng là tất toán hoặc tái tục (T-S4).
  - Bản ký đã có thì không sửa trường nào được nữa; muốn đổi thì làm phụ lục, khi hợp đồng đã "Đang gửi" (BR-T2-10).
- **BR-T2-07. Ghi nhận gửi tiền:**
  - Kế toán ghi ngày tiền rời tài khoản (phải bằng ngày gửi), kèm chứng từ chuyển tiền.
  - Hệ thống ghi **một dòng sổ** Chi, nhóm "Gửi tiền có kỳ hạn", số tiền bằng gốc. Dòng này ghép được với dòng sao kê −gốc của tài khoản quỹ (F-S4).
  - **Không âm:** số dư theo sổ của tài khoản quỹ tại ngày gửi, và mọi ngày sau đó, phải ≥ 0 (BR-F3-13). Thiếu tiền thì chặn, kèm câu "Số dư quỹ không đủ để gửi: còn «X» đ tại «ngày»."
  - Ghi xong: hợp đồng "Đang gửi", lịch lãi được sinh (BR-T2-08), gốc được cộng vào **gốc đang gửi** của quỹ (BR-T2-11).
  - Ghi nhầm thì hủy chứng từ gửi tiền theo BR-F3-04 (dòng đảo, chặn nếu đã đối soát). Hợp đồng về "Đã ký", lịch lãi bị xóa, gốc đang gửi giảm. Chỉ làm được khi chưa có kỳ lãi nào được ghi nhận (T-S3).

### 3.3 Lịch lãi

- **BR-T2-08. Sinh lịch lãi** khi hợp đồng chuyển "Đang gửi":
  - **Cuối kỳ:** một kỳ, từ ngày gửi đến ngày đáo hạn.
  - **Định kỳ mỗi N ngày:** kỳ thứ k kết thúc ở ngày gửi + k × N ngày. Kỳ cuối kết thúc ở ngày đáo hạn, có thể ngắn hơn.
  - **Định kỳ mỗi N tháng:** kỳ thứ k kết thúc ở ngày gửi + k × N tháng. Ngày bị cắt về cuối tháng khi tháng ngắn hơn, và mỗi kỳ tính lại từ ngày gửi nên không trôi ngày. Kỳ cuối kết thúc ở ngày đáo hạn.
  - **Ngày đến hạn** của một kỳ = ngày kết thúc kỳ.
  - **Lãi của mỗi kỳ** = gốc × lãi suất × số ngày của kỳ ÷ cơ sở, làm tròn theo hợp đồng. **Riêng kỳ cuối** = lãi cả kỳ (BR-T2-05) − tổng lãi các kỳ trước. Nhờ vậy tổng lãi các kỳ luôn đúng bằng lãi theo hợp đồng, không lệch vì làm tròn (D-T2-2).
  - **Ví dụ D1** (mỗi 30 ngày, gửi 01/09/2026, 90 ngày):

    | Kỳ | Ngày đến hạn | Số ngày | Lãi |
    |---|---|---|---|
    | L-001 | 01/10/2026 | 30 | 5.000.000 |
    | L-002 | 31/10/2026 | 30 | 5.000.000 |
    | L-003 | 30/11/2026 | 30 | 5.000.000 |

    Tổng **15.000.000**, khớp D1 tr. 35–36.
- **BR-T2-09. Trạng thái kỳ lãi ở slice này:**
  - **Chưa đến kỳ:** hôm nay < ngày đến hạn;
  - **Đến hạn:** hôm nay = ngày đến hạn;
  - **Quá hạn:** hôm nay > ngày đến hạn.

  Trạng thái được cập nhật mỗi ngày bằng bộ lịch chạy dùng chung. T-S3 thêm "Đã nhận" và "Nhận thiếu". D1 tr. 36: "Khoản chưa đến kỳ không tính là quá hạn."
- **BR-T2-10. Phụ lục** (hợp đồng "Đang gửi"; kế toán lập, **BQT duyệt**). Mã `PL-TGNN`.
  - **Được đổi:** lãi suất, cách trả lãi. Gốc và ngày đáo hạn **không** đổi bằng phụ lục: đổi gốc là gửi thêm hay rút bớt, thuộc tất toán và tái tục (T-S4).
  - **Cần:** ngày hiệu lực (≥ hôm nay), tệp phụ lục, lý do.
  - **Duyệt xong:**
    - hợp đồng có phiên bản mới;
    - các kỳ lãi có ngày đến hạn **sau** ngày hiệu lực được sinh lại theo điều khoản mới, tính lãi theo hai đoạn trước và sau ngày hiệu lực (D-T2-3);
    - kỳ đến hạn trước ngày hiệu lực giữ nguyên;
    - T-S3 sẽ thêm điều kiện: kỳ đã có lãi thực nhận thì không sinh lại.
  - Lãi theo hợp đồng được tính lại bằng tổng các kỳ.

### 3.4 Gốc đang gửi, tài sản quỹ, tiền chuyển đến

- **BR-T2-11. Gốc đang gửi và tài sản quỹ:**
  - **Gốc đang gửi** của quỹ = Σ gốc của các hợp đồng "Đang gửi". Một khoản gốc **chỉ thuộc một hợp đồng** (D1 tr. 4, 39).
  - **Tài sản quỹ bảo trì** tại ngày D = số dư theo sổ của tài khoản + gốc đang gửi.
  - Gửi tiền làm số dư tài khoản giảm và gốc đang gửi tăng cùng một số, nên **tài sản quỹ không đổi** (D1: "không cộng trùng").
  - Trang quỹ bảo trì hiện ba số: số dư tài khoản, gốc đang gửi, tài sản quỹ. Không màn nào cộng gốc đang gửi vào "số dư tài khoản".
- **BR-T2-12. Tiền chuyển đến từ quỹ khác** (khép D-F3-4):
  - Kế toán ghi nhận ở quỹ bảo trì: chọn **một phiếu chi "Chuyển sang quỹ khác" đã chi** của quỹ khai thác cùng tòa, đích là quỹ bảo trì; ngày nhận; chứng từ.
  - **Số tiền bằng đúng phiếu chi.**
  - Hệ thống ghi một dòng Thu "Nhận chuyển từ quỹ khác" ở quỹ bảo trì, liên kết với phiếu chi.
  - Mỗi phiếu chi chỉ được ghi nhận nhận tiền **một lần**.
  - Phiếu chi chưa được ghi nhận ở quỹ nhận thì hiện "Chưa ghi nhận ở quỹ nhận", ở cả hai quỹ.

### 3.5 Chung

- **BR-T2-13. Quyền:**
  - **Kế toán** (`FUND_OPERATE`, phạm vi tòa): thiết lập quỹ bảo trì, nhập quy chế, lập, gửi duyệt và hủy hợp đồng, ghi ký, ghi nhận gửi tiền, lập phụ lục, ghi nhận tiền chuyển đến.
  - **BQT:** duyệt quy chế, hợp đồng có khác biệt, và phụ lục; xem tất cả.
  - **BQL:** xem quy chế, hợp đồng, lịch lãi. **Không** xem sổ quỹ (D-F3-6).
  - KT, TVKT: không thấy.
  - Ngoài phạm vi tòa: 404.
  - Dùng lại `FUND_VIEW` và `FUND_APPROVE` của F-S3, cùng quyền tiền gửi của T-S1. Thêm quyền mới chỉ khi cần; cập nhật ma trận quyền và tài liệu RM.
  - Mọi thao tác ghi có nhật ký, kèm lý do nếu có, và khóa phiên bản.
- **BR-T2-14. Seed demo** (quỹ bảo trì Aqua 1, nối tiếp T-S1):
  - tài khoản ****0002; số dư đầu **1.200.000.000** ngày 01/08;
  - quy chế đã duyệt: kỳ hạn 30–365 ngày, 2 đồng chủ tài khoản;
  - **TG-001** từ KQ-TG01: Ngân hàng B, 1.000.000.000, 6,0%, cơ sở 360, làm tròn nửa lên, gửi 01/09, 90 ngày, trả lãi mỗi 30 ngày; "Đang gửi";
  - dòng sổ "Gửi tiền có kỳ hạn" −1.000.000.000 ngày 01/09;
  - lịch lãi 3 kỳ × 5.000.000.

  Trang quỹ ra: số dư tài khoản 200.000.000, gốc đang gửi 1.000.000.000, tài sản quỹ 1.200.000.000. Ngày được dời theo ngày chạy seed, giữ đúng khoảng cách và số tiền. Chỉ thêm khi chưa có; không chạy ở production.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu là quỹ bảo trì Aqua 1, KQ-TG01 (Ngân hàng B, 6,0%, cơ sở 360, mỗi 30 ngày), thư mời 1.000.000.000, 90 ngày.

**Quỹ và quy chế**
- **AC-T2.1** Màn "Sổ quỹ" chọn loại "Bảo trì": thiết lập tài khoản và số dư đầu như quỹ khai thác. Hai quỹ của cùng tòa có số liệu riêng; không có số dư nào cộng chung hai quỹ.
- **AC-T2.2** Lập TG khi quỹ chưa có quy chế hiệu lực: bị từ chối, kèm câu "Quỹ chưa có quy chế được duyệt." Kế toán nhập quy chế 30–365 ngày; kế toán tự duyệt: 403; BQT duyệt: hiệu lực.

**Hợp đồng**
- **AC-T2.3** (D1 tr. 35) Soạn TG từ KQ-TG01: ngân hàng B, gốc 1.000.000.000, lãi suất 6,0%, cơ sở 360, mỗi 30 ngày điền sẵn. Ô làm tròn **trống** và bắt buộc chọn. Ngày gửi 01/09/2026: ngày đáo hạn **30/11/2026**, lãi theo hợp đồng **15.000.000**.
- **AC-T2.4** Kỳ hạn 400 ngày khi quy chế tối đa 365: bị từ chối ở trường kỳ hạn, nêu khoảng cho phép.
- **AC-T2.5** Đổi lãi suất thành 6,1% so với bản chào: bắt buộc lý do. Hợp đồng phải "Chờ duyệt", và kế toán ghi ký trước khi BQT duyệt thì bị từ chối. Giữ đúng như bản chào: ghi ký được ngay.
- **AC-T2.6** Ghi nhận gửi tiền ngày 01/09:
  - sổ quỹ bảo trì có dòng "Gửi tiền có kỳ hạn" −1.000.000.000;
  - hợp đồng "Đang gửi";
  - lịch có 3 kỳ: 01/10, 31/10, 30/11, mỗi kỳ 5.000.000;
  - trang quỹ: số dư tài khoản 200.000.000, gốc đang gửi 1.000.000.000, tài sản 1.200.000.000.
- **AC-T2.7** Quỹ chỉ còn 500.000.000 mà ghi nhận gửi 1.000.000.000: bị chặn, kèm câu của BR-T2-07.
- **AC-T2.8** Hủy hợp đồng "Đang gửi": không có nút, và gọi API thì bị từ chối. Hủy chứng từ gửi tiền khi chưa đối soát: hợp đồng về "Đã ký", lịch lãi xóa, gốc đang gửi giảm 1.000.000.000.

**Lịch lãi**
- **AC-T2.9** Cùng hợp đồng nhưng cơ sở 365, làm tròn xuống: lãi mỗi kỳ 30 ngày = 4.931.506 (1.000.000.000 × 6% × 30 ÷ 365 = 4.931.506,8 → làm tròn xuống). Lãi cả kỳ = 14.794.520. Kỳ cuối = 14.794.520 − 2 × 4.931.506 = **4.931.508**. Tổng 3 kỳ đúng bằng lãi cả kỳ.
- **AC-T2.10** Trả lãi "mỗi 1 tháng", gửi 31/01/2027, kỳ hạn 90 ngày (đáo hạn 01/05/2027): có **4 kỳ**, đến hạn 28/02/2027 (cắt cuối tháng), 31/03/2027, 30/04/2027, và kỳ cuối 1 ngày đến **01/05/2027**.
- **AC-T2.11** Hôm nay 05/10/2026: L-001 (01/10) "Quá hạn", L-002 "Chưa đến kỳ". Hôm nay 31/10: L-002 "Đến hạn". Lần chạy hằng ngày cập nhật mà không cần ai mở web.
- **AC-T2.12** Phụ lục đổi lãi suất thành 5,0%, hiệu lực 15/10/2026, BQT duyệt:
  - hợp đồng phiên bản 2; L-001 (01/10) giữ 5.000.000;
  - L-002 (31/10) tính 14 ngày ở 6,0% (01/10–14/10) và 16 ngày ở 5,0% (15/10–30/10) = 2.333.333 + 2.222.222 = 4.555.555 (nửa lên, làm tròn từng đoạn);
  - L-003 tính ở 5,0%.

  Phụ lục đổi gốc: không có trường gốc, và gọi API với gốc thì bị từ chối.

**Chuyển quỹ, chặn đổi kết quả**
- **AC-T2.13** Quỹ khai thác Aqua 1 có phiếu chi PC "Chuyển sang quỹ khác → Bảo trì" 30.000.000 đã chi. Ghi nhận ở quỹ bảo trì: dòng Thu 30.000.000 liên kết PC. Ghi nhận lần hai, hoặc ghi số tiền khác: bị từ chối. Phiếu chưa ghi nhận có nhãn "Chưa ghi nhận ở quỹ nhận" ở cả hai quỹ.
- **AC-T2.14** (bổ sung AC-T1.14) Đổi KQ-TG01 khi TG-001 đã có: bị từ chối.

**Quyền và chung**
- **AC-T2.15** BQL xem được TG-001 và lịch lãi, nhưng không mở được sổ quỹ bảo trì. KT không thấy gì. Kế toán tòa B mở TG-001 của tòa A: 404.
- **AC-T2.16** Seed demo cho ra đúng BR-T2-14 trên DB mới; chạy lại không tạo trùng.
- **AC-T2.17** Các trạng thái loading, rỗng, lỗi, offline, accessibility, responsive (375px) đúng brief. Test của nhóm F và T-S1 vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test:
  - ngày đáo hạn;
  - lịch lãi: cuối kỳ, mỗi N ngày, mỗi N tháng (cắt cuối tháng), kỳ cuối ngắn;
  - lãi từng kỳ, hai cách làm tròn, kỳ cuối khử sai số;
  - phụ lục tính hai đoạn (AC-T2.9, AC-T2.10, AC-T2.12);
  - số lớn không tràn.
- [ ] e2e API:
  - quy chế (chưa có thì chặn, BQT duyệt, phiên bản);
  - hợp đồng: các trạng thái, kỳ hạn ngoài quy chế, khác bản chào cần BQT, ghi ký, gửi tiền không âm, hủy chứng từ gửi;
  - lịch lãi và trạng thái theo ngày; phụ lục;
  - gốc đang gửi và tài sản quỹ;
  - chuyển quỹ một lần; chặn đổi KQ-TG;
  - quyền.
- [ ] Tiền và lãi suất là số nguyên trên mọi đường; không có phép tính số thực.
- [ ] Migration mới chạy được trên `qltn_dev`, sau migration của T-S1.
- [ ] Test component: form hợp đồng (điền sẵn, ô làm tròn trống, cảnh báo khác bản chào), bảng lịch lãi, ba số của quỹ.
- [ ] Ảnh chụp ở chế độ `api`: trang TG-001 và tab Lịch lãi, sổ quỹ bảo trì có dòng gửi tiền, trang quy chế, màn rộng 375px.

## 6. Mặc định PM/BA và câu hỏi mới

| ID | Mặc định | Lý do |
|---|---|---|
| D-T2-1 | Hợp đồng giống hệt bản chào đã duyệt thì không cần BQT duyệt lại; khác thì cần | BQT đã duyệt kết quả chọn; chỉ phần khác biệt mới cần quyết định mới |
| D-T2-2 | Kỳ lãi cuối nhận phần còn lại, để tổng các kỳ đúng bằng lãi theo hợp đồng | Tránh lệch vài đồng do làm tròn từng kỳ; khớp cách ngân hàng tất toán |
| D-T2-3 | Phụ lục tính lãi hai đoạn trước và sau ngày hiệu lực, làm tròn từng đoạn | Lãi suất mới chỉ áp dụng từ ngày hiệu lực. **Cần khách xác nhận** cách ngân hàng tính thật |
| D-T2-4 | Phụ lục không đổi gốc và ngày đáo hạn | Đổi gốc là gửi thêm hay rút, thuộc tất toán và tái tục (T-S4) |
| D-T2-5 | Ghi nhận gửi tiền là một dòng Chi "Gửi tiền có kỳ hạn" của tài khoản quỹ; gốc theo dõi riêng | Đúng với sao kê tài khoản; tài sản quỹ = tài khoản + gốc đang gửi, không cộng trùng |
| D-T2-6 | Kế toán nhập quy chế; BQT duyệt | Quy chế do hội nghị thông qua; BQT chịu trách nhiệm áp dụng |

**Câu hỏi mới cho khách** (thêm vào OD-16):
- **TQ-07:** Quỹ bảo trì có chi trực tiếp cho hồ sơ sửa chữa (B09) không? Nếu có, chi từ tài khoản quỹ hay từ tài khoản khác? Mặc định: chưa nối, hai luồng theo dõi riêng.
- **TQ-08:** Khi đổi lãi suất giữa kỳ, ngân hàng tính lãi theo hai đoạn như D-T2-3 hay cách khác?

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 28/10/2026 | Viết từ phân tích nhóm T và DF-20 đến DF-26 (PD-09), sau T-S1 (PD-37). |
| 28/10/2026 | Chủ dự án duyệt (PD-39), gồm D-T2-1 đến D-T2-6, và cho giao dev-build (bắt đầu sau khi T-S1 đạt review). Quyền xem của T-S2 cấp cho ADMIN theo BR-RM2-02 (PD-38). |
