# SPEC — Luồng hồ sơ sửa chữa sau "Chờ xác nhận" (B03–B09, API)

**Chủ sở hữu:** PM/BA (`dev-pm-ba@qltn`) · **Cập nhật:** 26/10/2026 · **Trạng thái:** `Chờ duyệt`  
**Người duyệt:** chủ dự án, chưa duyệt · **Quyết định nền:** [PD-03](../../DECISIONS.md)

## 1. Mục tiêu

Hồ sơ sửa chữa trên API thật đi được từ `PENDING_CONFIRMATION` đến trạng thái cuối: xác nhận hiện trạng, tờ trình và chuỗi duyệt, thi công, nghiệm thu, thanh toán, đóng hồ sơ. Hành vi giống web demo đã qua UAT nội bộ ngày 20/10. Những chỗ D1 khác demo được làm theo **quy tắc tạm** (mục 3), mỗi quy tắc ghi OD sẽ thay nó.

Hiện API đã có: tạo, lưu nháp, ảnh hiện trường, gửi (`DRAFT` → `PENDING_CONFIRMATION`), rút, danh sách, bộ đếm (`api-qltn/README.md`, "Đợt 2"). SPEC này không đổi các phần đó, trừ những chỗ ghi rõ.

## 2. Phạm vi

### 2.1 Trong phạm vi

Mỗi slice gồm API, nối web ở chế độ `api` (giao diện giữ như demo), test e2e và cập nhật `api-qltn/README.md`.

| Slice | Nội dung | Hành động (tên theo `web/src/domain/actions.ts`) |
|---|---|---|
| S1 | KT xác nhận hiện trạng | `requestRecordUpdate`, `confirmRepair`, `closeNoRepair` |
| S2 | Tờ trình và chuỗi duyệt từ snapshot cấu hình | `saveProposalDraft`, `submitProposal`, `resubmitProposal`, `approveProposal`, `requestProposalUpdate`, `rejectProposal` |
| S3 | Thi công, nghiệm thu, khắc phục | `startConstruction`, `updateConstruction`, `submitAcceptance`, `passAcceptance`, `failAcceptance`, `saveRepairEvidence`, `resubmitAcceptance` |
| S4 | Thanh toán và đóng hồ sơ | `savePaymentDraft`, `submitPaymentRequest`, `approvePayment`, `requestPaymentUpdate`, `recordPayment`, `completeRecord` |

Làm theo thứ tự S1 → S4. Mỗi slice đi qua review riêng ([PROCESS.md](../../../PROCESS.md) §2) trước khi bắt đầu slice sau.

### 2.2 Ngoài phạm vi

| Nội dung | Ghi chú |
|---|---|
| Xử lý khẩn cấp B06 (`startEmergencyRepair`, trạng thái `EMERGENCY_IN_PROGRESS`, hạn bổ sung chứng từ, lý do trễ) | SPEC riêng. Ở SPEC này, mọi nguồn và nhánh `EMERGENCY_IN_PROGRESS` không được mở. |
| Phát hành thông báo "chưa xử lý" (`saveUnresolvedNotice`, `issueUnresolvedNotice`) | SPEC riêng. Ở đây hồ sơ chỉ chuyển sang `UNRESOLVED` (BR-08). |
| Giao lại người xử lý (`reassignRepair`), đồng bộ phân công khi thu hẹp vai trò hoặc khóa tài khoản, `replaceManager` (việc còn tồn của Đợt 1) | SPEC riêng. Ở đây chỉ chặn trình khi người duyệt không hợp lệ (BR-05). |
| Hạn xử lý từng bước, danh sách công việc cá nhân (B02), lịch (B04), thông báo (B14) | Demo có tạo task kèm hạn; API chưa có module task. |
| Dự toán theo hạng mục, nghiệm thu theo hạng mục kiểm tra, biên bản nghiệm thu do hệ thống tạo, thanh toán nhiều đợt, vai trò Kế toán | Theo D1, chờ OD-05, OD-10–OD-13 (xem DG-01–DG-04). |
| Ký số, kết nối ngân hàng | Loại trừ theo D1 tr. 45, D2 mục 04. |

## 3. Quy tắc tạm

Các quy tắc dưới đây lấy theo demo. Khi OD tương ứng được chốt, SPEC này sẽ có phiên bản mới thay quy tắc đó. Thiết kế dữ liệu **không được** chặn đường thay thế đã ghi.

