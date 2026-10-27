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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, kết quả kiểm màu, test đã chạy.)_
