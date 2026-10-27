# Handoff: F-S1 Mời thầu và tiếp nhận hồ sơ dự thầu khai thác

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-32) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-F1.14).

**Cách làm:**
- **Xếp sau MT-S2** trong hàng việc của bạn. Không chạm vào code bảo trì, nên không phụ thuộc MT-S2.
- Tạo nhánh và worktree riêng, tách từ `main` mới nhất. Gợi ý: `feature/f-s1-exploitation-invitations`.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Bối cảnh:** đây là slice đầu tiên của nhóm F (Quỹ khai thác). **Không có demo** để làm theo. Hình D1 tr. 5–6 là mẫu giao diện; bản mô tả đọc từ hình nằm ở `docs/product/modules/F-quy-khai-thac.md` §2.

**Những gì đã có sẵn:**
- Tòa và vị trí (khu vực của gói chọn từ danh mục vị trí).
- Module tệp (AT-S1) và nhật ký (`audit`). Cần thêm loại chủ thể và mục đích tệp cho gói khai thác và hồ sơ dự thầu.
- Vai trò `BQL`, `OWNERS_BOARD`, `ACCOUNTANT`; ma trận quyền v2 (`api-qltn/src/domain/permissions.ts`, ADR-0001).
- Cách làm việc tự chạy ở máy chủ: lần sinh lượt 00:15 của MT-S2 đang làm. Dùng **chung một cơ chế lịch chạy** cho việc tự đóng nhận và tự chuyển quá hạn bổ sung, không dựng thêm cơ chế thứ hai.

**Những gì phải tạo mới:**
- Bảng đơn vị khai thác, gói và phiên bản phát hành, hồ sơ dự thầu, tài liệu theo mục, yêu cầu bổ sung. Gộp vào **một** migration mới.
- Quyền mới cho khai thác (BR-F1-11). Bạn đặt tên quyền; cập nhật ma trận và tài liệu RM (`docs/product/features/RM-ma-tran-quyen-v2/`).
- Nhóm menu "Quỹ khai thác", chỉ hiện ở chế độ `api` và cho người có quyền.

