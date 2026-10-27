---
id: B06.S1
title: Xử lý khẩn cấp — làm trước, duyệt hậu kiểm
status: Đã triển khai
owner: PM/BA
intent: "BQL được cho làm ngay các sự cố khẩn cấp trong hạn mức của tòa; hồ sơ vẫn đi đủ chuỗi duyệt sau đó và không trả tiền khi chưa được duyệt."
depends_on: []
---

# SPEC: Xử lý khẩn cấp (B06-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã triển khai` (27/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-19)

**Nguồn:**
- Phân tích [B06-xu-ly-khan-cap.md](../../modules/B06-xu-ly-khan-cap.md) (đã duyệt, PD-18), các mục B6G-01 đến 04, 09, 11, 12 và mặc định D-B6-1 đến D-B6-7.
- DF-09; D2 nhóm 06; D1 tr. 20.

**Nền:** SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md), gồm máy trạng thái §5, người giữ bước §3, BR-C-01 và S4. SPEC này **chỉ thêm** vào máy trạng thái đó, không đổi gì của hồ sơ thường.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Khi có sự cố như vỡ ống hay chập điện, BQL không thể chờ tờ trình đi hết chuỗi duyệt. DF-09 (TT05 Điều 32.5) cho phép làm trước trong hạn mức tiền của tòa, với điều kiện:
- BQT được báo ngay;
- tờ trình được nộp bổ sung trong hạn;
- BQT duyệt hậu kiểm.

Bản demo đã có luồng này, nhưng API chưa có. Ở chế độ `api`, bấm nút sẽ báo "chưa nối API" (B6G-01).

**Người dùng:**
- Chính: BQL quản lý hồ sơ (người bắt đầu và nộp hồ sơ).
- Phụ: BQT và TVKT (được báo, duyệt hậu kiểm), kế toán (bị chặn thanh toán đến khi có duyệt).

**User story:**
- Là BQL, tôi muốn cho nhà thầu làm ngay một sự cố trong hạn mức, để không để hư hỏng lan rộng.
- Là BQT, tôi muốn được báo ngay khi có việc khẩn cấp và duyệt hậu kiểm bằng tờ trình đầy đủ, để kiểm soát chi tiêu quỹ.
- Là BQT, tôi muốn có quyền **không duyệt hậu kiểm**, để không có khoản thanh toán nào cho việc không được chấp nhận.

## 2. Phạm vi

**Trong phạm vi:**
1. Bắt đầu xử lý khẩn cấp (E-T1): kiểm hạn mức, ghi thông tin khẩn cấp, mở phần thi công, báo người duyệt.
2. Nộp tờ trình bổ sung từ `EMERGENCY_IN_PROGRESS`, có hạn bổ sung và lý do khi trễ hạn.
3. Duyệt hậu kiểm theo chuỗi PROPOSAL của snapshot. Duyệt xong, hồ sơ về thẳng `IN_CONSTRUCTION`.
4. **Không được duyệt hậu kiểm** (B6G-04, PD-18): thêm hai trạng thái mới, BQT giữ hồ sơ và đóng. Phần này chuyển từ S2 lên S1. Nếu để sang S2, hồ sơ khẩn cấp bị từ chối lần cuối sẽ rơi vào `UNRESOLVED`, như vậy là sai nghiệp vụ.
5. Chặn tạm ứng, nghiệm thu và quyết toán trước khi duyệt hậu kiểm xong.
6. Thông tin khẩn cấp trong danh sách và chi tiết hồ sơ ở API và web chế độ `api`: thẻ, huy hiệu hạn, cờ, cảnh báo vượt hạn mức.

**Ngoài phạm vi** (B06-S2 hoặc sau):
- Nhật ký sự cố theo D1 tr. 20 (B6G-05, 06).
- Báo khi quá hạn bổ sung (B6G-08). Trong S1 chỉ có huy hiệu.
- Cờ và danh sách báo cáo hội nghị (B6G-07).
- Mã riêng `KC-` (B6G-12): giữ mã `SC-` và gắn nhãn "Khẩn cấp".
- Bộ lọc danh sách "chỉ hồ sơ khẩn cấp".
- Trợ lý An Nhi.
- Chế độ `mock`: giữ nguyên như demo hiện tại.

