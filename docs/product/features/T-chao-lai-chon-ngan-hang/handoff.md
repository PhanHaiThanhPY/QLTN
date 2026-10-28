# Handoff: T-S1 Thư mời chào lãi suất và chọn ngân hàng gửi tiền quỹ bảo trì

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-37) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-T1.18).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main` mới nhất (đã có đủ nhóm F). Gợi ý: `feature/t-s1-rate-invitations`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Slice đầu của nhóm T** (tiền gửi quỹ bảo trì). Không có demo; hình D1 tr. 33–34 là mẫu giao diện. Bản mô tả đọc từ hình nằm ở `docs/product/modules/T-tien-gui-quy-bao-tri.md` §2.

**Dùng lại, không làm thứ hai:**
- **Mô hình quỹ của F-S3:** thêm loại quỹ `BAO_TRI` vào cùng bảng quỹ, và tạo sẵn cho mọi tòa. Không làm bảng quỹ riêng.
- **Bộ lịch chạy dùng chung**, cho việc tự hết hạn nhận bản chào.
- **Cách dựng của nhóm F:**
  - F-S1: gói, hạn nhận, trễ hạn theo thời điểm nhận, danh sách kiểm khi gửi;
  - F-S2: đề xuất kết quả, BQT duyệt, yêu cầu sửa, từ chối, đổi kết quả, bản chụp bảng so sánh.

  Tách phần dùng chung nếu thấy hợp lý; không chép một bản thứ hai.

**Những gì phải tạo mới:**
- Danh mục ngân hàng; thư mời (`MC-`), ngân hàng được mời, bản chào; kết quả chọn (`KQ-TG`), biên bản (`BB-TG`), quyết định. Gộp vào **một** migration mới.
- Quyền mới cho tiền gửi (BR-T1-12). Bạn đặt tên; cập nhật ma trận quyền và lịch sử RM.
- Nhóm menu "Tiền gửi quỹ bảo trì": "Thư mời chào lãi", "Ngân hàng".

**Cần lưu ý:**
- **Lãi suất** lưu dạng **số nguyên** theo phần nghìn của phần trăm (5,875% → 5875). Nhập quá 3 chữ số thập phân thì từ chối.
- **Lãi cả kỳ** = số tiền × lãi suất × số ngày ÷ cơ sở. Tính hoàn toàn bằng số nguyên (BigInt hoặc bigint ở DB), làm tròn đến đồng, nửa lên. Ví dụ D1: 1.000.000.000 × 6,0% × 90 ÷ 360 = 15.000.000. Không có phép tính số thực.
- **Cơ sở tính ngày** là trường bắt buộc của bản chào, **không có mặc định** (DF-22).
- **Chặn đổi kết quả khi đã có hợp đồng** (AC-T1.14) chỉ test đầy đủ được khi có T-S2. Ghi rõ trong bằng chứng.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
