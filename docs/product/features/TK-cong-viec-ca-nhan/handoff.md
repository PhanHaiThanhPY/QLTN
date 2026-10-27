# Handoff: TK-S1 Việc sửa chữa của tôi, có hạn xử lý

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-29) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-TK.15).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main`. Gợi ý: `feature/tk-s1-my-tasks`.
- **Chạy song song với MT-S1.** Hai slice cùng chạm vài file của records:
  - MT-S1 thêm thiết bị vào hồ sơ;
  - TK-S1 thêm hạn vào view của hồ sơ, `record-view.ts`, `records.service.ts`.

  Nên rebase lên `main` sau khi slice kia merge, để tránh xung đột.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- **Luật thao tác:** `api-qltn/src/modules/records/record-actions.ts` (33 thao tác, mỗi thao tác có `from`, `capability`, `slot`).
- **Người giữ bước:** `record-steps.ts` (`currentStepKeyOf`, `stepHolderOf`, `approvalStepOf`, `acceptanceStepsHeldBy`), `stage-holders.ts`, `record-assignment.ts` (`isActiveUserForApprovalStep`, `loadAssignmentContext`).
- **Số ngày hạn:** `taskDueDays` chụp vào hồ sơ khi tạo hoặc gửi. Chỉ có 4 loại sửa chữa: `CONFIRM_RECORD`, `APPROVE_PROPOSAL`, `REVIEW_ACCEPTANCE`, `APPROVE_PAYMENT` (`domain/building-config.ts`).
- **Nhật ký:** `audit_events` có `subject_id`, `to_status`, `actor_id`, `created_at`. Dùng cho thời điểm vào trạng thái và cho "Đã hoàn thành".
- **Hạn hồ sơ khẩn cấp:** `docsOverdue` / `hoursLeft` của B06.
- **Demo:**
  - `web/src/domain/task-rules.ts` (`REPAIR_TASK`, `desiredRepairTasks`) là tài liệu sống về ai nhận việc gì;
  - `features/tasks/*` là màn hình;
  - `TASK_KIND_TAB` (`domain/constants.ts`) cho biết bấm việc thì mở tab nào.

**Những gì phải tạo mới:**
- Phần tính việc ở API, dùng chung luật với `record-actions.ts`. **Không** viết một bộ luật thứ hai lệch với luật thao tác.
- Endpoint "việc của tôi" (đang mở, đã hoàn thành) và ô số.
- Thêm hạn và cờ quá hạn vào view của `GET /records` và `GET /records/:id`.
- Nối web chế độ `api`, mở menu "Công việc" ở chế độ `api` (`router.tsx` dòng 57, `navigation.ts`).

**Cần lưu ý:**
- Giờ Việt Nam cho "hôm nay" (dùng `vnDate()` như các chỗ khác).
- Không cần migration. Nếu thêm một cột thời điểm vào bước để truy vấn nhanh, ghi lý do và tên tệp migration vào bằng chứng.
- Ghi số đo thời gian đáp ứng (SPEC §5).

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build điền: commit, quyết định, bảng AC → bằng chứng, test đã chạy, số đo thời gian đáp ứng.)_
