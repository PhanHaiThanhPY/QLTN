# Handoff: TK-S1 Việc sửa chữa của tôi, có hạn xử lý

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-29) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-TK.15).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/tk-s1-my-tasks`.
- **Chạy song song với MT-S1.** Hai slice cùng chạm vài file của records:
  - MT-S1 thêm thiết bị vào hồ sơ;
  - TK-S1 thêm hạn vào view của hồ sơ, `record-view.ts`, `records.service.ts`.

  Nên rebase lên `main` sau khi slice kia merge, để tránh xung đột.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- **Luật thao tác:** `api-qltn/src/modules/records/record-actions.ts` (33 thao tác, mỗi thao tác có `from`, `capability`, `slot`).
- **Người giữ bước:** `record-steps.ts` (`currentStepKeyOf`, `stepHolderOf`, `approvalStepOf`, `acceptanceStepsHeldBy`), `stage-holders.ts`, `record-assignment.ts` (`isActiveUserForApprovalStep`, `loadAssignmentContext`).
- **Số ngày hạn:** `taskDueDays` chụp vào hồ sơ khi tạo hoặc gửi. Chỉ có 4 loại sửa chữa: `CONFIRM_RECORD`, `APPROVE_PROPOSAL`, `REVIEW_ACCEPTANCE`, `APPROVE_PAYMENT` (`domain/building-config.ts`).
- **Nhật ký:** `audit_events` có `subject_id`, `to_status`, `actor_id`, `created_at`. Dùng cho thời điểm vào trạng thái và cho "Đã hoàn thành".
- **Hạn hồ sơ khẩn cấp:** `docsOverdue` / `hoursLeft` của B06.
- **Demo:**
  - `web/src/domain/task-rules.ts` (`REPAIR_TASK`, `desiredRepairTasks`) là tài liệu sống về ai nhận việc gì;
  - `features/tasks/*` là màn hình;
  - `TASK_KIND_TAB` (`domain/constants.ts`) cho biết bấm việc thì mở tab nào.

**Những gì phải tạo mới:**
- Phần tính việc ở API, dùng chung luật với `record-actions.ts`. **Không** viết một bộ luật thứ hai lệch với luật thao tác.
- Endpoint "việc của tôi" (đang mở, đã hoàn thành) và ô số.
- Thêm hạn và cờ quá hạn vào view của `GET /records` và `GET /records/:id`.
- Nối web chế độ `api`, mở menu "Công việc" ở chế độ `api` (`router.tsx` dòng 57, `navigation.ts`).

**Cần lưu ý:**
- Giờ Việt Nam cho "hôm nay" (dùng `vnDate()` như các chỗ khác).
- Không cần migration. Nếu thêm một cột thời điểm vào bước để truy vấn nhanh, ghi lý do và tên tệp migration vào bằng chứng.
- Ghi số đo thời gian đáp ứng (SPEC §5).

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/tk-s1-my-tasks` (worktree `../QLTN-tk-s1`, tách từ `main` d3bf0f9). Chưa push, chưa merge.

**Commit:**
- `faa0f20`: API.
- `3abde36`: web.
- Commit bằng chứng này: số đếm "Đã hoàn thành" không còn bị giới hạn, nhãn ngắn của ô số trên điện thoại, script và ảnh.

**Không có migration.**

**Rebase:** MT-S1 cũng sửa `records.service.ts`, `record-view.ts` và `navigation.ts`. Khi MT-S1 vào `main`, tôi sẽ rebase nhánh này. Xung đột dự kiến chỉ ở vài dòng import và ở danh sách `API_READY_PATHS`.

### API

`GET /me/tasks` trả `{ asOf, today, open[], done[], counts{open, overdue, dueToday, done} }`.
- Endpoint không có tham số nào: tham số lạ bị bỏ qua, và người gọi luôn chỉ nhận việc của chính mình (BR-TK-09).
- Mỗi việc đang mở gồm: `kind`, `label`, `tab`, `detail` (dòng "Cần phân công lại"), `dueAt`, `isOverdue`, `startedAt` và `record` (mã, tên, tòa, vị trí, trạng thái, ưu tiên, `isEmergency`).
- `GET /records` và `GET /records/:id` có thêm `dueAt` và `isOverdue` của bước hiện tại (BR-TK-04).

### Cách tính (D-TK-1: tính lúc đọc, không lưu)

- **`task-rules.ts` (hàm thuần):** đi từ trạng thái hồ sơ, người giữ bước và đúng các slot của `record-actions.ts`.
  - **BQL quản lý** (`manager`): bảng `MANAGER_TASK_BY_STATUS`.
  - **Người xác nhận** (`confirmer`).
  - **Người giữ bước tờ trình hiện tại** (`approvalStep`, `currentStepKeyOf`).
  - **Thành viên nghiệm thu chưa quyết định ở lượt đang mở** (`acceptanceMember`): mỗi người một việc, kể cả khi giữ hai bước.
  - **Người giữ bước thanh toán hiện tại** (`paymentStep`), cho cả quyết toán lẫn tạm ứng.
  - **Mọi người có `PAYMENT_CONFIRM` trong tòa** (`building`), cho việc ghi nhận chuyển khoản (D-TK-2).
  - **Người giữ bước BQT** (`boardStep`), khi hồ sơ ở POST_REVIEW_REJECTED.
- **`task-facts.ts`:** nạp dữ liệu cho nhiều hồ sơ bằng một số truy vấn cố định.
  - **Thời điểm vào trạng thái:** dòng nhật ký gần nhất có `from_status ≠ to_status`. Một số thao tác (như duyệt tạm ứng) ghi lại cùng trạng thái, nên không lấy được dòng gần nhất bất kỳ.
  - **Lúc bắt đầu bước tờ trình:** mốc muộn hơn giữa lúc vào trạng thái và lần duyệt gần nhất của tờ trình hiện tại. Mốc này cần cho các bước tùy chỉnh nối tiếp nhau mà cùng một trạng thái.
  - **Nghiệm thu:** lấy lượt nghiệm thu đang mở và các quyết định đã có trong lượt.
  - **Đợt thanh toán:** các đợt đang chờ duyệt hoặc chờ chuyển khoản; lúc bắt đầu bước là mốc muộn hơn giữa lúc gửi và quyết định gần nhất của lần sửa hiện tại.
  - **Kiểm người giữ bước:** dùng `loadAssignmentContext` và `isActiveUserForApprovalStep`, đúng như các thao tác tự kiểm. Người xác nhận được tính hợp lệ thêm khi là BQT, theo BR-07.
- **Cần phân công lại (BR-TK-03):**
  - Người giữ bước bị khóa (`đã khóa`) hoặc mất phạm vi/vai trò (`không còn hợp lệ`) thì không nhận việc.
  - BQL của hồ sơ nhận **một** việc "Cần phân công lại", có dòng "Bước «nhãn bước» · «họ tên (mã)» («lý do»)".
  - Nếu chính BQL cũng không còn hợp lệ, việc đi tới mọi ADMIN trong phạm vi tòa (D-TK-5).
- **Hạn (BR-TK-04):** = mốc bắt đầu + số ngày của loại việc trong `taskDueDays` đã chụp vào hồ sơ.
  - Chỉ CONFIRM_RECORD, APPROVE_PROPOSAL, REVIEW_ACCEPTANCE và APPROVE_PAYMENT (dùng cả cho duyệt tạm ứng) có hạn.
  - "Nộp hồ sơ khẩn cấp" dùng `docsDueAt` của B06 cho đến khi tờ trình được nộp.
  - Các việc còn lại "Không có hạn" (D-TK-3).
  - Hạn của hồ sơ trong list/detail là hạn sớm nhất trong các việc đang mở, không phụ thuộc người giữ bước còn hợp lệ hay không.
- **Đã hoàn thành (BR-TK-06):** lấy từ nhật ký các thao tác `COMPLETED_ACTIONS` của chính người xem trong 30 ngày, trong phạm vi tòa.
  - Tên việc và kết quả có bảng riêng, ví dụ `confirmRepair` → "Xác nhận hồ sơ · Đã xác nhận cần sửa".
  - Danh sách trả tối đa 200 dòng mới nhất. Ô số đếm toàn bộ, không bị giới hạn.
- **Sắp xếp (BR-TK-07):** quá hạn → khẩn cấp (B06) hoặc ưu tiên Khẩn cấp/Cao → có hạn → không có hạn; trong mỗi nhóm theo hạn rồi theo lúc vào bước. Web áp cùng cách sắp cho cả mock.

### Ghi chú về BR-TK-02

- "Chưa xử lý, chưa phát hành thông báo" (UNRESOLVED) **không có việc**:
  - API không có thao tác nào cho trạng thái này trong `record-actions.ts`;
  - UNRESOLVED nằm trong `RECORD_FINAL_STATUSES`.

  Theo BR-TK-01, không có thao tác thì không có việc. Khi API có thao tác phát hành thông báo, chỉ cần thêm một dòng vào bảng.
- "Đang thi công" ghi "Gửi nghiệm thu" theo SPEC, dù demo ghi "Cập nhật thi công".
- Thêm hai loại việc mà demo chưa có: "Duyệt tạm ứng", "Ghi nhận chuyển khoản tạm ứng" (theo SPEC), và "Đóng hồ sơ không duyệt hậu kiểm".

### Web

- **Cùng một mô hình dòng việc** (`services/my-tasks-service.ts`): chế độ api đọc `GET /me/tasks`; chế độ mock đổi các việc đã lưu của demo sang cùng mô hình. Nhờ vậy màn hình và các sửa lỗi TD-01 đến TD-03 áp cho cả hai chế độ.
- **Màn `/tasks`:**
  - đầu trang "Hôm nay, dd/mm/yyyy" (TD-01);
  - 4 ô số dạng nút bật/tắt `aria-pressed`: Đang mở / Quá hạn / Đến hạn hôm nay (TD-02) / Đã hoàn thành (30 ngày), trên điện thoại hiện nhãn ngắn;
  - tìm bỏ dấu (TD-03), lọc theo tòa, loại việc và hạn; trên điện thoại các bộ lọc gom vào sheet "Lọc";
  - mỗi dòng của bảng là một liên kết có tên đọc được;
  - thẻ "Tiếp tục công việc" trên điện thoại;
  - tự tải lại khi cửa sổ được focus; có dòng báo khi mất mạng;
  - lọc "Sửa chữa/Bảo trì" chỉ hiện ở chế độ mock.
- **Menu:** "Công việc của tôi" hiện ở chế độ api (thêm `/tasks` vào `API_READY_PATHS`); route bỏ `connected()`.
- **Thay đổi component:**
  - `TaskTable`, `TaskCard` và `TaskMetricCard` được sửa cho mô hình mới. `TaskStatusBadge` bị xóa vì không còn nơi dùng.
  - Thẻ việc trên dashboard (mock) dùng `toMyTaskRow`.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| AC-TK.1 | e2e: chỉ `kt-a` có "Xác nhận hồ sơ", tab `overview`; `bql-a` và `kt-a2` không có; unit `task-rules.spec` |
| AC-TK.2 | e2e: việc duyệt chỉ ở TVKT; TVKT duyệt xong thì việc chuyển sang BQT; unit cho bước hiện tại và mốc bắt đầu bước |
| AC-TK.3 | e2e: KT và TVKT (thành viên nghiệm thu của mẫu mặc định) mỗi người có một việc; KT quyết định ĐẠT thì mất việc và có dòng "Nghiệm thu · Đạt" ở "Đã hoàn thành"; unit cho ca một người giữ hai bước |
| AC-TK.4 | e2e (dùng đợt tạm ứng): BQT có "Duyệt tạm ứng", sau đó `ktoan-a` có "Ghi nhận chuyển khoản tạm ứng", ghi nhận xong thì hết; unit cho quyết toán và tạm ứng |
| AC-TK.5 | e2e: khóa BQT (cập nhật thẳng DB vì form tài khoản cần đủ trường) → BQL có một việc "Cần phân công lại" với dòng "Bước BQT duyệt · … (đã khóa)"; unit cho ca BQL không hợp lệ → ADMIN |
| AC-TK.6 | e2e: hạn = lúc vào trạng thái + số ngày đã chụp; đẩy lùi mốc thì có cờ quá hạn và tăng ô "Quá hạn"; unit `task-list` cho "Đến hạn hôm nay" (lúc 08:00 thì tính, đã quá hạn thì không) |
| AC-TK.7 | e2e: đổi `task_due_days` của tòa sau khi gửi → hạn giữ nguyên |
| AC-TK.8 | e2e và unit: "Soạn tờ trình" không có hạn và không có cờ quá hạn |
| AC-TK.9 | e2e: `GET /records` và `GET /records/:id` trả cùng `dueAt` và `isOverdue` |
| AC-TK.10 | e2e: dòng "Xác nhận hồ sơ · Đã xác nhận cần sửa"; dòng cách đây 31 ngày không còn hiện |
| AC-TK.11 | unit API (`compareTasks`) và web (`task-list.test`) |
| AC-TK.12 | test web `task-list` ("bom", "sc-031"); test `my-tasks-service` trên DB mock |
| AC-TK.13 | e2e: `bql-b` không thấy việc của tòa A; `?userId=` không đổi được kết quả |
| AC-TK.14 | Script: menu có "Công việc của tôi", đầu trang "Hôm nay, 27/10/2026", không còn "Tháng 10, 2026"; test component |
| AC-TK.15 | Script ở 375px cho KT và BQT: overflow 0px, thẻ "Tiếp tục công việc" là việc đứng đầu; test component (ô số `aria-pressed`, lọc, rỗng, rỗng do lọc, lỗi kèm "Thử lại", tab "Đã hoàn thành"); ảnh `evidence/TK-kt-a-wide.png`, `TK-kt-a-375.png`, `TK-bqt-wide.png`, `TK-bqt-375.png` |

### Số đo thời gian đáp ứng (SPEC §5)

`GET /me/tasks` trên `qltn_dev` (69 hồ sơ trong phạm vi BQL-A), đo qua proxy vite, lấy 7 lần sau một lần khởi động:

| Tài khoản | Việc đang mở / đã hoàn thành | Trung vị | Lâu nhất |
|---|---|---|---|
| `kt-a` | 3 / 2 | 59 ms | 90 ms |
| `bqt` | 9 / 84 | 62 ms | 109 ms |
| `bql-a` | 49 / 217 | 79 ms | 136 ms |

Lần đo trước, khi API vừa nạp lại, lâu nhất là 222 ms. Mọi lần đo đều dưới 500 ms.

### Test đã chạy

- **api-qltn:**
  - `format:check`, eslint (`src/modules/tasks`, `src/modules/records`, e2e) và `tsc --noEmit` đều OK.
  - Unit `task-rules.spec`: 21/21.
  - e2e `my-tasks` 7/7; `records-list`, `records-summary`, `record-confirmations`, `record-proposals` và `record-emergency` đạt 44/44.
- **web:**
  - `tsc -b` OK.
  - Toàn bộ vitest: 499/499. Test mới: `task-list`, `TasksPage`, `my-tasks-service`.
- **Trình duyệt thật:** script `supporting/tk-s1-tasks-check.mjs`, chế độ api, API của worktree ở cổng 5302, cổng debug Chrome 9344. Kết quả: PASS.

### Dữ liệu thử để lại trên qltn_dev

Ba hồ sơ `[TEST TK VIỆC] …` mã SC-069, SC-070 và SC-071, đang chờ KT-A xác nhận, ưu tiên Cao.

