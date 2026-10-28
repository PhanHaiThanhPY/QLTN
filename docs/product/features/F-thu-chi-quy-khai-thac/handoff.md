# Handoff: F-S3 Sổ quỹ khai thác, khoản thu, thuế và phiếu chi

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-34) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-F3.18).

**Cách làm:**
- **Chỉ bắt đầu sau khi F-S2 đạt review.** Xếp sau F-S2 trong hàng việc của bạn.
- Tách nhánh từ nhánh F-S2 đã review, hoặc từ `main` nếu F-S2 đã merge. Gợi ý: `feature/f-s3-exploitation-fund`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Đây là slice chốt mô hình tiền** (SPEC §3.1). Đọc §3.1 trước khi thiết kế bảng.
- **Nhóm T sau này dùng chung** quỹ, tài khoản và sổ quỹ. Vì vậy không đặt tên bảng hay kiểu dữ liệu riêng cho "khai thác" ở tầng sổ; loại quỹ là một trường.
- **Dòng sổ bất biến.** Sửa sai bằng dòng đảo liên kết dòng gốc. Không có `UPDATE` hay `DELETE` trên dòng sổ, kể cả ở API quản trị.
- **Số dư do máy chủ tính.**
  - Kiểm "không âm ở mọi ngày sau" (BR-F3-13) phải chạy trong cùng giao dịch với việc ghi, có khóa ở mức quỹ, để hai lệnh chi đồng thời không cùng lọt.
  - Có e2e cho hai lệnh chi song song.
- **Tiền:** bigint VND trên mọi đường. Không có phép tính số thực, kể cả khi tính % ở web: tính từ hai số nguyên, làm tròn khi hiển thị.

**Những gì đã có sẵn (F-S1, F-S2):**
- Hợp đồng, kỳ phải thu (phải thu, hạn, phiên bản), điều khoản tiền cọc.
- Quyền `EXPLOITATION_*` và quyền duyệt kết quả chọn của BQT.
- Bộ lịch chạy dùng chung, cho việc cập nhật trạng thái kỳ.
- Vai trò `ACCOUNTANT` có `FUND_OPERATE` (`api-qltn/src/domain/permissions.ts`), chưa được dùng ở đâu.
- Hình D1 tr. 10–13 là mẫu giao diện; số ví dụ ở `docs/product/modules/F-quy-khai-thac.md` §1.

**Những gì phải tạo mới:**
- Quỹ (tạo sẵn cho mọi tòa, và cho tòa mới), tài khoản, dòng sổ, khoản thu và phân bổ, nhận cọc, nghĩa vụ thuế và giấy nộp thuế (**mã GNT**), phiếu chi và các quyết định. Gộp vào **một** migration mới.
- Quyền duyệt phiếu chi (BQT) và quyền xem sổ quỹ (kế toán, BQT). Cập nhật ma trận quyền và lịch sử RM.
- Bỏ điều kiện "chưa có khoản thu" ở phụ lục của F-S2: kỳ đã có khoản thu phân bổ thì không sinh lại (BR-F3-07).
- Menu "Sổ quỹ", "Thuế", "Phiếu chi" (chỉ kế toán và BQT); tab "Khoản thu" trong trang hợp đồng.

