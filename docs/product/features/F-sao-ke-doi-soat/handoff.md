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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
