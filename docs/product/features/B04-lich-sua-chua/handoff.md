# Handoff: B4-S1 Lịch thi công đọc dữ liệu thật

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-21) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-B4.11).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main` (`7f36c91` trở đi). Gợi ý: `feature/b4-s1-construction-schedule`.
- Không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Những gì đã có sẵn:**
- Dữ liệu thi công S3: bảng `repair_constructions` (một dòng mỗi hồ sơ: `start_date`, `planned_end_date`, `completed_date`, `progress_percent`). `completed_date` được ghi khi gửi nghiệm thu (`construction.service.ts`), và giữ nguyên khi hồ sơ sang `NEEDS_REPAIR`.
- Hồ sơ khẩn cấp B06-S1 có dòng thi công ngay khi được cho làm trước (`emergency.service.ts`, `startDate = hôm nay`).
- `GET /records`: phạm vi tòa, bộ lọc `buildingId`, `locationId`, `statusGroup`. Lịch phải cho cùng kết quả (BR-B4-03, BR-B4-09). Lưu ý: `dateFrom`/`dateTo` của `GET /records` là **ngày tạo**, không dùng được cho lịch.
- Web demo: `RepairSchedulePage.tsx`, `components/schedule/*`, `listRepairSchedule` trong `records-service.ts`. Route `records/schedule` đang dùng `connected()` (mock-only); cần mở cho chế độ `api`.
- `RecordFlags` đã có cờ "Khẩn cấp"; `useOnline` đã có ở `hooks/useOnline.ts`.

**Những gì phải tạo mới:**
- API đọc cho lịch (lọc giao nhau theo khoảng ngày) và cho khối "Chờ xếp lịch". Hình dạng endpoint do bạn chọn; ghi lại vào phần bằng chứng.
- Phần tính khoảng ngày và cờ "Trễ thi công" theo BR-B4-01 và BR-B4-04. Nên tính ở một chỗ (API) để web không tự tính lệch.
- Web chế độ `api`: nối 3 kiểu xem, mục nhiều ngày ở kiểu Tuần/Tháng, khối "Chờ xếp lịch", trạng thái cắt bớt (BR-B4-06).

**Cần lưu ý:**
- "Hôm nay" theo giờ Việt Nam, giống `vnDate()` ở API.
- Số đếm là số hồ sơ khác nhau, không phải số ô (AC-B4.6).
- Không dùng chữ "Quá hạn" cho cờ trễ; chữ là "Trễ thi công" (brief §1).
- Không cần migration. Nếu thấy cần, hỏi PM/BA trước.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/b4-s1-construction-schedule` (worktree `../QLTN-b4-s1`, tách từ `main` b2bf9c3). Chưa push, chưa merge.

**Commit:** `4631468` (API), `74e5053` (web), và commit bằng chứng này (sửa giao diện nhỏ của khối "Chờ xếp lịch" ở 375px, script, ảnh).

### Hình dạng endpoint (SPEC §2 mục 7)

- `GET /records/schedule?buildingId&locationId&statusGroup&from&to&page&limit`: các đợt thi công đã bắt đầu có khoảng ngày **giao** với `from`–`to` (để trống thì không giới hạn).
  - Mỗi mục: `record` (giống `GET /records`), `construction` (ngày bắt đầu, dự kiến xong, hoàn thành, tiến độ), `span: {start, end}`, `isLate`.
  - Sắp xếp theo ngày bắt đầu rồi mã (BR-B4-08). `meta.total` là tổng số hồ sơ khớp.
- `GET /records/schedule/awaiting?buildingId&locationId&page&limit`: hồ sơ `READY_FOR_CONSTRUCTION` kèm `readySince` (lần cuối hồ sơ vào trạng thái này, lấy từ audit), cũ nhất lên đầu.
- Quyền: `VIEW`, giống `GET /records`. `buildingId` ngoài phạm vi thì nhận danh sách rỗng.
- **Không có migration.**

### Quyết định của dev-build

- **Tính ở một chỗ:** khoảng ngày và cờ trễ chỉ tính ở API, trong `api-qltn/src/modules/records/schedule-span.ts`; web không tự tính lại.
  - SQL lọc thô bằng cận trên `GREATEST(completed, planned, today)`, nên không bao giờ loại sót hồ sơ khớp.
  - Quy tắc chính xác chạy trên các dòng đã tải.
- **Dùng chung bộ lọc với `GET /records`:** phạm vi tòa, vị trí và nhóm trạng thái tách ra `record-scope-query.ts`, và `GET /records` cũng dùng helper này. Nhờ vậy cùng bộ lọc luôn chọn ra cùng hồ sơ (AC-B4.9).
- **"Hồ sơ đã kết thúc"** = `RECORD_FINAL_STATUSES` (COMPLETED, nhóm CLOSED, và cả UNRESOLVED). `POST_REVIEW_REJECTED` chưa kết thúc nên vẫn chạy theo ngày dự kiến xong.
- **Mức trần (BR-B4-06):** 200 hồ sơ mỗi lần gọi; kiểu Tuần và Tháng xin đúng 200. Vượt mức thì hiện Notice "Đang hiện n trên m hồ sơ…".
  - Số đếm trên đầu lưới = số hồ sơ khác nhau đang vẽ.
  - Danh sách phân trang 10 dòng (`LIMITS.PAGE_SIZE`).
- **Thứ tự route:** `ScheduleController` đăng ký trước `RecordsController`, để `/records/schedule` không bị hiểu là `/records/:id`. Có e2e kiểm.
- **"+n" ở kiểu Tháng:** dùng `Dialog` sẵn có, vốn đã giữa màn hình trên màn rộng và là sheet đáy trên màn hẹp; có nút "Đóng" và Esc. Không thêm component popover mới (brief §0). Ở màn < 768px, kiểu Tháng là danh sách ngày đầy đủ nên không cần "+n".
- **Tab:** mỗi hồ sơ chỉ được Tab tới một lần cho mỗi hàng tuần, ở kiểu Tuần lẫn kiểu Tháng. Các ô còn lại có `tabIndex=-1` và `aria-hidden`.
- **Khối "Chờ xếp lịch":** mở sẵn khi có hồ sơ **hoặc khi có lỗi**, để lỗi riêng của khối không bị giấu sau trạng thái thu gọn.
- **Mock:** dùng chung hình dạng `ScheduleEntry`.
  - Mục mock trải từ ngày bắt đầu đến ngày dự kiến xong. Bộ lọc mock vẫn theo ngày bắt đầu, như demo.
  - Khối "Chờ xếp lịch" ở mock đọc `listRecords({ status: READY_FOR_CONSTRUCTION })`.
  - Không sửa B4G-02 đến B4G-04 ở mock (đúng SPEC §2, Ngoài phạm vi).
- **Route `records/schedule`:** bỏ `connected()`, nên mở ở cả hai chế độ.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| AC-B4.1 | Script `supporting/b4-s1-schedule-check.mjs` với `bql-a`; ảnh `evidence/B4-1-list.png` (không còn màn "chưa nối API") |
| AC-B4.2 | e2e `records-schedule` "AC-B4.2"; unit `schedule-span.spec.ts`; component "multi-day entry on each day"; script: hồ sơ T-4 → T+1 có mặt ở 3 ô của tuần này (`week.running = 3`); ảnh `B4-2-week.png` |
| AC-B4.3 | e2e "AC-B4.3" (đến hôm nay, `isLate`, sau hôm nay không còn); script: hồ sơ trễ có 2 ô (T2, T3) và cờ "Trễ thi công" |
| AC-B4.4 | e2e "AC-B4.4"; unit cho các trạng thái chờ nghiệm thu và thanh toán; script: hồ sơ xong hôm nay không có cờ trễ (`builtFlag = false`) |
| AC-B4.5 | e2e "AC-B4.5"; unit "Cần khắc phục" |
| AC-B4.6 | e2e (tổng, thứ tự, phân trang sau khi sắp xếp); component "counts distinct records" (đợt 4 ngày: 4 ô, đếm 3) |
| AC-B4.7 | e2e "AC-B4.7"; script: bắt đầu thi công hồ sơ chờ, tải lại màn, hồ sơ rời khối "Chờ xếp lịch" và có trên lưới tuần |
| AC-B4.8 | e2e "AC-B4.8" (khẩn cấp có mặt từ hôm nay, có `emergency`); cờ "Khẩn cấp" qua `ScheduleFlags` |
| AC-B4.9 | e2e "AC-B4.9": so tập hồ sơ với `GET /records` cho vị trí, các nhóm trạng thái và `buildingId` |
| AC-B4.10 | e2e "AC-B4.10" (`bql-b`, cả lịch lẫn khối chờ) |
| AC-B4.11 | Component test (lỗi kèm "Thử lại", rỗng, cắt bớt, `aria-current`, tên đọc được, Tab một lần); khối chờ: `aria-expanded`, "Xem tất cả" > 10; ảnh `B4-4-week-375.png` và `B4-5-awaiting-375.png`, trang không cuộn ngang ở 375px (overflow 0px) |
| AC-B4.12 | Route mở ở chế độ mock qua `listMockSchedule`; toàn bộ test web đạt (không có test lịch cũ nào hỏng) |

### Test đã chạy

- **api-qltn:**
  - `format:check`, eslint (`src/modules/records`, e2e mới) và `tsc --noEmit` đều OK.
  - Unit `schedule-span.spec.ts`: 11/11.
  - e2e (`E2E_POSTGRES_DB=qltn_build_e2e`, `--runInBand`): `records-schedule` 10/10; `records-list` + `records-summary` 13/13 (hồi quy của phần tách scope).
- **web:**
  - `tsc -b` OK.
  - Toàn bộ vitest: 465/465 trước commit bằng chứng. Sau khi sửa giao diện khối chờ: các test lịch 16/16.

### Dữ liệu thử để lại trên qltn_dev

- Hồ sơ `[TEST B4 LỊCH] …` có mã trong khoảng SC-024 đến SC-058, sinh từ nhiều lần chạy script; các lần đầu dừng do lỗi chờ của chính script, đã sửa.
- Một số hồ sơ vẫn ở "Chờ thi công" (ví dụ SC-043, SC-053), một số đang thi công hoặc chờ nghiệm thu.
- Tòa A đã trả về STANDARD sau mỗi lần chạy. Không đụng mật khẩu nào.

### Còn lại

- Lần chạy cuối, kiểu Tuần của dev có 46 hồ sơ (do dữ liệu thử dồn lại). Lưới vẫn dưới mức trần 200, nên ảnh không cho thấy Notice cắt bớt. Notice này có test component.
- Ảnh chỉ chụp phần trên của trang ở kích thước màn hình.