| ID | Quy tắc tạm (theo demo) | Thay bởi | Ràng buộc thiết kế để thay về sau |
|---|---|---|---|
| TR-01 | Vai trò trong luồng chỉ gồm BQL, KT, TVKT, BQT và vai trò tùy chỉnh trong snapshot. BQL ghi nhận thanh toán. | OD-10 | Người giữ bước lấy từ snapshot theo khóa bước, không gắn cứng tên vai trò. |
| TR-02 | Tờ trình có một số tiền `amountVnd` và một `contractorName`. | OD-11 | Lần trình lưu thành bản ghi riêng; có thể thêm bảng hạng mục mà không đổi ý nghĩa `amountVnd` (= tổng). |
| TR-03 | Nghiệm thu: mỗi người duyệt chọn đạt hoặc không đạt, kèm ghi chú; KT phải đính kèm biên bản khi chọn đạt. | OD-12 | Mỗi lượt nghiệm thu lưu danh sách kết luận (`checks`) dạng mảng, không phải hai cột cố định. |
| TR-04 | Người trình ký ảnh chữ ký (chuột hoặc cảm ứng) khi trình tờ trình. Không ký ở bước khác. | OD-13 | Chữ ký gắn với lần trình, người ký và thời điểm, lưu ở bảng chữ ký riêng có trường loại tài liệu. Chữ ký không phải tệp đính kèm (BR-04). |
| TR-05 | Thanh toán một lần, đúng bằng số đã duyệt. Đóng hồ sơ khi tổng đã trả bằng số đã duyệt. | OD-05 | Khoản thanh toán là bảng nhiều dòng theo đề nghị. Điều kiện đóng tính bằng tổng, không bằng "có đúng 1 dòng". |
| TR-06 | Mỗi hồ sơ được trình tối đa 3 lần. Lần thứ 3 không được "yêu cầu bổ sung"; từ chối lần thứ 3 thì hồ sơ thành `UNRESOLVED`. | OD-15 | Giới hạn là một hằng số, có thể chuyển vào cấu hình tòa. |

## 4. Vai trò và người giữ bước

Hồ sơ đã có snapshot cấu hình tòa, chụp khi tạo: `approvalStepKeys`, `workflowApprovalSteps`, `workflowStageApprovalStepKeys` (theo giai đoạn `PROPOSAL`, `ACCEPTANCE`, `PAYMENT`), `approvalAssigneeUserIds`, cùng các người được giao `managerUserId`, `confirmationUserId`, `consultantUserId`, `boardUserId`. Mọi kiểm tra người giữ bước đọc từ snapshot, **không** đọc cấu hình tòa hiện tại.

| Bước có sẵn | Khóa | Trạng thái chờ | Người giữ bước |
|---|---|---|---|
| Kỹ thuật duyệt | `TECH_CONFIRM` | `PENDING_TECH_APPROVAL` | `confirmationUserId` |
| TVKT thẩm định | `TECH` | `PENDING_TECH_REVIEW` | `consultantUserId` |
| BQT duyệt | `BOARD` | `PENDING_BOARD_APPROVAL` | `boardUserId` |
| Bước tùy chỉnh | khóa trong `workflowApprovalSteps` | `PENDING_CUSTOM_APPROVAL` | `approvalAssigneeUserIds[khóa]`; vai trò phải khớp `role`, hoặc `roleDefId` nếu bước có trường này |

Thứ tự kiểm tra. Mỗi lần từ chối trả `details.reason` cố định (mục 7).

| Loại hành động | Thứ tự |
|---|---|
| Người làm là `manager` hoặc `confirmer` | tài khoản còn hoạt động → hồ sơ trong phạm vi tòa và khu vực (ngoài phạm vi thì 404) → capability (403) → đúng người được giao (403) → trạng thái nguồn (409). Giữ thứ tự của `assertRecordAction` hiện có. |
| Người làm là `APPROVAL_STEP`, `ACCEPTANCE_PENDING` hoặc `PAYMENT_APPROVAL` | tài khoản → phạm vi (404) → capability (403) → **trạng thái nguồn (409)** → đúng người giữ bước hiện tại (403). Lý do: ngoài các trạng thái chờ thì không có "bước hiện tại" để so. |

## 5. Chuyển trạng thái

"Người làm" dùng cột `slot` của demo: `manager` = `managerUserId`; `confirmer` = `confirmationUserId`; `APPROVAL_STEP` = người giữ bước duyệt hiện tại; `ACCEPTANCE_PENDING` = người giữ một bước nghiệm thu còn chờ; `PAYMENT_APPROVAL` = người giữ bước duyệt thanh toán hiện tại.

