# Phân tích theo module

**Chủ sở hữu:** PM/BA · **Cập nhật:** 26/10/2026

Đây là đầu ra của giai đoạn 1 (Khảo sát) và bước chuẩn bị cho giai đoạn 2 (Phân tích) theo [PROCESS.md](../../PROCESS.md) §2a. Mỗi nhóm module có một file; mỗi module là một mục trong file đó.

File phân tích **chưa phải SPEC**:
- Quy tắc ghi "đề xuất" chưa có hiệu lực.
- Khi chuyển thành SPEC, quy tắc nào cũng phải dẫn được về một PD-xx đã chốt, hoặc được ghi là quy tắc tạm.

## Mẫu mỗi module

1. **Nguồn:** trang D1, mục D2, sơ đồ.
2. **Mục đích và người dùng.**
3. **Hiện trạng code:** demo, API, thao tác; dẫn file.
4. **Dữ liệu:** các hồ sơ và trường chính đọc được từ nguồn.
5. **Trạng thái và luồng.**
6. **Quy tắc nghiệp vụ:** "nguồn" nếu đọc được trực tiếp, "đề xuất" nếu là suy luận.
7. **Khác biệt, rủi ro, câu hỏi mở:** dẫn OD-xx hoặc câu trong phiếu khảo sát L0.

## Danh sách theo module code (đi lần lượt)

Mỗi module code có một file `<module>.md`. Mẫu tham chiếu: [auth.md](auth.md), gồm bảng tính năng và trạng thái, quy tắc đọc từ code, khoảng trống có căn cứ, câu hỏi và việc tiếp theo.

| # | Module code | API (`api-qltn/src/modules`) | Web (`web/src/features`) | Mã D1 | File | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | auth | `auth` | `auth` | nền tảng (B17) | [auth.md](auth.md) | Xong lần 1 (26/10); AU-S1 đạt review và đóng (`9de70f3`, chưa merge) |
| 2 | users | `users` | `admin` (nhân viên) | B17 | [users.md](users.md) | Xong lần 1 (26/10); US-S1 đã giao |
| 3 | roles và phân quyền | `roles`, `domain/permissions.ts` | `admin` (vai trò) | B17 | [roles.md](roles.md) | Xong lần 1 (26/10); chưa giao (chờ RQ-01, OD-10) |
| 4 | organization (bộ phận) | `organization` | `admin` (bộ phận) | B17 | — | Kế tiếp |
| 5 | buildings, locations, config | `buildings` | `buildings`, `workflow` | B15, B16 | — | Chưa |
| 6 | reference, audit, health | `reference`, `audit`, `health` | dùng chung | nền tảng | — | Chưa |
| 7 | records | `records` | `records` | B03–B09 | [SPEC](../features/B03-B09-luong-sua-chua/SPEC.md) | Đã có SPEC; còn B04, B06, B07 |
| 8 | attachments | `attachments` | `components/common/FileUploader` | B03, B07 | — | Chưa |
| 9 | maintenance | — | `maintenance` | B10–B13 | — | Chưa |
| 10 | notifications | — | `notifications` | B14 | — | Chưa |
| 11 | tasks | — | `tasks` | B02 | — | Chưa |
| 12 | dashboard | — | `dashboard` | B01 | — | Chưa |
| 13 | reports | — | `reports` | B18 | — | Chưa |
| 14 | space | — | `space` | S01 | — | Chưa |
| 15 | assistant | — | `assistant` | A01 | — | Chưa |
| 16 | Quỹ khai thác | — | — | F01–F10 | — | Chưa có code |
| 17 | Tiền gửi quỹ bảo trì | — | — | T01–T06 | [T-tien-gui-quy-bao-tri.md](T-tien-gui-quy-bao-tri.md) | Xong lần 1 (theo D1, chưa có code) |
