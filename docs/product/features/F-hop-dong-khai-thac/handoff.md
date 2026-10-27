# Handoff: F-S2 Chọn đơn vị, hội nghị thông qua và hợp đồng khai thác

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-33) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-F2.17).

**Cách làm:**
- **Chỉ bắt đầu sau khi F-S1 đạt review.** Xếp **sau MT-S3** trong hàng việc của bạn, trừ khi bạn thấy làm trước hợp lý hơn; nếu đổi thì báo PM/BA.
- Tách nhánh từ nhánh F-S1 đã đạt review, hoặc từ `main` nếu F-S1 đã merge. Gợi ý: `feature/f-s2-exploitation-contracts`. Rebase lên `main` sau khi F-S1 vào `main`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn (F-S1):**
- Đơn vị khai thác; gói và phiên bản; hồ sơ dự thầu (tình trạng, cờ trễ hạn, giá chào).
- Quyền `EXPLOITATION_VIEW`, `EXPLOITATION_MANAGE`.
- Bộ lịch chạy dùng chung (JobScheduler). Việc cập nhật trạng thái kỳ hằng ngày dùng bộ này.
- Hình D1 tr. 7–9 là mẫu giao diện. Bản mô tả đọc từ hình nằm ở `docs/product/modules/F-quy-khai-thac.md` §2.

**Những gì phải tạo mới:**
- Kết quả chọn và các quyết định duyệt, hồ sơ hội nghị, hợp đồng và phiên bản, phụ lục, kỳ phải thu. Gộp vào **một** migration mới.
- Quyền duyệt kết quả chọn cho BQT (BR-F2-13). Bạn đặt tên quyền; cập nhật ma trận quyền và lịch sử RM.
- Kế toán: thêm quyền **xem hợp đồng và lịch phải thu**, nhưng không xem bảng so sánh giá chào.
- Menu "Hợp đồng khai thác" trong nhóm "Quỹ khai thác"; giữ đủ các mục `API_READY_PATHS`.

**Cần lưu ý:**
- Tiền: số nguyên VND (bigint), không dùng số thực.
- Lịch phải thu (BR-F2-11):
  - kỳ cuối ngắn vẫn thu đủ giá trị kỳ;
  - hạn thu không vượt ngày cuối kỳ;
  - cẩn thận với cuối tháng 31/28 khi cộng tháng.