| # | Hành động | Từ trạng thái | Capability · Người làm | Sang trạng thái | Dữ liệu bắt buộc |
|---|---|---|---|---|---|
| T01 | `requestRecordUpdate` Trả bổ sung | `PENDING_CONFIRMATION` | `RECORD_CONFIRM` · confirmer | `NEEDS_RECORD_UPDATE` | `note` lý do, 5–1000 ký tự |
| T02 | `confirmRepair` Xác nhận cần sửa | `PENDING_CONFIRMATION` | `RECORD_CONFIRM` · confirmer | `PENDING_PROPOSAL` | `note` kết luận hiện trạng, 5–1000 |
| T03 | `closeNoRepair` Đóng không cần sửa | `PENDING_CONFIRMATION` | `RECORD_CONFIRM` · confirmer | `CLOSED_NO_REPAIR` (cuối) | `note` lý do, 5–1000 |
| T04 | `saveProposalDraft` | `PENDING_PROPOSAL`, `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE` | `RECORD_EDIT` · manager | giữ nguyên | đều tùy chọn; nếu có `amountVnd` thì phải hợp lệ; `contractorName` ≤ 200 |
| T05 | `submitProposal` Trình duyệt | `PENDING_PROPOSAL` | `RECORD_EDIT` · manager | trạng thái của bước đầu tiên trong `approvalStepKeys` | BR-03, BR-04, BR-05 |
| T06 | `resubmitProposal` Trình lại | `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE` | `RECORD_EDIT` · manager | như T05 | như T05 |
| T07 | `approveProposal` Duyệt | `PENDING_TECH_APPROVAL`, `PENDING_TECH_REVIEW`, `PENDING_BOARD_APPROVAL`, `PENDING_CUSTOM_APPROVAL` | `PROPOSAL_DECIDE` · APPROVAL_STEP | bước kế tiếp; sau bước cuối là `READY_FOR_CONSTRUCTION` | `submissionId` (tùy chọn, BR-06) |
| T08 | `requestProposalUpdate` Yêu cầu bổ sung | như T07 | như T07 | `NEEDS_SUBMISSION_UPDATE` | `reason` 5–1000; không cho phép ở lần trình thứ 3 (TR-06) |
| T09 | `rejectProposal` Từ chối | như T07 | như T07 | `REJECTED_RESUBMITTABLE`; ở lần trình thứ 3 là `UNRESOLVED` (cuối) | `reason` 5–1000 |
| T10 | `startConstruction` | `READY_FOR_CONSTRUCTION` | `CONSTRUCTION` · manager | `IN_CONSTRUCTION` | `startDate`, `plannedEndDate` ≥ `startDate` |
| T11 | `updateConstruction` | `IN_CONSTRUCTION` | `CONSTRUCTION` · manager | giữ nguyên | `progressPercent` là số nguyên 0–100; `note` 5–1000; `attachmentIds` (`CONSTRUCTION`) tùy chọn |
| T12 | `submitAcceptance` | `IN_CONSTRUCTION` | `CONSTRUCTION` · manager | `PENDING_ACCEPTANCE` | tiến độ hiện tại = 100; `completedDate` trong khoảng [`startDate`, hôm nay]; `note` 5–1000; ít nhất 1 ảnh (`ACCEPTANCE`/`CONSTRUCTION`) |
| T13 | `passAcceptance` | `PENDING_ACCEPTANCE` | `ACCEPTANCE_DECIDE` · ACCEPTANCE_PENDING | BR-09 | `note` 5–1000; nếu bước của người quyết định có `role = TECH_CONFIRMER` (bước có sẵn hay tùy chỉnh đều vậy) thì phải có `reportAttachmentIds` (`ACCEPTANCE`) ≥ 1 (TR-03) |
| T14 | `failAcceptance` | `PENDING_ACCEPTANCE` | như T13 | `NEEDS_REPAIR` | `note` 5–1000 |
| T15 | `saveRepairEvidence` | `NEEDS_REPAIR` | `CONSTRUCTION` · manager | giữ nguyên | `note`, `attachmentIds` đều tùy chọn |
| T16 | `resubmitAcceptance` | `NEEDS_REPAIR` | `CONSTRUCTION` · manager | `PENDING_ACCEPTANCE` (lượt mới) | `note` 5–1000 (mặc định lấy từ bản lưu T15); ít nhất 1 ảnh |
| T17 | `savePaymentDraft` | `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_RECORD` · manager | giữ nguyên | đều tùy chọn |
| T18 | `submitPaymentRequest` | `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` | `PAYMENT_RECORD` · manager | BR-11 | `amountVnd` = số đã duyệt (TR-05); ≥ 1 tệp `PAYMENT_REQUEST`; có ít nhất một lượt nghiệm thu đạt |
| T19 | `approvePayment` | `PENDING_PAYMENT_APPROVAL`, `PENDING_CUSTOM_PAYMENT_APPROVAL` | `PAYMENT_DECIDE` · PAYMENT_APPROVAL | bước thanh toán kế tiếp; sau bước cuối là `PENDING_PAYMENT` | — |
| T20 | `requestPaymentUpdate` | như T19 | như T19 | `NEEDS_PAYMENT_UPDATE` | `reason` 5–1000 |
| T21 | `recordPayment` | `PENDING_PAYMENT` | `PAYMENT_RECORD` · manager | giữ nguyên | `amountVnd` = số của đề nghị đã duyệt (TR-05); `paidDate` ≤ hôm nay; `reference` bắt buộc; ≥ 1 tệp `PAYMENT_PROOF`; mỗi đề nghị chỉ được ghi nhận một lần |
| T22 | `completeRecord` Đóng hoàn tất | `PENDING_PAYMENT` | `PAYMENT_RECORD` · manager | `COMPLETED` (cuối) | tổng đã trả = số đã duyệt; có ít nhất một lượt nghiệm thu đạt |

