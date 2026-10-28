# Handoff: F-S4 Nhập sao kê tài khoản quỹ và đối soát với sổ quỹ

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-35) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-F4.17).

**Cách làm:**
- **Chỉ bắt đầu sau khi F-S3 đạt review.** Xếp sau F-S3.
- Tách nhánh từ nhánh F-S3 đã review, hoặc từ `main` nếu F-S3 đã merge. Gợi ý: `feature/f-s4-statements-reconciliation`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Dựng theo tài khoản, không theo "khai thác".** Nhóm T sẽ dùng lại nguyên chức năng này cho tài khoản quỹ bảo trì (DF-26). Không đặt tên bảng hay đường dẫn API riêng cho khai thác ở tầng sao kê.

**Những gì đã có sẵn (F-S3):**
- Quỹ, tài khoản, dòng sổ bất biến, dòng đảo, số dư theo sổ.
- Luật không âm (BR-F3-13).
- Trạng thái đối soát "Chưa đối soát".
- Module tệp (AT-S1): lưu tệp gốc của mỗi lần nhập.

**Những gì phải tạo mới:**
- Lần nhập sao kê, dòng sao kê, cặp ghép và lịch sử ghép/bỏ ghép. Gộp vào **một** migration mới.
- Bộ đọc tệp mẫu cột chuẩn, cho CSV (UTF-8) và XLSX (trang đầu). Có mẫu tệp tải về.
- Đề xuất ghép (BR-F4-06), ghép tay, bỏ ghép, ghi nhận từ sao kê.
- Chặn hủy chứng từ đã đối soát (bổ sung cho BR-F3-04).
- Màn "Sao kê và đối soát"; nhãn GD và đối soát trên sổ quỹ, khoản thu, phiếu chi, thuế.

