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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
