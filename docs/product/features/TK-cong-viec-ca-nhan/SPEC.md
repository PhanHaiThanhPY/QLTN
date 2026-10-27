---
id: TK.S1
title: Việc sửa chữa của tôi, có hạn xử lý
status: Đã duyệt
owner: PM/BA
intent: "Mỗi người mở một màn là biết hồ sơ sửa chữa nào đang chờ chính mình, phải làm gì, hạn đến khi nào, và việc nào đã quá hạn."
depends_on: []
---

# SPEC: Việc sửa chữa của tôi, có hạn xử lý (TK-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-29), gồm 5 mặc định D-TK-1 đến D-TK-5 ở §6

**Nguồn:**
- Phân tích [tasks.md](../../modules/tasks.md), đã duyệt (PD-28): TG-01, TG-02, TG-04 (chỉ báo), TG-06, TG-07, TG-08, TD-01 đến TD-03; mặc định TKQ-01 đến TKQ-03 (OD-24).
- D2 nhóm 02; D1 tr. 16; review 23/10 dòng 74.
- Demo là tài liệu sống về hành vi: `web/src/domain/task-rules.ts`, `services/tasks-service.ts`, `features/tasks/*`. Khi demo và SPEC này khác nhau, theo SPEC.

**Nền:** luồng sửa chữa của SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md), B06-S1 và FX-S1 đến S3: trạng thái, người giữ bước, luật thao tác (`api-qltn/src/modules/records/record-actions.ts`), số ngày hạn trong hồ sơ.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Ở chế độ `api` chưa có "Công việc của tôi" (TG-01). API cũng không tính hạn xử lý của bước hiện tại (TG-02), nên không ai biết hồ sơ nào đang trễ ở tay mình.

Sau slice này:
- Mỗi người có một màn liệt kê đúng những hồ sơ sửa chữa đang chờ **chính mình** làm một bước.
- Mỗi việc có hạn xử lý và mức ưu tiên; bấm vào là tới đúng chỗ cần làm trong hồ sơ.
- Hạn xử lý được tính ở API, nên B04 và B01 dùng lại được.

Việc bảo trì gộp vào ở TK-S2, sau MT-S3. Nhắc hạn bằng thông báo thuộc module `notifications`.

**Người dùng:** mọi vai trò tham gia luồng sửa chữa: BQL, KT, TVKT, BQT, kế toán, và người giữ bước tùy chỉnh.

**User story:**
- Là KT, sáng đến tôi muốn mở một màn là thấy 3 hồ sơ đang chờ tôi xác nhận, cái nào trễ, để làm theo thứ tự.
- Là BQT, tôi muốn thấy tờ trình và đợt thanh toán nào đang chờ tôi duyệt, kèm hạn, để không làm chậm cả hồ sơ.
- Là BQL, tôi muốn biết hồ sơ nào đang tắc vì người giữ bước đã nghỉ, để xin giao lại.

## 2. Phạm vi

**Trong phạm vi:**
1. API đọc **việc đang mở của tôi** và **việc đã hoàn thành của tôi**, cho hồ sơ sửa chữa (BR-TK-01 đến BR-TK-06).
2. **Hạn xử lý** của bước hiện tại và cờ quá hạn, tính ở API. Danh sách và chi tiết hồ sơ cũng trả kèm hạn này (BR-TK-04).
3. Web chế độ `api`: trang "Công việc của tôi" (`/tasks`), gồm ô số, tab, lọc, tìm kiếm, thẻ "Tiếp tục công việc" trên điện thoại (BR-TK-07, BR-TK-08). Menu "Công việc" hiện ở chế độ `api`.
4. Sửa các lỗi demo TD-01 đến TD-03, ở cả `api` và `mock`.

**Ngoài phạm vi:**
- Việc bảo trì (TK-S2, sau MT-S3).
- Thao tác giao lại người giữ bước (US-S2, R-06). Slice này chỉ **hiện** việc "Cần phân công lại".
- Thông báo, nhắc hạn, email (module `notifications`).
- Kiểu xem "Bảng công việc" chia cột (TKQ-01).
- Xem việc của người khác (TKQ-03).
- Ngày làm việc, ngày lễ (TKQ-02): hạn tính theo ngày lịch.
- Không lưu bảng việc riêng (BR-TK-01). Không cần migration, trừ khi dev-build thấy cần một cột thời điểm vào bước để truy vấn nhanh. Khi đó ghi lý do vào bằng chứng.

## 3. Quy tắc nghiệp vụ