## 3. Dữ liệu nghiệp vụ của hồ sơ khẩn cấp

| Trường | Ghi chú |
|---|---|
| Lý do phải xử lý ngay | 5–1000 ký tự, bắt buộc |
| Nhà thầu thực hiện | tên, 2–200 ký tự, bắt buộc |
| Chi phí dự kiến | số nguyên VND > 0, gửi và nhận dạng chuỗi, bắt buộc |
| Ngày dự kiến xong | ≥ hôm nay (giờ Việt Nam), bắt buộc |
| Hạn mức đã áp | `emergencyLimitVnd` của tòa **tại lúc bắt đầu**; đổi cấu hình sau đó không làm thay đổi (D-B6-3) |
| Hạn bổ sung (`docsDueAt`) | lúc bắt đầu + `emergencyDocHours` của tòa tại lúc bắt đầu |
| Người bắt đầu, lúc bắt đầu | hệ thống ghi |
| Lúc nộp tờ trình lần đầu (`docsSubmittedAt`), lý do trễ | hệ thống ghi ở T05; lý do trễ 5–1000 ký tự |
| Kết quả hậu kiểm | trống / `APPROVED` / `REJECTED` |
| Quyết định xử lý khi không duyệt | lý do 5–1000 ký tự, tệp tùy chọn, người và lúc quyết |

Hồ sơ được coi là **hồ sơ khẩn cấp** khi đã có thông tin này. Thông tin này không bị xóa, kể cả sau khi hồ sơ đóng.

## 4. Chuyển trạng thái

**Trạng thái mới** (sửa SPEC v2 §5 "không thêm trạng thái", theo PD-18):

| Trạng thái | Nhãn | Nhóm lọc | Đã đóng? |
|---|---|---|---|
| `POST_REVIEW_REJECTED` | Không được duyệt hậu kiểm | `NEEDS_ACTION` | Chưa (BQT giữ) |
| `CLOSED_POST_REVIEW_REJECTED` | Đã đóng: không được duyệt hậu kiểm | `CLOSED` | Có |

Nhãn và nhóm phải giống nhau ở API và web.

| # | Hành động | Từ | Quyền · Người làm | Sang | Điều kiện |
|---|---|---|---|---|---|
| E-T1 | `startEmergencyRepair` (mới) | `DRAFT`, `PENDING_CONFIRMATION`, `PENDING_PROPOSAL` | `EMERGENCY_START` · manager | `EMERGENCY_IN_PROGRESS` | BR-E-01 đến 04 |
| T04 | `saveProposalDraft` | như v2, **cộng** `EMERGENCY_IN_PROGRESS` | như v2 | giữ nguyên | như v2 |
| T05 | `submitProposal` | như v2, **cộng** `EMERGENCY_IN_PROGRESS` | như v2 | trạng thái chờ của bước đầu chuỗi | như v2, cộng BR-E-05 |
| T06–T08 | trình lại, duyệt, yêu cầu bổ sung | như v2 | như v2 | như v2; riêng bước cuối của T07 xem BR-E-06 | như v2 |
| T09 | `rejectProposal` trên hồ sơ khẩn cấp | như v2 | như v2 | xem BR-E-07 | như v2 |
| T11 | `updateConstruction` | như v2, **cộng** `EMERGENCY_IN_PROGRESS` | như v2 | giữ nguyên | như v2 |
| E-T2 | `closePostReviewRejected` (mới) | `POST_REVIEW_REJECTED` | `PROPOSAL_DECIDE` · người giữ bước BOARD của snapshot | `CLOSED_POST_REVIEW_REJECTED` | BR-E-08 |

Thứ tự kiểm giống SPEC v2 §3: không thấy hồ sơ hoặc ngoài phạm vi (404) → trạng thái (409) → quyền hoặc người giữ bước (403) → `version` (409) → dữ liệu (400).

## 5. Quy tắc nghiệp vụ

