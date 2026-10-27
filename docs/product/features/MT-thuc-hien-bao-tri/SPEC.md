---
id: MT.S3
title: Thực hiện và xác nhận lượt bảo trì trên điện thoại
status: Đã triển khai
owner: PM/BA
intent: "Người thực hiện điền kết quả từng mục kiểm ngay tại thiết bị bằng điện thoại, người xác nhận duyệt hoặc trả làm lại, và mỗi mục lỗi đều có hướng xử lý rõ ràng, kể cả hồ sơ sửa chữa tạo từ chính mục đó."
depends_on: [MT.S2]
---

# SPEC: Thực hiện và xác nhận lượt bảo trì trên điện thoại (MT-S3)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã triển khai` (27/10/2026, merge vào `main`); trước đó `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-27), gồm 7 mặc định D-MT3-1 đến D-MT3-7 ở §6. Chỉ giao dev-build sau khi MT-S2 đạt review

**Nguồn:**
- Phân tích [maintenance.md](../../modules/maintenance.md), đã duyệt (PD-24):
  - khoảng trống MG-01 (phần thực hiện), MG-02 (lượt bảo trì nguồn của hồ sơ sửa chữa), MG-03, MG-09;
  - lỗi demo MD-01, MD-07, MD-09;
  - mặc định MQ-01, MQ-03, MQ-07 (OD-23).
- D2 nhóm 13: "Nhận việc, điền checklist, số đo, ảnh và kết quả; gửi xác nhận hoặc bổ sung; liên kết tạo hồ sơ sửa chữa khi phát hiện hư hỏng." D1 tr. 27: "Ghi nhận kết quả bảo trì ngay trên điện thoại".
- Review 23/10 dòng 201: "giữ kết quả cũ; không coi tạo hồ sơ sửa chữa là đã sửa xong".
- Demo là tài liệu sống về hành vi: `services/handlers/maintenance-occurrence-handlers.ts`, `link-and-assignment-handlers.ts` (`createRepairFromMaintenance`), `domain/maintenance-rules.ts`, `features/maintenance/OccurrenceDetailPage.tsx`, `components/occurrence/*`, `SchedulePage.tsx` (kiểu Danh sách). Khi demo và SPEC này khác nhau, theo SPEC.

**Nền:** [MT-S1](../MT-thiet-bi-bao-tri/SPEC.md) (thiết bị, thiết bị của hồ sơ sửa chữa) và [MT-S2](../MT-ke-hoach-bao-tri/SPEC.md) (kế hoạch, lượt, người thực hiện, người xác nhận, lần chạy hằng ngày). Slice này chỉ bắt đầu build **sau khi MT-S2 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau MT-S2, máy chủ đã sinh lượt bảo trì, nhưng chưa ai làm được lượt nào ở chế độ `api`. Slice này làm phần còn lại của vòng đời một lượt:
- người thực hiện nhận việc và điền kết quả trên điện thoại, kèm số đo và ảnh;
- người xác nhận duyệt, hoặc trả làm lại từng mục;
- mục lỗi dẫn tới hồ sơ sửa chữa, hoặc tới một hướng xử lý được ghi rõ.

Slice này cũng sửa hai lỗi của demo:
- hạn xác nhận bỏ qua cấu hình của tòa (MD-01);
- quy tắc "mục lỗi phải có hướng xử lý" chỉ so số lượng, không xét từng mục (MD-07).

**Người dùng:**
- Chính: người thực hiện (KT hoặc BQL) điền kết quả tại thiết bị bằng điện thoại.
- Chính: người xác nhận (KT) duyệt kết quả.
- Phụ: BQL quản lý kế hoạch, theo dõi lượt quá hạn, tạo hồ sơ sửa chữa từ mục lỗi, giao lại người.

**User story:**
- Là KT, tôi muốn mở lượt hôm nay trên điện thoại, đánh Đạt/Lỗi từng mục, nhập áp suất và chụp ảnh chỗ rò, để không phải ghi giấy rồi nhập lại.
- Là KT xác nhận, tôi muốn trả lại đúng mục chưa đạt kèm lý do, để người làm sửa đúng chỗ.
- Là BQL, khi một mục bị lỗi, tôi muốn tạo hồ sơ sửa chữa từ chính mục đó, kèm sẵn ảnh và thiết bị, để không phải nhập lại.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Thao tác với lượt:**
   - bắt đầu, lưu, gửi kết quả;
   - yêu cầu làm lại (từng mục), xác nhận hoàn thành;
   - hủy khi đang làm, giao lại người thực hiện hoặc người xác nhận (BR-MT3-01 đến BR-MT3-07).
