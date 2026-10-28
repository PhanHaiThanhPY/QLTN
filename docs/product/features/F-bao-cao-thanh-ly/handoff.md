# Handoff: F-S5 Báo cáo thu chi quỹ khai thác, chấm dứt và thanh lý hợp đồng

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-36) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-F5.17).

**Cách làm:**
- **Chỉ bắt đầu sau khi F-S4 đạt review.** Xếp sau F-S4.
- Tách nhánh từ nhánh F-S4 đã review, hoặc từ `main` nếu F-S4 đã merge. Gợi ý: `feature/f-s5-report-termination`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Đây là slice cuối của nhóm F.** Phần lớn việc là đọc lại dữ liệu đã có (sổ quỹ, sao kê, kỳ phải thu), cộng thêm phần thanh lý.

**Những gì đã có sẵn:**
- **F-S3:** quỹ, dòng sổ và nhóm dòng, số dư theo sổ, cọc, phiếu chi (thêm nhóm "Hoàn cọc"), khoản thu và phân bổ.
- **F-S4:** số dư theo sao kê, tháng "Đã khớp", dòng tự khử. Dòng **Nội bộ** của cấn trừ cọc cũng phải được bỏ qua khi tính "lệch".
- **F-S2:** hợp đồng và trạng thái, kỳ phải thu.
- Bộ lịch chạy dùng chung, cho cờ "Đã hết hạn, chưa thanh lý".
- **B7-S1:** khung bản in A4 (`DocumentPrintPage`, `@page`, chân trang).
- Hình D1 tr. 13–14 là mẫu giao diện.

**Những gì phải tạo mới:**
- Hồ sơ thanh lý, bàn giao, đề xuất không thu được và các quyết định, cấn trừ cọc (2 dòng nội bộ). Gộp vào **một** migration mới.
- Trạng thái hợp đồng "Đang thanh lý", "Đã thanh lý"; trạng thái gói "Đã đóng"; trạng thái kỳ "Hủy do chấm dứt", "Không thu được".
- API báo cáo theo kỳ và nguồn số; xuất XLSX 3 trang; bản in.
- Quyền xem và xuất báo cáo quỹ (BQT, kế toán). Cập nhật ma trận quyền và lịch sử RM.
- Menu "Báo cáo thu chi"; tab "Thanh lý" trong trang hợp đồng.

**Cần lưu ý:**
- **Màu thác nước:**
  - Cột đầu và cuối kỳ dùng `--series-1`.
  - Cột thu và chi dùng một cặp **không phải màu tình trạng**. Chọn rồi kiểm cùng `--series-1` bằng script, ở cả chế độ sáng và tối:

    `node <skill dataviz>/scripts/validate_palette.js "<hex,...>" --mode light --surface "#ffffff"`

    Chế độ tối dùng `--mode dark --surface "#102f41"`.
  - Lưu kết quả vào bằng chứng (AC-F5.17).
- Tiền là số nguyên trên mọi đường, kể cả trong tệp XLSX. Ô tiền là số, không phải chữ.
- Ví dụ D1 phải ra đúng **50 + 15 − 5 = 60** và **"Chưa thể đóng · còn 5.000.000 đ"** (AC-F5.1, AC-F5.7).
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/f-s5-report-termination` (worktree `../QLTN-f-s5`), tách từ `a9b36dd` (F-S4 đạt review, chưa merge). Đã merge `main` vào để có tài liệu SPEC (`a615294`). Chưa push.

**Commit chính:** `b7c85d8` (API), `b613886` (web), `353b45a` (badge "Nội bộ"), cùng commit bằng chứng này. Trước đó là các commit `wip`: `d4d2d5f`, `38713fe`, `6c86a3e`, `906633c`, `6df8404` và `fb685cd` (tách phần phân bổ kỳ để dùng chung).

**Migration:** `api-qltn/src/database/migrations/2026-10-28b-fund-report-termination.sql`. Đã chạy thử trên `qltn_dev` trong `BEGIN … ROLLBACK`, chạy hai lần liền nhau để kiểm tính chạy lại được. Áp thật trên các DB e2e và trên DB riêng `qltn_build_f5_evidence`. **Chưa áp vào `qltn_dev`**, vì seed sẽ chuyển HĐ-001 dùng chung sang "Đang thanh lý".

### Quyết định (SPEC chưa nói rõ)

1. **Seed mở TL-001 với lý do "Chấm dứt sớm theo thỏa thuận", không phải "Hết hạn".** HĐ-001 của seed có 3 kỳ (01/10–31/12) và chưa hết hạn. Ngày chấm dứt là cuối kỳ 1, nên kỳ 2–3 bị "Hủy do chấm dứt". Kết quả tab vẫn đúng AC-F5.7: "Chưa thể đóng · còn 5.000.000 đ", bàn giao Đạt, biên bản Đã lập.
2. **Báo cáo seed là tháng mở sổ (09/2026).** Tháng này ra 50 + 15 − 5 = 60 theo sao kê, nhưng "Còn phải thu" bằng 0, vì kỳ 1 của HĐ-001 hạn 10/10. BR-F5-04 chỉ tính các kỳ đến hạn trước cuối kỳ báo cáo. Số D1 đầy đủ (còn phải thu 5 tr) được kiểm trong e2e ở tòa B tháng 11.
3. **XLSX tự viết** (`src/common/xlsx/xlsx-writer.ts`), không thêm thư viện. Ô tiền là số nguyên, định dạng `#,##0`.
4. **Căn cứ "không thu được" là tài liệu của gói** (`TERMINATION_DOCUMENT`, BQL tải lên). Kế toán đề xuất không cần tệp.
5. **"Còn phải thu" ở cuối kỳ** tính từ khoản thu, cấn trừ và không thu được có ngày không sau cuối kỳ. Bỏ qua các khoản đã hủy.
6. **Phiếu hoàn cọc giữ chỗ tiền cọc khi đang mở.** Số được hoàn không vượt cọc đang giữ trừ các phiếu hoàn khác chưa xong. Lúc trả tiền, kiểm lại một lần nữa.
7. **Lọc danh sách hợp đồng** nhận thêm hai trạng thái mới.
8. **Mobile:** dưới 640px, thác nước thành bảng 4 dòng có thanh nhỏ (ui-brief §3). Nút "Đóng hồ sơ" dính đáy màn hình.