`withdrawRecord` đã có sẵn và vẫn được phép ở `PENDING_PROPOSAL`, `NEEDS_SUBMISSION_UPDATE`, `REJECTED_RESUBMITTABLE`. Mọi kết hợp hành động và trạng thái không có trong bảng trả 409 `invalid_status_transition`.

## 6. Quy tắc nghiệp vụ

- **BR-01 Chống ghi đè.** Mọi hành động nhận `version` hồ sơ mà client đã tải. Nếu lệch thì trả 409 `CONFLICT` và không ghi gì. Mỗi hành động ghi thành công tăng `version`, kể cả các hành động giữ nguyên trạng thái.
- **BR-02 Kiểm toán.** Mọi hành động thành công ghi audit trong cùng transaction, gồm `action`, trạng thái trước và sau, `version`, người làm, thời điểm và lý do hoặc ghi chú nếu có. Một lệnh lỗi không để lại thay đổi nào.
- **BR-03 Lần trình bất biến.** T05/T06 tạo một bản ghi lần trình mới từ bản nháp hiện tại, gồm `attemptNo`, phương án, nhà thầu, số tiền, tệp, người trình và thời điểm. Lần trình đã tạo không bao giờ bị sửa. Sửa bản nháp sau khi trình không ảnh hưởng tới lần trình đó.
- **BR-04 Điều kiện trình.**
  - `proposal`: 10–2000 ký tự.
  - `contractorName`: bắt buộc, tối đa 200 ký tự.
  - `amountVnd`: số nguyên VND > 0, gửi và trả dạng chuỗi.
  - Tệp `PROPOSAL`: ít nhất 1.
  - `signature`: bắt buộc (TR-04). Là chuỗi data URL `data:image/png;base64,…`, chỉ nhận PNG; SVG và mọi định dạng khác trả 400. Dung lượng sau giải mã từ 1 byte đến 200 KB, và nội dung phải đúng chữ ký tệp PNG. Lưu vào bảng chữ ký (một dòng gồm lần trình, loại `SUBMITTER`, người ký, thời điểm), không phải tệp đính kèm và không thuộc BR-12.
- **BR-05 Người duyệt hợp lệ khi trình.** Với từng bước trong `approvalStepKeys`, người giữ bước phải còn hoạt động, đúng vai trò (hoặc đúng `roleDefId`) và có phạm vi trên tòa và khu vực của hồ sơ. Bước nào không đạt thì trả 400 kèm lỗi theo trường `approvalStepKeys.<index>`: "Người xử lý bước «…» đã ngừng hoạt động hoặc không hợp lệ. Cần kiểm tra lại phân công." Việc sửa phân công thuộc SPEC giao lại (mục 2.2).
- **BR-06 Quyết định trên lần trình hiện hành.**
  - Người đã trình lần trình hiện hành không được quyết định nó; nếu cố quyết định thì trả 409 `self_approval_denied`.
  - Nếu client gửi `submissionId` khác lần trình hiện hành thì trả 409 `CONFLICT`.
  - Mỗi quyết định ghi lại bước, người, kết quả (`APPROVED`, `NEEDS_UPDATE`, `REJECTED`), lý do và thời điểm.
