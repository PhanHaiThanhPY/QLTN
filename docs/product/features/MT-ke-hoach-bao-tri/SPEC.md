---
id: MT.S2
title: Kế hoạch bảo trì và sinh lượt tự động
status: Đã duyệt
owner: PM/BA
intent: "BQL lập kế hoạch bảo trì cho từng thiết bị với chu kỳ, danh mục kiểm và người làm; hệ thống tự sinh đúng các lượt bảo trì mỗi ngày, không trùng, kể cả khi không ai mở web."
depends_on: [MT.S1]
---

# SPEC: Kế hoạch bảo trì và sinh lượt tự động (MT-S2)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** `Đã duyệt`, chủ dự án duyệt ngày 27/10/2026 (PD-26), gồm 7 mặc định D-MT2-1 đến D-MT2-7 ở §6. Chỉ giao dev-build sau khi MT-S1 đạt review

**Nguồn:**
- Phân tích [maintenance.md](../../modules/maintenance.md), đã duyệt (PD-24):
  - khoảng trống MG-01 (phần kế hoạch), MG-03, MG-05, MG-07, MG-08, MG-10;
  - lỗi demo MD-02, MD-03, MD-04, MD-05, MD-08, MD-09, MD-10;
  - mặc định MQ-01, MQ-02, MQ-04 (OD-23).
- D2 nhóm 12: "Thiết lập chu kỳ và checklist, giao người thực hiện/xác nhận; tạo các lượt bảo trì, thay đổi lịch và ghi lý do điều chỉnh." D1 tr. 26. Review 23/10 §5.2 và dòng 201.
- Demo là tài liệu sống về hành vi: `web/src/services/handlers/maintenance-plan-handlers.ts`, `maintenance-generation.ts`, `domain/schedule.ts`, `features/maintenance/Plan*.tsx`. Khi demo và SPEC này khác nhau, theo SPEC.

**Nền:** thiết bị của [MT-S1](../MT-thiet-bi-bao-tri/SPEC.md). Slice này chỉ bắt đầu build **sau khi MT-S1 đạt review**.

