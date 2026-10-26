# SPEC — Luồng hồ sơ sửa chữa sau "Chờ xác nhận" (B03–B09), phiên bản 2

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Đã triển khai` (26/10/2026: S1–S4 đạt review, chưa merge, chưa nghiệm thu với khách). Chủ dự án duyệt v2 ngày 26/10/2026 (PD-12)

**Phiên bản**
- v1 được duyệt 26/10/2026 (PD-04), lưu tại [supporting/SPEC-v1-2026-10-26.md](supporting/SPEC-v1-2026-10-26.md).
- v2 thay toàn bộ S2–S4 của v1. S1 của v1 **đã triển khai**, xem [handoff.md](handoff.md).

**Căn cứ**
- [PRODUCT-DEFAULTS](../../PRODUCT-DEFAULTS.md), đã duyệt theo PD-09: DF-01 đến DF-08, DF-10.
- [ADR-0001](../../../engineering/adr/ADR-0001-role-matrix-v2.md), mục R3 và R4.
- Biểu mẫu khách D5: tờ trình (D5-TT), biên bản nghiệm thu (D5-NT), thư đề nghị thanh toán (D5-TDN), quy trình hồ sơ kỹ thuật (D5-QT).

**Phụ thuộc:** RM-S1 và RM-S2 phải xong trước (ma trận quyền v2, người xác nhận theo cấu hình, một nguồn cho chuỗi duyệt). v2 dùng mẫu cấu hình `AQUA` làm ví dụ chuẩn.

## 1. Thay đổi so với v1

| Chủ đề | v1 (quy tắc tạm theo demo) | v2 | Căn cứ |
|---|---|---|---|
| Tờ trình | 1 số tiền, 1 nhà thầu | Bảng báo giá theo hạng mục, **mặc định 3 nhà thầu**, có thuế; BQL đề xuất một nhà thầu, **BQT được chọn nhà thầu khác** | DF-03, D5-TT, D5-QT bước 4 |
| BQT duyệt | Bấm duyệt | Bắt buộc đính kèm **biên bản họp BQT**; BQT ký | DF-02, DF-07, PD-07 Q8 |
| Thi công | Bắt đầu ngay | Khi bắt đầu, BQL phát **thông báo kế hoạch** cho BQT | DF-05, D5-QT bước 6 |
| Nghiệm thu | KT và TVKT, song song khi đúng cặp | **Biên bản** gồm các thành phần cấu hình theo tòa (mẫu AQUA: BQL, BQT, TVKT), quyết định song song, mọi thành phần phải đạt, mỗi người ký | DF-06, D5-NT, ADR §4.4, PD-07 Q1 |
| Thanh toán | Một lần, đúng đủ, BQL ghi nhận | **Nhiều đợt**: tạm ứng và quyết toán; mỗi đợt có đề nghị, BQT duyệt, rồi BQT hoặc Kế toán **xác nhận đã chuyển khoản**; quyết toán cần đủ hồ sơ | DF-08, D5-TDN, D5-QT bước 9–10, PD-07 Q4 |
| Số lần trình | Tối đa 3 (quy tắc tạm) | Tối đa 3, **đã có căn cứ** | DF-04, D5-QT |

## 2. Phạm vi

**Trong phạm vi.** Mỗi slice gồm API, nối web ở chế độ `api`, test e2e và cập nhật README.

| Slice | Nội dung | Gồm phần ADR |
|---|---|---|
| **S2** | Tờ trình theo D5-TT, chuỗi duyệt theo snapshot, biên bản họp BQT, BQT chọn nhà thầu, ký, các vòng bổ sung, từ chối, tối đa 3 lần | R3: bản đồ người giữ bước thống nhất; `BOARD_MINUTES` |
| **S3** | Bắt đầu thi công kèm thông báo kế hoạch, cập nhật tiến độ, biên bản nghiệm thu nhiều thành phần, khắc phục và nghiệm thu lại | R3: bước `MANAGER` |
| **S4** | Thanh toán nhiều đợt (tạm ứng, quyết toán), xác nhận chuyển khoản, đóng hồ sơ | R4: `PAYMENT_CONFIRM` |

**Ngoài phạm vi.** Mỗi mục làm bằng SPEC riêng.
- Xử lý khẩn cấp B06 (DF-09).
- Phát hành thông báo "chưa xử lý" cho cư dân sau lần từ chối thứ 3 (DF-04). Ở đây hồ sơ chỉ chuyển sang `UNRESOLVED`.
- Giao lại người xử lý và US-S2 (DF-12).
- Xuất tờ trình, biên bản, đề nghị ra PDF hoặc bản in theo mẫu (DF-18). Ở đây chỉ có màn xem trên web.
- Hạn xử lý, công việc cá nhân, thông báo ngoài hệ thống.
- Khoản chi **vượt** số được duyệt: chặn lại. Muốn vượt thì làm hồ sơ bổ sung riêng.

## 3. Người giữ bước

Theo ADR §4.3, mỗi hồ sơ mới có bản đồ **khóa bước → người giữ** (`approvalAssigneeUserIds`), chụp lúc tạo, cho mọi bước kể cả `TECH`, `BOARD`, `MANAGER`. Hồ sơ cũ vẫn đọc theo cột cũ.

| Bước | Vai trò | Dùng ở giai đoạn | Người giữ |
|---|---|---|---|
| `TECH` | TVKT | INTAKE (AQUA), PROPOSAL, ACCEPTANCE | theo luật giao việc |
| `BOARD` | BQT | PROPOSAL, ACCEPTANCE, PAYMENT; dự phòng cho INTAKE | theo luật giao việc |
| `MANAGER` (mới) | BQL | chỉ ACCEPTANCE | `managerUserId` |
| `TECH_CONFIRM` | KT | INTAKE (mẫu STANDARD) | theo luật giao việc |
| bước tùy chỉnh | theo cấu hình | theo cấu hình | theo luật giao việc |

**Xác nhận chuyển khoản không có người giữ cố định.** Bất kỳ ai có `PAYMENT_CONFIRM` (BQT, Kế toán) trong phạm vi tòa đều được làm (PD-07 Q4).

**Thứ tự kiểm tra** giữ như v1 §4: với bước của người giữ, kiểm trạng thái (409) trước, rồi mới kiểm đúng người giữ (403).

## 4. Dữ liệu nghiệp vụ

### 4.1 Tờ trình (D5-TT)

| Trường | Bắt buộc khi trình | Ghi chú |
|---|---|---|
| Kính gửi | có | mặc định "Ban quản trị tòa «tên tòa»" |
| Người trình | tự động | người quản lý hồ sơ (BQL) |
| Người lập | có | mặc định người trình |
| Thẩm định nội dung | tự động | người giữ bước TVKT đầu tiên trong chuỗi, nếu có |
| Loại tờ trình | có | `SUA_CHUA` (Sửa chữa), `THAY_THE` (Thay thế thiết bị), `KHAC` (Khác). **Giả định**: D5-TT để trống |
| Ngân sách | có | `KINH_PHI_BAO_TRI` (Kinh phí bảo trì phần sở hữu chung), `KINH_PHI_VAN_HANH`, `KHAC`. **Giả định**: D5-TT để trống; TT05 Điều 34 nói về hạng mục được dùng kinh phí bảo trì |
| Nội dung xin phê duyệt | có | 10–2000 ký tự |
| Đề xuất và đánh giá | có | 10–2000 ký tự |
| Hạn mong muốn phê duyệt | không | ngày |
| Lần trình | tự động | 1–3 |
| Ngày trình | tự động | — |

### 4.2 Bảng báo giá

- **Hạng mục** là danh sách dùng chung cho mọi nhà thầu, 1–50 dòng: STT (tự động), tên hạng mục (≤ 200 ký tự), đơn vị (≤ 20 ký tự), số lượng (số > 0, tối đa 3 chữ số thập phân).
- **Nhà thầu** từ 1 đến 5. Mỗi nhà thầu có:
  - tên (≤ 200 ký tự);
  - đơn giá cho **từng** hạng mục (số nguyên VND ≥ 0);
  - chi phí khác (số nguyên VND ≥ 0, mặc định 0);
  - thuế (số nguyên VND ≥ 0);
  - ít nhất 1 tệp báo giá (mục đích `QUOTATION`).
- **Thành tiền một dòng** = làm tròn nửa lên (số lượng × đơn giá) về đồng.
  - **Tổng của nhà thầu** = Σ thành tiền + chi phí khác + thuế (đã gồm VAT).
  - Hệ thống tự tính; client gửi giá trị khác thì bị bỏ qua.
- **Số nhà thầu:** dưới 3 thì bắt buộc có "Lý do không đủ 3 báo giá" (10–1000 ký tự).
- **Nhà thầu đề xuất:** BQL chọn đúng 1. **Số trình** = tổng của nhà thầu đề xuất.
- **Tệp bắt buộc khi trình:** ít nhất 1 "Biên bản ghi nhận sự việc" (mục đích `INCIDENT_MINUTES`). Tệp tờ trình (`PROPOSAL`) không bắt buộc, vì hệ thống hiển thị tờ trình từ dữ liệu.
- Tiền gửi và nhận dạng chuỗi số nguyên. Số lượng dạng chuỗi thập phân.

### 4.3 Biên bản nghiệm thu (D5-NT)

Mỗi lượt nghiệm thu là một biên bản gồm:
- thời gian và địa điểm nghiệm thu (bắt buộc khi gửi nghiệm thu);
- nội dung nghiệm thu: công việc và hạng mục (10–2000 ký tự);
- thành phần bắt buộc: các bước `ACCEPTANCE` trong snapshot;
- thành phần khác: chữ tự do, ví dụ "Đại diện cư dân: …";
- ảnh kết quả;
- với mỗi thành phần: kết luận ĐẠT hoặc KHÔNG ĐẠT, điểm cần lưu ý, chữ ký, thời điểm;
- kết luận chung, do hệ thống tính.

Khi mọi thành phần đã quyết định, biên bản bị khóa.

### 4.4 Đợt thanh toán (D5-TDN)

| Trường | Ghi chú |
|---|---|
| Loại | `TAM_UNG` (tạm ứng) hoặc `QUYET_TOAN` (quyết toán) |
| Số tiền | số nguyên VND > 0; hệ thống hiện thêm số tiền bằng chữ |
| Người hưởng: tên tài khoản, số tài khoản, ngân hàng | bắt buộc. Số tài khoản 6–20 chữ số, **giả định** |
| Nội dung chuyển khoản | bắt buộc, ≤ 210 ký tự. Mặc định "BQT «mã tòa» THANH TOAN CHI PHI «mã hồ sơ»" |
| Tệp | Tạm ứng: đề nghị tạm ứng của nhà thầu (`PAYMENT_REQUEST`). Quyết toán: công văn đề nghị thanh toán của nhà thầu (`PAYMENT_REQUEST`) **và** hóa đơn GTGT (`INVOICE`). Tờ trình, báo giá đã duyệt và biên bản nghiệm thu đạt được hệ thống tự liên kết |
| Xác nhận chuyển khoản | ngày ≤ hôm nay, mã tham chiếu, ít nhất 1 chứng từ (`PAYMENT_PROOF`), người xác nhận |

## 5. Chuyển trạng thái

Trạng thái hồ sơ dùng lại tập trạng thái của v1. Không thêm trạng thái mới; đợt tạm ứng có trạng thái riêng (mục 5.4).

### 5.1 S2: Tờ trình và chuỗi duyệt

| # | Hành động | Từ trạng thái | Quyền · Người làm | Sang trạng thái | Điều kiện |
|---|---|---|---|---|---|
| T04 | `saveProposalDraft` | `PENDING_PROPOSAL`, `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE` | `RECORD_EDIT` · manager | giữ nguyên | các trường đều tùy chọn; giá trị nào có thì phải hợp lệ |
| T05 | `submitProposal` | `PENDING_PROPOSAL` | `RECORD_EDIT` · manager | trạng thái chờ của bước đầu tiên trong `record.approvalStepKeys` | BR-S2-01 đến 04 |
| T06 | `resubmitProposal` | `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE` | như T05 | như T05 | như T05 |
| T07 | `approveProposal` | các trạng thái chờ duyệt tờ trình | `PROPOSAL_DECIDE` · người giữ bước | bước kế tiếp; sau bước cuối là `READY_FOR_CONSTRUCTION` | BR-S2-05 đến 07 |
| T08 | `requestProposalUpdate` | như T07 | như T07 | `NEEDS_SUBMISSION_UPDATE` | lý do 5–1000 ký tự; không được ở lần trình thứ 3 |
| T09 | `rejectProposal` | như T07 | như T07 | `REJECTED_RESUBMITTABLE`; ở lần 3 là `UNRESOLVED` | lý do 5–1000 ký tự; ở bước BQT áp BR-S2-05 |

### 5.2 S3: Thi công và nghiệm thu

| # | Hành động | Từ | Quyền · Người làm | Sang | Điều kiện |
|---|---|---|---|---|---|
| T10 | `startConstruction` | `READY_FOR_CONSTRUCTION` | `CONSTRUCTION` · manager | `IN_CONSTRUCTION` | ngày bắt đầu; ngày dự kiến xong ≥ ngày bắt đầu; ghi chú kế hoạch 5–1000 ký tự. Phát thông báo kế hoạch (BR-S3-01) |
| T11 | `updateConstruction` | `IN_CONSTRUCTION` | như T10 | giữ nguyên | như v1 |
| T12 | `submitAcceptance` | `IN_CONSTRUCTION` | như T10 | `PENDING_ACCEPTANCE` | tiến độ 100; ngày hoàn thành trong khoảng [ngày bắt đầu, hôm nay]; thời gian, địa điểm và nội dung nghiệm thu; ít nhất 1 ảnh. Tạo biên bản lượt mới |
| T13 | `passAcceptance` | `PENDING_ACCEPTANCE` | `ACCEPTANCE_DECIDE` · người giữ một bước ACCEPTANCE chưa quyết định | `PENDING_PAYMENT_REQUEST` khi mọi bước đã đạt; nếu chưa thì giữ nguyên | điểm lưu ý tùy chọn (≤ 1000 ký tự); chữ ký (BR-S3-03) |
| T14 | `failAcceptance` | `PENDING_ACCEPTANCE` | như T13 | `NEEDS_REPAIR`, ngay lập tức | điểm cần khắc phục 5–1000 ký tự; chữ ký |
| T15 | `saveRepairEvidence` | `NEEDS_REPAIR` | `CONSTRUCTION` · manager | giữ nguyên | như v1 |
| T16 | `resubmitAcceptance` | `NEEDS_REPAIR` | như T15 | `PENDING_ACCEPTANCE` | như T12; tạo biên bản lượt mới |

### 5.3 S4: Quyết toán và đóng hồ sơ

| # | Hành động | Từ | Quyền · Người làm | Sang | Điều kiện |
|---|---|---|---|---|---|
| T17 | `savePaymentDraft` | `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_RECORD` · manager | giữ nguyên | các trường tùy chọn |
| T18 | `submitPaymentRequest` (quyết toán) | như T17 | như T17 | trạng thái chờ duyệt thanh toán theo chuỗi PAYMENT (như v1 BR-11) | BR-S4-01 đến 03; chữ ký BQL |
| T19 | `approvePayment` | `PENDING_PAYMENT_APPROVAL`, `PENDING_CUSTOM_PAYMENT_APPROVAL` | `PAYMENT_DECIDE` · người giữ bước | bước kế tiếp; sau bước cuối là `PENDING_PAYMENT` | — |
| T20 | `requestPaymentUpdate` | như T19 | như T19 | `NEEDS_PAYMENT_UPDATE` | lý do 5–1000 ký tự |
| T21 | `confirmPaymentTransfer` (mới, thay `recordPayment`) | `PENDING_PAYMENT` | `PAYMENT_CONFIRM` · bất kỳ ai trong phạm vi tòa | giữ nguyên | ngày, mã tham chiếu, chứng từ; số tiền = số của đợt |
| T22 | `completeRecord` | `PENDING_PAYMENT` | `PAYMENT_RECORD` · manager | `COMPLETED` | BR-S4-05 |

### 5.4 S4: Đợt tạm ứng

Tạm ứng không đổi trạng thái hồ sơ. Đợt tạm ứng có vòng đời riêng:

`Chờ duyệt` (theo chuỗi PAYMENT) → `Chờ chuyển khoản` → `Đã chuyển khoản`, hoặc → `Cần bổ sung` → (gửi lại cùng đợt, bản sửa kế tiếp) `Chờ duyệt`. **Không có bản nháp tạm ứng**: A1 gửi thẳng.

| # | Hành động | Khi hồ sơ ở trạng thái | Quyền · Người làm | Điều kiện |
|---|---|---|---|---|
| A1 | `submitAdvanceRequest` | `READY_FOR_CONSTRUCTION`, `IN_CONSTRUCTION`, `PENDING_ACCEPTANCE`, `NEEDS_REPAIR` | `PAYMENT_RECORD` · manager | BR-S4-04; chữ ký BQL |
| A1b | gửi lại đợt tạm ứng đang `Cần bổ sung` (cùng đợt, bản sửa kế tiếp) | như A1, **cộng** `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_RECORD` · manager | như A1 |
| A2 | `approveAdvance` / `requestAdvanceUpdate` | như A1, **cộng** `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_DECIDE` · người giữ bước PAYMENT | yêu cầu bổ sung thì cần lý do 5–1000 ký tự |
| A3 | `confirmAdvanceTransfer` | như A1, **cộng** `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_CONFIRM` · bất kỳ ai trong phạm vi tòa | như T21 |

## 6. Quy tắc nghiệp vụ

### S2

- **BR-S2-01:** Trình (T05, T06) cần đủ các trường bắt buộc ở §4.1, bảng báo giá hợp lệ (§4.2), tệp `INCIDENT_MINUTES`, và **chữ ký** của người trình (PNG data URL, theo v1 BR-04).
- **BR-S2-02:** Mỗi lần trình là một bản ghi **bất biến**, gồm toàn bộ tờ trình, bảng báo giá, nhà thầu đề xuất, tổng các nhà thầu, tệp và chữ ký. Tệp bị khóa theo v1 BR-14.
- **BR-S2-03:** Mỗi lần trình duyệt lại từ bước đầu. Tối đa 3 lần (DF-04; mã lỗi `max_submission_attempts`, `final_attempt_decide_only` như v1).
- **BR-S2-04:** Người giữ mọi bước trong chuỗi phải còn hợp lệ lúc trình (v1 BR-05). Không còn hợp lệ thì trả 400 theo từng bước.
- **BR-S2-05:** Ở bước vai trò BQT, `approveProposal` và `rejectProposal` cần:
  - ít nhất 1 tệp `BOARD_MINUTES` của **lần trình hiện hành**;
  - chữ ký của người giữ bước BQT.

  Người giữ bước BQT được tải tệp `BOARD_MINUTES` lên khi hồ sơ đang chờ BQT. Thiếu tệp thì trả 400, lỗi trường `boardMinutesAttachmentIds`. `requestProposalUpdate` không cần biên bản.
- **BR-S2-06:** Khi duyệt ở bước **cuối** của chuỗi, người giữ bước được chọn `selectedContractorIndex`, tức một nhà thầu khác trong bảng báo giá. Chọn khác nhà thầu đề xuất thì bắt buộc ghi lý do (5–1000 ký tự).
  - **Số được duyệt** = tổng của nhà thầu được chọn. **Nhà thầu thực hiện** = nhà thầu được chọn.
  - Không chọn thì lấy nhà thầu đề xuất.
- **BR-S2-07:** Người trình không được tự quyết lần trình của mình (`self_approval_denied`). Gửi `submissionId` cũ thì trả 409 (như v1).

### S3

- **BR-S3-01:** `startConstruction` tạo một **thông báo trong hệ thống** "Kế hoạch thi công «mã hồ sơ»" gửi người giữ bước BQT và TVKT của hồ sơ. Thông báo gồm nhà thầu thực hiện, ngày bắt đầu, ngày dự kiến xong và ghi chú. Thông báo cho cư dân không thuộc phạm vi này.
- **BR-S3-01a (làm rõ khi build S3):** API chưa có module thông báo, nên S3 làm **phần tối thiểu** để BR-S3-01 và AC-3.1 kiểm được:
  - bảng `notifications`;
  - `GET /api/notifications`: chỉ thông báo của chính mình, mới nhất trước, có số chưa đọc;
  - `POST /api/notifications/:id/read`;
  - `startConstruction` ghi mỗi người nhận (người giữ bước BQT và TVKT) một dòng, trong cùng transaction;
  - web chế độ `api` hiện thông báo trên trang **Thông báo** sẵn có (bật menu ở chế độ `api`).

  Không có email, push hay loại thông báo nào khác. Module thông báo đầy đủ (B14) phân tích và làm riêng.
- **BR-S3-02:** Thành phần nghiệm thu bắt buộc lấy theo `ACCEPTANCE.approvalStepKeys` trong snapshot.
  - Mọi thành phần quyết định **song song**, không theo thứ tự.
  - Lượt đạt khi **tất cả** đã đạt. Một người KHÔNG ĐẠT thì lượt không đạt ngay.
  - Mỗi người chỉ quyết định một lần trong một lượt (`step_already_decided`).
  - Người quản lý hồ sơ (bước `MANAGER`) được tự xác nhận (PD-07 Q1).
  - Quy tắc này áp cho mọi mẫu cấu hình, và thay v1 BR-09.
- **BR-S3-03:** Mỗi quyết định nghiệm thu cần chữ ký của người quyết định. Không còn yêu cầu tải tệp biên bản: biên bản do hệ thống tạo từ dữ liệu. Tệp đính kèm (`ACCEPTANCE`) là tùy chọn.
- **BR-S3-04:** Có màn **xem biên bản** cho mỗi lượt (chỉ đọc), hiển thị đủ các trường của §4.3 và chữ ký từng thành phần. Lượt cũ được giữ nguyên.

### S4

- **BR-S4-01:** Quyết toán chỉ gửi được khi có lượt nghiệm thu đạt. **Số quyết toán** ≤ số được duyệt; vượt thì trả 400 lỗi trường `amountVnd`: "Số quyết toán không được vượt số được duyệt."
- **BR-S4-02:** Số tiền của đợt quyết toán = số quyết toán − Σ các đợt tạm ứng **đã chuyển khoản**. Hệ thống tự tính và hiện cách tính.
  - Còn đợt tạm ứng chưa ở trạng thái "Đã chuyển khoản" thì không gửi quyết toán được (409 `open_advance_exists`).
- **BR-S4-03:** Quyết toán bắt buộc có đủ tệp `PAYMENT_REQUEST` và `INVOICE` (§4.4). Tờ trình, báo giá được duyệt và biên bản nghiệm thu đạt được hệ thống liên kết, không cần tải lại.
- **BR-S4-04:** Tạm ứng:
  - Σ các đợt tạm ứng (mọi trạng thái) ≤ số được duyệt.
  - Đợt tạm ứng **mới** (A1) chỉ tạo được ở các trạng thái hồ sơ của A1. Đợt **đã có** được xử lý tiếp (A1b, A2, A3) cả sau khi nghiệm thu đạt, để không chặn quyết toán mãi (`open_advance_exists`).
  - Mỗi hồ sơ chỉ có **một** đợt tạm ứng đang mở tại một thời điểm.
  - Không áp tỷ lệ tối đa (DF-08 không đặt trần).
- **BR-S4-05:** `completeRecord` khi quyết toán đã chuyển khoản **và** Σ mọi đợt đã chuyển khoản = số quyết toán. Thiếu thì trả 400 lỗi trường `payment`.
- **BR-S4-06:** Mỗi đợt chỉ được xác nhận chuyển khoản một lần. Người xác nhận và thời điểm được ghi audit (PD-07 Q4).

### Chung

- **BR-C-01:** Mọi hành động dùng khóa phiên bản (`version`) và ghi audit trong cùng transaction, như v1 BR-01 và BR-02.
- **BR-C-02:** Thêm các mục đích tệp `QUOTATION`, `INCIDENT_MINUTES`, `BOARD_MINUTES`, `INVOICE`.

  | Mục đích | Người tải | Khi nào |
  |---|---|---|
  | `QUOTATION`, `INCIDENT_MINUTES` | manager | ở các nguồn của T04–T06 |
  | `BOARD_MINUTES` | người giữ bước BQT | khi chờ BQT |
  | `INVOICE` | manager | ở các nguồn của T17–T18 |

  Các mục đích của v1 giữ nguyên theo v1 BR-12, riêng `PAYMENT_PROOF` chuyển sang người có `PAYMENT_CONFIRM`.
- **BR-C-03:** Ký là ký nhanh bằng chuột hoặc cảm ứng, theo v1 BR-04, ở 4 tài liệu: tờ trình (T05/T06), quyết định của BQT (BR-S2-05), quyết định nghiệm thu (T13/T14), đề nghị thanh toán (T18, A1).

## 7. Tiêu chí nghiệm thu

Seed dùng tòa A với mẫu `AQUA` và các tài khoản demo, cộng `KTOAN-A` (RM-S1). Mỗi AC có ít nhất một e2e trên API thật.

### S2

- **AC-2.1** BQL lập tờ trình có 3 hạng mục và 3 nhà thầu. Tổng từng nhà thầu khớp công thức §4.2, kể cả làm tròn: số lượng 1,5 × đơn giá 333.333 = 499.999,5, làm tròn thành 500.000. Trình kèm chữ ký và biên bản ghi nhận: hồ sơ sang trạng thái chờ TVKT.
- **AC-2.2** Trình chỉ với 2 nhà thầu mà không ghi lý do: 400. Có lý do: trình được. Thiếu `INCIDENT_MINUTES`: 400.
- **AC-2.3** TVKT duyệt, hồ sơ sang chờ BQT. BQT duyệt khi thiếu `BOARD_MINUTES`: 400. Có biên bản và chữ ký: hồ sơ sang `READY_FOR_CONSTRUCTION`; số được duyệt = tổng của nhà thầu đề xuất.
- **AC-2.4** BQT duyệt và chọn nhà thầu 2 nhưng không ghi lý do: 400. Có lý do: số được duyệt = tổng nhà thầu 2, nhà thầu thực hiện là nhà thầu 2, có audit lý do.
- **AC-2.5** BQT từ chối không kèm biên bản: 400. Có biên bản: `REJECTED_RESUBMITTABLE`. Trình lại thì quay về bước đầu, `attemptNo` = 2; lần 1 giữ nguyên toàn bộ bảng báo giá và quyết định.
- **AC-2.6** Lần trình thứ 3 bị BQT từ chối: `UNRESOLVED`. Yêu cầu bổ sung ở lần 3: 409. Trình lần 4: 409.
- **AC-2.7** Người giữ bước BQT tải được `BOARD_MINUTES` khi hồ sơ chờ BQT. TVKT tải loại tệp này thì nhận 403 `attachment_step_denied`.

### S3

- **AC-3.1** `startConstruction` thiếu ghi chú kế hoạch: 400. Đủ: `IN_CONSTRUCTION`, và người giữ bước BQT cùng TVKT nhận thông báo kế hoạch có đúng nhà thầu thực hiện.
- **AC-3.2** Gửi nghiệm thu đủ dữ liệu: biên bản lượt 1 có 3 thành phần bắt buộc (BQL, BQT, TVKT) đều đang chờ.
- **AC-3.3** BQL, BQT và TVKT lần lượt chọn ĐẠT, mỗi người ký. Sau người thứ hai hồ sơ vẫn `PENDING_ACCEPTANCE`; sau người thứ ba thì `PENDING_PAYMENT_REQUEST`. Biên bản bị khóa và màn xem hiện đủ chữ ký.
- **AC-3.4** BQT chọn KHÔNG ĐẠT sau khi BQL đã chọn ĐẠT: hồ sơ sang `NEEDS_REPAIR` ngay. Gửi nghiệm thu lại thì có lượt 2 mới; lượt 1 giữ nguyên. BQL quyết định lần hai trong cùng lượt: 409 `step_already_decided`.
- **AC-3.5** Tòa mẫu `STANDARD` (ACCEPTANCE `[TECH_CONFIRM, TECH]`) cũng quyết định song song và mọi thành phần phải đạt.

### S4

- **AC-4.1** Ở `IN_CONSTRUCTION`, BQL gửi đề nghị tạm ứng 4 triệu (số được duyệt 10 triệu). BQT duyệt. `ktoan-a` xác nhận chuyển khoản kèm chứng từ. Đợt tạm ứng thành "Đã chuyển khoản"; trạng thái hồ sơ không đổi.
- **AC-4.2** Gửi đợt tạm ứng thứ hai khi đợt đầu chưa chuyển khoản: 409. Tổng tạm ứng vượt 10 triệu: 400.
- **AC-4.3** Sau nghiệm thu đạt, quyết toán 10 triệu: số của đợt hiện 6 triệu (10 − 4). Thiếu hóa đơn `INVOICE`: 400. Đủ hồ sơ: đi qua chuỗi PAYMENT, sang `PENDING_PAYMENT`; `bqt` xác nhận chuyển khoản; BQL đóng hồ sơ, hồ sơ sang `COMPLETED`.
- **AC-4.4** Quyết toán 11 triệu khi số được duyệt là 10 triệu: 400. Quyết toán 9 triệu: được; đóng hồ sơ khi Σ đã chuyển khoản = 9 triệu.
- **AC-4.5** `kt-a` (không có `PAYMENT_CONFIRM`) xác nhận chuyển khoản: 403. Xác nhận lần hai cho cùng một đợt: 409.
- **AC-4.6** Gửi quyết toán khi đang có đợt tạm ứng mở: 409 `open_advance_exists`.

### Chung

- **AC-0.1** Mọi hành động gọi từ trạng thái không hợp lệ: 409 `invalid_status_transition`, không có audit.
- **AC-0.2** Hồ sơ tạo trước khi triển khai v2 (snapshot cũ) vẫn đi hết luồng theo snapshot của nó; test bằng một hồ sơ seed.
- **AC-0.3** Mỗi slice chạy được trên web ở chế độ `api` bằng tài khoản demo, có ảnh chụp: S2 lập và duyệt tờ trình; S3 biên bản ba bên; S4 tạm ứng rồi quyết toán.

## 8. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] e2e của slice; chạy lại `record-confirmations` và `records*`.
- [ ] Unit test cho phép tính báo giá (làm tròn) và số quyết toán.
- [ ] Hồ sơ snapshot cũ (AC-0.2).
- [ ] Chữ ký và tệp không lộ trong log hoặc URL.
- [ ] Ảnh chụp AC-0.3.

## 9. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 26/10/2026 | v1 (PD-03, PD-04). S1 triển khai và đóng. |
| 26/10/2026 | v2 viết lại S2–S4 theo PRODUCT-DEFAULTS (PD-09) và ADR-0001 R3/R4. |
| 26/10/2026 | Chủ dự án duyệt v2 (PD-12). |
| 26/10/2026 | BR-S3-01a: phần thông báo tối thiểu cho S3, theo đề xuất của dev-build; nằm trong BR-S3-01 đã duyệt, không mở rộng phạm vi. |
| 26/10/2026 | Làm rõ §5.4 và BR-S4-04 khi build S4, theo phát hiện của dev-build. Thêm A1b; A2, A3 được làm cả ở `PENDING_PAYMENT_REQUEST` và `NEEDS_PAYMENT_UPDATE`, để gỡ chỗ kẹt khi nghiệm thu đạt lúc còn tạm ứng mở. Bỏ trạng thái "Nháp" của tạm ứng. Không đổi ý định nghiệp vụ đã duyệt (PD-12). |
| 26/10/2026 | S4 đóng. SPEC chuyển `Đã triển khai`. Việc tồn: VT-01 (nút lưu nháp quyết toán trên web), VT-02 (e2e `not_step_assignee` cho bước thanh toán). |