- **BR-07 Mỗi lần trình duyệt lại từ đầu.** T05/T06 luôn bắt đầu từ bước đầu tiên của `approvalStepKeys`. Kết quả của các lần trình trước được giữ làm lịch sử, không được tính cho lần trình mới.
- **BR-08 Giới hạn lần trình.** Đã có 3 lần trình thì T05/T06 trả 409 `max_submission_attempts`. Ở lần trình thứ 3, T08 trả 409 `final_attempt_decide_only`, còn T09 chuyển hồ sơ sang `UNRESOLVED` (TR-06).
- **BR-09 Chuỗi nghiệm thu.**
  - Các bước nghiệm thu lấy từ `workflowStageApprovalStepKeys.ACCEPTANCE`; nếu snapshot không có thì mặc định `[TECH_CONFIRM, TECH]`.
  - Nếu danh sách đúng bằng `[TECH_CONFIRM, TECH]`: hai người quyết định **song song**, không theo thứ tự. Các trường hợp khác đi **tuần tự** theo thứ tự cấu hình.
  - Một kết luận "không đạt" làm lượt đó không đạt ngay và chuyển hồ sơ sang `NEEDS_REPAIR`. Lượt chỉ đạt khi mọi bước đều đạt; khi đó hồ sơ chuyển sang `PENDING_PAYMENT_REQUEST`.
  - Mỗi người chỉ quyết định một lần trong một lượt.
  - Mỗi lượt có `roundNo` tăng dần và lưu ghi chú, ảnh và danh sách kết luận. Lượt cũ được giữ nguyên.
- **BR-10 Số đã duyệt.** Số đã duyệt là `amountVnd` của lần trình được bước duyệt cuối cùng duyệt. Khi duyệt bước cuối, hồ sơ lưu id của lần trình đó.
- **BR-11 Chuỗi duyệt thanh toán.**
  - Các bước lấy từ `workflowStageApprovalStepKeys.PAYMENT`; nếu snapshot không có thì mặc định `[BOARD]`.
  - Trạng thái chờ là `PENDING_PAYMENT_APPROVAL` khi chuỗi chỉ có một bước `BOARD`, và `PENDING_CUSTOM_PAYMENT_APPROVAL` trong mọi trường hợp khác.
  - Mỗi lần gửi tạo một đề nghị mới (`revisionNo` tăng dần) và chụp lại chuỗi bước đang áp dụng. Đề nghị cũ được giữ.
  - Một đề nghị đã có quyết định cuối thì không nhận thêm quyết định nào (trả 409).
- **BR-12 Tệp theo mục đích.** Mở thêm các mục đích tệp `PROPOSAL`, `CONSTRUCTION`, `ACCEPTANCE`, `PAYMENT_REQUEST`, `PAYMENT_PROOF` cho hồ sơ sửa chữa, cùng giới hạn loại và dung lượng với `SITE_PHOTO`. Ai được tải lên và khi nào (trường hợp khác trả 403 `attachment_step_denied`):

  | Mục đích | Người tải | Trạng thái hồ sơ |
  |---|---|---|
  | `SITE_PHOTO` | manager | `DRAFT`, `NEEDS_RECORD_UPDATE` (như hiện tại) |
  | `PROPOSAL` | manager | nguồn của T04–T06 |
  | `CONSTRUCTION` | manager | `IN_CONSTRUCTION`, `NEEDS_REPAIR` |
  | `ACCEPTANCE` | manager (cho T12/T16); người giữ một bước nghiệm thu còn chờ (cho T13/T14) | manager: `IN_CONSTRUCTION`, `NEEDS_REPAIR`; người giữ bước: `PENDING_ACCEPTANCE` |
  | `PAYMENT_REQUEST` | manager | `PENDING_PAYMENT_REQUEST`, `NEEDS_PAYMENT_UPDATE` |
  | `PAYMENT_PROOF` | manager | `PENDING_PAYMENT` |

  Mọi `attachmentIds` gửi kèm hành động phải thuộc đúng hồ sơ và đúng mục đích; nếu không thì trả 400.