2. **Các lần gửi kết quả:** mỗi lần gửi là một bản chụp không sửa được. Có lịch sử các lần gửi và các quyết định.
3. **Mục lỗi và hồ sơ sửa chữa:** tạo hồ sơ sửa chữa từ **một mục lỗi** (cần migration). Xác nhận chỉ được khi **từng** mục lỗi có hướng xử lý (BR-MT3-08, BR-MT3-09).
4. **Thông báo và nhắc hạn** trong hệ thống (BR-MT3-10).
5. **Màn hình:**
   - trang lượt bảo trì, dùng tốt ở 375px;
   - trang "Lượt bảo trì" kiểu **Danh sách**, có lọc "Việc của tôi" và thẻ số tính ở máy chủ;
   - dòng lượt ở trang kế hoạch và tab "Bảo trì" của thiết bị trở thành liên kết.
6. **Seed demo:** lượt ở đủ các trạng thái, như `mock/seed-maintenance.ts` (BR-MT3-12).

**Ngoài phạm vi:**
- Lịch bảo trì kiểu Tuần và Tháng, cảnh báo, nhập dữ liệu từ tệp: **MT-S4**.
- Việc (task) trong "Công việc cá nhân" (B02): slice này chỉ có thông báo và danh sách "Việc của tôi".
- Làm việc khi không có mạng: không có chế độ offline. Lỗi mạng không được làm mất dữ liệu đang nhập (brief §4).
- Bản in biên bản bảo trì (nút demo `MaintenanceDocumentButton`).
- Hạn theo giờ (MQ-07).
- Chế độ `mock`: giữ nguyên.

## 3. Quy tắc nghiệp vụ

- **BR-MT3-01. Trạng thái của lượt** (giữ 6 trạng thái của demo):

  | Từ | Thao tác | Ai | Đến |
  |---|---|---|---|
  | Đã lên lịch | Bắt đầu | người thực hiện | Đang làm |
  | Đang làm, Làm lại | Lưu | người thực hiện | không đổi |
  | Đang làm, Làm lại | Gửi kết quả | người thực hiện | Chờ xác nhận |
  | Chờ xác nhận | Yêu cầu làm lại | người xác nhận | Làm lại |
  | Chờ xác nhận | Xác nhận hoàn thành | người xác nhận | Hoàn thành |
  | Đã lên lịch, Đang làm, Làm lại | Hủy (lý do) | BQL quản lý kế hoạch | Đã hủy |
  | mọi trạng thái chưa kết thúc | Giao lại (lý do) | BQL quản lý kế hoạch | không đổi |

  - "Hoàn thành" và "Đã hủy" là trạng thái kết thúc; lượt ở hai trạng thái này không sửa được nữa.
  - Lượt "Chờ xác nhận" không hủy được. Người xác nhận phải trả làm lại trước (như demo).
- **BR-MT3-02. Bắt đầu:**
  - Được bắt đầu từ **3 ngày trước** ngày lịch trở đi (sửa MD-09). Sớm hơn thì báo: "Chưa đến lúc làm lượt này. Nhờ BQL đổi lịch nếu cần làm sớm."
  - Khi bắt đầu, lượt chụp lại danh mục kiểm, người thực hiện, người xác nhận và nhà thầu. Sửa kế hoạch sau đó không đổi lượt này (MT-S2 BR-MT2-04).
- **BR-MT3-03. Điền kết quả** (lưu được nhiều lần trước khi gửi):
  - **Mục kiểm:**
    - Mục Kiểm tra: kết quả là Đạt, Lỗi hoặc Không áp dụng.
    - Mục Số đo: nhập số; nằm ngoài ngưỡng thì kết quả **tự chuyển thành Lỗi**, kèm dòng "Ngoài ngưỡng 2–6 bar". Người làm không đổi được thành Đạt.
    - Mỗi mục có ghi chú và ảnh riêng.
  - **Chung cho cả lượt:** kết quả chung (≥ 5 ký tự), nhà thầu (sửa được), người làm thực tế (chữ tự do, không bắt buộc; ví dụ thợ của nhà thầu), ảnh chung.
  - Ảnh tải theo luật của module tệp và AT-S1, mục đích "Kết quả bảo trì". Chỉ người thực hiện tải được, khi lượt đang làm hoặc làm lại.
