# Tổng quan module, tính năng và trạng thái triển khai QLTN

**Chủ sở hữu:** PM/BA · **Ngày:** 26/10/2026 · **Trạng thái:** Báo cáo giai đoạn 1 (kiểm kê). Chưa phải kế hoạch đã duyệt.

## 1. Căn cứ và cách đo

**Ảnh chụp code**
- Commit `641c8b5`, nhánh `feature/b03-s1-confirmation`, gồm slice S1 chưa merge.
- `main` đang ở `ef5b792`, chưa có S1.

**Nguồn**

| Nguồn | Dùng để |
|---|---|
| `web/src/app/router.tsx`, `web/src/app/navigation.ts` | Màn hình nào chạy ở chế độ `api` |
| `web/src/services/handlers/*.ts` | Thao tác ghi của demo |
| `web/src/services/http/command-adapter.ts` (`API_COMMANDS`) | Thao tác ghi đã nối API |
| `api-qltn/src/modules/*/*.controller.ts`, `src/database/migrations/` | Endpoint và bảng dữ liệu |
| D1 tr. 2, 15–41, 44 | Danh mục module |
| [DECISIONS.md](../../product/DECISIONS.md) | Khác biệt nghiệp vụ |

**Đơn vị đếm**
- **Module:** một mã trong D1: `B01–B18`, `F01–F10`, `T01–T06`, `S01`, `A01`. Tổng 36 module (34 nghiệp vụ, cộng S01 và A01).
- **Tính năng:** một thao tác ghi (lệnh) trong demo. Module chỉ có màn hình xem được tính theo số màn hình.
- Đây là cách đếm kiểm chứng được trên code. Nó **không** thay cho danh sách tính năng hợp đồng: danh sách đó chưa có, vì phụ lục nghiệm thu chưa có (OD-14).

**Ba mức trạng thái**

| Mức | Nghĩa |
|---|---|
| **API** | Có endpoint, test e2e và web chạy ở chế độ `api` |
| **Demo** | Chỉ chạy trên dữ liệu mẫu IndexedDB. Ở chế độ `api`, route hiện trang "chưa nối API" (`connected()` trong `router.tsx`) |
| **Chưa có** | Không có dòng code nào |

## 2. Kết quả tổng hợp

| Nhóm | Số module | API | Một phần API | Chỉ demo | Chưa có |
|---|---|---|---|---|---|
| B: Vận hành tòa nhà | 18 | 2 (B15, B16) | 2 (B03, B17) | 14 | 0 |
| F: Quỹ khai thác | 10 | 0 | 0 | 0 | 10 |
| T: Tiền gửi quỹ bảo trì | 6 | 0 | 0 | 0 | 6 |
| S01, A01 | 2 | 0 | 0 | 2 | 0 |
| **Tổng** | **36** | **2** | **2** | **16** | **16** |

**Thao tác ghi:** demo có **70**, đã nối API **21**.
- B15 và B16: 8 thao tác.
- B17: 6 thao tác.
- B03: 7 thao tác. Trong đó 3 thao tác xác nhận (S1) chỉ có trên nhánh `feature/b03-s1-confirmation`, chưa merge vào `main`.

**API hiện có**
- 46 route trong 9 module NestJS: auth, users, roles, organization (bộ phận), buildings, reference, records, attachments, health.
- 15 bảng dữ liệu, 6 migration.

**Test**
- API: 39 unit test, 85 test e2e.
- Web: 289 test.
- Số liệu lấy từ handoff S1 ngày 26/10.

## 3. Chi tiết từng module

Cột "Khác D1" chỉ ghi khác biệt đã có bằng chứng (DG, RC, OD trong DECISIONS.md). Ô để trống nghĩa là chưa rà; **không** có nghĩa là đúng D1.

