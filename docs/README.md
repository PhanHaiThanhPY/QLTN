# Tài liệu dự án QLTN

**Cập nhật:** 26/10/2026

Điểm vào duy nhất của mọi tài liệu QLTN. Quy trình viết, duyệt và lưu tài liệu nằm ở [PROCESS.md](PROCESS.md).

## Cấu trúc

```text
docs/
├── README.md        # file này: mục lục
├── PROCESS.md       # quy trình tài liệu: ai viết gì, khi nào, duyệt thế nào
├── product/         # yêu cầu sản phẩm (chủ sở hữu: PM/BA) — nguồn chuẩn cho triển khai
│   ├── README.md    #   thứ bậc nguồn, hiện trạng, kế hoạch tài liệu
│   ├── DECISIONS.md #   nhật ký quyết định sản phẩm (PD-xx đã chốt, OD-xx chờ chốt)
│   └── features/<mã>-<tên>/SPEC.md, handoff.md
├── sources/         # tài liệu gốc từ khách hàng — chỉ đọc, không sửa
├── reviews/         # báo cáo review/phân tích còn hiệu lực, theo ngày
├── engineering/     # ADR kỹ thuật, kiến trúc, runbook (chủ sở hữu: dev)
├── qa/              # kế hoạch kiểm thử, biên bản UAT/nghiệm thu theo mã tính năng
└── archive/         # tài liệu hết hiệu lực, giữ làm lịch sử
```

README kỹ thuật của từng ứng dụng nằm cạnh code: [api-qltn/README.md](../api-qltn/README.md), [web/README.md](../web/README.md), [web/UI_CONVENTIONS.md](../web/UI_CONVENTIONS.md).

## Đọc gì trước

| Bạn cần | Đọc |
|---|---|
| Phạm vi hợp đồng | [sources/INDEX.md](sources/INDEX.md) → D1, D2 |
| Yêu cầu một tính năng | `product/features/<mã>/SPEC.md` |
| Điều gì đã chốt, điều gì còn mở | [product/DECISIONS.md](product/DECISIONS.md) |
| Khác biệt giữa các nguồn | [reviews/2026-10-23/review-tai-lieu-nghiep-vu.md](reviews/2026-10-23/review-tai-lieu-nghiep-vu.md) |
| Vì sao kỹ thuật làm như vậy | [engineering/](engineering/README.md) |
| Đã kiểm thử/nghiệm thu đến đâu | [qa/](qa/README.md) |
| Tài liệu cũ | [archive/](archive/README.md) |