- **BR-MT3-04. Điều kiện để gửi kết quả** (báo lỗi tại đúng mục):
  - mọi mục bắt buộc đã có kết quả;
  - mục Lỗi và mục Không áp dụng có ghi chú;
  - mục Lỗi có ít nhất 1 **ảnh** (demo nhận cả PDF);
  - mục "Cần ảnh" (MT-S2) có ít nhất 1 ảnh;
  - mục Số đo đã có số;
  - kết quả chung đã nhập;
  - cả lượt có ít nhất 1 ảnh.
- **BR-MT3-05. Các lần gửi:**
  - Mỗi lần gửi lưu một bản chụp: lần thứ mấy, các mục, ghi chú, ảnh, kết quả chung, người gửi, thời điểm.
  - Bản chụp **không sửa được**.
  - Lần làm lại bắt đầu từ kết quả của lần gửi trước. Người làm chỉ sửa những gì cần sửa.
- **BR-MT3-06. Xác nhận:**
  - **Hạn xác nhận** = thời điểm gửi + số ngày của mục "Kiểm tra kết quả bảo trì" trong **cấu hình của tòa** (mặc định 2 ngày; sửa MD-01).
  - **Yêu cầu làm lại:**
    - cần lý do chung (≥ 5 ký tự);
    - đánh dấu **ít nhất một mục** "Cần làm lại", mỗi mục có lý do (≥ 5 ký tự);
    - các mục còn lại được giữ.
  - **Xác nhận hoàn thành:**
    - không mục nào bị đánh dấu "Cần làm lại";
    - mọi mục lỗi đều có hướng xử lý (BR-MT3-09);
    - người xác nhận được đổi tình trạng thiết bị (Tốt / Cần chú ý), kèm ghi chú. Lần đổi này ghi vào lịch sử tình trạng của thiết bị (MT-S1 BR-MT-04).
  - Thao tác trên một lần gửi cũ (người khác đã gửi lại hoặc đã quyết định) bị từ chối với lỗi xung đột.
- **BR-MT3-07. Giao lại:**
  - BQL quản lý kế hoạch giao lại **người thực hiện** (khi Đã lên lịch, Đang làm, Làm lại) hoặc **người xác nhận** (khi chưa kết thúc).
  - Người mới phải hợp lệ theo MT-S2 BR-MT2-02 và khác người hiện tại. Cần lý do.
  - Người mới nhận thông báo.
  - Kết quả đã điền giữ nguyên.
- **BR-MT3-08. Tạo hồ sơ sửa chữa từ một mục lỗi:**
  - **Ai:** BQL quản lý kế hoạch, có quyền tạo hồ sơ sửa chữa.
  - **Khi nào:** lượt đang làm, chờ xác nhận hoặc làm lại, và mục đang có kết quả Lỗi.
  - **Hồ sơ mới:** ở trạng thái **Nháp**, BQL đó là người quản lý. Hồ sơ chép từ lượt:
    - tòa, vị trí của thiết bị (đổi được trong form), thiết bị (MT-S1);
    - tên gợi ý "«mã thiết bị»: «tên mục»";
    - mô tả gợi ý từ ghi chú của mục;
    - ảnh của mục, thành ảnh hiện trường của hồ sơ.
  - **Liên kết hai chiều:**
    - hồ sơ lưu lượt bảo trì nguồn và mục nguồn (cần migration);
    - mục lỗi hiện "Hồ sơ sửa chữa: SC-…" kèm trạng thái;
    - chi tiết hồ sơ hiện "Từ lượt bảo trì BT-… · mục «tên mục»".
  - **Một mục lỗi có nhiều nhất một hồ sơ còn hiệu lực.** Hồ sơ bị rút, hoặc đóng vì không cần sửa, thì không còn hiệu lực, và BQL tạo được hồ sơ mới cho mục đó.
  - Bấm hai lần (gửi lặp) không tạo hai hồ sơ.