**Cần lưu ý:**
- Tiền (giá chào): số nguyên VND (bigint), không dùng số thực.
- Trễ hạn so **thời điểm tiếp nhận** với hạn nhận, không so lúc nhập (BR-F1-07).
- KT và kế toán phải nhận 403 khi xem giá chào và tài liệu dự thầu.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/f-s1-exploitation-invitations` (worktree `../QLTN-f-s1`).
- **Tách từ `feature/mt-s2-plans` (`6e3b32c`),** vì handoff yêu cầu dùng chung cơ chế lịch chạy của MT-S2, mà MT-S2 chưa vào `main`. Nhánh có thêm một merge từ `main` `b5b1c84` để lấy SPEC này.
- Sau khi MT-S2 merge, chỉ còn các commit F-S1. Có thể rebase lên `main` nếu PM/BA muốn lịch sử thẳng.

**Commit F-S1:** `30fa94e` (schema, quyền, bộ lịch chạy), `66de64e` (API + e2e + seed), `36445d2` (web), các commit sửa sau, và commit bằng chứng này.

**Migration:** `api-qltn/src/database/migrations/2026-10-27f-exploitation-invitations.sql`.
- Sáu bảng: `exploitation_partners`, `exploitation_packages`, `exploitation_package_revisions`, `exploitation_bids`, `exploitation_bid_items`, `exploitation_supplement_requests`.
- Chạy thử hai lần liền trong `BEGIN … ROLLBACK` trên qltn_dev: OK.
- Đã áp thật lên qltn_dev khi API của worktree khởi động để chụp ảnh. Seed đã thêm MT-001, DV-001 (DV-A) và DV-002 (DV-B).

### Quyết định (SPEC giao cho dev-build hoặc chưa nói rõ)

- **Quyền (BR-F1-11):**
  - `EXPLOITATION_VIEW` cho BQL và BQT: xem gói, đơn vị, hồ sơ, giá và tài liệu.
  - `EXPLOITATION_MANAGE` cho BQL: mọi thao tác ghi.
  - KT, TVKT, kế toán và ADMIN không có, nên gọi API nhận 403. Ngoài phạm vi tòa nhận 404 trước.
  - Đã cập nhật ma trận ở API, web (`permissions.ts`, nhãn, bảng quyền của trang Vai trò), ADR-0001 §3 và lịch sử RM.
  - Vai trò tùy chỉnh dựa trên BQL/BQT thấy quyền mới ở dạng "Có quyền mới chưa bật". Test RM AC-1.6 đã cập nhật đúng theo điều này.
- **Tệp:**
  - Hai mục đích tệp mới: `EXPLOITATION_DOCUMENT` (của gói) và `BID_DOCUMENT` (của hồ sơ).
  - **Đọc tệp của gói và hồ sơ cần `EXPLOITATION_VIEW`.** Trước đây đọc tệp chỉ kiểm phạm vi tòa, nên phải thêm điều kiện này để KT và kế toán nhận 403 (AC-F1.12).
- **Lịch chạy dùng chung:**
  - `JobScheduler` (toàn cục) chạy mỗi việc một lần khi khởi động, rồi theo hẹn giờ.
  - Lần sinh lượt 00:15 của MT-S2 nay đăng ký trên bộ này.
  - F-S1 thêm một việc chạy mỗi phút: đóng nhận khi đến hạn (gắn cờ thiếu giá chào) và chuyển "Quá hạn bổ sung".
  - Tắt khi `NODE_ENV=test` hoặc khi `SCHEDULER=off`. Biến `MAINTENANCE_SCHEDULER` của MT-S2 được thay bằng `SCHEDULER`.
- **`Clock`:** "bây giờ" của các luật hạn đi qua `Clock`, để test cố định được.
- **Phát hành bản sửa:**
  - Thay được tài liệu, đổi tên và thêm mục. **Không bỏ được mục đã phát hành**, để hồ sơ đã nhận không mất mục; SPEC chỉ nêu trường hợp thêm mục.
  - Hạn nhận đổi bằng "Gia hạn", không đổi qua bản sửa. Danh sách mời giữ nguyên.
- **Ghi nhận hồ sơ lần hai** (AC-F1.5): API trả `{ bid, existing: true }` với hồ sơ cũ, không sửa gì.
- **Lý do nhận ngoài danh sách mời:** tối thiểu 5 ký tự, theo luật lý do chung, vì SPEC không nêu số ký tự.
- **Cập nhật tài liệu:**
  - Chọn "Đã nhận" hoặc "Chưa nhận" cho từng mục, kèm tệp. Trạng thái "Cần bổ sung" chỉ đặt qua yêu cầu bổ sung.
  - Mục đang bổ sung chuyển "Đã nhận" thì xóa hạn bổ sung trên mục; yêu cầu đã ghi vẫn còn trong lịch sử yêu cầu.
- **Đóng sớm:** khi bị chặn, thông báo nêu rõ mã đơn vị chưa nộp hoặc hồ sơ chưa có giá chào.
- **Màn hình:**
  - Phần đầu trang gói dùng `DetailHeaderCard`, cùng mẫu với trang kế hoạch MT-S2.
  - Thêm 3 component dùng chung: menu `⋯` của MT-S2; `useMediaQuery` (trên điện thoại, bấm thẻ đơn vị thì mở trang đối chiếu riêng); và `FigureRow` (ô số dạng `<dl>`).
- **Seed demo:** chỉ chạy cho tòa A.
  - Tên đơn vị là "DV-A", "DV-B" như trong D1; mã do hệ thống cấp là DV-001, DV-002.
  - Tệp mẫu là PDF một trang.
  - Hạn bổ sung của DV-B là hôm nay + 5 ngày, 17:00.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| F1.1 | e2e "a DV code; a taken tax code refused…; a same name only warned"; ảnh F1-6 |
| F1.2 | e2e "issuing names the missing document…" (`documents.CRITERIA`; phiên bản 01; nhật ký); web `IssueDialog.test`; ảnh F1-4 |
| F1.3 | e2e "a deadline before the issue is refused; extending works; shortening is refused" |
| F1.4 | e2e "a corrected issue makes revision 02…" (giữ phiên bản 01; thêm mục "Chưa nhận"; thành Thiếu; không bỏ được mục) |
| F1.5 | e2e "a complete bid shows 4/4; a second recording opens the same bid" |
| F1.6 | e2e "a supplement request makes 3/4 Đang bổ sung; past its due time the item is overdue" (đúng 17:00 thì chưa, 17:01 thì quá hạn) |
| F1.7 | e2e "a partner outside the invitation needs a reason and carries the flag" |
| F1.8 | e2e "lateness follows the receipt time, not the entry time" |
| F1.9, F1.11 | e2e "the deadline closes the package by itself…" và "after the supplement due time a closed package takes no change"; ảnh F1-5 |
| F1.10, F1.11 | e2e "early close needs every invitee and price; cancel works; an issued package cannot be deleted" (DELETE → 409; nháp chưa phát hành → 204) |
| F1.12 | e2e "BQT reads but cannot write; KT and accountant get 403; another building answers 404" (gồm cả tệp và ADMIN); script: KT/kế toán 403 |
| F1.13 | e2e "the demo seed holds MT-001 with DV-A 4/4 and DV-B 3/4, and a second run adds nothing" |
| F1.14 | ảnh F1-1…9; web `BidsTab.test`, `ChecklistEditor.test`, `exploitation-ui.test`, `navigation.test` (menu ẩn ở mock, ẩn với KT/kế toán/ADMIN); 375px không cuộn ngang |

### Ảnh (`supporting/evidence/`, chế độ api, `bql-a`)

Script: `supporting/f-s1-exploitation-check.mjs`. Kết quả: PASS.
- Dữ liệu thử để lại trên qltn_dev: đơn vị `[TEST F] …` (DV-003…005) và gói đã đóng MT-002, MT-004, MT-006.
- Các gói nháp thử (MT-003, MT-005, MT-007) đã bị script xóa.

| Ảnh | Nội dung |
|---|---|
| F1-1-packages | menu "Quỹ khai thác", ô số, bảng gói |
| F1-2-mt001-invitation | MT-001 đang nhận: hồ sơ phát hành và bản xem |
| F1-3-mt001-bids-dvb | tab hồ sơ: DV-A 4/4 Đủ, DV-B 3/4 Đang bổ sung (đang chọn); phần đối chiếu DV-B |
| F1-4-draft-issue-checklist | gói nháp thiếu "Tiêu chí đánh giá": danh sách kiểm có ✗ |
| F1-5-closed-package | gói đã đóng nhận (đóng sớm) |
| F1-6-partners | danh mục đơn vị |
| F1-7-packages-375, F1-8-bids-375, F1-9-bid-375 | điện thoại: thẻ, ô số 2 × 2, nút chính dính đáy, trang đối chiếu riêng có nút quay lại |

### Test đã chạy

- **api:**
  - `format:check`, `tsc` và eslint: OK.
  - unit 104/104.
  - e2e trên `qltn_build_e2e` đạt 64/64: `exploitation` (13), `attachments`, `maintenance-plans`, `maintenance-items`, `role-matrix-v2`, `audit-log`.
- **web:** `tsc -b` OK; vitest toàn bộ 555/555 (88 tệp).

### Ghi chú cho review

- Nhánh gồm cả các commit MT-S2. Phần review của F-S1 là các commit từ `30fa94e`, cộng việc chuyển lần sinh lượt của MT-S2 sang `JobScheduler`.
- **Khi merge:**
  - `API_READY_PATHS` (`web/src/app/navigation.ts`) bị TK-S1, MT-S2 và F-S1 cùng sửa. Giữ đủ `/tasks`, `/maintenance/plans`, `/exploitation/packages` và `/exploitation/partners`.
  - Thứ tự `app.module.ts` cần có cả `TasksModule` lẫn `ExploitationModule`.

## Đóng F-S1 (PM/BA, 27/10/2026)

- **F-S1 đóng.** Review PASS WITH RESIDUE trên `a572cbe`: e2e khai thác 13/13, API unit 104/104, web 555/555. Đọc tệp của gói và hồ sơ giờ cần quyền `EXPLOITATION_VIEW` (AC-F1.12). Mọi AC đều có bằng chứng ở trên.
- **Residue được chấp nhận:** chưa chạy lại trình duyệt trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
- **Merge vào `main`** theo yêu cầu của chủ dự án: TK-S1 (`896d7eb`), rồi nhánh tích hợp `integration/tk-mt2-f1` (`d6ebda4`, MT-S2 và F-S1). dev-build gỡ xung đột `navigation.ts` và `app.module.ts` theo kiểu giữ cả hai. PM/BA kiểm `API_READY_PATHS` đủ 9 đường dẫn.
- **Kiểm trên bản đã merge:**
  - dev-build: vitest 229/229, API unit 79/79, e2e 58/58;
  - PM/BA: typecheck API và web.
- **Trước khi chạy code này**, phải áp migration `2026-10-27f-exploitation-invitations.sql` lên mọi DB. API tự áp khi khởi động.

