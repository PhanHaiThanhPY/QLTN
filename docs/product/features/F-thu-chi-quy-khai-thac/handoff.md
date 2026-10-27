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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
