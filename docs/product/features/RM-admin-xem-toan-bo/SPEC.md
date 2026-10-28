---
id: RM.S2
title: Quản trị xem được toàn bộ, không thao tác nghiệp vụ
status: Đã duyệt
owner: PM/BA
intent: "Tài khoản Quản trị thấy mọi menu và mọi dữ liệu của mọi module trong phạm vi tòa của mình, nhưng vẫn không duyệt, không ghi tiền và không ký."
depends_on: []
---

# SPEC: Quản trị xem được toàn bộ, không thao tác nghiệp vụ (RM-S2)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 28/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 28/10/2026 (PD-38)

**Nguồn:**
- **Yêu cầu của chủ dự án, 28/10/2026.** Chủ dự án vào web bằng `admin-demo` nhưng không thấy nhóm "Quỹ khai thác", và muốn "tài khoản admin sẽ thấy tất cả". Khi được hỏi, chủ dự án chọn **"Chỉ xem tất cả"**: xem mọi thứ, nhưng không duyệt, không ghi tiền, không ký.
- [ADR-0001](../../../engineering/adr/ADR-0001-role-matrix-v2.md) và [RM-ma-tran-quyen-v2](../RM-ma-tran-quyen-v2/SPEC.md): ma trận quyền v2. Câu "ADMIN không giữ quyền quyết định nghiệp vụ" **giữ nguyên**. Slice này chỉ thêm quyền **xem**.
- BR-F3-02 (F-S3): số tài khoản quỹ chỉ hiện đầy đủ cho kế toán và BQT.

## 1. Mục tiêu

Theo ma trận quyền v2, Quản trị chỉ có quyền quản trị (tài khoản, tòa, cấu hình, nhật ký) cộng `VIEW` và `REPORT_VIEW`. Các module mới (khai thác, quỹ, tiền gửi) đều mở bằng quyền xem riêng, nên Quản trị **không thấy** các module đó.

Sau slice này:
- Quản trị thấy mọi menu và đọc được mọi màn hình của mọi module, trong phạm vi tòa của mình.
- **Mọi nút ghi, duyệt, ký, ghi tiền** vẫn không hiện với Quản trị, và API vẫn trả 403 nếu Quản trị gọi thẳng.

**Người dùng:** chủ dự án và người quản trị hệ thống cần nhìn toàn cảnh để kiểm tra, hỗ trợ và trình diễn.

## 2. Phạm vi

**Trong phạm vi:**
1. Cấp cho vai trò **ADMIN** mọi **quyền xem** đang có (BR-RM2-01).
2. Quy tắc cho các module về sau: mỗi quyền xem mới đều phải cấp cho ADMIN (BR-RM2-02).
3. Giữ các ngoại lệ về dữ liệu nhạy cảm (BR-RM2-03).
4. Cập nhật ADR-0001, lịch sử của SPEC RM và ma trận quyền ở web.

**Ngoài phạm vi:**
- Mọi quyền ghi, duyệt, ký, ghi tiền cho ADMIN. Lựa chọn "Xem và làm được mọi việc" **không** được chọn.
- "Việc của tôi" (B02): Quản trị không giữ bước nào, nên không có việc. Riêng việc "Cần phân công lại" của D-TK-5 vẫn giữ.
- Đổi phạm vi tòa của tài khoản Quản trị. Quản trị vẫn chỉ thấy các tòa trong phạm vi của mình; `admin-demo` hiện có cả 4 tòa.
- Vai trò tùy chỉnh dựa trên ADMIN: vẫn chỉ được thu hẹp, không được mở rộng, như hiện nay.

## 3. Quy tắc nghiệp vụ

- **BR-RM2-01. Quyền xem cấp thêm cho ADMIN:**

  | Quyền | Mở cái gì |
  |---|---|
  | `EXPLOITATION_VIEW` | gói mời thầu, hồ sơ dự thầu, bảng so sánh giá chào, kết quả chọn, hội nghị (F-S1, F-S2) |
  | `EXPLOITATION_CONTRACT_VIEW` | hợp đồng khai thác, lịch phải thu, khoản thu, thanh lý |
  | `FUND_VIEW` | sổ quỹ, thuế, phiếu chi, sao kê và đối soát |
  | `FUND_REPORT` | báo cáo thu chi quỹ, xuất XLSX, bản in |
  | Quyền xem tiền gửi của T-S1, đang build | thư mời chào lãi, bản chào, kết quả chọn ngân hàng; sau này là hợp đồng tiền gửi và lịch lãi |

  - **Giữ nguyên** các quyền ADMIN đã có: `VIEW`, `REPORT_VIEW`, `AUDIT_VIEW`, `ADMIN_VIEW`, `BUILDING_CONFIG`, `LOCATION_MANAGE`, `ACCOUNT_MANAGE`, `REPLACE_MANAGER`.
  - **Không cấp** quyền nào trong nhóm ghi, duyệt, ký, ghi tiền: `RECORD_*`, `PROPOSAL_DECIDE`, `CONSTRUCTION`, `ACCEPTANCE_DECIDE`, `PAYMENT_*`, `MAINTENANCE_MANAGE`, `MAINTENANCE_REVIEW`, `ITEM_CONDITION`, `REASSIGN`, `EMERGENCY_START`, `EXPLOITATION_MANAGE`, `EXPLOITATION_APPROVE`, `FUND_OPERATE`, `FUND_APPROVE`, và quyền ghi hay duyệt của tiền gửi.