- **BR-MT3-09. Hướng xử lý của mục lỗi** (MQ-03, sửa MD-07):
  - Lúc xác nhận, **từng** mục lỗi phải có một trong hai:
    - (a) một hồ sơ sửa chữa còn hiệu lực tạo từ đúng mục đó (BR-MT3-08);
    - (b) một "hướng xử lý" do người xác nhận ghi cho mục đó, ≥ 10 ký tự. Ví dụ: "Đã siết lại khớp nối tại chỗ, theo dõi lượt sau".
  - Xét theo từng mục, không theo số lượng. Thiếu ở mục nào thì báo đúng mục đó.
  - Lượt "Hoàn thành" **không** có nghĩa là hư hỏng đã được sửa. Trang lượt và trang thiết bị hiện trạng thái hiện tại của hồ sơ sửa chữa liên kết (review 23/10).
- **BR-MT3-10. Thông báo trong hệ thống:**

  | Sự kiện | Người nhận |
  |---|---|
  | Lượt mới được giao (khi sinh, hoặc khi giao lại người thực hiện) | người thực hiện |
  | Đến hạn hôm nay (lần chạy 00:15, một lần cho mỗi lượt) | người thực hiện |
  | Quá hạn 1 ngày (một lần cho mỗi lượt) | người thực hiện và BQL quản lý kế hoạch |
  | Đã gửi kết quả, hoặc giao lại người xác nhận | người xác nhận |
  | Quá hạn xác nhận (một lần) | người xác nhận và BQL quản lý kế hoạch |
  | Yêu cầu làm lại | người thực hiện |
  | Xác nhận hoàn thành | BQL quản lý kế hoạch |

  - Không gửi thông báo cho chính người vừa làm thao tác.
  - Mỗi thông báo mở thẳng tới trang lượt.
  - Một lượt không bao giờ nhận cùng một loại nhắc hạn hai lần.
- **BR-MT3-11. Quá hạn:**
  - Lượt Đã lên lịch, Đang làm hoặc Làm lại có ngày lịch < hôm nay (giờ VN) thì "Quá hạn N ngày".
  - Lượt Chờ xác nhận quá hạn xác nhận thì "Quá hạn xác nhận".
  - Lượt quá hạn vẫn làm tiếp được. BQL hủy được, kèm lý do (MQ-04).
- **BR-MT3-12. Seed demo:** thêm các lượt ở đủ 6 trạng thái theo `mock/seed-maintenance.ts`. Gồm:
  - một lượt quá hạn;
  - một lượt chờ xác nhận;
  - một lượt làm lại;
  - một lượt hoàn thành có mục lỗi đã tạo hồ sơ sửa chữa.

  Chỉ thêm khi chưa có; không bao giờ chạy ở production.
- **BR-MT3-13. Quyền và phạm vi:**
  - Mỗi thao tác chỉ dành cho đúng người ở cột "Ai" của BR-MT3-01. Người đó còn phải đang hoạt động và có phạm vi tòa và vị trí của thiết bị.
  - Xem: mọi người có quyền xem, trong phạm vi tòa.
  - Mọi thao tác ghi có nhật ký và khóa phiên bản.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Tài khoản: `bql-a` (quản lý kế hoạch), `kt-a1` (người thực hiện), `kt-a2` (người xác nhận). Kế hoạch có 3 mục, như AC-MT2.1 của MT-S2: Vận hành; Rò rỉ (cần ảnh); Áp suất (bar, 2–6).

**Thực hiện**
- **AC-MT3.1** GIVEN lượt ngày 12/11, hôm nay 08/11, WHEN `kt-a1` bấm Bắt đầu, THEN bị từ chối với câu của BR-MT3-02. Hôm nay 09/11 thì bắt đầu được. `kt-a2` hoặc `bql-a` bấm Bắt đầu thì nhận 403.
- **AC-MT3.2** `kt-a1` nhập Áp suất 7: mục tự thành Lỗi, kèm dòng "Ngoài ngưỡng 2–6 bar". Lưu, tải lại trang: dữ liệu còn nguyên.
- **AC-MT3.3** Gửi khi mục Rò rỉ chưa có ảnh, hoặc mục Áp suất (Lỗi) chưa có ghi chú hay ảnh: bị từ chối, báo lỗi tại đúng mục. Đủ điều kiện thì lượt thành "Chờ xác nhận", có bản chụp lần 1, và `kt-a2` nhận thông báo.
- **AC-MT3.4** GIVEN cấu hình tòa A đặt "Kiểm tra kết quả bảo trì" là 3 ngày, WHEN gửi lúc 09:00 ngày 10/11, THEN hạn xác nhận là 09:00 ngày 13/11 (sửa MD-01).

