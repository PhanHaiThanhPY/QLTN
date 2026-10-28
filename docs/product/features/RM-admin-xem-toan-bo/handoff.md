# Handoff: RM-S2 Quản trị xem được toàn bộ, không thao tác nghiệp vụ

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-38). Slice nhỏ, không có UI-UX brief riêng; giao diện theo BR-RM2-04.

**Cách làm:**
- **Làm xen ngay sau T-S1** (hoặc ngay bây giờ nếu T-S1 đang chờ review). Tách nhánh từ `main`. Gợi ý: `feature/rm-s2-admin-view-all`.
- **Riêng T-S1 đang build:** cấp luôn quyền xem tiền gửi cho ADMIN ngay trong T-S1 (BR-RM2-02), để T-S1 merge xong là chủ dự án thấy được.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5.

## Ghi chú cho dev-build (PM/BA)

- **Ma trận quyền:** `api-qltn/src/domain/permissions.ts` (`ROLE_CAPABILITIES.ADMIN`) và bản tương ứng ở `web/src/domain/permissions.ts`. Cập nhật ADR-0001 (`docs/engineering/adr/ADR-0001-role-matrix-v2.md`) và lịch sử SPEC RM.
- **Bẫy cần sửa (BR-RM2-03):**
  - F-S3 hiện đủ số tài khoản theo `FUND_VIEW` hoặc `FUND_OPERATE` (`fund-views.ts`, `seesFullAccount`).
  - Đổi điều kiện sang **vai trò kế toán hoặc BQT**, hoặc `FUND_OPERATE` / `FUND_APPROVE`. Lý do: sau slice này, ADMIN có `FUND_VIEW` mà vẫn phải thấy số bị che.
  - Kiểm luôn các chỗ khác đang dùng một quyền xem như điều kiện để hiện thêm dữ liệu nhạy cảm, và báo trong bằng chứng nếu có.
- **Test chung của BR-RM2-02:** mọi quyền `*_VIEW` và `*_REPORT` phải thuộc ADMIN; không quyền ghi hay duyệt nào thuộc ADMIN, trừ các quyền quản trị đã có. Đặt test ở nơi CI chạy cùng unit của ma trận quyền.
- **e2e cũ:** chỗ nào kỳ vọng "ADMIN xem bị 403" thì sửa thành xem được. Liệt kê các chỗ đã sửa trong bằng chứng.
- Không cần migration.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build điền: commit, quyết định, bảng AC → bằng chứng, test đã chạy, danh sách e2e đã sửa kỳ vọng.)_