| Mã | Module (D1) | Màn hình web | Thao tác demo | Đã nối API | Trạng thái | Khác D1 / còn thiếu |
|---|---|---|---|---|---|---|
| B01 | Tổng quan đa tòa | `/` dashboard | chỉ xem | 0 | Demo | Ở chế độ `api`, trang chủ chuyển hướng sang trang khác, không hiện dashboard |
| B02 | Công việc cá nhân | `/tasks` | chỉ xem | 0 | Demo | API chưa có module task và hạn xử lý |
| B03 | Hồ sơ sửa chữa | `/records`, chi tiết, form | 8: tạo, lưu nháp, gửi, rút, trả bổ sung, xác nhận cần sửa, đóng không cần sửa, giao lại | 7, thiếu giao lại | Một phần API | Chưa liên kết thiết bị: `maintenanceItemId` bị API từ chối |
| B04 | Lịch sửa chữa | `/records/schedule` | chỉ xem | 0 | Demo | — |
| B05 | Tờ trình và phê duyệt | tab trong chi tiết hồ sơ | 8: lưu nháp, trình, trình lại, duyệt, yêu cầu bổ sung, từ chối, lưu và phát hành thông báo chưa xử lý | 0 | Demo | DG-01 (dự toán theo hạng mục), OD-11, OD-15. Đã có SPEC S2 |
| B06 | Xử lý khẩn cấp | trong chi tiết hồ sơ | 1: bắt đầu xử lý khẩn cấp | 0 | Demo | D1 tr. 20 có nhật ký diễn biến sự cố, demo chưa đối chiếu. Ngoài SPEC hiện tại |
| B07 | Ký và biểu mẫu | ký trong lần trình | không có thao tác riêng | 0 | Demo (một phần) | DG-03 (biên bản nghiệm thu do hệ thống tạo và ký), OD-13 |
| B08 | Thi công và nghiệm thu | tab thi công và nghiệm thu | 7: bắt đầu, cập nhật tiến độ, gửi nghiệm thu, đạt, không đạt, lưu khắc phục, gửi lại | 0 | Demo | DG-02 (nghiệm thu theo hạng mục), OD-12. Đã có SPEC S3 |
| B09 | Thanh toán hồ sơ | tab thanh toán | 6: lưu nháp, gửi đề nghị, duyệt, trả, ghi nhận, đóng | 0 | Demo | DG-04 và H07: demo chỉ cho thanh toán một lần, trong khi D1/D2 yêu cầu tạm ứng và nhiều đợt; vai trò Kế toán. OD-05, OD-10 |
| B10 | Hồ sơ thiết bị | `/maintenance/items` | 5: tạo, sửa, ngừng dùng, cập nhật tình trạng, tài liệu | 0 | Demo | — |
| B11 | Bảo hành và cảnh báo | cảnh báo trong hồ sơ và thiết bị | chỉ xem | 0 | Demo | Ngưỡng cảnh báo chưa chốt (review M) |
| B12 | Kế hoạch bảo trì | `/maintenance/plans` | 8: tạo, sửa, kích hoạt, tạm dừng, đổi chu kỳ, tạo lượt bù, làm mới lịch, sinh lượt | 0 | Demo | — |
| B13 | Thực hiện bảo trì | chi tiết lượt bảo trì | 10: bắt đầu, lưu, gửi, yêu cầu làm lại, xác nhận, đổi lịch, giữ lượt, hủy, giao lại, tạo hồ sơ sửa chữa | 0 | Demo | — |
| B14 | Lịch và thông báo | `/maintenance/schedule`, `/notifications` | 2: đánh dấu đã đọc, đồng bộ thông báo đến hạn | 0 | Demo | Chỉ có thông báo trong hệ thống; kênh ngoài bị loại trừ (D1 tr. 45) |
| B15 | Tòa nhà và vị trí | `/settings/buildings`, `/settings/locations` | 5 | 5 | API | — |
| B16 | Thiết kế workflow | `/settings/workflow` | 3 | 3 | API | Bước bắt buộc và tác động lên hồ sơ đang chạy chưa chốt (M03). Hồ sơ dùng snapshot cấu hình chụp lúc tạo |
| B17 | Nhân sự và phân quyền | `/admin/*` | 7: người dùng, bộ phận, vai trò (mỗi loại tạo và sửa), thay người quản lý | 6, thiếu thay người quản lý | Một phần API | Chưa có đồng bộ phân công khi thu hẹp vai trò hoặc khóa tài khoản, chưa có `replaceManager`. Chưa có vai trò Kế toán (OD-10). Phạm vi khu vực chỉ áp cho thao tác ghi hồ sơ |
| B18 | Báo cáo và dữ liệu | `/reports` | chỉ xem, xuất CSV | 0 | Demo | D2 mục 04 yêu cầu nhập/xuất Excel theo mẫu; demo chỉ có CSV (M05) |
| F01–F10 | Quỹ khai thác (10 module) | — | — | — | Chưa có | Toàn bộ nhóm chưa có đặc tả, code hay bảng dữ liệu. OD-04 |
| T01–T06 | Tiền gửi quỹ bảo trì (6 module) | — | — | — | Chưa có | Toàn bộ nhóm chưa có đặc tả, code hay bảng dữ liệu. OD-06; ví dụ nghiệm thu ở D1 tr. 39 |
| S01 | Không gian trực quan | `/space` | chỉ xem | 0 | Demo | Cần sơ đồ thật của khách (D2 mục 06) |
| A01 | Trợ lý An Nhi | `/assistant` | chỉ xem | 0 | Demo, AI mô phỏng | D2 mục 05 ghi "Giao diện demo đang mô phỏng AI". OD-08 |