**UI:** [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC.

## 1. Mục tiêu

Sau MT-S1, thiết bị đã có ở chế độ `api` nhưng chưa có kế hoạch bảo trì. Demo có kế hoạch, nhưng còn ba vấn đề:
- Lượt bảo trì chỉ được sinh khi có người mở màn hình (MG-05).
- Người thực hiện chỉ là chữ tự do, trong khi D1 cho kỹ thuật viên tự đăng nhập để làm (MG-03).
- Có nhiều lỗi về lịch: đổi chu kỳ hai lần thì chồng ngày; tạm dừng mà lượt vẫn thành quá hạn; kích hoạt kế hoạch cũ thì sinh lượt trong quá khứ (MD-02 đến MD-04).

Sau slice này:
- BQL lập kế hoạch cho thiết bị, gồm chu kỳ, danh mục kiểm, người thực hiện và người xác nhận.
- Máy chủ tự sinh lượt mỗi ngày.
- BQL tạm dừng, kết thúc, đổi chu kỳ, đổi lịch từng lượt và tạo lượt bù, mỗi việc đều có lý do.

**Thực hiện lượt** (điền checklist, gửi, xác nhận) làm ở **MT-S3**.

**Người dùng:**
- Chính: BQL lập và giữ kế hoạch bảo trì.
- Phụ: người thực hiện (KT hoặc BQL) và người xác nhận (KT) xem kế hoạch và lượt sắp tới của mình.

**User story:**
- Là BQL, tôi muốn đặt kế hoạch "kiểm bơm B01 hằng tháng" một lần, với 3 mục kiểm và người làm, để không phải nhớ lịch từng tháng.
- Là BQL, khi nhà cung cấp đổi khuyến nghị từ hằng tháng sang 2 tuần một lần, tôi muốn đổi chu kỳ từ một ngày cụ thể mà không làm hỏng các lượt đã có.
- Là BQL, khi thiết bị đang chờ thay, tôi muốn tạm dừng kế hoạch mà không để lại hàng loạt lượt quá hạn.

## 2. Phạm vi

**Trong phạm vi** (API và web chế độ `api`):
1. **Kế hoạch:**
   - tạo và sửa, với danh mục kiểm (BR-MT2-01 đến BR-MT2-03);
   - các bước: kích hoạt, tạm dừng, chạy lại, kết thúc (BR-MT2-04);
   - đổi chu kỳ (BR-MT2-05);
   - tạo lượt bù (BR-MT2-08).
2. **Sinh lượt tự động** ở máy chủ, chạy hằng ngày và chạy ngay khi kích hoạt hoặc đổi chu kỳ (BR-MT2-06).
3. **Lượt bảo trì ở trạng thái "Đã lên lịch":** xem; đổi lịch; giữ hoặc hủy lượt bị đánh dấu do đổi chu kỳ; hủy (BR-MT2-07).
4. **Giao người:** người thực hiện là tài khoản; người xác nhận là tài khoản khác (BR-MT2-02, theo MQ-01).
5. **Màn hình:**
   - danh sách kế hoạch, form kế hoạch, trang kế hoạch;
   - tab "Bảo trì" trong trang thiết bị (kế hoạch và các lượt sắp tới);
   - menu "Kế hoạch bảo trì" hiện ở chế độ `api`.
6. **Điều kiện ngừng dùng thiết bị** (BR-MT2-09, sửa MD-05).
7. **Seed demo:** kế hoạch cho các tòa demo theo `mock/seed-maintenance.ts` (BR-MT2-10).

**Ngoài phạm vi:**
- Bắt đầu, lưu, gửi kết quả, yêu cầu làm lại, xác nhận, giao lại người xác nhận, tạo hồ sơ sửa chữa từ lượt: **MT-S3**. Ở slice này, lượt chưa có trang chi tiết.
- Việc (task) và nhắc hạn cho người thực hiện: **MT-S3**. Slice này không gửi thông báo.
- Lịch bảo trì tuần/tháng (B14), cảnh báo, nhập dữ liệu từ tệp: **MT-S4**.
- Hạn theo giờ (MQ-07): lượt có hạn theo **ngày**.
- Chế độ `mock`: giữ nguyên, không bắt buộc sửa lỗi demo trong `mock`.

## 3. Quy tắc nghiệp vụ

- **BR-MT2-01. Trường của kế hoạch:**

  | Trường | Bắt buộc | Quy tắc |
  |---|---|---|
  | Mã | hệ thống | `KH-NNN`, đánh số chung, duy nhất ở tầng dữ liệu. Số chữ số tăng khi cần, không bị tràn (sửa MD-10) |
  | Thiết bị | có | thiết bị đang dùng, trong phạm vi tòa và vị trí của người tạo. **Không đổi** sau khi kích hoạt |
  | Tên | có | 3–120 ký tự |
  | Chu kỳ | có | **mỗi N tuần** (N từ 1 đến 8) hoặc **mỗi N tháng** (N từ 1 đến 24), theo MQ-02 |
  | Ngày bắt đầu | có | ngày của lượt đầu tiên; không trước hôm nay khi lưu |
  | Người quản lý kế hoạch | hệ thống | BQL tạo kế hoạch |
  | Người thực hiện | có | BR-MT2-02 |
  | Người xác nhận | có | BR-MT2-02 |
  | Nhà thầu | không | chữ tự do, tối đa 200 ký tự |
  | Danh mục kiểm | có | BR-MT2-03 |

- **BR-MT2-02. Người thực hiện và người xác nhận** (MQ-01):
  - **Người thực hiện:** một tài khoản đang hoạt động, vai trò KT hoặc BQL, có phạm vi tòa và vị trí của thiết bị. Người này sẽ điền kết quả ở MT-S3.
  - **Người xác nhận:** một tài khoản đang hoạt động, vai trò KT, có phạm vi tòa và vị trí của thiết bị, và **khác** người thực hiện.
  - Nhà thầu ngoài chỉ ghi ở ô "Nhà thầu". Người thực hiện là người của BQL điền thay.
  - Tài khoản bị khóa hoặc mất phạm vi sau khi được giao thì kế hoạch vẫn giữ người đó. Kế hoạch hiện cờ "Cần giao lại" cho đến khi BQL đổi người.
- **BR-MT2-03. Danh mục kiểm:** từ 1 đến 50 mục, có ít nhất 1 mục bắt buộc. Mỗi mục gồm:
  - Tên mục (3–200 ký tự).
  - Bắt buộc hay không.
  - Kiểu:
    - **Kiểm tra:** kết quả là Đạt / Lỗi / Không áp dụng, điền ở MT-S3.
    - **Số đo:** cần đơn vị (tối đa 30 ký tự); có ngưỡng tối thiểu và tối đa nếu muốn, tối thiểu ≤ tối đa.
  - **Cần ảnh** hay không (MG-07). Nếu có, ở MT-S3 mục đó phải có ít nhất 1 ảnh mới gửi được.
- **BR-MT2-04. Trạng thái của kế hoạch:**

  | Từ | Thao tác | Đến | Điều kiện, tác động |
  |---|---|---|---|
  | — | Tạo | **Nháp** | không sinh lượt |
  | Nháp | Kích hoạt | **Đang chạy** | Thiết bị đang dùng; người được giao hợp lệ. **Ngày bắt đầu không được trước hôm nay.** Nếu đã trước, báo lỗi ở trường ngày bắt đầu và yêu cầu sửa (sửa MD-03). Sinh lượt ngay |
  | Đang chạy | Tạm dừng (lý do) | **Tạm dừng** | **Tự hủy** mọi lượt "Đã lên lịch" của kế hoạch, lý do "Tạm dừng kế hoạch: «lý do»". Lượt đã bắt đầu thì giữ nguyên (MQ-04, sửa MD-04) |
  | Tạm dừng | Chạy lại | **Đang chạy** | Các kỳ rơi vào thời gian tạm dừng được ghi là "Bỏ qua do tạm dừng", không thành lượt quá hạn (như demo). Sinh lượt từ hôm nay |
  | Nháp, Đang chạy, Tạm dừng | Kết thúc (lý do) | **Đã kết thúc** | Tự hủy mọi lượt "Đã lên lịch", lý do "Kết thúc kế hoạch: «lý do»". Lượt đã bắt đầu vẫn làm tiếp được. **Không chạy lại được**; muốn tiếp tục thì tạo kế hoạch mới (MG-10) |

  - **Sửa kế hoạch:**
    - Lúc Nháp: sửa được mọi trường.
    - Lúc Đang chạy hoặc Tạm dừng: sửa được tên, danh mục kiểm, người thực hiện, người xác nhận và nhà thầu.
    - Muốn đổi chu kỳ hoặc ngày thì dùng "Đổi chu kỳ".
    - Lúc Đã kết thúc: không sửa được.
  - **Phần sửa áp vào các lượt "Đã lên lịch"** của kế hoạch. Lượt đã bắt đầu giữ bản chụp lúc bắt đầu (MD-08).
- **BR-MT2-05. Đổi chu kỳ** (lúc Đang chạy hoặc Tạm dừng). Nhập chu kỳ mới, ngày hiệu lực (≥ hôm nay), ngày của lượt đầu tiên theo chu kỳ mới (≥ ngày hiệu lực), và lý do.
  - **Cách xác định chu kỳ áp dụng:** ở một ngày bất kỳ, chu kỳ áp dụng là chu kỳ có **ngày hiệu lực muộn nhất mà vẫn ≤ ngày đó**.
  - Đổi chu kỳ từ ngày X **thay cho mọi thay đổi chu kỳ khác có hiệu lực từ X trở đi**. Hai chu kỳ không bao giờ cùng sinh lượt cho một ngày (sửa MD-02).
  - **Lượt đã sinh:** các lượt "Đã lên lịch" từ ngày hiệu lực trở đi bị **đánh dấu "Lịch đã đổi"**, không tự hủy (như demo). BQL chọn cho từng lượt:
    - "Giữ lượt này": bỏ dấu, lượt giữ ngày cũ;
    - "Hủy": hủy lượt; nếu chu kỳ mới cũng có kỳ ở ngày đó thì hệ thống sinh lại lượt cho kỳ đó.
  - Hệ thống sinh ngay các lượt của chu kỳ mới nếu kế hoạch đang chạy. Ngày nào đã có lượt rồi thì bỏ qua.
  - Mỗi lần đổi chu kỳ lưu lại người đổi, lý do và thời điểm. Lịch sử đổi chu kỳ hiện trên trang kế hoạch.
- **BR-MT2-06. Sinh lượt:**
  - **Cách tính ngày của từng kỳ:**
    - Kỳ thứ n = ngày bắt đầu của chu kỳ + n × (N tuần hoặc N tháng).
    - Với chu kỳ tháng: ngày bị cắt về ngày cuối tháng khi tháng ngắn hơn, ví dụ 31/01 thành 28/02. Mỗi kỳ tính lại từ ngày bắt đầu, nên không trôi ngày (như demo).
  - **Khoảng nhìn trước:** sinh các kỳ đến **hôm nay + 30 ngày**, cho kế hoạch đang chạy.
  - **Khi nào sinh:**
    - máy chủ chạy **mỗi ngày lúc 00:15 giờ Việt Nam**;
    - chạy ngay khi kích hoạt, chạy lại, hoặc đổi chu kỳ một kế hoạch đang chạy.
    - Không cần ai mở web (MG-05).
  - **Không trùng:**
    - mỗi kỳ của một kế hoạch, xác định bằng kế hoạch và ngày gốc, có nhiều nhất một lượt, kể cả khi lần chạy bị lặp lại hoặc hai lần chạy chồng nhau;
    - ràng buộc này kiểm ở tầng dữ liệu;
    - lượt đã đổi lịch vẫn giữ ngày gốc, nên kỳ đó không bị sinh lại.
  - **Mỗi lượt mới:**
    - mã `BT-NNNN` (đánh số chung, duy nhất);
    - trạng thái "Đã lên lịch";
    - bản chụp danh mục kiểm, người thực hiện, người xác nhận và nhà thầu của kế hoạch lúc sinh.
  - **Lần chạy lỗi hoặc dừng giữa chừng:**
    - lần chạy sau làm tiếp từ chỗ đã dừng;
    - mỗi lần chạy ghi nhật ký máy chủ: số lượt đã sinh, số kế hoạch lỗi;
    - **một kế hoạch lỗi không chặn các kế hoạch khác**.
- **BR-MT2-07. Thao tác với lượt "Đã lên lịch"** (người quản lý kế hoạch, BQL):
  - **Đổi lịch:**
    - cần ngày mới và lý do;
    - ngày mới ≥ hôm nay, khác ngày hiện tại, và **trước ngày của kỳ kế tiếp** của cùng kế hoạch (sửa MD-09);
    - ngày gốc giữ nguyên.
  - **Hủy:** cần lý do.
  - **Giữ lượt này:** chỉ có ở lượt bị đánh dấu "Lịch đã đổi".
  - Mọi thao tác đều có nhật ký kèm lý do.
  - Ai có quyền xem thì xem được lượt ở trang kế hoạch, trong phạm vi tòa.
- **BR-MT2-08. Lượt bù:**
  - Lúc Đang chạy hoặc Tạm dừng, BQL tạo được một lượt ngoài chu kỳ, với ngày ≥ hôm nay và lý do.
  - Lượt bù không có ngày gốc, nên không tính vào việc kiểm trùng.
  - Không tạo được lượt bù khi thiết bị đã ngừng dùng (sửa MD-05).
- **BR-MT2-09. Ngừng dùng thiết bị** (bổ sung cho BR-MT-03 của MT-S1): chỉ ngừng dùng được khi mọi kế hoạch của thiết bị đã ở "Nháp" hoặc "Đã kết thúc".
  - Nếu còn kế hoạch "Đang chạy" hoặc "Tạm dừng", báo: "Kết thúc các kế hoạch bảo trì của thiết bị trước khi ngừng dùng." kèm danh sách mã kế hoạch.
- **BR-MT2-10. Seed demo:** tạo các kế hoạch như `mock/seed-maintenance.ts`, ở trạng thái Đang chạy, với ngày bắt đầu tính tương đối theo ngày chạy seed.
  - Chỉ thêm khi chưa có, dựa theo mã thiết bị và tên kế hoạch.
  - Chỉ chạy khi bật seed demo, không bao giờ ở production.
- **BR-MT2-11. Quyền và phạm vi:**
  - Tạo, sửa và mọi thao tác ghi: người có `MAINTENANCE_MANAGE` (BQL), trong phạm vi tòa và vị trí của thiết bị.
  - Sửa và các thao tác với lượt chỉ dành cho **người quản lý kế hoạch**. Nếu người quản lý đã bị khóa, ADMIN đổi người quản lý cho kế hoạch, và việc đổi này áp vào luôn các lượt chưa bắt đầu (MD-08).
  - Xem: mọi người có quyền xem, trong phạm vi tòa.
  - Mọi thao tác ghi có nhật ký (loại chủ thể `MAINTENANCE_PLAN`, `MAINTENANCE_OCCURRENCE`) và khóa phiên bản.

## 4. Tiêu chí nghiệm thu

Trong test, "hôm nay" được cố định. Dữ liệu dùng tòa mẫu, tài khoản `bql-a` và hai KT của tòa A (`kt-a1`, `kt-a2`). Thiết bị lấy từ MT-S1.

**Lập kế hoạch**
- **AC-MT2.1** GIVEN `bql-a`, WHEN tạo kế hoạch cho BOM-A01, mỗi 1 tháng, ngày bắt đầu 12/11, người thực hiện `kt-a1`, người xác nhận `kt-a2`, 3 mục kiểm (Vận hành: Kiểm tra, bắt buộc; Rò rỉ: Kiểm tra, cần ảnh; Áp suất: Số đo, đơn vị "bar", 2–6), THEN kế hoạch ở "Nháp", có mã `KH-…`, và chưa có lượt nào.
- **AC-MT2.2** Chọn cùng một người cho cả người thực hiện và người xác nhận: bị từ chối ở trường người xác nhận. Chọn một BQL làm người xác nhận: bị từ chối. Danh mục kiểm không có mục bắt buộc nào: bị từ chối. Mục Số đo thiếu đơn vị: bị từ chối.
- **AC-MT2.3** GIVEN hôm nay 27/10, WHEN kích hoạt kế hoạch ở AC-MT2.1, THEN kế hoạch "Đang chạy" và có đúng 1 lượt "Đã lên lịch" ngày 12/11, vì 12/12 nằm ngoài khoảng 30 ngày.
- **AC-MT2.4** Một kế hoạch nháp có ngày bắt đầu 20/10, hôm nay 27/10: kích hoạt bị từ chối ở trường ngày bắt đầu. Sửa ngày bắt đầu thành 01/11 rồi kích hoạt thì được.
- **AC-MT2.5** Kế hoạch mỗi 2 tuần, bắt đầu 28/10: sau khi kích hoạt (hôm nay 27/10) có các lượt 28/10, 11/11, 25/11.

**Sinh lượt**
- **AC-MT2.6** Chạy lần sinh hằng ngày 2 lần liên tiếp, và 2 lần chạy song song: số lượt không đổi so với chạy 1 lần.
- **AC-MT2.7** Kế hoạch mỗi 1 tháng, bắt đầu 31/01: các lượt rơi vào 31/01, 28/02 (hoặc 29/02), 31/03.
- **AC-MT2.8** Dời "hôm nay" sang 25/11 rồi chạy lần sinh hằng ngày, không ai mở web: lượt 12/12 của AC-MT2.3 được sinh.
- **AC-MT2.9** Một kế hoạch có dữ liệu lỗi (ví dụ thiết bị bị xóa khỏi phạm vi bằng tay trong DB thử) không làm các kế hoạch khác ngừng được sinh. Nhật ký máy chủ ghi kế hoạch lỗi.

**Tạm dừng, kết thúc, đổi chu kỳ**
- **AC-MT2.10** GIVEN kế hoạch đang chạy có 2 lượt "Đã lên lịch", WHEN tạm dừng với lý do, THEN cả 2 lượt thành "Đã hủy" với lý do "Tạm dừng kế hoạch: …". Chạy lại sau 40 ngày: các kỳ trong lúc tạm dừng có trên trang kế hoạch dưới dạng "Bỏ qua do tạm dừng"; lượt mới bắt đầu từ hôm nay; không có lượt quá hạn nào.
- **AC-MT2.11** Kết thúc kế hoạch: các lượt "Đã lên lịch" thành "Đã hủy". Không còn nút "Kích hoạt" hay "Chạy lại". Lần sinh hằng ngày không sinh thêm lượt cho kế hoạch này.
- **AC-MT2.12** GIVEN kế hoạch mỗi 1 tháng có lượt 12/11, WHEN đổi sang mỗi 2 tuần, hiệu lực từ 10/11, lượt đầu 10/11, THEN:
  - lượt 12/11 bị đánh dấu "Lịch đã đổi";
  - có lượt mới 10/11 và 24/11.

  "Giữ lượt này" ở lượt 12/11 thì lượt đó bỏ dấu và giữ nguyên ngày.
- **AC-MT2.13** (MD-02) GIVEN đã đổi chu kỳ hiệu lực từ 01/12, WHEN đổi tiếp chu kỳ hiệu lực từ 15/11, THEN từ 15/11 chỉ còn chu kỳ mới sinh lượt, và lần đổi 01/12 bị thay thế. Không có hai lượt nào ở hai ngày khác nhau cho cùng một kỳ.

**Lượt**
- **AC-MT2.14** Đổi lịch lượt 12/11 sang 15/11 với lý do: lượt có ngày 15/11 và ngày gốc vẫn là 12/11. Chạy lần sinh không tạo thêm lượt 12/11. Đổi lịch sang sau ngày của kỳ kế tiếp: bị từ chối.
- **AC-MT2.15** Sửa người thực hiện của kế hoạch sang `bql-a`: các lượt "Đã lên lịch" đổi theo.
- **AC-MT2.16** Tạo lượt bù ngày 05/11 với lý do: có lượt ngày 05/11, đánh dấu "Lượt bù".

**Thiết bị và phạm vi**
- **AC-MT2.17** Ngừng dùng BOM-A01 khi còn kế hoạch đang chạy: bị từ chối, với câu của BR-MT2-09. Kết thúc kế hoạch rồi ngừng dùng thì được.
- **AC-MT2.18** Tab "Bảo trì" của trang BOM-A01 có danh sách kế hoạch và các lượt sắp tới. `bql-b` không thấy kế hoạch nào của tòa A, và mở thẳng đường dẫn thì nhận 404. Tài khoản chỉ xem không có nút ghi nào; gọi thẳng API ghi thì nhận 403.

**Chung**
- **AC-MT2.19** Ở chế độ `api`, menu có "Kế hoạch bảo trì". Trạng thái loading, rỗng, lỗi, offline, accessibility và responsive đúng brief. Chế độ `mock` vẫn chạy, test hiện có vẫn đạt.

## 5. Checklist test cho dev-review

Chỉ chạy các test liên quan.

- [ ] Unit test phần tính kỳ: chu kỳ tuần và tháng, cắt ngày cuối tháng, chọn chu kỳ theo ngày hiệu lực (AC-MT2.13), khoảng 30 ngày.
- [ ] e2e API: trạng thái của kế hoạch, sinh lượt không trùng (lặp lại và song song), tạm dừng, chạy lại, kết thúc, đổi chu kỳ, giữ hoặc hủy lượt bị đánh dấu, đổi lịch, lượt bù, điều kiện ngừng dùng thiết bị, phạm vi, 403, khóa phiên bản.
- [ ] Lần sinh hằng ngày chạy được khi gọi trực tiếp, không cần web (AC-MT2.8). Một kế hoạch lỗi không chặn kế hoạch khác.
- [ ] Migration chạy được trên `qltn_dev` (sau migration của MT-S1).
- [ ] Test component: form kế hoạch (danh mục kiểm), trang kế hoạch (thao tác theo trạng thái), tab "Bảo trì".
- [ ] Ảnh chụp ở chế độ `api`: danh sách, form, trang kế hoạch có lượt bị đánh dấu, tab "Bảo trì", màn rộng 375px.

## 6. Mặc định PM/BA dùng trong SPEC này

| ID | Mặc định | Lý do |
|---|---|---|
| D-MT2-1 | Người thực hiện là KT hoặc BQL; người xác nhận là KT khác | Theo MQ-01 và D1 tr. 27 (KT01 làm trên điện thoại). Tòa chỉ có một KT thì BQL thực hiện |
| D-MT2-2 | Kích hoạt kế hoạch có ngày bắt đầu đã qua thì báo lỗi, không tự lùi hay bỏ kỳ | Rõ ràng nhất cho BQL; không lặng lẽ sinh lượt quá hạn (MD-03) |
| D-MT2-3 | Tạm dừng và kết thúc thì tự hủy lượt chưa bắt đầu | Theo MQ-04; tránh hàng loạt lượt quá hạn (MD-04) |
| D-MT2-4 | Sửa người, danh mục kiểm, nhà thầu áp vào lượt chưa bắt đầu | Lượt chưa bắt đầu chưa có ai làm; giữ bản chụp cho lượt đã bắt đầu (MD-08) |
| D-MT2-5 | Đổi lịch không được qua ngày của kỳ kế tiếp | Hai lượt của hai kỳ không bị đảo thứ tự (MD-09) |
| D-MT2-6 | Sinh lượt lúc 00:15 giờ VN, nhìn trước 30 ngày | Giữ khoảng 30 ngày của demo; chạy sau nửa đêm để "hôm nay" đã đổi |
| D-MT2-7 | Có thêm trạng thái "Đã kết thúc" cho kế hoạch | Demo không có cách kết thúc kế hoạch (MG-10) |

## 7. Lịch sử

| Ngày | Thay đổi |
|---|---|
| 27/10/2026 | Viết từ phân tích maintenance (PD-24). |
| 27/10/2026 | Chủ dự án duyệt (PD-26), gồm D-MT2-1 đến D-MT2-7. Giao dev-build sau khi MT-S1 đạt review. |
