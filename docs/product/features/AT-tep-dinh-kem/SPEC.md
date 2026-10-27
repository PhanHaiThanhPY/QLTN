---
id: AT.S1
title: Tải và xem tệp đáng tin hơn
status: Đã triển khai
owner: PM/BA
intent: "Người dùng biết chắc tệp nào đã lên, tệp nào bị từ chối và vì sao; tải được tệp gốc về máy; ảnh chụp từ điện thoại tải lên được và xem rõ."
depends_on: []
---

# SPEC: Tải và xem tệp đáng tin hơn (AT-S1)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã triển khai` (27/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-23), gồm 3 mặc định D-AT-1 đến D-AT-3 ở §6

**Nguồn:**
- Phân tích [attachments.md](../../modules/attachments.md), đã duyệt (PD-22): ATG-01, ATG-02, ATG-04, ATG-08; mặc định ATQ-01 đến ATQ-04 (OD-22).
- Luật tải theo mục đích của SPEC [B03–B09 v2](../B03-B09-luong-sua-chua/SPEC.md) BR-C-02, và của B06-S1. Slice này giữ nguyên các luật đó.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Tệp là bằng chứng của mọi bước sửa chữa. Hiện có hai chỗ làm người dùng mất bằng chứng hoặc mất thời gian:
- Chọn nhiều tệp mà một tệp bị từ chối thì các tệp sau đó **không được tải, và không có thông báo nào** (ATG-01). BQL tưởng đã đủ ảnh, đến lúc gửi mới biết thiếu, hoặc không bao giờ biết.
- Không có cách tải tệp gốc về máy (ATG-02). Kế toán cần lưu hóa đơn và chứng từ, BQT cần lưu biên bản.

Ngoài ra, ảnh chụp thật bị răng cưa trong hộp xem (ATG-08). Ảnh từ iPhone và ảnh dung lượng lớn chưa được kiểm trên máy thật (ATG-04).

**Người dùng:**
- Chính: BQL tải ảnh hiện trường, ảnh thi công, ảnh nghiệm thu, thường là từ điện thoại.
- Phụ: kế toán và BQT tải tệp về máy; TVKT xem ảnh.

**User story:**
- Là BQL, khi chọn nhiều ảnh một lúc, tôi muốn mọi ảnh hợp lệ đều được tải lên và biết rõ ảnh nào bị từ chối, để chụp lại đúng ảnh đó.
- Là kế toán, tôi muốn tải hóa đơn và chứng từ về máy đúng tên gốc, để lưu cùng sổ sách.
- Là BQL dùng iPhone, tôi muốn chụp ảnh và tải lên ngay, không phải đổi định dạng.

## 2. Phạm vi

**Trong phạm vi** (chỉ sửa web; áp dụng cho mọi chỗ dùng `FileUploader` và `AttachmentViewer`, ở cả hai chế độ `api` và `mock`):
1. Tải nhiều tệp: tệp lỗi không làm dừng các tệp khác. Cuối lượt có báo cáo kết quả từng tệp (BR-AT-01, BR-AT-02).
2. Nút **Tải xuống** trong hộp xem tệp (BR-AT-03).
3. Ảnh lớn được nén ở web trước khi tải (BR-AT-04).
4. Ảnh HEIC có thông báo rõ ràng (BR-AT-05).
5. Ảnh chụp hiển thị mượt trong hộp xem (BR-AT-06).

**Ngoài phạm vi:**
- Đổi API: không đổi luật tải, giới hạn 10 MB hay định dạng nhận của máy chủ. Nếu thấy buộc phải đổi API, hỏi PM/BA trước.
  - **Ngoại lệ duy nhất, PM/BA duyệt 27/10 khi đang build:** API đọc tên tệp multipart theo latin1, nên tên có dấu bị lưu sai (tải lên "HD-0012 Hòa Phát.pdf" thì lưu thành "HD-0012 HÃ²a PhÃ¡t.pdf"). Vì vậy AC-AT.5 không đạt được nếu chỉ sửa web. Được sửa: API đọc tên tệp theo UTF-8, kèm e2e tải lên tên tiếng Việt. Không sửa ngược các tên đã lưu sai, vì đó chỉ là dữ liệu dev.
- Nhận Excel/Word: **AT-S2**, chỉ làm nếu khách cần (ATQ-01).
- Xóa tệp, dọn tệp không dùng: **AT-S3** (ATG-05, ATQ-03, ATQ-04).
- Tệp cho bảo trì ở chế độ `api` (ATG-10): làm cùng module maintenance.
- Xem nhiều ảnh liên tiếp, ảnh thu nhỏ trong danh sách (ATG-09).
- Phạm vi theo vị trí khi đọc tệp (ATG-07): thuộc phân tích phân quyền.
- Sao lưu kho tệp (ATG-06): việc vận hành.

## 3. Quy tắc nghiệp vụ