- **BR-14 Tệp bị khóa theo bản ghi.** Tệp đã gắn vào một lần trình, một quyết định, một lượt nghiệm thu, một đề nghị thanh toán hoặc một khoản thanh toán bị khóa cùng bản ghi đó. Về sau, sửa bản nháp, `PATCH attachmentIds` của hồ sơ, hay dùng lại tệp `CONSTRUCTION`/`ACCEPTANCE` ở lượt sau đều không được gỡ, xóa hay đổi tệp trong bản ghi cũ. `PATCH /records/:id` với `attachmentIds` chỉ tác động lên danh sách `SITE_PHOTO` của hồ sơ.
- **BR-13 Ngày.** Ngày dạng `YYYY-MM-DD`. "Hôm nay" tính theo giờ Việt Nam (UTC+7).

## 7. Hợp đồng API

- **Endpoint:** mỗi hành động mới là `POST /api/records/:id/<action>`, với `<action>` viết kebab-case theo tên ở mục 5, ví dụ `POST /api/records/:id/confirm-repair`. Các route đã có (`/submit`, `/withdraw`) giữ nguyên tên.
- **Body:** gồm `version` cùng các trường ở cột "Dữ liệu bắt buộc".
- **Kết quả thành công:** trả `{ record }` sau khi đổi; T05/T06 trả thêm `submissionId` và `attemptNo`, T18 trả thêm `paymentRequestId`.
- **Định dạng chung:** response, validation và tiền theo quy ước có sẵn trong `api-qltn/README.md`.

`GET /api/records/:id` trả thêm các phần sau, để web hiển thị đủ các tab như demo:

| Phần | Nội dung |
|---|---|
| `confirmations` | kết quả, ghi chú, người, thời điểm |
| `proposalDraft` | bản nháp hiện tại (chỉ người quản lý thấy) |
| `submissions` | mọi lần trình, mỗi lần kèm `decisions` và `signatures` |
| `construction` | ngày, tiến độ, nhật ký, bản lưu khắc phục |
| `acceptances` | mọi lượt kèm `checks` |
| `paymentDraft`, `paymentRequests`, `payments` | bản nháp, các đề nghị và quyết định, khoản đã ghi nhận |

Bộ `details.reason` dùng cố định:

| Mã | Khi nào |
|---|---|
| `missing_capability` | 403 · vai trò không có quyền |
| `not_record_manager` | 403 · không phải BQL quản lý hồ sơ |
| `not_step_assignee` | 403 · không phải người giữ bước hiện tại |
| `step_already_decided` | 409 · đã quyết định trong lượt nghiệm thu này |
| `invalid_status_transition` | 409 · trạng thái nguồn không hợp lệ |
| `self_approval_denied` | 409 · BR-06 |
| `max_submission_attempts` | 409 · BR-08 |
| `final_attempt_decide_only` | 409 · BR-08 |
| `attachment_step_denied` | 403 · BR-12 |

Câu thông báo tiếng Việt giống demo.

## 8. Tiêu chí nghiệm thu

Mỗi AC có ít nhất một test e2e trên API thật. Seed dùng tài khoản demo: `bql-a`, `kt-a`, `kt-a2`, `kt-a-cu` (đã khóa), `tvkt`, `bqt`, `bql-b`, `kt-b`.

### S1 — Xác nhận hiện trạng

- **AC-1.1** `kt-a` (người xác nhận được giao) chạy T01, T02, T03 trên ba hồ sơ `PENDING_CONFIRMATION`. Hồ sơ lần lượt sang `NEEDS_RECORD_UPDATE`, `PENDING_PROPOSAL`, `CLOSED_NO_REPAIR`; `confirmations` và audit có ghi chú.
- **AC-1.2** `kt-a2` (cùng vai trò, không được giao), `bql-a` và `kt-b` (tòa khác) gọi T02 thì nhận lần lượt 403 `not_step_assignee`, 403 `missing_capability`, 404. Hồ sơ không đổi.
- **AC-1.3** Hồ sơ `NEEDS_RECORD_UPDATE` được BQL sửa và gửi lại (hành động có sẵn), sau đó `kt-a` xác nhận được. Lịch sử giữ cả hai lần xác nhận.
- **AC-1.4** Ghi chú 4 ký tự trả 400 lỗi trường `note`. `version` cũ trả 409 `CONFLICT`.

### S2 — Tờ trình và chuỗi duyệt