- **BR-E-01. Ai được bắt đầu:** chỉ manager của hồ sơ có `EMERGENCY_START` (D-B6-1; theo ma trận hiện tại là BQL). Hồ sơ phải đủ điều kiện gửi như ở T01: có tên, mô tả, vị trí, và BQL còn hoạt động. Bắt đầu từ `DRAFT` hoặc `PENDING_CONFIRMATION` sẽ **bỏ qua bước xác nhận**. Đây là điều được chấp nhận (B6G-11), và audit ghi rõ trạng thái gốc.
- **BR-E-02. Hạn mức:**
  - Chi phí dự kiến **≤** hạn mức của tòa thì được bắt đầu. Bằng hạn mức vẫn được.
  - Vượt hạn mức thì trả 400 lỗi trường `estimatedAmountVnd`: "Chi phí dự kiến vượt hạn mức khẩn cấp của tòa («hạn mức»). Hãy đi quy trình duyệt thông thường."
  - Hạn mức so theo **từng hồ sơ**, không cộng dồn (D-B6-2).
  - So sánh tiền bằng số nguyên, không dùng float.
- **BR-E-03. Mở thi công:**
  - E-T1 tạo phần thi công với ngày bắt đầu là hôm nay, ngày dự kiến xong theo dữ liệu nhập, và tiến độ 0.
  - Tạo sẵn một tờ trình nháp: điền nhà thầu, ghi chi phí dự kiến làm gợi ý, và lấy lý do làm "nội dung".
- **BR-E-04. Báo người duyệt:**
  - Trong cùng transaction với E-T1, mỗi người sau nhận **đúng một** thông báo: người giữ bước xác nhận (INTAKE) và mọi người giữ bước của chuỗi PROPOSAL trong snapshot. Một người giữ nhiều bước thì vẫn chỉ nhận một thông báo, và người bắt đầu không nhận.
  - Thông báo dùng module `notifications` của S3.
  - Nội dung: "Hồ sơ «mã» đang xử lý khẩn cấp: «lý do». Hạn bổ sung tờ trình: «docsDueAt»."
- **BR-E-05. Hạn bổ sung:**
  - Lần T05 đầu tiên của hồ sơ khẩn cấp ghi `docsSubmittedAt`.
  - Nếu nộp sau `docsDueAt` thì bắt buộc có lý do trễ (5–1000 ký tự); thiếu thì trả 400 lỗi trường `lateReason`.
  - Nộp đúng hạn thì không có ô lý do trễ, và lý do gửi kèm bị bỏ qua.
  - Các lần trình lại (T06) không xét hạn nữa.
- **BR-E-06. Duyệt hậu kiểm:**
  - Dùng đúng chuỗi PROPOSAL của snapshot, kể cả biên bản họp BQT và chữ ký (D-B6-4, BR-S2-05).
  - Bước cuối của T07 trên hồ sơ khẩn cấp đưa hồ sơ sang **`IN_CONSTRUCTION`**, không qua `READY_FOR_CONSTRUCTION`, và ghi kết quả hậu kiểm `APPROVED`. Số được duyệt tính như v2.
  - Tổng báo giá được chọn mà vượt hạn mức đã áp vẫn trình và duyệt được (B6G-09). Khi đó chi tiết hồ sơ có cờ `overEmergencyLimit`, và web hiện cảnh báo bắt buộc cho người duyệt (xem brief).
- **BR-E-07. Từ chối hậu kiểm:**
  - Trên hồ sơ khẩn cấp, T09 ở lần trình 1 và 2 giữ như v2: hồ sơ sang `REJECTED_RESUBMITTABLE`, BQL trình lại được.
  - **Thay `UNRESOLVED`:** ở lần trình thứ 3, hoặc khi **người giữ bước BOARD** chọn "Không duyệt hậu kiểm" (cờ `finalPostReview=true`, chỉ người giữ BOARD gửi được, ở bất kỳ lần trình nào), hồ sơ sang `POST_REVIEW_REJECTED` và kết quả hậu kiểm là `REJECTED`.
  - Người không giữ BOARD mà gửi `finalPostReview=true` thì trả 403.
  - Hồ sơ khẩn cấp **không bao giờ** vào `UNRESOLVED`, nên không sinh thông báo "chưa xử lý" cho cư dân (DF-04).
  - BQL được báo một lần.