- **BR-AT-01. Tải nhiều tệp:** các tệp được tải **lần lượt**, theo thứ tự đã chọn.
  - Một tệp bị từ chối (sai định dạng, quá lớn, rỗng, bước không cho phép, lỗi mạng) thì **vẫn tải tiếp** các tệp sau.
  - Một tệp bị từ chối vì quyền hoặc bước (403, 404, 409) thì dừng lượt: các tệp còn lại không thể đi qua cùng một luật. Báo cáo ghi các tệp còn lại là "Chưa tải".
  - Lỗi phiên đăng nhập (401) thì dừng lượt theo cách chung của ứng dụng.
  - Mọi tệp đã lên thì được gắn vào danh sách như hiện nay, kể cả khi lượt có tệp lỗi.
- **BR-AT-02. Báo cáo kết quả:**
  - Mọi tệp đều lên: một toast thành công "Đã tải «n» tệp".
  - Có tệp lỗi: một khối báo cáo **nằm ngay dưới nút tải, không tự biến mất** (chi tiết ở brief §2.1).
    - Dòng đầu: "Đã tải «k»/«n» tệp".
    - Mỗi tệp lỗi một dòng: tên tệp và lý do bằng lời của máy chủ hoặc của web. Ví dụ: "IMG_2041.jpg: Tệp vượt quá 10 MB."
    - Khối này mất khi người dùng đóng nó hoặc bắt đầu lượt tải mới.
  - Không báo bằng toast cho từng tệp lỗi, vì toast tự biến mất.
- **BR-AT-03. Tải xuống:**
  - Hộp xem tệp có nút "Tải xuống" cho **mọi** tệp xem được.
  - Tệp lưu về máy dùng **đúng tên gốc** và đúng nội dung đã lưu (không qua nén hay đổi định dạng).
  - Ai xem được tệp thì tải xuống được, không cần quyền mới. Người ngoài phạm vi tòa vẫn nhận 404 như hiện nay.
  - Nút chỉ bấm được khi tệp đã tải xong. Đang tải thì khóa nút; tải lỗi thì ẩn nút và hiện lỗi như hiện nay.
- **BR-AT-04. Nén ảnh lớn:** áp dụng cho ảnh JPEG, PNG và WebP **lớn hơn 10 MB**, hoặc có cạnh dài hơn 4.000 px.
  - Web thu nhỏ ảnh sao cho cạnh dài nhất ≤ 4.000 px, và lưu thành JPEG chất lượng 0,85.
  - Tên tệp giữ nguyên phần trước dấu chấm, đuôi đổi thành `.jpg`.
  - Ảnh vẫn lớn hơn 10 MB sau khi nén thì bị từ chối với lý do "Ảnh vẫn vượt quá 10 MB sau khi nén."
  - Ảnh nhỏ hơn ngưỡng thì giữ nguyên, không nén.
  - **PDF không bao giờ bị nén.**
  - Nén ảnh không được bỏ thông tin hướng xoay. Ảnh chụp dọc sau khi nén vẫn đứng đúng chiều.
- **BR-AT-05. Ảnh HEIC:** nếu tệp được chọn là HEIC/HEIF (theo loại tệp hoặc đuôi `.heic`/`.heif`), web từ chối ngay, không gửi lên máy chủ. Lý do: "Ảnh HEIC chưa được hỗ trợ. Trên iPhone, vào Cài đặt › Camera › Định dạng, chọn «Tương thích nhất», hoặc chụp màn hình ảnh rồi tải lại." Nếu kiểm trên iPhone thật thấy Safari đã tự đổi ảnh sang JPEG, thì quy tắc này chỉ là lớp phòng hờ. Ghi kết quả kiểm vào bằng chứng.
- **BR-AT-06. Hiển thị ảnh:** ảnh trong hộp xem được thu nhỏ mượt, theo cách mặc định của trình duyệt. Bỏ kiểu hiển thị dạng điểm ảnh (`pixelated`).

## 4. Tiêu chí nghiệm thu

**Tải nhiều tệp**
- **AC-AT.1** GIVEN BQL đang ở bước được tải ảnh hiện trường, WHEN chọn 5 tệp mà tệp thứ 2 là tệp `.txt` đổi đuôi thành `.png`, THEN 4 tệp còn lại được tải lên và gắn vào danh sách. Khối báo cáo ghi "Đã tải 4/5 tệp" và một dòng cho tệp thứ 2, kèm lý do "Nội dung tệp không đúng định dạng…".
- **AC-AT.2** GIVEN chọn 3 tệp hợp lệ, WHEN mạng mất ở tệp thứ 2, THEN tệp 1 và tệp 3 vẫn được tải nếu mạng có lại, còn tệp 2 có lý do là lỗi kết nối. Kiểm bằng test component có giả lập lỗi mạng.
- **AC-AT.3** GIVEN chọn 3 tệp, WHEN máy chủ trả 403 `attachment_step_denied` ở tệp đầu tiên, THEN lượt dừng lại. Khối báo cáo ghi "Đã tải 0/3 tệp": tệp 1 kèm lý do của máy chủ, tệp 2 và tệp 3 là "Chưa tải".
- **AC-AT.4** GIVEN chọn 3 tệp hợp lệ, THEN chỉ có một toast "Đã tải 3 tệp" và không có khối báo cáo.