- **AC-2.1** Hồ sơ có snapshot `[TECH, BOARD]`: BQL lưu nháp, rồi trình kèm chữ ký. Hồ sơ sang `PENDING_TECH_REVIEW`; `tvkt` duyệt thì sang `PENDING_BOARD_APPROVAL`; `bqt` duyệt thì sang `READY_FOR_CONSTRUCTION`. Số đã duyệt bằng số của lần trình (BR-10).
- **AC-2.2** Đổi cấu hình tòa sau khi hồ sơ đã tạo, ví dụ thêm `TECH_CONFIRM`. Chuỗi duyệt của hồ sơ vẫn theo snapshot.
- **AC-2.3** Hồ sơ có bước tùy chỉnh trong snapshot: chỉ người trong `approvalAssigneeUserIds` có đúng vai trò mới duyệt được, ở trạng thái `PENDING_CUSTOM_APPROVAL`.
- **AC-2.4** Trình thiếu từng điều kiện của BR-04 trả 400 với đúng trường lỗi. Khi người giữ một bước là `kt-a-cu` (đã khóa), trình trả 400 lỗi `approvalStepKeys.<index>` (BR-05).
- **AC-2.5** Yêu cầu bổ sung ở bước 2 chuyển hồ sơ sang `NEEDS_SUBMISSION_UPDATE`. Trình lại thì bắt đầu lại từ bước 1, `attemptNo` = 2, và lần trình 1 giữ nguyên nội dung cùng các quyết định (BR-03, BR-07).
- **AC-2.6** Từ chối ở lần 1 và lần 2 chuyển hồ sơ sang `REJECTED_RESUBMITTABLE`. Ở lần 3: yêu cầu bổ sung trả 409 `final_attempt_decide_only`, từ chối chuyển hồ sơ sang `UNRESOLVED`. Trình lần 4 trả 409 `max_submission_attempts`.
- **AC-2.7** Người trình tự duyệt trả 409 `self_approval_denied`. Gửi `submissionId` cũ trả 409 `CONFLICT`. Người không giữ bước hiện tại trả 403 `not_step_assignee`.

### S3 — Thi công và nghiệm thu

- **AC-3.1** BQL bắt đầu thi công, cập nhật tiến độ 50 rồi 100, rồi gửi nghiệm thu kèm 1 ảnh. Hồ sơ sang `PENDING_ACCEPTANCE`, lượt 1 có trạng thái chờ.
- **AC-3.2** Gửi nghiệm thu khi tiến độ dưới 100, khi `completedDate` ở tương lai hoặc trước `startDate`, hoặc khi không có ảnh: đều trả 400 với đúng trường lỗi.
- **AC-3.3** Chuỗi mặc định `[TECH_CONFIRM, TECH]`: `tvkt` đạt trước rồi `kt-a` đạt sau thì hồ sơ sang `PENDING_PAYMENT_REQUEST`. `kt-a` chọn đạt mà không kèm biên bản thì trả 400 `reportAttachmentIds`.
- **AC-3.4** Một người chọn không đạt: hồ sơ sang `NEEDS_REPAIR` ngay, kể cả khi người kia chưa quyết định. BQL lưu nội dung khắc phục rồi gửi nghiệm thu lại: hồ sơ có lượt 2, và lượt 1 giữ nguyên kết luận.
- **AC-3.5** Chuỗi nghiệm thu khác mặc định, ví dụ `[TECH]` hoặc `[TECH, TECH_CONFIRM]`, đi tuần tự đúng thứ tự cấu hình. Người đã quyết định trong lượt mà quyết định lại thì trả 409 `step_already_decided`.

### S4 — Thanh toán và đóng hồ sơ

- **AC-4.1** BQL gửi đề nghị đúng số đã duyệt kèm tệp. Hồ sơ sang `PENDING_PAYMENT_APPROVAL`; `bqt` duyệt thì sang `PENDING_PAYMENT`; BQL ghi nhận thanh toán kèm chứng từ rồi đóng hồ sơ, và hồ sơ sang `COMPLETED`.
- **AC-4.2** Gửi đề nghị khác số đã duyệt hoặc thiếu tệp trả 400. Ghi nhận thanh toán khác số đề nghị, với ngày ở tương lai, thiếu `reference` hoặc thiếu chứng từ trả 400. Ghi nhận lần thứ hai cho cùng một đề nghị trả 409.
- **AC-4.3** BQT trả đề nghị: hồ sơ sang `NEEDS_PAYMENT_UPDATE`. BQL gửi lại thì có đề nghị `revisionNo` = 2, và đề nghị 1 giữ nguyên quyết định cùng lý do.
- **AC-4.4** Chuỗi thanh toán trong snapshot gồm một bước tùy chỉnh rồi đến `BOARD`. Bước tùy chỉnh dùng `roleDefId` là vai trò tùy chỉnh có `PAYMENT_DECIDE`; vai trò này dựa trên `OWNERS_BOARD`, vì chỉ BQT có `PAYMENT_DECIDE` và cấu hình tòa từ chối mọi bước thanh toán thiếu quyền này. Kết quả: trạng thái là `PENDING_CUSTOM_PAYMENT_APPROVAL`, duyệt tuần tự theo đúng người giữ bước; người giữ bước 2 duyệt trước lượt mình thì trả 403 `not_step_assignee`.
- **AC-4.5** Đóng hồ sơ khi chưa ghi nhận thanh toán đủ trả 400 lỗi trường `payment`. Hồ sơ `COMPLETED` không nhận thêm hành động nào: mọi hành động trả 409 `invalid_status_transition`.

