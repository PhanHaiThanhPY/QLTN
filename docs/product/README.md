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

## 3. Hiện trạng đã ghi nhận (26/10/2026)

Mục này chỉ là ảnh chụp từ git log và cấu trúc thư mục. Chưa phải kết quả review code.

- **Web (`web/`):** bản demo đủ nhiều nhóm màn hình (records, workflow, maintenance, dashboard, reports, space, assistant…), chạy được ở chế độ mock. UAT nội bộ ngày 20/10 ghi nhận 34/34 kịch bản sửa chữa đạt trên demo.
- **API (`api-qltn/`, NestJS):** các module auth, users, roles, organization, buildings, reference, attachments, audit, records. Riêng hồ sơ sửa chữa (B03) đã có tạo hồ sơ, lưu nháp, xem chi tiết, ảnh hiện trường, gửi/rút hồ sơ, danh sách phân trang có lọc và bộ đếm.
- **Web chế độ `api`:** đang nối dần từng phần của B03 với API thật.
- Mã task `D2-T*` trong commit không có kế hoạch gốc (OD-09 đã trả lời).

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
| P2 | [SPEC B03–B09 luồng sửa chữa](features/B03-B09-luong-sua-chua/SPEC.md): 4 slice từ xác nhận đến đóng hồ sơ, quy tắc tạm theo demo (PD-03) | `Đã duyệt` 26/10/2026 (PD-04); S1 đã giao |
| P3 | Workflow và ma trận quyền cho luồng sửa chữa B03–B09 | Chưa bắt đầu |
| P4 | Đặc tả thanh toán B09 và hai quỹ F/T | Chờ OD-01, OD-05, OD-06 |
| P5 | Bộ nghiệm thu nghiệp vụ gắn theo mã | Chưa bắt đầu |

Thứ tự P1/P2 có thể đảo nếu dev-build cần đặc tả cho phần đang làm trước.