**Cần lưu ý:**
- Ví dụ D1 phải ra đúng **50 + 15 − 5 = 60** (AC-F3.2), và seed demo cũng vậy (BR-F3-15).
- Công nợ không được cộng vào số dư. Tiền cọc nằm trong số dư nhưng hiện tách riêng.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/f-s3-exploitation-fund`, tách từ `integration/f-s2` @`dbbe32a` (main `515cded` + F-S2 đã merge). Worktree `../QLTN-f-s3`. Chưa push.

**Commit:** `af56e24`, `a167b06` (wip API) · `8dfd569` API · `57e9130` web · commit bằng chứng (cuối nhánh).

**Migration:** `api-qltn/src/database/migrations/2026-10-27i-exploitation-fund.sql` (chạy sau 27g của MT-S3 và 27h của F-S2). Đã chạy thử `BEGIN … ROLLBACK` hai lần liền trên `qltn_dev`, rồi áp thật khi khởi động API.
- Bảng chung cho mọi loại quỹ (nhóm T dùng lại): `funds` (loại là một trường; unique theo tòa + loại), `fund_ledger_entries`, `fund_tax_obligations`, `fund_tax_payments`, `fund_vouchers`, `fund_voucher_decisions`.
- Bảng riêng của khai thác: `exploitation_receipts`, `exploitation_receipt_allocations`, `exploitation_deposits`; `exploitation_receivables` thêm `paid_vnd` và trạng thái `PARTIAL`, `PAID`.
- Quỹ khai thác được tạo cho mọi tòa đang có, và trigger `TRG_buildings_fund` tạo cho tòa mới (kể cả tòa do seed tạo).
- Trigger `TRG_fund_ledger_entries_immutable` từ chối mọi `UPDATE`/`DELETE` trên dòng sổ; chỉ cột `reconciliation` được đổi (để F-S4 dùng).

### Quyết định của dev-build
- **Quyền:** `FUND_VIEW` (Kế toán, BQT) xem sổ quỹ, thuế, phiếu chi; `FUND_APPROVE` (BQT) duyệt phiếu chi, duyệt hủy phiếu đã chi, duyệt đổi số dư đầu. Kế toán dùng `FUND_OPERATE` sẵn có cho mọi thao tác ghi. BQL xem tab "Khoản thu" qua `EXPLOITATION_CONTRACT_VIEW`. Đã cập nhật permissions (API, web), nhãn, ma trận quyền, ADR-0001, lịch sử SPEC RM.
- **Số dư đầu** nằm trên quỹ, không phải một dòng trong bảng sổ; API trả nó thành dòng "Số dư đầu" của tháng bắt đầu sổ. Lý do: số dư đầu không phải một lần tiền vào ra, và đổi được (có duyệt) trong khi dòng sổ thì bất biến. Đổi số dư đầu không được làm quỹ âm ở bất kỳ ngày nào, và ngày bắt đầu sổ không được sau dòng sổ đầu tiên.
- **Không âm quỹ (BR-F3-13):** máy chủ tính "số dư thấp nhất từ ngày chi trở về sau". Mọi lệnh ghi khóa hàng `funds` trước (`FOR UPDATE`), nên hai lệnh chi song song chạy lần lượt; e2e kiểm hai lệnh chi cùng lúc (một 201, một 400). Câu báo gắn vào trường `paidOn` (phiếu chi) hoặc `amountVnd` (giấy nộp thuế).
- **Mã chứng từ:** PT (khoản thu), NC (nhận cọc), TH (nghĩa vụ thuế), GNT (giấy nộp thuế), PC (phiếu chi).
- **Tệp:** mọi tệp F-S3 gắn vào quỹ (subject `FUND`), purpose `RECEIPT_PROOF`, `DEPOSIT_PROOF`, `TAX_FILING`, `TAX_PAYMENT_SLIP`, `VOUCHER_REQUEST`, `VOUCHER_PROOF`. Chỉ Kế toán tải lên. Kế toán và BQT đọc được; BQL đọc được chứng từ khoản thu và nhận cọc (hiện trên tab "Khoản thu").
- **Trạng thái kỳ** được tính lại theo hôm nay mỗi khi đọc (trang không chờ job đêm); job 00:15 vẫn ghi trạng thái vào DB. Test F-S2 AC-F2.12 nay kiểm trạng thái lưu trong DB do job ghi.
- **Hủy hợp đồng / hủy gói** bị chặn khi hợp đồng còn tiền cọc chưa hủy (hoàn cọc là F-S5).
- **Hủy phiếu chi "Đã chi":** Kế toán gửi đề nghị hủy kèm lý do, BQT duyệt thì mới thêm dòng đảo.
- **"Chuyển sang quỹ khác":** quỹ nhận chỉ có "Quỹ bảo trì" (lưu `target_fund_kind = BAO_TRI`); chỉ ghi phía chi (D-F3-4).
- **Thanh tiến độ:** thêm token `--series-1`/`--series-2` theo B01 §5.3. Phần trăm do máy chủ tính bằng số nguyên.
- **Seed (BR-F3-15):** chạy qua các service, đặt ví dụ D1 vào **tháng trước** tháng chạy seed, để mọi ngày đều ở quá khứ. Mở sổ ngày 1; PT-001 ngày 18; PT-002, TH-001 và GNT-001 ngày 22; PC-001 ngày 23. Seed lùi ngày duyệt PC-001 về ngày 20 để ghi được "đã chi" ngày 23. Hai khoản thu phân bổ vào kỳ 1 của HĐ-001: kỳ 1 còn 5 tr, nhưng cả HĐ-001 (3 kỳ của F-S2) còn 45 tr. Tháng đó ra đúng 50 + 15 − 5 = **60**.

### AC → bằng chứng
| AC | Bằng chứng |
|---|---|
| AC-F3.1 | e2e `exploitation-fund` "AC-F3.1" |
| AC-F3.2 | e2e "AC-F3.13 / AC-F3.2" (đủ 4 dòng + số dư đầu, ra 60); unit `fund-ledger.spec`; ảnh F3-1 |
| AC-F3.3 | e2e "AC-F3.3" (dòng đảo ngày hôm nay, kỳ còn 10 tr, SQL `UPDATE`/`DELETE` bị trigger chặn, không có API sửa dòng); test component sổ quỹ |
| AC-F3.4 | e2e "AC-F3.4 / AC-F3.16"; mọi API chỉ trả số liệu của một quỹ |
| AC-F3.5, F3.6, F3.7 | e2e "AC-F3.5 / AC-F3.6 / AC-F3.7"; unit trạng thái kỳ; ảnh F3-2 |
| AC-F3.8, F3.9 | e2e "AC-F3.8 / AC-F3.9"; unit phân bổ; test component hộp thoại khoản thu; ảnh F3-3 |
| AC-F3.10 | e2e "AC-F3.10" |
| AC-F3.11, F3.12 | e2e "AC-F3.11 / AC-F3.12"; ảnh F3-4 |
| AC-F3.13 | e2e "AC-F3.13 / AC-F3.2"; test component nút phiếu chi; ảnh F3-5 |
| AC-F3.14 | e2e "AC-F3.14" (chi lùi ngày bị chặn dù hôm nay vẫn dương) và "BR-F3-13: two payouts" |
| AC-F3.15 | e2e "AC-F3.15" |
| AC-F3.16 | e2e "AC-F3.4 / AC-F3.16"; test menu; ảnh F3-7, F3-8 |
| AC-F3.17 | e2e "AC-F3.17" (seed ra 60, chạy lại không thêm dòng); seed trên `qltn_dev` |
| AC-F3.18 | ảnh F3-1…F3-10; 375px không cuộn ngang; bảng có `th scope` và `tfoot`; số tiền đọc thành chữ; thanh tiến độ `role="progressbar"`; mất mạng thì khóa nút ghi (chưa giả lập trong trình duyệt). Test F-S1, F-S2 vẫn đạt |

### Sửa sau review (P2 F-S3-01)
- **Số tài khoản (BR-F3-02):** API chỉ trả số tài khoản đầy đủ (`accountNo`) cho Kế toán và BQT; người khác chỉ nhận `accountMasked` (****0001). Trang "Sổ quỹ" hiện số đầy đủ khi có. Ảnh F3-1 chụp lại ở góc nhìn Kế toán: "Tài khoản 0071000000001".
- **Test:** unit `fund-views.spec`; e2e AC-F3.1 kiểm Kế toán và BQT đều nhận số đầy đủ; test web `fund-ui.test` (`accountText`).
- **Thẻ "Khoản thu tiếp theo"** (theo brief đã sửa trên main): nền `--accent-strong`, chữ `--accent-fg`, đậm ở cả hai chế độ. Nhãn trạng thái đặt trên nền sáng để đủ tương phản. Ảnh F3-2 chụp lại.
- **Gates sau khi sửa:** API format, tsc và eslint sạch; unit 147/147; e2e `exploitation-fund` 13/13. Web `tsc -b` sạch; vitest 597/597. Script trình duyệt đạt.

### Test đã chạy
- **API:**
  - `format:check`, `tsc --noEmit`, eslint đều sạch.
  - unit 146/146.
  - e2e `exploitation-fund` 13/13.
  - Hồi quy e2e: `exploitation-fund`, `exploitation-contracts`, `exploitation`, `attachments`, `role-matrix`, `maintenance-execution`, `maintenance-plans`, `records`, `audit-log`: 92/92.
- **Web:** `tsc -b` sạch; vitest 595/595.
- **Trình duyệt:** `supporting/f-s3-fund-check.mjs`, ảnh lưu ở `supporting/evidence/`. Mỗi lần chạy, script tạo thêm một phiếu chi `[TEST F3] …` chờ duyệt trên `qltn_dev` (hiện có PC-003 đến PC-006).
- **Nhật ký:** dòng thời gian trên trang phiếu chi hiện nhãn tiếng Việt cho thao tác và trạng thái của F-S3.

### Còn lại / ngoài phạm vi
- Đối soát sao kê (F-S4); hoàn cọc, báo cáo, thanh lý (F-S5).
- Nhãn nhật ký cho các thao tác của F-S1 và F-S2 vẫn còn thiếu (đã có từ trước); F-S3 đã thêm nhãn cho các thao tác của mình.
- Nút AI 32px vẫn là residue chung.

## Đóng F-S3 (PM/BA, 28/10/2026)

- **F-S3 đóng.** Review lần 1 FAILED (F3-1: số tài khoản luôn bị che, trái BR-F3-02; kèm lỗi brief `--navy` ở chế độ sáng, đã làm rõ ở `eb8f7a2`). Bản sửa `f40bb34` qua review lần 2: PASS WITH RESIDUE (API 147/147, e2e 13/13, web 597/597). PM/BA tự kiểm AC-F3.2 (ví dụ D1 ra 60), AC-F3.3 (trigger chặn sửa và xóa dòng sổ), BR-F3-13 (khóa quỹ, e2e hai lệnh chi song song).
- **Residue được chấp nhận:**
  - Chưa chạy lại trình duyệt và chưa giả lập offline trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
  - Các việc tồn ngoài slice: nút AI dùng chung cao 32px; nhãn nhật ký của F-S1, F-S2; một test web chập chờn do bước dựng dữ liệu quá thời gian (không liên quan).
- **Merge vào `main`** (`3b08be1`) theo yêu cầu của chủ dự án; không có xung đột. Kiểm trên bản đã merge: typecheck API và web; test web khai thác và `app` 44/44.
- **Trước khi chạy code này**, phải áp migration `2026-10-27i-exploitation-fund.sql` lên mọi DB. API tự áp khi khởi động.

