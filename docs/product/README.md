# Tài liệu sản phẩm QLTN

**Chủ sở hữu:** seat PM/BA (`dev-pm-ba@qltn`)  
**Cập nhật:** 26/10/2026

Thư mục này là nơi duy nhất giữ yêu cầu, luồng nghiệp vụ, tiêu chí nghiệm thu, quy tắc nghiệp vụ, hợp đồng API ở mức nghiệp vụ và ghi chú bàn giao cho QLTN. Các quyết định quan trọng phải được ghi vào [DECISIONS.md](DECISIONS.md); không để quyết định chỉ nằm trong hội thoại hoặc tin nhắn giữa các seat.

## 1. Thứ bậc nguồn

| Mức | Nguồn | Cách dùng |
|---|---|---|
| 1 | Quyết định đã ghi trong [DECISIONS.md](DECISIONS.md) với trạng thái `Đã chốt` | Chuẩn cao nhất trong repo. Chỉ thay bằng một quyết định mới ghi rõ nó thay thế quyết định nào. |
| 2 | `SPEC.md` của từng tính năng trong `features/` | Hợp đồng yêu cầu duy nhất của tính năng đó. Dev-build triển khai và dev-review đối chiếu theo file này. |
| 3 | D1 aqua-proposal (23/10/2026) và D2 Báo giá (20/10/2026) trong [sources/customer/](../sources/INDEX.md) | Đầu vào phạm vi chính. D1 tự ghi là bổ sung gói đầy đủ của D2 (D1 tr. 42, 45). Chỗ còn khác nhau và các sửa đổi so với [review 23/10](../reviews/2026-10-23/review-tai-lieu-nghiep-vu.md) xem [DECISIONS.md](DECISIONS.md) mục "Đối chiếu nguồn gốc". |
| 4 | D5 biểu mẫu trong [sources/customer/D5-bieu-mau/](../sources/customer/D5-bieu-mau/); D3 đặc tả demo và D4 đề xuất giải pháp trong [archive/2026-10/specs/](../archive/2026-10/specs/) | Tham khảo trường dữ liệu và bối cảnh cũ. Không tự coi là phạm vi hiện hành. |
| 5 | Phân tích và UAT mock nội bộ trong [archive/2026-10/](../archive/README.md); review trong [reviews/](../reviews/) | Không phải bằng chứng khách hàng đã nghiệm thu. |

Khi hai nguồn mâu thuẫn và chưa có quyết định ở mức 1, ghi một mục `Chờ chốt` vào DECISIONS.md thay vì tự chọn.

## 2. Cấu trúc

```text
docs/product/
├── README.md            # file này: thứ bậc nguồn, hiện trạng, kế hoạch
├── DECISIONS.md         # nhật ký quyết định (đã chốt + chờ chốt)
├── glossary.md          # thuật ngữ và danh mục dữ liệu (phase sau)
└── features/
    └── <mã>-<tên>/
        ├── SPEC.md      # yêu cầu, AC, quy tắc, hợp đồng API nghiệp vụ
        ├── handoff.md   # ghi chú bàn giao cho dev-build, kết quả review
        └── supporting/  # luồng, mockup, ví dụ số liệu
```

Mã tính năng dùng hệ mã của D1: `B01–B18` vận hành, `F01–F10` quỹ khai thác, `T01–T06` tiền gửi quỹ bảo trì, `S01` không gian, `A01` trợ lý AI.

## 3. Hiện trạng theo module (26/10/2026)

Nguồn: [báo cáo kiểm kê 26/10](../reviews/2026-10-26/tong-quan-module-tinh-nang.md), đo trên code `641c8b5`. Giai đoạn theo [PROCESS.md](../PROCESS.md) §2a: 1 Khảo sát · 2 Phân tích · 3 Thiết kế · 4 Phát triển · 5 Kiểm thử và nghiệm thu. Module có sẵn demo nhưng chưa có SPEC được ghi ở giai đoạn 1, vì demo chưa phải yêu cầu đã chốt.