**Cần lưu ý:**
- Tiền là số nguyên. Tệp có phần thập phân thì **chặn**, không làm tròn ngầm.
- Có một dòng lỗi, hoặc sao kê không khép, thì không nhập dòng nào.
- Ghép phải có khóa: hai người không ghép cùng một dòng cùng lúc được (brief §4, trạng thái xung đột).
- Cặp dòng đảo và dòng gốc là "Tự khử", không tính vào "lệch".
- Ví dụ D1 phải ra **4/4 khớp, chênh lệch 0 đ, lệch/trùng 0/0** (AC-F4.6), và seed demo cũng vậy.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/f-s4-statements-reconciliation`, tách từ F-S3 đã đạt review (`f40bb34`). Worktree `../QLTN-f-s4`. Chưa push.

**Commit:** `dc23110`, `75262f7` (wip API) · `93a9185` API · `ce8e00e` web · `04c6487` sửa tháng đang chạy, bằng chứng.

**Migration:** `api-qltn/src/database/migrations/2026-10-28a-bank-statements.sql` (chạy sau 27i của F-S3). Đã chạy thử `BEGIN … ROLLBACK` hai lần liền trên `qltn_dev`, rồi áp thật khi khởi động API.
- Bảng: `bank_statement_imports`, `bank_statement_lines`, `bank_matches`. Gắn theo quỹ (mỗi quỹ một tài khoản, DF-26), không có chữ "khai thác", nên nhóm T dùng lại được. Đường dẫn API đều dưới `/funds`.
- Sổ quỹ thêm nhóm `BANK_FEE` và `INTEREST` (ghi nhận từ sao kê).
- Hai unique index một phần (một dòng sao kê, một dòng sổ chỉ ở trong tối đa một cặp còn hiệu lực) chặn ghép trùng, kể cả khi chạy đồng thời.

### Quyết định của dev-build
- **Đọc tệp không thêm thư viện:** `node_modules` dùng chung với cây chính, nên tôi không cài gói mới. Tự viết bộ đọc CSV (UTF-8, có nháy kép, dấu `,` hoặc `;`) và bộ đọc XLSX tối giản (zip qua `zlib` của Node; chỉ đọc trang đầu, shared strings, inline strings). Mẫu tệp tải về là CSV UTF-8 có BOM.
- **Số tiền:** nhận "10.000.000", "10,000,000", hoặc số trong ô XLSX. Có phần thập phân thì chặn ("2.000.000,50", 2000000.5), không làm tròn.
- **Số dòng trong thông báo lỗi** tính theo dòng của tệp, dòng tiêu đề là dòng 1, như AC-F4.3. Với nhập tay cũng vậy (dòng nhập tay đầu tiên là "Dòng 2").
- **Kiểm sao kê khép** tính trên mọi dòng của tệp, kể cả dòng trùng bị bỏ qua. Lý do: một sao kê thật luôn liệt kê đủ giao dịch trong kỳ của nó.
- **Chống trùng:** khóa đã có e lần trong DB thì bỏ qua e dòng đầu của khóa đó trong tệp. Còn hai dòng trở lên cùng khóa thì cả hai là "Có thể trùng".
- **Số dư theo sao kê tại ngày D:** số dư đầu kỳ của sao kê phủ ngày D (bắt đầu muộn nhất), cộng mọi dòng sao kê đã lưu của tài khoản từ đầu kỳ đó đến D.
- **Tháng đang chạy:** tháng được đọc tại ngày cuối tháng (đúng BR-F4-10). Nếu sao kê chỉ phủ đến trước cuối tháng, tháng được đọc tại ngày cuối cùng có sao kê, và màn hình ghi "đến dd/mm" (trường `asOf`). Không có sao kê nào trong tháng thì vẫn ghi "Chưa có sao kê". Lỗi này lộ ra khi chụp ảnh tháng hiện tại; đã có e2e.
- **Đề xuất ghép** không lưu trong DB, mà tính lại mỗi lần xem. "Bỏ qua" một đề xuất chỉ ẩn nó trên màn hiện tại. Một dòng sổ bị hai dòng sao kê cùng đề xuất thì không đề xuất cho dòng nào.
- **"Ghi nhận từ sao kê":** dòng chi chỉ ghi được là "Phí ngân hàng", dòng thu chỉ ghi được là "Lãi không kỳ hạn". Cặp ghi nhận này không bỏ ghép được.
- **Tự khử:** dòng đảo và dòng gốc của nó không cần ghép, và không tính vào "lệch".
- **Chặn hủy chứng từ đã đối soát** đặt trong `FundLedgerService.reverse`, nên áp cho mọi chứng từ: khoản thu, nhận cọc, giấy nộp thuế, phiếu chi đã chi.
- **Tệp gốc** của lần nhập lưu như tệp của quỹ (purpose `STATEMENT_FILE`), không tải lên riêng được. Tải xuống qua phiên đăng nhập.
- **Xóa lần nhập:** API trả `matchedCount` của từng lần nhập; nút xóa chỉ hiện khi bằng 0.
- **Seed (BR-F4-13):** nhập sao kê dạng CSV cho tháng mẫu D1 của F-S3 (tháng trước tháng chạy seed), rồi xác nhận mọi đề xuất: 4/4 khớp, chênh lệch 0, lệch/trùng 0/0.
- **Fixture e2e:** hàm tạo hợp đồng hiệu lực chuyển sang `test/fund-fixtures.ts`, dùng chung cho test F-S3 và F-S4. Test F-S3 AC-F3.17 nay kiểm các dòng của tháng mẫu là "Đã đối soát", vì seed F-S4 đã đối soát tháng đó.

### AC → bằng chứng
| AC | Bằng chứng |
|---|---|
| AC-F4.1, F4.4 | e2e `fund-statements` "AC-F4.1 / AC-F4.4" (4 dòng mới, 4 đề xuất; nhập lại bỏ qua 4; tệp chồng kỳ chỉ thêm dòng mới) |
| AC-F4.2, F4.3 | e2e "AC-F4.2 / AC-F4.3" (cả CSV và XLSX); unit `bank-statement.spec`, `statement-file.spec`; test component bảng xem trước; ảnh F4-4 |
| AC-F4.5 | e2e "AC-F4.5 / AC-F4.14" (trùng 2) |
| AC-F4.6 | e2e "AC-F4.6" (50/15/5/60, 4/4, chênh lệch 0, TH 1/1, mã GD trên sổ quỹ); ảnh F4-1, F4-3 |
| AC-F4.7, F4.8 | e2e "AC-F4.7 / AC-F4.8"; unit đề xuất |
| AC-F4.9 | e2e "AC-F4.9" (câu chặn, bỏ ghép có lý do, tự khử, lệch +1) |
| AC-F4.10, F4.11 | e2e "AC-F4.10 / AC-F4.11"; ảnh F4-2 (tháng còn lệch: chênh lệch +11.000 đ, kèm ngày và hai số dư) |
| AC-F4.12, F4.13 | e2e "AC-F4.12 / AC-F4.13" (thêm tháng đang chạy) |
| AC-F4.14 | e2e "AC-F4.5 / AC-F4.14" |
| AC-F4.15 | e2e "AC-F4.15"; ảnh F4-5 (BQT không có nút ghi), F4-6 (BQL 403); test menu |
| AC-F4.16 | e2e "AC-F4.16" (seed đúng, chạy lại không thêm dòng); seed trên `qltn_dev` |
| AC-F4.17 | ảnh F4-1…F4-8; 375px không cuộn ngang; hai cột là hai `<section>` có tiêu đề; mỗi cặp có tên đọc được; dòng tình trạng có `aria-live`; bảng xem trước có `th scope`. Mất mạng thì khóa nút (chưa giả lập trong trình duyệt). Test F-S1 đến F-S3 vẫn đạt |
| Đồng thời | e2e "BR-F4-05: two people matching one line at once" (một 201, một 409 kèm câu của brief) |

### Test đã chạy
- **API:** `format:check`, `tsc --noEmit`, eslint đều sạch; unit 156/156.
- **e2e:** `fund-statements` 11/11; `exploitation-fund` 13/13; `exploitation-contracts` 10/10.
- **Web:** `tsc -b` sạch; vitest 600/600.
- **Trình duyệt:** `supporting/f-s4-reconciliation-check.mjs`, ảnh lưu ở `supporting/evidence/`. Script nhập một sao kê tay của tháng hiện tại cho tòa A trên `qltn_dev` (một dòng "Phi SMS Banking" chưa ghép). Chạy lại thì dòng đó bị nhận là trùng.

### Còn lại / ngoài phạm vi
- Chưa đọc định dạng sao kê riêng của từng ngân hàng (D-F4-6); chưa có khóa tháng (D-F4-5).
- Chưa giả lập mất mạng trong trình duyệt. Nhãn nhật ký của F-S1 và F-S2 vẫn thiếu. Nút AI 32px vẫn là residue chung.

## Đóng F-S4 (PM/BA, 28/10/2026)

- **F-S4 đóng.** Review PASS WITH RESIDUE trên `a9b36dd` (e2e 11/11, F-S3 13/13, hợp đồng 10/10, API 156/156). PM/BA tự kiểm AC-F4.1 đến F4.4, F4.6 (4/4, chênh lệch 0) và F4.9; chấp nhận cách đọc tháng đang chạy "đến dd/mm".
- **Residue được chấp nhận:**
  - Chưa chạy lại trình duyệt và chưa giả lập offline trên đúng bản ứng viên, vì môi trường của seat review không có trình duyệt.
  - Các việc tồn ngoài slice: nút AI dùng chung cao 32px; nhãn nhật ký của F-S1, F-S2; một test web chập chờn do bước dựng dữ liệu quá thời gian (không liên quan).
- **Merge vào `main`** (`3b08be1`) theo yêu cầu của chủ dự án; không có xung đột. Kiểm trên bản đã merge: typecheck API và web; test web khai thác và `app` 44/44.
- **Trước khi chạy code này**, phải áp migration `2026-10-28a-bank-statements.sql` lên mọi DB. API tự áp khi khởi động.