- Phụ lục chỉ sinh lại các kỳ có hạn từ ngày hiệu lực của phụ lục trở đi (BR-F2-12).
- Điều kiện "Hiệu lực" theo DF-27: xét hồ sơ hội nghị **mới nhất có kết quả** của gói.
- Seed demo phải giữ lại một gói "Đang nhận hồ sơ" để demo F-S1 (BR-F2-14).
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/f-s2-selection-contracts`, tách từ `main` `5775da4` (đã có F-S1). Worktree `../QLTN-f-s2`. Chưa push.

**Commit:** `969b918` quy tắc lịch phải thu · `6d36cc0` quyền · `7f1de9f` schema · `0929e24`, `8789c90`, `4fbb051` (wip API) · `f1fc4ab` API · `dcbfc8a` seed · `6b1e903` format · `1639d61` web · commit bằng chứng (cuối nhánh).

**Migration:** `api-qltn/src/database/migrations/2026-10-27h-exploitation-contracts.sql`, gồm cả ràng buộc. Đã chạy thử `BEGIN … ROLLBACK` hai lần liền và chạy được. Đã áp lên `qltn_dev` khi khởi động API.
- Trạng thái gói thêm `SELECTED` và `NO_RESULT`.
- Bảng mới: `exploitation_selections`, `exploitation_selection_decisions`, `exploitation_assemblies`, `exploitation_contracts`, `exploitation_contract_revisions`, `exploitation_receivables`.
- Ràng buộc:
  - Mỗi gói chỉ có một hợp đồng chưa hủy (unique một phần).
  - Mỗi hợp đồng chỉ có một kỳ phải thu hiện hành cho mỗi số kỳ (`superseded_at IS NULL`).

### Quyết định của dev-build
- **Tên quyền:**
  - `EXPLOITATION_APPROVE` cấp cho BQT (BR-F2-13).
  - `EXPLOITATION_CONTRACT_VIEW` cấp cho BQL, BQT và Kế toán.
  - Kế toán không có `EXPLOITATION_VIEW`, nên không thấy hồ sơ dự thầu hay bảng so sánh.
  - Đã cập nhật permissions (API và web), ADR-0001 và lịch sử SPEC RM.
- **Kết quả chọn:** lập xong là ở ngay "Chờ duyệt", không qua bước nháp riêng. "Sửa và gửi lại" giữ nguyên mã KQ. "Đổi kết quả" tạo KQ mới, còn KQ cũ chuyển "Đã thay thế" khi KQ mới được duyệt.
- **Lý do:** lý do xét hồ sơ trễ hạn và các lý do yêu cầu sửa, từ chối, hủy cần tối thiểu 10 ký tự. Căn cứ và lý do đổi kết quả cần tối thiểu 20 ký tự.
- **Tệp của F-S2:** biên bản, tài liệu hội nghị và tài liệu hợp đồng đều gắn vào gói (`EXPLOITATION_PACKAGE`), với purpose `SELECTION_MINUTES`, `ASSEMBLY_DOCUMENT` và `CONTRACT_DOCUMENT`. Kế toán đọc được `CONTRACT_DOCUMENT` qua `EXPLOITATION_CONTRACT_VIEW`.
- **Hội nghị:**
  - Lập hồ sơ mới sau một HN "Thông qua" thì phải có lý do, và HN cũ chuyển "Đã thay thế".
  - Sau một HN "Không thông qua" thì là trình lại, không cần lý do.
  - HN được tính (DF-27) là HN mới nhất có kết quả. Nếu trùng ngày họp thì lấy HN lập sau (`createdAt`).
- **Hủy gói:** bị từ chối khi gói ở "Không có kết quả" hoặc có hợp đồng "Hiệu lực". Hợp đồng nháp hoặc đã ký thì bị hủy theo gói.
- **Trạng thái kỳ phải thu:** chạy hằng ngày lúc 00:15 giờ VN, qua JobScheduler của F-S1.
- **Seed:** đi qua các service thật, chạy sau khi transaction seed chính commit, và có thể chạy lại.
  - Kết quả: MT-001 → KQ-001 (DV-A) → HN-001 (NQ-001) → HĐ-001 hiệu lực, chu kỳ tháng, 3 kỳ từ ngày 1 tháng hiện tại.
  - Thêm gói "Quảng cáo màn hình thang máy · Sảnh" ở trạng thái "Đang nhận hồ sơ" (BR-F2-14).

### AC → bằng chứng
| AC | Bằng chứng |
|---|---|
| AC-F2.1, F2.2 | e2e `exploitation-contracts` "AC-F2.1 / AC-F2.2"; ảnh F2-1 (DV-B bị khóa, nêu tài liệu còn thiếu), F2-7 (BQT có nút Duyệt, Yêu cầu sửa, Từ chối); test component `F2Components` |
| AC-F2.3 | e2e "AC-F2.3" |
| AC-F2.4 | e2e "AC-F2.4" |
| AC-F2.5 | e2e "AC-F2.5" |
| AC-F2.6, F2.7 | e2e "AC-F2.6 / AC-F2.7"; ảnh F2-3 |
| AC-F2.8, F2.9, F2.11, F2.12 | e2e "AC-F2.8 / … / AC-F2.12"; unit `exploitation-receivables.spec`; test component cho danh sách điều kiện hiệu lực; ảnh F2-4, F2-5 |
| AC-F2.10 | e2e "AC-F2.10"; unit |
| AC-F2.13, F2.14 | e2e "AC-F2.13 / AC-F2.14"; unit sinh lại kỳ |
| AC-F2.15 | e2e "AC-F2.15"; ảnh F2-8 (Kế toán: không có nút ghi; menu có "Hợp đồng khai thác" nhưng không có "Mời thầu khai thác"); test `navigation.test` |
| AC-F2.16 | e2e "AC-F2.16"; seed trên `qltn_dev`: `+1 contracts`, MT-001 `SELECTED`/HĐ-001 `ACTIVE`, MT-008 `OPEN` |
| AC-F2.17 | ảnh F2-1…F2-10; ảnh 375px F2-9, F2-10 không cuộn ngang; bảng dùng `<tfoot>` và `th scope`, mốc hồ sơ dùng `<ol>` và `<time>`; mất mạng thì vô hiệu nút ghi và hiện Notice (chưa giả lập trong trình duyệt) |

### Test đã chạy
- **API:**
  - `format:check`, `tsc --noEmit`, eslint đều sạch.
  - unit 132/132.
  - e2e `exploitation-contracts` 10/10.
  - e2e exploitation, attachments và role-matrix: 38/38.
  - e2e plans, records và my-tasks: 30/30.
- **Web:** `tsc -b` sạch; vitest 575/575.
- **Trình duyệt:** `supporting/f-s2-contracts-check.mjs`, ảnh lưu ở `supporting/evidence/`. Script tạo thêm một gói tên bắt đầu bằng `[TEST F2 CHỌN]` trên `qltn_dev`.

### Còn lại / ngoài phạm vi
- Thu tiền, phiếu thu và tiền cọc thuộc F-S3. Kỳ 1 của HĐ-001 trong seed hiện "Quá hạn" vì chưa có bút toán thu.
- Nút AI 32px vẫn là residue chung, như ở MT-S3.

## Đóng F-S2 (PM/BA, 27/10/2026)

- **F-S2 đóng.** Review trên đúng bản ứng viên `64d6a62`: PASS WITH RESIDUE, không có lỗi sản phẩm.
  - e2e hợp đồng 10/10; chạy lại các phần liên quan 73/73; API unit 132/132; web 575/575.
  - PM/BA tự kiểm AC-F2.1, F2.2, F2.8 đến F2.13 và tệp migration.
- **Residue được chấp nhận:**
  - Chưa chạy lại trình duyệt và chưa giả lập offline trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
  - Nút AI dùng chung cao 32px, dưới mức 44px. Lỗi này có từ trước, không thuộc F-S2; ghi vào việc tồn.
- **Merge vào `main`:**
  - Merge thẳng xung đột 4 tệp với MT-S3: `database.module.ts`, `database-seed.service.ts`, `attachments.service.ts`, `router.tsx`.
  - dev-build gỡ trên nhánh tích hợp `integration/f-s2` (`dbbe32a`), giữ cả hai bên. Kết quả: API unit 138/138, e2e 58/58, web 92/92.
  - PM/BA kiểm route và module, rồi fast-forward `main`, rồi chạy typecheck API và web.
- **Trước khi chạy code này**, phải áp migration `2026-10-27h-exploitation-contracts.sql` lên mọi DB. API tự áp khi khởi động.