| Module | Code hiện có | Thao tác API / demo | Giai đoạn | Chặn bởi |
|---|---|---|---|---|
| B03 Hồ sơ sửa chữa | Một phần API (S1 chưa merge) | 7 / 8 | 4 (SPEC B03–B09) | — |
| B05, B08, B09 | Demo | 0 / 21 | 3 xong; chờ giao S2–S4 | Quy tắc tạm: OD-05, OD-10–OD-13, OD-15 |
| B07 Ký và biểu mẫu | Demo (ký ở lần trình) | 0 / 0 | 1 | OD-13 |
| B06 Khẩn cấp | Demo | 0 / 1 | 1 | Chưa có SPEC |
| B15 Tòa nhà và vị trí, B16 Workflow | API | 8 / 8 | 4 (làm trước khi có quy trình này, chưa có SPEC hồi tố) | OD-14 |
| B17 Nhân sự và phân quyền | Một phần API | 6 / 7 | 1 cho phần còn thiếu | OD-03, OD-10 |
| B10–B14 Thiết bị, bảo trì, lịch, thông báo | Demo | 0 / 25 | 1 | Chưa có SPEC |
| B01, B02, B04, B11, B18 | Demo (chỉ xem) | — | 1 | B18: OD-07 (Excel) |
| S01 Không gian, A01 Trợ lý AI | Demo (AI mô phỏng) | — | 1 | OD-07, OD-08 |
| F01–F10 Quỹ khai thác | Chưa có | — | 1 | OD-04 |
| T01–T06 Tiền gửi quỹ bảo trì | Chưa có | — | 1 | OD-06 |

Chưa module nào qua giai đoạn 5. Tiêu chí nghiệm thu hợp đồng cho nhóm B còn chờ OD-14.

### Chuẩn so sánh cho luồng B03–B09

- **Chuẩn hành vi hiện có:** web demo (`web/src/domain/actions.ts`, `web/src/services/handlers/repair-*.ts`). API đang port theo chuẩn này. UAT 20/10 đo trên demo.
- **So với D1 tr. 17–23:** demo khác ở dự toán theo hạng mục, nghiệm thu theo hạng mục kiểm tra, ký biên bản nghiệm thu, thanh toán nhiều đợt và vai trò Kế toán (DG-01–DG-04 trong [DECISIONS.md](DECISIONS.md)). Port nguyên demo sang API vì thế chưa chắc đạt nghiệm thu theo D1. Các câu hỏi cần chốt là OD-05, OD-10–OD-13.
- **Tiêu chí nghiệm thu hợp đồng cho nhóm B** chưa có nguồn nào nêu (OD-14).

## 4. Kế hoạch tài liệu theo phase

Mỗi phase nhỏ, kết thúc bằng một artifact có thể review. Thứ tự theo đề xuất của [review 23/10 §8](../reviews/2026-10-23/review-tai-lieu-nghiep-vu.md).

| Phase | Đầu ra | Trạng thái |
|---|---|---|
| P0 | Thư mục sản phẩm, thứ bậc nguồn, nhật ký quyết định | Xong |
| P1 | Bảng phạm vi có phiên bản B/F/T/S/A (gom H01–H04, H07) dưới dạng đề xuất chờ khách hàng chốt | Chưa bắt đầu |
| P2 | [SPEC B03–B09 luồng sửa chữa](features/B03-B09-luong-sua-chua/SPEC.md): 4 slice từ xác nhận đến đóng hồ sơ, quy tắc tạm theo demo (PD-03) | v1 `Đã duyệt` (PD-04), S1 xong (`ab67a6c`, chưa merge). **v2 (S2–S4) `Đã duyệt`** (PD-12); S2 đã giao, chờ RM-S2 xong |
| P3 | Workflow và ma trận quyền cho luồng sửa chữa B03–B09 | Chưa bắt đầu |
| P4 | Đặc tả thanh toán B09 và hai quỹ F/T | Chờ OD-01, OD-05, OD-06 |
| P5 | Bộ nghiệm thu nghiệp vụ gắn theo mã | Chưa bắt đầu |

Thứ tự P1/P2 có thể đảo nếu dev-build cần đặc tả cho phần đang làm trước.