## 4. Đánh giá

**Đã có**
- Một demo phủ đủ 18 module B cùng S01 và A01, chạy trên dữ liệu mẫu, đã qua UAT nội bộ ngày 20/10.
- Nền tảng API thật: xác thực, phân quyền theo vai trò và tòa, audit, khóa phiên bản.
- Cấu hình tòa và workflow (B15, B16), quản trị người dùng (B17).
- Đầu luồng hồ sơ sửa chữa (B03).

**Còn thiếu, xếp theo khối lượng**
1. 16 module F và T: chưa có gì. Đây là phần D1 bổ sung, chiếm 10 triệu trên 30 triệu mỗi tòa (D1 tr. 42), và là phần D1 tr. 44 nêu rõ trong nghiệm thu.
2. 49 trên 70 thao tác của demo chưa có backend. Các màn hình B01, B02, B04, B10–B14, B18, S01, A01 chưa đọc dữ liệu thật.
3. Tiêu chí nghiệm thu hợp đồng cho nhóm B chưa có (OD-14).

**Có thể sai nghiệp vụ** (khác D1, chờ khách chốt)
- B05: dự toán theo hạng mục (DG-01).
- B07: ký biên bản nghiệm thu (DG-03).
- B08: nghiệm thu theo hạng mục kiểm tra (DG-02).
- B09: tạm ứng và nhiều đợt, vai trò Kế toán (DG-04, H07).
- B18: Excel thay vì CSV (M05).

Hình trong D1 là minh họa. Các điểm trên là câu hỏi cần khách chốt, chưa phải lỗi đã được xác nhận.

**Chưa xác minh**
- Mức độ khớp D1 của các module B01, B02, B04, B10–B14, S01 và A01. Phần hình D1 của các trang này chưa được xem (DECISIONS.md, mục "Đối chiếu").
- Dữ liệu và biểu mẫu thật của khách (OD-07).

## 5. Đề xuất lộ trình

Không ước lượng thời gian khi phạm vi chưa chốt (review 23/10 §8). Thứ tự dưới đây dựa trên ba tiêu chí: phụ thuộc, giá trị hợp đồng, và rủi ro làm lại.

| Bước | Giai đoạn quy trình | Nội dung | Điều kiện bắt đầu |
|---|---|---|---|
| L0 | Khảo sát | Một buổi chốt với khách: OD-01, OD-03/OD-10 (vai trò), OD-05 (thanh toán), OD-11–OD-15, OD-14 (tiêu chí nghiệm thu B), OD-07 (biểu mẫu, dữ liệu mẫu) | Đã soạn [phiếu khảo sát](khao-sat-L0-cau-hoi-khach-hang.md) (26/10); chờ gửi khách |
| L1 | Phát triển, kiểm thử | Hoàn thành luồng sửa chữa B03–B09: S2 → S3 → S4 theo SPEC đã duyệt | SPEC đã duyệt; merge S1 |
| L2 | Phân tích, phát triển | B17 còn thiếu: giao lại người xử lý, `replaceManager`, đồng bộ khi khóa tài khoản. Sau đó B06 khẩn cấp và thông báo chưa xử lý | SPEC riêng |
| L3 | Khảo sát, phân tích | Đặc tả nhóm T (6 module) rồi nhóm F (10 module). Mỗi nhóm cần quy tắc tiền, ví dụ số liệu (D1 tr. 39) và dữ liệu mẫu của khách | OD-04, OD-06, mẫu sao kê và hợp đồng |
| L4 | Thiết kế | Thiết kế dữ liệu hai quỹ (gốc/lãi, phải thu/thực thu, đối soát) bằng ADR trong `engineering/` | Có SPEC của L3 |
| L5 | Phát triển | Backend cho bảo trì và thiết bị (B10–B14), rồi B01, B02, B04 đọc dữ liệu thật | SPEC cho từng module |
| L6 | Phát triển | B18 báo cáo và Excel, S01 với sơ đồ thật, A01 với AI thật | OD-07, OD-08 |
| L7 | Kiểm thử | UAT với khách trên dữ liệu thật, theo bộ tiêu chí OD-14 | Có OD-14 |

L1 và L3 chạy song song được: L1 là việc của dev-build, L3 là việc của PM/BA cùng khách.

## 6. Cập nhật tài liệu

- Quy trình 5 giai đoạn và cổng chuyển giai đoạn được bổ sung vào [PROCESS.md](../../PROCESS.md) §2a.
- Bảng trạng thái module được đặt vào [product/README.md](../../product/README.md) §3, trỏ về báo cáo này.