**Tải xuống**
- **AC-AT.5** GIVEN kế toán mở hóa đơn PDF `HD-0012 Hòa Phát.pdf` trong hộp xem, WHEN bấm "Tải xuống", THEN máy lưu tệp `HD-0012 Hòa Phát.pdf`, có nội dung trùng từng byte với tệp đã tải lên. Kiểm như vậy với một ảnh PNG.
- **AC-AT.6** GIVEN `bql-b` không có tòa A, WHEN mở đường dẫn nội dung của một tệp thuộc tòa A, THEN vẫn nhận 404, và không có nút hay dữ liệu nào (giữ hành vi hiện tại).

**Ảnh từ điện thoại**
- **AC-AT.7** GIVEN ảnh JPEG 6.000×4.000 nặng 14 MB, WHEN tải lên, THEN tệp lên được dưới dạng JPEG có cạnh dài 4.000 px, nặng ≤ 10 MB, tên đuôi `.jpg`, và đứng đúng chiều với một ảnh chụp dọc (EXIF orientation 6).
- **AC-AT.8** GIVEN ảnh JPEG 3 MB, cạnh dài 3.000 px, THEN ảnh được tải nguyên bản, không bị nén (so byte).
- **AC-AT.9** GIVEN chọn tệp `IMG_0001.HEIC`, THEN tệp không được gửi lên máy chủ và có dòng lỗi đúng câu ở BR-AT-05.
- **AC-AT.10** Trên một iPhone thật hoặc trình giả lập iOS Safari, chọn ảnh từ thư viện và chụp ảnh mới bằng nút tải: ghi kết quả từng cách vào bằng chứng (lên được hay bị từ chối, loại tệp nhận được). Nếu không có thiết bị: ghi rõ là chưa kiểm, PM/BA chuyển mục này sang UAT.

**Xem ảnh**
- **AC-AT.11** Ảnh chụp 4.000×3.000 mở trong hộp xem không bị răng cưa. Kiểm bằng ảnh chụp màn hình trước và sau khi sửa.

**Chung**
- **AC-AT.12** Các trạng thái loading, lỗi, accessibility và responsive đúng như brief §3–§4. Các test hiện có của `FileUploader`, `file-service` và màn có tải tệp vẫn đạt, hoặc được sửa cho khớp quy tắc mới và ghi rõ trong bằng chứng.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Test component `FileUploader`: tải tiếp khi lỗi định dạng, lỗi kích thước hoặc lỗi mạng; dừng khi lỗi 403/404/409; báo cáo kết quả; toast khi mọi tệp đều lên.
- [ ] Unit test phần nén: ngưỡng 10 MB và 4.000 px, ảnh nhỏ giữ nguyên, PDF không nén, đổi đuôi, hướng xoay, HEIC bị từ chối.
- [ ] Test component `AttachmentViewer`: nút "Tải xuống" khóa khi đang tải, dùng đúng tên gốc, ẩn khi lỗi.
- [ ] Ảnh chụp màn hình: khối báo cáo trên màn rộng và màn 375px; hộp xem ảnh trước và sau khi bỏ `pixelated`.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-AT-1 | Ngưỡng nén: lớn hơn 10 MB hoặc cạnh dài hơn 4.000 px; JPEG chất lượng 0,85 | 4.000 px vẫn đủ rõ để soi vết nứt, vết thấm. Ảnh điện thoại thường 3–8 MB nên phần lớn không bị nén |
| D-AT-2 | Lỗi quyền hoặc bước (403, 404, 409) thì dừng cả lượt; lỗi của riêng tệp thì tải tiếp | Lỗi quyền áp dụng cho mọi tệp của lượt. Thử tiếp chỉ tạo thêm lỗi giống nhau |
| D-AT-3 | HEIC bị từ chối ở web, kèm hướng dẫn, thay vì đổi định dạng ngay trong trình duyệt | Đổi định dạng HEIC trong trình duyệt cần thêm thư viện nặng. Safari thường đã tự đổi sẵn; AC-AT.10 sẽ xác nhận |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích attachments (PD-22). |
| 27/10/2026 | Chủ dự án duyệt (PD-23), gồm D-AT-1 đến D-AT-3, và cho giao dev-build. |
| 27/10/2026 | Làm rõ khi build (PM/BA): cho sửa API để đọc tên tệp theo UTF-8 (§2 Ngoài phạm vi). |
| 27/10/2026 | Review PASS WITH RESIDUE, merge vào `main`; trạng thái `Đã triển khai`. |