- **BR-E-08. Đóng hồ sơ không được duyệt:**
  - BQT ghi quyết định xử lý chi phí: lý do 5–1000 ký tự và tệp tùy chọn với mục đích `BOARD_DECISION`. Ví dụ "nhà thầu tự chịu" hoặc "trích nguồn khác ngoài quỹ".
  - Hồ sơ sang `CLOSED_POST_REVIEW_REJECTED`.
  - Không có thanh toán nào trong hệ thống cho hồ sơ này (D-B6-6).
- **BR-E-09. Chặn thanh toán và nghiệm thu:**
  - Khi hồ sơ ở `EMERGENCY_IN_PROGRESS`, ở các trạng thái chờ duyệt, bổ sung hay từ chối tờ trình, hoặc ở `POST_REVIEW_REJECTED`, `CLOSED_POST_REVIEW_REJECTED`, thì mọi thao tác sau đều trả 409 `invalid_status_transition`: tạm ứng (A1, A1b, A2, A3), quyết toán (T17–T22) và nghiệm thu (T12).
  - Theo máy trạng thái v2 thì điều này đã đúng sẵn. SPEC chỉ đòi có test giữ nó (D-B6-5).
- **BR-E-10. Khóa và audit:**
  - Như BR-C-01: E-T1 và E-T2 kiểm `version`, khóa dòng, ghi audit trong cùng transaction.
  - Audit của E-T1 ghi trạng thái gốc, chi phí dự kiến, hạn mức đã áp và `docsDueAt`.
  - Mã hành động mới có nhãn tiếng Việt ở nhật ký thao tác (AD-S1 BR-05).
- **BR-E-11. Hiển thị:**
  - Danh sách và chi tiết hồ sơ trả thông tin khẩn cấp (§3) cùng các giá trị suy ra: `docsOverdue`, `hoursLeft`, `overEmergencyLimit`.
  - Chỉ người có quyền xem hồ sơ mới thấy, như các trường khác.

## 6. Tiêu chí nghiệm thu

Dữ liệu dùng tòa mẫu AQUA (hạn mức 15 triệu, bổ sung trong 24 giờ) và tài khoản demo.

**Bắt đầu**
- **AC-E1.1** GIVEN hồ sơ `PENDING_PROPOSAL` do `bql-a` quản lý, WHEN `bql-a` bắt đầu khẩn cấp với chi phí 12.500.000, THEN hồ sơ sang `EMERGENCY_IN_PROGRESS`, có phần thi công (bắt đầu hôm nay, tiến độ 0), có tờ trình nháp điền sẵn nhà thầu, và `docsDueAt` bằng lúc bắt đầu + 24 giờ.
- **AC-E1.2** Chi phí đúng 15.000.000 thì được. Chi phí 15.000.001 thì trả 400 lỗi trường `estimatedAmountVnd` với thông báo của BR-E-02, hồ sơ giữ nguyên trạng thái và không có audit.
- **AC-E1.3** Bắt đầu từ `DRAFT` và từ `PENDING_CONFIRMATION` đều được; audit ghi trạng thái gốc. Bắt đầu từ `IN_CONSTRUCTION` trả 409 `invalid_status_transition`.
- **AC-E1.4** Một BQL khác không phải manager trả 403. `kt-a` (không có `EMERGENCY_START`) trả 403. Gửi `version` cũ trả 409.
- **AC-E1.5** Sau AC-E1.1, người giữ bước xác nhận, TVKT và BQT mỗi người có đúng một thông báo mới; `bql-a` không có.
- **AC-E1.6** Sau AC-E1.1, ADMIN đổi hạn mức của tòa thành 10 triệu và số giờ thành 48. Chi tiết hồ sơ vẫn hiện hạn mức 15 triệu và `docsDueAt` cũ.