- **BR-TK-01. Việc là thứ được tính ra, không phải thứ được lưu** (TG-07).
  - Việc đang mở được tính ngay lúc đọc, từ trạng thái hồ sơ, người giữ bước và luật thao tác hiện có.
  - Một người có việc trên một hồ sơ khi người đó **làm được ngay bây giờ** một thao tác đưa hồ sơ đi tiếp ở trạng thái hiện tại. Nghĩa là thao tác đó có trong `record-actions.ts` với trạng thái hiện tại, và người đó đúng vai trò, giữ đúng bước, có đúng quyền và phạm vi.
  - Các thao tác phụ không tạo việc: lưu nháp, rút hồ sơ, đóng không cần sửa, cập nhật tiến độ giữa chừng.
- **BR-TK-02. Loại việc theo trạng thái** (tên việc hiện cho người dùng):

  | Trạng thái hồ sơ | Việc | Ai |
  |---|---|---|
  | Chờ xác nhận | Xác nhận hồ sơ | người xác nhận (bước tiếp nhận) |
  | Cần bổ sung thông tin | Bổ sung hồ sơ | BQL của hồ sơ |
  | Chờ lập tờ trình; Cần bổ sung tờ trình; Từ chối và được trình lại | Soạn tờ trình | BQL của hồ sơ |
  | Đang xử lý khẩn cấp | Nộp hồ sơ khẩn cấp | BQL của hồ sơ |
  | Chờ kỹ thuật duyệt; Chờ TVKT thẩm định; Chờ BQT duyệt; Chờ phê duyệt theo workflow | Duyệt tờ trình | người giữ bước duyệt hiện tại |
  | Chưa xử lý, chưa phát hành thông báo | Phát hành thông báo chưa xử lý | BQL của hồ sơ |
  | Chờ thi công | Bắt đầu thi công | BQL của hồ sơ |
  | Đang thi công | Gửi nghiệm thu | BQL của hồ sơ |
  | Chờ nghiệm thu | Nghiệm thu | **mỗi** thành viên nghiệm thu chưa quyết định ở lượt hiện tại |
  | Cần khắc phục | Khắc phục và gửi nghiệm thu lại | BQL của hồ sơ |
  | Chờ đề nghị thanh toán; Cần bổ sung thanh toán | Lập đề nghị thanh toán | BQL của hồ sơ |
  | Chờ duyệt thanh toán; Chờ duyệt thanh toán theo workflow | Duyệt thanh toán | người giữ bước thanh toán hiện tại |
  | Chờ thanh toán | Ghi nhận chuyển khoản | **mọi** người có quyền ghi nhận chuyển khoản trong tòa (kế toán) |
  | Không được duyệt hậu kiểm | Đóng hồ sơ không duyệt hậu kiểm | người giữ bước BQT |

  - **Đợt tạm ứng** đang chờ duyệt hoặc chờ chuyển khoản trong lúc thi công tạo thêm việc "Duyệt tạm ứng" hoặc "Ghi nhận chuyển khoản tạm ứng", với người nhận như hai dòng thanh toán ở trên.
  - Có trạng thái nào của API chưa nằm trong bảng thì dev-build gán vào loại việc gần nhất theo BR-TK-01, rồi ghi vào bằng chứng.
- **BR-TK-03. Cần phân công lại:**
  - Người giữ bước không còn hợp lệ (bị khóa, mất phạm vi, đổi vai trò) thì người đó **không** còn việc này.
  - Thay vào đó, **BQL của hồ sơ** có việc "Cần phân công lại", ghi rõ bước nào và người cũ là ai.
  - Nếu chính BQL của hồ sơ không còn hợp lệ, việc đi tới mọi quản trị (ADMIN) có phạm vi tòa đó.
  - Mỗi hồ sơ có nhiều nhất **một** việc "Cần phân công lại", liệt kê mọi bước bị tắc.
- **BR-TK-04. Hạn xử lý:**
  - Hạn = **thời điểm hồ sơ vào trạng thái hiện tại** + **số ngày hạn của loại việc**, lấy từ cấu hình đã chụp vào hồ sơ (`taskDueDays`).
  - Bước duyệt tờ trình: mỗi bước có hạn riêng, tính từ lúc bước đó bắt đầu.
  - Nghiệm thu: tính từ lúc gửi lượt nghiệm thu.
  - Chỉ 4 loại có số ngày hạn trong cấu hình: Xác nhận hồ sơ, Duyệt tờ trình, Nghiệm thu, Duyệt thanh toán (gồm duyệt tạm ứng). Các việc khác **không có hạn** và hiện "Không có hạn".
  - Riêng "Nộp hồ sơ khẩn cấp" dùng hạn bổ sung hồ sơ đã có của B06 (`docsOverdue`).
  - **Thời điểm vào trạng thái** lấy từ nhật ký thao tác: lần gần nhất hồ sơ chuyển vào trạng thái đó.
  - **Quá hạn** khi bây giờ đã qua hạn và việc vẫn còn mở.
  - Danh sách và chi tiết hồ sơ trả kèm hạn và cờ quá hạn của bước hiện tại, để B04 và B01 dùng lại. Hai màn đó không phải đổi gì trong slice này.