- **BR-RM2-02. Module về sau:**
  - Từ nay, mỗi module mới có quyền xem riêng thì quyền đó **mặc định cấp cho ADMIN**.
  - SPEC của module ghi rõ điều này; dev-review kiểm khi review.
  - Ma trận quyền có một test chung: mọi quyền có tên kết thúc bằng `_VIEW` hoặc `_REPORT` đều thuộc ADMIN, và **không** quyền nào có tên chứa `MANAGE`, `APPROVE`, `OPERATE`, `DECIDE`, `RECORD`, `CONFIRM`, `EDIT` thuộc ADMIN. Ngoại lệ là các quyền quản trị đã có ở BR-RM2-01.
- **BR-RM2-03. Ngoại lệ về dữ liệu nhạy cảm:**
  - **Số tài khoản quỹ:** Quản trị chỉ thấy 4 số cuối ("****0001"). Đầy đủ chỉ cho kế toán và BQT, đúng BR-F3-02.
    - Điều kiện hiện đủ số tài khoản phải dựa trên **vai trò kế toán hoặc BQT**, hoặc quyền ghi và duyệt quỹ (`FUND_OPERATE`, `FUND_APPROVE`). **Không** dựa trên `FUND_VIEW`, vì ADMIN nay có `FUND_VIEW`.
  - **Mật khẩu, token, chữ ký vẽ:** không đổi gì. Quản trị xem được ảnh chữ ký trên bản in như mọi người xem hồ sơ.
- **BR-RM2-04. Giao diện:**
  - Với Quản trị, các nút thao tác **không hiện** (không phải hiện rồi khóa), như với tài khoản chỉ xem hiện nay.
  - Dòng ghi chú "Bạn đang xem với quyền Quản trị — chỉ xem" hiện **một lần** ở đầu các trang nghiệp vụ, như dòng "Bạn đang xem" của MT-S3.
- **BR-RM2-05. Nhật ký:** việc Quản trị **xem** không ghi nhật ký (giống mọi vai trò). Việc cấp thêm quyền này cũng không cần migration dữ liệu, vì quyền tính theo vai trò.

## 4. Tiêu chí nghiệm thu

- **AC-RM2.1** `admin-demo` đăng nhập ở chế độ `api`: menu có đủ các nhóm. Cụ thể:
  - Sửa chữa, Bảo trì;
  - **Quỹ khai thác**, với mọi mục: mời thầu, đơn vị, hợp đồng, sổ quỹ, thuế, phiếu chi, sao kê và đối soát, báo cáo thu chi;
  - Tiền gửi quỹ bảo trì, khi T-S1 đã merge;
  - Theo dõi, Hệ thống, Quản trị.
- **AC-RM2.2** Quản trị mở được, ở dạng chỉ đọc: MT-001, bảng so sánh giá chào, HĐ-001, sổ quỹ tháng, báo cáo thu chi (kèm xuất XLSX), màn đối soát. Không có nút ghi, duyệt hay ký nào.
- **AC-RM2.3** Quản trị gọi thẳng API: duyệt kết quả chọn, duyệt phiếu chi, ghi khoản thu, lập phiếu chi, ghi nhận sao kê, ký tờ trình, xác nhận lượt bảo trì. Mọi lệnh đều nhận **403**.
- **AC-RM2.4** Quản trị xem sổ quỹ: số tài khoản hiện "****…" (4 số cuối). Kế toán và BQT vẫn thấy đủ.
- **AC-RM2.5** Test ma trận quyền chung của BR-RM2-02 chạy và đạt. Thêm thử một quyền `X_VIEW` mà không cấp cho ADMIN thì test đỏ.
- **AC-RM2.6** Tài khoản Quản trị chỉ có phạm vi tòa A thì không thấy dữ liệu tòa B (404), giống mọi vai trò.
- **AC-RM2.7** Các e2e ma trận quyền hiện có (`role-matrix-v2`) và e2e của nhóm F vẫn đạt. Chỗ nào có kỳ vọng cũ "ADMIN nhận 403 khi **xem**" thì sửa thành "xem được", và ghi lại trong bằng chứng.

## 5. Checklist test cho dev-review

- [ ] Unit test ma trận quyền (BR-RM2-02).
- [ ] e2e: ADMIN xem được và ADMIN ghi bị 403, trên một mẫu đại diện của mỗi module; số tài khoản bị che với ADMIN.
- [ ] Web: menu của ADMIN; không có nút thao tác; dòng ghi chú "chỉ xem".
- [ ] Ảnh chụp: menu của `admin-demo`, sổ quỹ (số tài khoản bị che), trang hợp đồng không có nút.

## 6. Mặc định PM/BA

| ID | Mặc định | Lý do |
|---|---|---|
| D-RM2-1 | Quản trị thấy số tài khoản đã che | Quản trị không làm việc tiền; giữ BR-F3-02 |
| D-RM2-2 | Mọi quyền xem về sau mặc định cấp cho ADMIN, có test chặn | Để không lặp lại tình huống "admin không thấy module mới" |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 28/10/2026 | Viết theo yêu cầu và lựa chọn "Chỉ xem tất cả" của chủ dự án. |
| 28/10/2026 | Chủ dự án duyệt (PD-38) và cho giao dev-build. |