**Xác nhận**
- **AC-MT3.5** `kt-a2` yêu cầu làm lại mà không đánh dấu mục nào: bị từ chối. Đánh dấu mục Áp suất kèm lý do: lượt thành "Làm lại", và `kt-a1` nhận thông báo. Mục Áp suất hiện lý do; hai mục kia giữ kết quả cũ.
- **AC-MT3.6** `kt-a1` sửa và gửi lần 2: có bản chụp lần 2, còn bản chụp lần 1 không đổi. `kt-a2` thao tác trên lần 1 (gọi API với lần gửi cũ): nhận lỗi xung đột.
- **AC-MT3.7** GIVEN lần 2 có mục Rò rỉ là Lỗi và mục Áp suất là Lỗi, chưa mục nào có hướng xử lý, WHEN `kt-a2` xác nhận, THEN bị từ chối và báo ở **cả hai** mục.
- **AC-MT3.8** GIVEN `bql-a` tạo hồ sơ sửa chữa từ mục Rò rỉ, và `kt-a2` ghi hướng xử lý cho mục Áp suất, THEN xác nhận được, lượt thành "Hoàn thành", và `bql-a` nhận thông báo.
- **AC-MT3.9** (MD-07) GIVEN lượt có 2 mục lỗi, đã tạo hồ sơ cho mục A rồi rút hồ sơ đó, và tạo một hồ sơ khác cho mục A, THEN mục B vẫn bị báo thiếu hướng xử lý khi xác nhận. Hồ sơ của mục A không được tính cho mục B.
- **AC-MT3.10** Khi xác nhận, `kt-a2` chọn tình trạng thiết bị "Cần chú ý" kèm ghi chú: trang BOM-A01 có tình trạng mới, và lịch sử tình trạng có một dòng mới.

**Hồ sơ sửa chữa từ mục lỗi**
- **AC-MT3.11** Tạo hồ sơ từ mục Rò rỉ: hồ sơ ở "Nháp", đã có tòa, vị trí, thiết bị BOM-A01, tên "BOM-A01: Rò rỉ", mô tả lấy từ ghi chú, và ảnh của mục là ảnh hiện trường. Chi tiết hồ sơ hiện "Từ lượt bảo trì BT-… · mục Rò rỉ". Mục Rò rỉ hiện "SC-…" kèm trạng thái.
- **AC-MT3.12** Tạo hồ sơ thứ hai cho mục Rò rỉ khi hồ sơ đầu còn hiệu lực: bị từ chối. Gửi lặp cùng một yêu cầu: chỉ có một hồ sơ. `kt-a1`, vốn không có quyền tạo hồ sơ sửa chữa, nhận 403.

**Hủy, giao lại, quá hạn, thông báo**
- **AC-MT3.13** Hủy lượt "Chờ xác nhận": bị từ chối. Hủy lượt "Đang làm" với lý do: thành "Đã hủy", kết quả đã điền vẫn xem được.
- **AC-MT3.14** Giao lại người thực hiện từ `kt-a1` sang `kt-a3` khi lượt đang làm: kết quả đã điền giữ nguyên. `kt-a3` nhận thông báo và tiếp tục được. Khi `bql-a` tự giao cho chính mình thì **không** có thông báo, theo BR-MT3-10. Giao người xác nhận trùng người thực hiện: bị từ chối. *(Làm rõ 27/10 khi build: bản đầu ghi `bql-a` tự giao mà vẫn nhận thông báo, mâu thuẫn với BR-MT3-10.)*
- **AC-MT3.15** GIVEN lượt ngày 12/11 chưa làm, WHEN lần chạy 00:15 ngày 12/11, THEN `kt-a1` nhận "đến hạn hôm nay" đúng một lần. Ngày 13/11: lượt "Quá hạn 1 ngày"; `kt-a1` và `bql-a` mỗi người nhận một thông báo quá hạn. Chạy lần đó 2 lần: không có thông báo lặp.