### Chung

- **AC-0.1** Với mỗi hành động ở mục 5, người có capability gọi từ một trạng thái không có trong cột "Từ trạng thái" thì nhận 409 `invalid_status_transition` và không có audit nào được ghi. Với hành động mà người làm là `manager`/`confirmer`, người được giao gọi thì kết quả cũng vậy (thứ tự kiểm tra ở mục 4).
- **AC-0.4** Chữ ký SVG, chữ ký không phải PNG, hoặc lớn hơn 200 KB trả 400 lỗi trường `signature`.
- **AC-0.5** Sau khi trình lần 1, BQL gỡ một tệp `PROPOSAL` khỏi bản nháp rồi trình lần 2. Lần trình 1 vẫn còn tệp đó và tải về được (BR-14).
- **AC-0.6** Trong `PENDING_ACCEPTANCE`, `kt-a` (người giữ bước) tải lên được tệp `ACCEPTANCE`; `kt-a2` không giữ bước nên nhận 403 `attachment_step_denied`. BQL tải `PROPOSAL` khi hồ sơ đang ở `IN_CONSTRUCTION` cũng nhận 403 (BR-12).
- **AC-0.2** Sau mỗi slice, `GET /api/records/summary` và danh sách với `attention=needs_update` đếm đúng các trạng thái mới, dùng bộ nhóm có sẵn trong `record-status-groups.ts`.
- **AC-0.3** Web ở chế độ `api` chạy được luồng của slice đó bằng tài khoản demo, giống demo ở chế độ mock.

## 9. Phụ thuộc mở

| OD | Ảnh hưởng tới SPEC này |
|---|---|
| OD-05 | Thay TR-05: tạm ứng, nhiều đợt, số còn lại |
| OD-10 | Thay TR-01: Kế toán, Người nghiệm thu, TVKT |
| OD-11 | Thay TR-02: dự toán theo hạng mục, báo giá |
| OD-12 | Thay TR-03: nghiệm thu theo hạng mục kiểm tra; thay luôn quy tắc song song/tuần tự ở BR-09 |
| OD-13 | Thay TR-04: tài liệu nào được ký, ký lại khi đổi phiên bản |
| OD-03 | Chuỗi duyệt mặc định và người ký của từng tòa |
| OD-15 | Thay TR-06: giới hạn số lần trình tờ trình |
| OD-14 | Điều kiện nghiệm thu hợp đồng của cả nhóm B |

Nguồn hành vi: `web/src/domain/actions.ts`, `web/src/services/handlers/repair-record-handlers.ts`, `repair-proposal-handlers.ts`, `repair-execution-handlers.ts`, `repair-helpers.ts`; `api-qltn/src/domain/building-config.ts`, `permissions.ts`; `api-qltn/src/modules/records/record-actions.ts`. Nếu demo và SPEC khác nhau thì SPEC thắng. Nếu SPEC thiếu chỗ nào, dev-build hỏi PM/BA trước khi tự chọn.

## 10. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 26/10/2026 | Bản nháp đầu tiên (PD-03). |
| 26/10/2026 | Sửa theo review kỹ thuật của dev-build: AC-4.4 dùng bước tùy chỉnh có `PAYMENT_DECIDE`; tách thứ tự kiểm tra theo loại người làm (mục 4); quy định cách gửi và lưu chữ ký (BR-04); thêm khóa tệp theo bản ghi (BR-14); quy định ai được tải tệp theo mục đích (BR-12); T13 xác định theo `role`; TR-06 chuyển sang OD-15; giữ tên các route có sẵn; thêm AC-0.4–AC-0.6. |