- **BR-TK-05. Thông tin của mỗi việc:**
  - tên việc;
  - mã và tên hồ sơ;
  - tòa, vị trí;
  - trạng thái hồ sơ;
  - **mức ưu tiên** của hồ sơ (Thấp, Bình thường, Cao, Khẩn cấp), và cờ "Xử lý khẩn cấp" nếu hồ sơ đi luồng khẩn cấp của B06;
  - hạn ("dd/mm · HH:mm", hoặc "Không có hạn") và cờ quá hạn;
  - **chỗ cần làm**: bấm vào thì mở đúng tab của hồ sơ, theo `TASK_KIND_TAB` của demo.
- **BR-TK-06. Việc đã hoàn thành:**
  - Gồm các thao tác đưa hồ sơ đi tiếp mà **chính người xem** đã làm trong **30 ngày gần nhất**, lấy từ nhật ký thao tác.
  - Mỗi dòng ghi tên việc, mã hồ sơ, thời điểm làm, và kết quả. Ví dụ: "Duyệt tờ trình · SC-031 · 26/10 14:20 · Đã duyệt", hoặc "· Yêu cầu bổ sung".
  - Việc mất đi vì người khác làm hoặc vì hồ sơ đổi người **không** nằm ở đây.
- **BR-TK-07. Sắp xếp và ô số:**
  - **Sắp xếp việc đang mở:**
    1. quá hạn trước, hạn sớm nhất lên đầu;
    2. tiếp theo là hồ sơ đi luồng khẩn cấp (B06), hoặc có ưu tiên Khẩn cấp hay Cao;
    3. tiếp theo là việc có hạn, theo hạn tăng dần;
    4. cuối cùng là việc không có hạn, theo thời điểm vào bước, cũ nhất lên đầu.
  - **Ô số:**
    - **Đang mở**: tổng số việc đang mở.
    - **Quá hạn**.
    - **Đến hạn hôm nay**: hạn rơi vào hôm nay (giờ VN) mà chưa quá hạn. Sửa TD-02.
    - **Đã hoàn thành (30 ngày)**.
  - Bấm một ô thì lọc danh sách theo ô đó.
- **BR-TK-08. Tìm kiếm và lọc:**
  - Tìm theo mã hồ sơ, tên hồ sơ hoặc tên việc, **bỏ dấu và không phân biệt hoa thường** (sửa TD-03).
  - Lọc theo tòa, loại việc, hạn (Quá hạn / Đến hạn hôm nay / Có hạn / Không có hạn).
  - Đầu trang không ghi cứng tháng hay ngày nào (sửa TD-01). Ghi "Hôm nay, dd/mm/yyyy" theo giờ VN.
- **BR-TK-09. Phạm vi:**
  - Chỉ thấy việc trên hồ sơ thuộc tòa trong phạm vi của mình.
  - Không ai xem được việc của người khác qua API.
  - Mọi người đã đăng nhập đều có trang này; ai không có việc thì thấy trạng thái rỗng.

## 4. Tiêu chí nghiệm thu

Trong test, "bây giờ" được cố định. Dữ liệu dùng tòa mẫu và tài khoản demo.

**Ai có việc**
- **AC-TK.1** GIVEN hồ sơ H1 ở "Chờ xác nhận" với người xác nhận `kt-a1`, THEN `kt-a1` có đúng một việc "Xác nhận hồ sơ · H1". BQL của H1 và `kt-a2` không có việc này. Bấm việc thì mở H1 ở tab Tổng quan.
- **AC-TK.2** GIVEN tờ trình của H2 đang chờ một bước duyệt tùy chỉnh do X giữ, THEN chỉ X có việc "Duyệt tờ trình · H2". Khi X duyệt và hồ sơ sang bước BQT, việc của X biến mất và người giữ bước BQT có việc.
- **AC-TK.3** GIVEN H3 "Chờ nghiệm thu" có 3 thành viên, 1 người đã quyết định ĐẠT, THEN 2 người còn lại mỗi người có một việc "Nghiệm thu · H3". Người đã quyết định không còn việc này, và việc đó có trong tab "Đã hoàn thành" của họ.
- **AC-TK.4** GIVEN H4 "Chờ thanh toán" ở tòa A, THEN mọi kế toán có phạm vi tòa A có việc "Ghi nhận chuyển khoản · H4". Một người ghi nhận xong thì việc biến mất ở tất cả.
- **AC-TK.5** GIVEN người giữ bước BQT của H5 bị khóa tài khoản, THEN người đó không còn việc trên H5. BQL của H5 có **một** việc "Cần phân công lại · H5", ghi "Bước BQT duyệt · «tên người cũ» (đã khóa)".