**Nộp và duyệt hậu kiểm**
- **AC-E2.1** Nộp tờ trình trước `docsDueAt` thì được, `docsSubmittedAt` được ghi và không có lý do trễ.
- **AC-E2.2** Nộp sau `docsDueAt` (test đặt `docsDueAt` về quá khứ): thiếu `lateReason` trả 400; có thì lưu.
- **AC-E2.3** TVKT rồi BQT duyệt (kèm biên bản họp và chữ ký): hồ sơ sang **`IN_CONSTRUCTION`**, kết quả hậu kiểm `APPROVED`, có số được duyệt. Từ đây nghiệm thu và thanh toán đi như S3, S4: tạm ứng 4 triệu, quyết toán, đóng hồ sơ.
- **AC-E2.4** Báo giá được chọn 16 triệu (vượt hạn mức 15 triệu) vẫn trình và duyệt được, và chi tiết hồ sơ có `overEmergencyLimit=true`.
- **AC-E2.5** `updateConstruction` ghi tiến độ được ở `EMERGENCY_IN_PROGRESS`.

**Không duyệt hậu kiểm**
- **AC-E3.1** BQT từ chối ở lần trình 1 (không có cờ): hồ sơ sang `REJECTED_RESUBMITTABLE`. BQL trình lại; duyệt đủ thì sang `IN_CONSTRUCTION`.
- **AC-E3.2** BQT từ chối ở lần trình 1 với `finalPostReview=true`: hồ sơ sang `POST_REVIEW_REJECTED`, BQL nhận một thông báo, và không có thông báo cư dân nào.
- **AC-E3.3** TVKT gửi `finalPostReview=true` thì trả 403.
- **AC-E3.4** Từ chối ở lần trình thứ 3 (không có cờ): hồ sơ sang `POST_REVIEW_REJECTED`, **không** sang `UNRESOLVED`.
- **AC-E3.5** Người giữ BOARD đóng hồ sơ kèm lý do: hồ sơ sang `CLOSED_POST_REVIEW_REJECTED` và có audit. Lý do 4 ký tự trả 400. BQL gọi E-T2 thì trả 403.

**Chặn thanh toán**
- **AC-E4.1** Ở `EMERGENCY_IN_PROGRESS`, ở trạng thái chờ TVKT duyệt và ở `POST_REVIEW_REJECTED`, các thao tác tạm ứng (A1), gửi quyết toán và gửi nghiệm thu đều trả 409 `invalid_status_transition`, và không có audit.

**Chung**
- **AC-E0.1** Hồ sơ thường (không khẩn cấp) không đổi hành vi: các e2e hiện có của S1–S4 vẫn đạt. Hồ sơ thường bị từ chối ở lần 3 vẫn sang `UNRESOLVED`.
- **AC-E0.2** Nhật ký thao tác hiện nhãn tiếng Việt cho `startEmergencyRepair` và `closePostReviewRejected`. Lọc theo trạng thái thì hai trạng thái mới nằm đúng nhóm.
- **AC-E0.3** Web chế độ `api` đáp ứng [ui-brief](supporting/ui-brief.md). Có test component cho dialog bắt đầu, huy hiệu hạn và hộp "Không duyệt hậu kiểm", và có ảnh chụp các màn chính bằng tài khoản demo.

## 7. Checklist test cho dev-review

Chỉ chạy các test liên quan, không chạy toàn bộ suite.

- [ ] e2e mới của B06; chạy lại `record-proposals`, `record-construction`, `record-payments`, `record-transitions`.
- [ ] Unit test so hạn mức (bằng, vượt) và tính `hoursLeft`/`docsOverdue` theo giờ Việt Nam.
- [ ] Migration mới (cột khẩn cấp, hai trạng thái mới) chạy được trên DB đang có dữ liệu S4.
- [ ] Nhãn và nhóm trạng thái giống nhau ở API và web (test so khớp như `permissions.parity`).
- [ ] Ảnh chụp AC-E0.3.

## 8. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích B06 (PD-18). Đưa "không duyệt hậu kiểm" từ S2 lên S1 (lý do ở §2 mục 4). |
| 27/10/2026 | Chủ dự án duyệt (PD-19) và cho giao dev-build. |
| 27/10/2026 | Triển khai, review đạt (sau một vòng sửa accessibility), đóng và merge vào `main`. |