**Màn hình và phạm vi**
- **AC-MT3.16** Trang "Lượt bảo trì" kiểu Danh sách:
  - lọc "Việc của tôi" của `kt-a1` chỉ ra các lượt `kt-a1` là người thực hiện, hoặc là người xác nhận khi lượt đang chờ xác nhận;
  - thẻ số "Quá hạn, Hôm nay, 7 ngày tới, Chờ xác nhận" khớp với danh sách và do máy chủ tính;
  - `bql-b` không thấy lượt nào của tòa A, và mở thẳng đường dẫn thì nhận 404.
- **AC-MT3.17** Ở 375px, `kt-a1` làm trọn một lượt (bắt đầu → điền → chụp ảnh → gửi) mà trang không cuộn ngang. Mọi nút và ô có vùng bấm ≥ 44px. Mất mạng lúc bấm Lưu: dữ liệu đang nhập còn nguyên, có thông báo lỗi, và lưu lại được khi có mạng.
- **AC-MT3.18** Trạng thái loading, rỗng, lỗi, accessibility đúng brief. Chế độ `mock` vẫn chạy, test hiện có vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] e2e API:
  - từng thao tác của BR-MT3-01 với đúng người và sai người (403);
  - điều kiện gửi; các lần gửi; xung đột với lần gửi cũ;
  - hạn xác nhận theo cấu hình tòa;
  - hướng xử lý theo từng mục (AC-MT3.7 đến AC-MT3.9);
  - tạo hồ sơ từ mục lỗi (một hồ sơ còn hiệu lực, gửi lặp);
  - giao lại; phạm vi.
- [ ] e2e hoặc unit cho nhắc hạn: một lần cho mỗi loại, chạy lặp không gửi lại (AC-MT3.15).
- [ ] Migration (lượt và mục nguồn của hồ sơ sửa chữa, các lần gửi, quyết định, nhắc hạn đã gửi) chạy được trên `qltn_dev`, sau migration của MT-S1 và MT-S2.
- [ ] Test component: trang lượt (điền theo kiểu mục, ngoài ngưỡng, lỗi tại mục), bảng xác nhận, danh sách "Việc của tôi".
- [ ] Ảnh chụp ở chế độ `api`: trang lượt ở 375px (đang làm, chờ xác nhận, có hồ sơ sửa chữa liên kết) và ở màn rộng; danh sách "Việc của tôi".

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-MT3-1 | Bắt đầu được từ 3 ngày trước ngày lịch | Cho làm sớm một chút khi tiện đường, nhưng không làm trước cả tháng (MD-09). Sớm hơn thì BQL đổi lịch |
| D-MT3-2 | Số đo ngoài ngưỡng tự thành Lỗi, không đổi được | Ngưỡng do kế hoạch đặt; người làm không tự bỏ qua |
| D-MT3-3 | Mục lỗi phải có ảnh (không nhận PDF thay ảnh) | Ảnh là bằng chứng hiện trường; D1 tr. 27 có ảnh cho mục lỗi |
| D-MT3-4 | Hướng xử lý (b) do người xác nhận ghi, ≥ 10 ký tự | Người xác nhận chịu trách nhiệm kết luận lượt (MQ-03) |
| D-MT3-5 | Một mục lỗi có nhiều nhất một hồ sơ còn hiệu lực | Tránh trùng hồ sơ cho cùng một hư hỏng |
| D-MT3-6 | Không có chế độ offline; không mất dữ liệu khi lỗi mạng | Offline thật cần đồng bộ và xử lý xung đột, quá lớn cho slice này |
| D-MT3-7 | Mỗi loại nhắc hạn gửi một lần cho mỗi lượt | Tránh làm phiền; danh sách "Việc của tôi" luôn có số quá hạn |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích maintenance (PD-24). |
| 27/10/2026 | Chủ dự án duyệt (PD-27), gồm D-MT3-1 đến D-MT3-7. Giao dev-build sau khi MT-S2 đạt review. |
| 27/10/2026 | Làm rõ khi build (PM/BA): AC-MT3.14 theo BR-MT3-10, không gửi thông báo cho người tự giao cho chính mình. |
| 27/10/2026 | Review PASS WITH RESIDUE trên `c479925`; merge vào `main` (`ef37aa8`); trạng thái `Đã triển khai`. |