**Hạn**
- **AC-TK.6** GIVEN H1 vào "Chờ xác nhận" lúc 09:00 ngày 10/11, và hạn xác nhận đã chụp trong H1 là 2 ngày, THEN việc có hạn "12/11 · 09:00". Lúc 08:00 ngày 12/11, việc được đếm vào ô "Đến hạn hôm nay". Lúc 09:01 ngày 12/11, việc có cờ "Quá hạn" và được đếm vào ô "Quá hạn", không còn ở "Đến hạn hôm nay".
- **AC-TK.7** GIVEN tòa A đổi hạn xác nhận thành 5 ngày **sau khi** H1 đã gửi, THEN hạn của H1 vẫn là 2 ngày, vì cấu hình đã được chụp vào hồ sơ.
- **AC-TK.8** Việc "Soạn tờ trình" ghi "Không có hạn" và không bao giờ có cờ quá hạn.
- **AC-TK.9** `GET /records` và `GET /records/:id` của H1 trả kèm hạn và cờ quá hạn đúng như AC-TK.6.

**Đã hoàn thành, sắp xếp, tìm kiếm**
- **AC-TK.10** `kt-a1` xác nhận H1: việc rời tab "Đang mở". Tab "Đã hoàn thành" có dòng "Xác nhận hồ sơ · H1 · «thời điểm» · Đã xác nhận cần sửa". Việc làm cách đây 31 ngày thì không hiện.
- **AC-TK.11** Với 4 việc (một quá hạn; một hồ sơ ưu tiên Khẩn cấp chưa quá hạn; một hạn ngày mai; một không có hạn), thứ tự đúng như BR-TK-07.
- **AC-TK.12** Gõ "bom" ra việc của hồ sơ "Sửa máy bơm tăng áp". Gõ "sc-031" ra hồ sơ SC-031. Kiểm ở cả `api` và `mock`.

**Phạm vi và chung**
- **AC-TK.13** `bql-b` không thấy việc nào của tòa A. Không có tham số API nào cho xem việc của người khác.
- **AC-TK.14** Ở chế độ `api`, menu "Công việc" mở được trang thật. Đầu trang ghi "Hôm nay, «ngày thật»", không còn "Tháng 10, 2026".
- **AC-TK.15** Ở 375px, thẻ "Tiếp tục công việc" hiện việc ở đầu danh sách theo BR-TK-07. Các trạng thái loading, rỗng, lỗi, offline, accessibility đúng brief. Chế độ `mock` vẫn chạy, các test hiện có vẫn đạt (hoặc được sửa cho khớp TD-01 đến TD-03, và ghi lại).

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test phần tính việc cho từng dòng của BR-TK-02, cho "Cần phân công lại" (BR-TK-03), và cho hạn (BR-TK-04): có hạn, không có hạn, bước tùy chỉnh, nghiệm thu, tạm ứng.
- [ ] e2e API: việc của tôi theo từng vai trò; đã hoàn thành (30 ngày); phạm vi; hạn trả kèm trong `GET /records` và `GET /records/:id`.
- [ ] Thời gian đáp ứng: với dữ liệu dev (vài chục hồ sơ), API "việc của tôi" trả về dưới 500 ms. Ghi lại số đo.
- [ ] Test component: ô số (gồm "Đến hạn hôm nay"), sắp xếp, tìm bỏ dấu, thẻ "Tiếp tục công việc".
- [ ] Ảnh chụp ở chế độ `api` với 2 vai trò (KT và BQT), ở màn rộng và 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-TK-1 | Tính việc ngay lúc đọc, không lưu bảng việc | Không thể lệch với trạng thái hồ sơ; tránh loại lỗi đồng bộ của demo (TG-07) |
| D-TK-2 | "Ghi nhận chuyển khoản" giao cho mọi kế toán của tòa | Theo ADR-0001 R4: bất kỳ người có quyền xác nhận chuyển khoản trong phạm vi |
| D-TK-3 | Việc không có số ngày hạn trong cấu hình thì "Không có hạn", không tự đặt hạn mặc định | Không bịa ra hạn mà khách chưa đặt |
| D-TK-4 | "Đã hoàn thành" lấy 30 ngày gần nhất | Đủ để tra lại việc vừa làm, không thành một báo cáo |
| D-TK-5 | BQL của hồ sơ không còn hợp lệ thì "Cần phân công lại" đi tới quản trị của tòa | Không để hồ sơ tắc mà không ai biết |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích tasks (PD-28). |
| 27/10/2026 | Chủ dự án duyệt (PD-29), gồm D-TK-1 đến D-TK-5, và cho giao dev-build. |
| 27/10/2026 | Review lần 1 FAILED (F-TK-S1-01, đếm "Đã hoàn thành" theo số dòng); sửa `133fe8a`; review lần 2 PASS WITH RESIDUE trên `2621f92`. PM/BA đóng slice. Chờ chủ dự án cho merge. |