### Kiểm màu thác nước (AC-F5.17)

[supporting/evidence/waterfall-palette.txt](supporting/evidence/waterfall-palette.txt) ghi lại các lần chạy `validate_palette.js --pairs all`.

| Cột | Màu sáng | Màu tối |
|---|---|---|
| Đầu kỳ, cuối kỳ (`--series-1`) | `#00929b` | `#1ba59f` |
| +Thu (`--series-2`) | `#6a4fd6` | `#8f78ec` |
| −Chi (`--series-3`, token mới) | `#eb6834` | `#d95926` |

Cả hai chế độ đều **ALL CHECKS PASS**. Hai bộ đã thử và bị loại (thu màu xanh dương: CVD và ngưỡng nhìn thường không đạt) cũng ghi trong tệp. Không dùng màu tình trạng: cam `#eb6834` khác hẳn `--warn` `#b7791f`. Nhãn số luôn có dấu (+15 / −5), nên màu không phải tín hiệu duy nhất.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| F5.1 | e2e `fund-termination` "November by the statement" (tòa B: 50/15/5/60, nguồn, còn 5 tr theo dõi riêng); ảnh F5-1, F5-2 (seed tòa A, sáng và tối) |
| F5.2, F5.3 | e2e: khoản thu không có trên sao kê → LEDGER, chênh lệch 1.000.000, cuối kỳ 61; quý 4 cộng đúng |
| F5.4 | e2e đọc cả 3 trang XLSX: số trong "Tổng hợp", 5 dòng "Chi tiết sổ" kèm GD-xxx, ô tiền kiểu số, trang "Công nợ" |
| F5.5 | F5-3-print.png và F5-3-print.pdf (in bằng Chrome, có chân trang và số trang) |
| F5.6 | e2e: BQL 403 với đúng câu thông báo; kế toán tòa B mở tòa A 404. Script: BQL 403, menu không có "Báo cáo thu chi" |
| F5.7, F5.8 | e2e (đóng, khóa ghi, 409 sau khi đóng); ảnh F5-5 → F5-6 → F5-7 → F5-8 (đóng xong, không còn nút ghi) |
| F5.9 | e2e: người đề xuất tự duyệt 403; BQT duyệt; không có dòng sổ mới; kỳ "Không thu được"; báo cáo 12 có `writeOffVnd` |
| F5.10, F5.13 | e2e: cấn trừ tạo 2 dòng nội bộ, không thành chênh lệch đối soát; hoàn 36 tr bị từ chối, 35 tr được; phiếu đang chờ chặn đóng |
| F5.11, F5.12 | e2e: chấm dứt sớm 10/01 giữ kỳ 2, hủy kỳ 3; bị từ chối nếu kỳ 3 đã thu; bàn giao Không đạt rồi Đạt |
| F5.14 | e2e `flagExpired`: có cờ, trạng thái giữ "Hiệu lực"; badge trên trang và danh sách hợp đồng |
| F5.15 | e2e: hủy khi đã xử lý tiền → 409; hủy khi chưa có → kỳ được khôi phục, hợp đồng về "Hiệu lực" |
| F5.16 | e2e: seed TL-001 đúng 5 điều kiện; chạy seed lại không tạo trùng; báo cáo seed theo sao kê 50/15/5/60 |
| F5.17 | Kiểm màu ở trên; ảnh F5-4, F5-4b, F5-9 ở 375px không cuộn ngang; test component (aria-label của thác nước, "Xem dạng bảng", điều kiện đọc được, `aria-disabled` kèm lý do) |

**Chạy lại bằng chứng** (cần DB mới, vì script đóng TL-001): [supporting/f-s5-report-termination-check.mjs](supporting/f-s5-report-termination-check.mjs). Lần chạy cuối: `PASS`.

### Test đã chạy

- **API:**
  - `format:check` OK; `tsc` OK; `eslint src` OK.
  - `jest`: 162/162.
  - e2e trên `qltn_build_e2e`:
    - `fund-termination`: 9/9.
    - `fund-statements`, `exploitation-fund`, `exploitation-contracts`, `role-matrix`, `attachments`: đều đạt.
    - Riêng AC-F2.16 đã sửa kỳ vọng: HĐ-001 của seed giờ là "Đang thanh lý".
- **Web:** `tsc -b` OK; `vitest` toàn bộ 605/605 (102 tệp); sau các sửa cuối, chạy lại `termination` 5/5.

### Còn lại / lưu ý cho review

- Web không có prettier, nên các tệp `features/exploitation/termination/*` đang ngắt dòng ở 120 cột. Phần còn lại của web dùng khoảng 160 cột. Chỉ khác về trình bày.
- Chưa có test component cho các hộp thoại (tạo hồ sơ, bàn giao, biên bản, cấn trừ, không thu được). Luồng của chúng được e2e API và script trình duyệt phủ một phần.
