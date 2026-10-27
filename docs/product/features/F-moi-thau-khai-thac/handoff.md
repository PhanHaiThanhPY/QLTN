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

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
