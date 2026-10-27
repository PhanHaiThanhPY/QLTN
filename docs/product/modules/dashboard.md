# Module `dashboard`: Tổng quan đa tòa (B01)

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **tạm hoãn**. Chủ dự án chưa duyệt; sẽ quay lại sau khi các tính năng khác của dự án làm xong (PD-30). Chưa viết SPEC

**Nguồn đã đọc:**
- D1 tr. 15 "Nắm ngay việc ưu tiên của bốn tòa" (đã xem hình); D1 tr. 2 ("Dashboard từng phân hệ", "Dashboard mở đến hồ sơ gốc").
- D2 nhóm 01: "Tổng hợp việc quá hạn, hồ sơ chờ duyệt, lịch bảo trì, thông báo và số liệu từng tòa; mở trực tiếp hồ sơ cần xử lý." D2 dòng 72: "Tập trung công việc quá hạn, hồ sơ chờ duyệt và lịch bảo trì trong phạm vi được cấp quyền."
- Code (commit `d3bf0f9`):
  - web `features/dashboard/*` (15 tệp, khoảng 1.000 dòng);
  - `services/report-service.ts` (`getDashboard`);
  - `app/router.tsx` dòng 56 và `app/HomeRedirect.tsx`;
  - `src/index.css` (token màu sáng/tối);
  - `package.json`: **chưa có thư viện biểu đồ nào**.
- API: `GET /records/summary` (đang mở, cần bổ sung, hoàn tất, tổng); chưa có endpoint tổng quan.
- Liên quan: TK-S1 (hạn xử lý ở API), MT-S1 đến S3 (bảo trì), B04 (lịch thi công), DF-20 ("Dashboard gộp được bốn tòa" cho quỹ).
- Hướng dẫn trực quan hóa dữ liệu (skill `dataviz`): chọn dạng theo câu hỏi, màu theo vai trò, kiểm màu bằng script, tương tác mặc định, bản bảng cho mọi biểu đồ.

## 1. Khách yêu cầu gì

| Nguồn | Nội dung |
|---|---|
| D2 nhóm 01 | Việc quá hạn; hồ sơ chờ duyệt; lịch bảo trì; thông báo; **số liệu từng tòa**; **mở trực tiếp hồ sơ cần xử lý**; trong phạm vi được cấp quyền |
| D1 tr. 15, web | Tiêu đề "Tổng quan đa tòa", dòng ngữ cảnh "Aqua 1–4 · Tháng 11 · 23/11/2026", vai BQT.<br>• **4 ô số:** Đang mở 4, Đến hạn hôm nay 2, Quá hạn 1, Hoàn tất 8.<br>• **"Toàn cảnh vận hành":** 4 biểu tượng tòa nhà, viền màu theo **tình trạng** (vàng: 2 việc mở; xanh: 1 việc mở; đỏ: 1 việc mở; xanh: không có việc mở), ghi "Theo phạm vi được xem".<br>• **Thẻ lớn "Ưu tiên xử lý":** "Ưu tiên · BT-004", Aqua 3 · TM01, cờ "Quá hạn 1 ngày", hạn 22/11, người làm KT03.<br>• **"Các việc tiếp theo":** BT-002, SC-003 (đến hạn 17:00), KC-001 (đã kiểm soát), mỗi việc có vạch màu tình trạng.<br>• Câu tóm tắt "4 mở: 2 đến hạn, 1 quá hạn." và nút "Mở việc quá hạn" |
| D1 tr. 15, mobile | 4 ô số, thẻ "Ưu tiên xử lý", "Các việc tiếp theo", nút "Mở việc quá hạn" |
| D1 tr. 2 | "Nhìn tổng quan, mở đúng hồ sơ"; "Dashboard từng phân hệ"; "Hai quỹ theo dõi riêng. Dashboard mở đến hồ sơ gốc" |

**Ý chính của D1:** B01 là màn **điều hành theo việc ưu tiên**, không phải màn báo cáo. Người xem phải biết ngay ba điều: việc gì nguy cấp nhất, tòa nào đang có vấn đề, và bấm vào đâu để xử lý. Báo cáo phân tích sâu là B18.

## 2. Hiện trạng

### 2.1 Demo

- Đầu trang:
  - tiêu đề "Tổng quan vận hành";
  - nút "Ghi nhận sự cố";
  - một nhãn tháng có mũi tên chọn, nhưng **không bấm được**.
- `DashboardFocusCard`: lời chào và một câu tóm tắt. `DashboardTodayCenter`: "Trung tâm điều hành hôm nay".
- `AssistantInsight`: khung "An Nhi" **mô phỏng** AI.
- Các ô số chính (Sự cố đang mở, Công việc quá hạn, Bảo trì đến hạn, Chờ phê duyệt), danh sách hồ sơ gần đây, lịch bảo trì và các số tiền đều **bị giấu trong khối gập "Xem dữ liệu chi tiết"**.
- Số liệu (`getDashboard`) tính trên **toàn bộ thời gian**, không có kỳ, và **không chia theo tòa**.

### 2.2 Chế độ `api`

- Trang chủ `/` **chuyển hướng** sang trang khác theo vai trò (`HomeRedirect`, `landingPathOf`). Không có tổng quan nào.
- API chỉ có `GET /records/summary`, với 4 số đếm cho hàng ô số của danh sách hồ sơ.

## 3. Khoảng trống

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **DG-01** | Chế độ `api` không có tổng quan; trang chủ chuyển hướng đi chỗ khác | `router.tsx` dòng 56 | **Cao**: là màn đầu tiên khách thấy, và D1 tr. 15 mở đầu nhóm B | DB-S1 |
| **DG-02** | Không có **số liệu từng tòa**. Demo cộng gộp mọi tòa, không có "Toàn cảnh vận hành" như D1 | `getDashboard`; D2 nhóm 01; D1 tr. 15 | **Cao** | Mỗi tòa một ô tình trạng; bấm vào thì lọc cả trang theo tòa đó |
| **DG-03** | Không có **thẻ "Ưu tiên xử lý"** đúng nghĩa D1: một việc nguy cấp nhất trong phạm vi, kèm hạn và người đang giữ việc | D1 tr. 15; demo chỉ có câu tóm tắt | **Cao** | Dùng hạn và quá hạn của TK-S1, xếp theo luật ưu tiên (BR-TK-07) trên **toàn phạm vi** của người xem |
| DG-04 | Các số chính bị giấu trong khối gập; màn đầu chỉ có lời chào và khung AI mô phỏng | `index.tsx` (`<details>`) | Trung bình (trải nghiệm) | Số chính và việc ưu tiên luôn nằm ở màn đầu |
| DG-05 | Không có **kỳ** (tuần, tháng, quý). Ô chọn tháng chỉ là hình; tiền và số hoàn tất tính trên toàn bộ thời gian | `index.tsx` (`monthLabel`); `getDashboard` | Trung bình | Bộ lọc kỳ thật, kèm so sánh với kỳ trước |
| DG-06 | Không có **xu hướng**: không biết việc tồn đang tăng hay giảm, tòa nào chậm dần | — | Trung bình | Biểu đồ việc tồn theo tuần, và tạo mới so với hoàn tất |
| DG-07 | Không thấy **đang tắc ở bước nào**: chờ BQT duyệt hay chờ nghiệm thu, mỗi bước bao lâu | — | Trung bình | Biểu đồ việc theo bước hiện tại, kèm số ngày nằm ở bước |
| DG-08 | Màu sai vai trò: "Bảo trì đến hạn" tô **xanh "tốt"** dù là việc phải làm; ô "Công việc quá hạn" liên kết tới `/records?overdue=1`, mà API đang từ chối tham số `overdue` | `index.tsx`; B04 B4G-05 | Trung bình | Màu tình trạng chỉ dùng đúng nghĩa (§5); bộ lọc quá hạn có ở API sau TK-S1 |
| DG-09 | Khung "An Nhi" là AI **mô phỏng** (A01, OD-08). Ở chế độ `api`, nó không được nói như thể đang đọc dữ liệu thật | `AssistantInsight` | Trung bình (tin cậy) | Ở `api`: thay bằng một dòng tóm tắt tính theo luật, như D1 "4 mở: 2 đến hạn, 1 quá hạn.", **không gắn nhãn AI**. AI thật làm ở A01 |
| DG-10 | Chưa có thư viện biểu đồ; demo không có biểu đồ nào | `web/package.json` | — | Dev-build chọn ở slice: SVG tự vẽ, hoặc một thư viện nhẹ. Ghi kích thước bundle |
| DG-11 | Bảo trì (đến hạn, quá hạn, tỷ lệ đúng hạn) chưa có dữ liệu thật cho tới MT-S3 | MT-S1 đến S3 | — | Tách thành DB-S2 |

## 4. Câu hỏi cho khách

Đề xuất gom thành **OD-25** trong `DECISIONS.md`.

| ID | Câu hỏi | Mặc định đề xuất (giả định) |
|---|---|---|
| DBQ-01 | "Tình trạng" của một tòa tính thế nào? Đỏ, vàng, xanh nghĩa là gì? | **Đỏ** "Cần can thiệp": có việc quá hạn. **Vàng** "Cần theo dõi": có việc đến hạn trong 24 giờ, hoặc có hồ sơ khẩn cấp đang mở. **Xanh** "Ổn định": không có hai điều trên |
| DBQ-02 | Màn này có khác nhau theo vai trò không (BQT, BQL, KT, kế toán)? | Cùng một bố cục cho mọi vai trò, số liệu theo phạm vi tòa. Thẻ "Ưu tiên xử lý" ưu tiên việc của **chính người xem** nếu có; nếu không thì là việc nguy cấp nhất trong phạm vi |
| DBQ-03 | Kỳ mặc định là gì? | **Tháng hiện tại**, so với tháng trước. Có tuần, quý và khoảng tùy chọn |
| DBQ-04 | Có cần số tiền (đã duyệt, đã chi) trên tổng quan không, hay để ở báo cáo? | Có 2 ô: "Đã duyệt trong kỳ" và "Đã chi trong kỳ". Phân tích tiền chi tiết ở B18 |
| DBQ-05 | Có cần màn hình treo tường (TV ở phòng BQL) không? | Không ở giai đoạn này. Bố cục vẫn đọc được ở 1920px |

## 5. Định hướng trực quan

Mục tiêu: một màn **điều hành** đọc trong 5 giây. Trông chuyên nghiệp vì rõ ràng và đúng nghĩa, không phải vì nhiều hiệu ứng. Mỗi khối trả lời một câu hỏi. Mỗi con số là một lối vào hồ sơ gốc (D1 tr. 2, D2 nhóm 01).

### 5.1 Bố cục đích (màn rộng ≥ 1280px)

```
┌ Tổng quan đa tòa ─────────────────── [Kỳ: Tháng 11 ▾] [Tòa: Tất cả (4) ▾]   Cập nhật 09:42 ↻ ┐
│ Aqua 1–4 · Tháng 11/2026 · so với Tháng 10                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ① HÀNG Ô SỐ (KPI)                                                                            │
│ ┌ Đang mở ─────┐ ┌ Đến hạn hôm nay ┐ ┌ Quá hạn ──────┐ ┌ Hoàn tất trong kỳ ┐ ┌ Chờ phê duyệt ┐ │
│ │ 24   ▲3      │ │ 5               │ │ 3 ⚠  ▼1       │ │ 41    ▲12%        │ │ 7             │ │
│ │ ▁▂▃▅▄▆ 12 tuần│ │                 │ │ ▂▃▂▄▃▂        │ │ ▃▄▅▅▆▇            │ │               │ │
│ └──────────────┘ └─────────────────┘ └───────────────┘ └───────────────────┘ └───────────────┘ │
├───────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ ② TOÀN CẢNH VẬN HÀNH (mỗi tòa một ô)                  │ ③ ƯU TIÊN XỬ LÝ (thẻ nổi, nền đậm)  │
│ ┌ Aqua 1 ──────┐ ┌ Aqua 2 ──────┐                      │  ⚠ Quá hạn 1 ngày                    │
│ │ ● Cần theo dõi│ │ ● Ổn định    │                      │  SC-031 · Rò ống cấp tầng 5          │
│ │ 9 mở · 2 hôm nay│ 4 mở · 0 trễ │                      │  Aqua 3 · Chờ BQT duyệt · Hạn 22/11  │
│ │ ▁▂▃▂▃ tồn    │ │ ▃▂▂▁▁ tồn    │                      │  Đang ở: Nguyễn Văn X (BQT)          │
│ └──────────────┘ └──────────────┘                      │  [ Mở hồ sơ ]                        │
│ ┌ Aqua 3 ──────┐ ┌ Aqua 4 ──────┐                      │ Các việc tiếp theo                   │
│ │ ● Cần can thiệp│ ● Ổn định    │                      │ ▌SC-028 Aqua 1 · Hôm nay 16:00 ›     │
│ │ 8 mở · 2 trễ │ │ 3 mở · 0 trễ │                      │ ▌SC-019 Aqua 2 · Ngày mai ›          │
│ └──────────────┘ └──────────────┘                      │ ▌SC-022 Aqua 1 · Không có hạn ›      │
├───────────────────────────────────────────────────────┴─────────────────────────────────────┤
│ ④ XU HƯỚNG VIỆC TỒN (12 tuần) — đường, 1 màu      │ ⑤ ĐANG TẮC Ở BƯỚC NÀO — cột ngang          │
│   tạo mới vs hoàn tất mỗi tuần — cột đôi, 2 màu   │   Chờ BQT duyệt   ███████ 7 · TB 4,2 ngày  │
│                                                   │   Chờ nghiệm thu  ████ 4 · TB 2,1 ngày     │
├───────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ ⑥ TUỔI VIỆC ĐANG MỞ theo tòa — cột ngang chồng,   │ ⑦ TIỀN TRONG KỲ — 2 ô số                    │
│   1 dải màu nhạt→đậm: 0–3 · 4–7 · 8–14 · >14 ngày │   Đã duyệt 1,24 tỷ ▲ · Đã chi 860 tr         │
└───────────────────────────────────────────────────┴────────────────────────────────────────────┘
```

Điện thoại (375px), theo đúng thứ tự D1: ③ Ưu tiên xử lý → ① ô số 2 × 2 → "Các việc tiếp theo" → ② tòa (danh sách) → ④⑤⑥ mỗi biểu đồ một thẻ, gập được.

### 5.2 Chọn dạng theo câu hỏi

| Khối | Câu hỏi | Dạng | Vì sao |
|---|---|---|---|
| ① | Bây giờ thế nào? | **Ô số**: số lớn, mức thay đổi so với kỳ trước, sparkline 12 tuần | Một giá trị hiện tại kèm xu hướng là ô số, không phải biểu đồ cột một thanh |
| ② | Tòa nào có vấn đề? | **Ô tình trạng theo tòa** (small multiples): chấm tình trạng, **kèm chữ**, số mở, số trễ, sparkline việc tồn | D1 tr. 15 dùng màu theo **tình trạng**, không phải màu nhận diện tòa. Mỗi tòa một ô, cùng thang đo |
| ③ | Việc gì làm trước? | **Thẻ nổi**: nền đậm (`--navy`), một việc, và 3–5 việc tiếp theo | Đúng thẻ "Ưu tiên xử lý" của D1 |
| ④ | Đang tốt lên hay xấu đi? | **Đường** việc tồn (1 màu); **cột đôi** tạo mới / hoàn tất (2 màu) | Cùng đơn vị "số hồ sơ", **một trục**. Không dùng hai trục y |
| ⑤ | Tắc ở đâu? | **Cột ngang** theo bước hiện tại, xếp giảm dần, kèm nhãn số ngày trung bình | So độ lớn; nhãn dài, nên dùng cột ngang |
| ⑥ | Việc nào đã để lâu? | **Cột ngang chồng** theo tòa, 4 nhóm tuổi, **một dải màu** nhạt → đậm | Các nhóm có thứ tự, nên dùng dải màu tuần tự, không dùng 4 màu khác nhau |
| ⑦ | Tiền đi đến đâu? | **2 ô số** | Hai đại lượng, không cần biểu đồ. Chi tiết ở B18 |

### 5.3 Quy tắc màu và nét

- **Màu tình trạng chỉ để nói tình trạng:**
  - `--crit` Cần can thiệp / quá hạn;
  - `--warn` Cần theo dõi / đến hạn;
  - `--good` Ổn định / hoàn tất.
  - Không bao giờ dùng ba màu này làm "màu của một chuỗi số liệu".
  - Luôn đi kèm biểu tượng và chữ, không chỉ dựa vào màu (sửa DG-08).
- **Tòa không có màu riêng.** Tòa được phân biệt bằng tên và vị trí ô, không bằng màu. Như vậy có thêm tòa thứ 5 cũng không phải đổi màu, và không lẫn với màu tình trạng.
- **Màu cho chuỗi số liệu đã kiểm bằng script** `validate_palette.js` (skill `dataviz`, bước 3), ngày 27/10/2026.
  - **Không dùng** cặp token có sẵn `--accent` + `--info` (xanh ngọc + xanh dương) cho biểu đồ hai chuỗi. Cặp này **không đạt**: chênh lệch với người nhìn bình thường là ΔE 8,3 (sáng) và 7,5 (tối), trong khi mức sàn là 15; độ đậm của xanh ngọc cũng dưới sàn.
  - **Đề xuất hai token mới cho biểu đồ.** Cặp này đạt đủ 5 bước kiểm ở cả hai chế độ:

    | Token | Sáng (nền `#ffffff`) | Tối (nền `#102f41`) |
    |---|---|---|
    | `--series-1` (xanh ngọc, gần màu thương hiệu) | `#00929b` | `#1ba59f` |
    | `--series-2` (tím) | `#6a4fd6` | `#8f78ec` |

  - Biểu đồ một chuỗi dùng `--series-1`. Biểu đồ hai chuỗi (④ tạo mới / hoàn tất) dùng `--series-1` và `--series-2`, kèm nhãn trực tiếp.
  - **Không đặt màu tình trạng trong cùng một biểu đồ với màu chuỗi.** Kiểm chéo cho thấy `--series-1` quá gần `--good`: ΔE 7,3 (sáng) và 11,2 (tối). Vì vậy màu tình trạng chỉ dùng ở chấm tình trạng, cờ và ô số, luôn kèm chữ; không dùng làm màu cột hay đường.
  - `--warn` và `--crit` khó phân biệt với người mù màu (ΔE 4,9). Đây là lý do hai màu này **luôn đi kèm biểu tượng và chữ** ("⚠ Cần theo dõi", "● Cần can thiệp"), không bao giờ chỉ dựa vào màu.
- **Dải màu tuần tự** cho ⑥: 4 bậc của cùng hue với `--series-1`, nhạt → đậm. Dev-build kiểm dải này bằng `validate_palette.js --ordinal` ở cả hai chế độ.
- **Nét mỏng, lưới mờ:**
  - đường 2px; cột có đầu bo 4px, cách nhau 2px;
  - lưới và trục dùng `--line`;
  - chữ trên biểu đồ dùng token chữ (`--ink-2`, `--ink-3`), không dùng màu của chuỗi.
- **Chế độ tối:** dùng bộ token tối đã có trong `index.css`. Mỗi màu biểu đồ được kiểm lại trên nền tối, không lật màu tự động.

### 5.4 Tương tác (mặc định, không phải thêm)

- Rê chuột hoặc chạm vào một điểm thì hiện chú thích, gồm giá trị và kỳ. Đường có thước dọc.
- **Mọi con số và mọi thanh đều bấm được**, và mở danh sách hồ sơ đã lọc sẵn (D2 "mở trực tiếp hồ sơ cần xử lý"). Ví dụ: bấm thanh "Chờ BQT duyệt" thì mở `/records` lọc trạng thái đó và kỳ đang xem.
- Bấm ô một tòa thì **lọc cả trang** theo tòa đó, kèm nút "Bỏ lọc tòa".
- Bộ lọc **kỳ** và **tòa** nằm trên một hàng, ở đầu trang. Bộ lọc được giữ trên đường dẫn, để chép link gửi cho người khác.
- Có dòng **"Cập nhật lúc HH:mm"** và nút làm mới. Trang tự tải lại khi quay lại tab.
- Mỗi biểu đồ có nút **"Xem dạng bảng"**: bảng số liệu của chính biểu đồ đó, cho trình đọc màn hình và để kiểm số.

### 5.5 Chất lượng "chuyên nghiệp"

- **Chiều cao ổn định khi tải:** khung xương có đúng kích thước khối thật, trang không nhảy.
- **Số dùng `tabular-nums`**, tiền rút gọn có quy tắc ("1,24 tỷ", "860 tr"); chú thích hiện số đầy đủ.
- **Trạng thái rỗng có ý nghĩa:** "Không có việc quá hạn" kèm dấu ✓ là một tin tốt, không phải một ô trống.
- **Chuyển động** chỉ dùng để nối trạng thái (lọc tòa thì các khối chuyển mượt 150–200ms), và tắt khi người dùng bật `prefers-reduced-motion`. Không có hiệu ứng trang trí.
- **Dữ liệu đúng trước, đẹp sau:** mỗi số trên màn này phải khớp với danh sách mà nó mở ra. Có test cho điều này (AC nháp DB-S1).

### 5.6 Chuẩn bị cho tương lai

- **Mỗi khối là một widget** có hợp đồng dữ liệu riêng: đầu vào là kỳ và tòa; đầu ra là số liệu kèm thời điểm tính. Như vậy:
  - **bảo trì** (DB-S2) chỉ là thêm widget;
  - **quỹ khai thác và tiền gửi** (F, T; DF-20 "gộp được bốn tòa") là các widget sau này;
  - **không gian trực quan S01** (sơ đồ tòa) có thể thay ô ② bằng mặt bằng thật, khi có sơ đồ;
  - **trợ lý AI A01** đọc cùng các số này để tóm tắt, thay cho dòng tóm tắt theo luật.
- **Số liệu tính ở máy chủ** trong một lần gọi (hoặc một lần mỗi widget), có `asOf`. Không tải hàng nghìn hồ sơ về trình duyệt như demo.
- Thứ tự và việc ẩn hiện khối theo vai trò để sau (DBQ-02). Bố cục hiện tại cố định, nhưng đã chia sẵn theo widget.

## 6. Đề xuất slice

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| **DB-S1 Tổng quan sửa chữa** | API tổng quan (theo kỳ và tòa) và web chế độ `api` với các khối ① ② ③ ④ ⑤ ⑥ ⑦ cho **sửa chữa**:<br>• bộ lọc kỳ và tòa;<br>• mọi số đều mở được danh sách đã lọc;<br>• dòng tóm tắt theo luật (DG-09);<br>• trang chủ ở `api` mở tổng quan thay vì chuyển hướng (DG-01);<br>• có thư viện biểu đồ hoặc SVG (DG-10) | **TK-S1** (hạn, quá hạn, bộ lọc quá hạn ở API) |
| DB-S2 Bảo trì trên tổng quan | Widget bảo trì: đến hạn, quá hạn, tỷ lệ lượt đúng hạn theo tòa, lượt chờ xác nhận; tòa đổi tình trạng theo cả bảo trì | MT-S3 |
| DB-S3 Theo vai trò và quỹ | Bố cục theo vai trò (DBQ-02); widget quỹ khai thác và tiền gửi | Phân tích F và T |

**AC nháp cho DB-S1:**
- **AC-1** Ô "Quá hạn" ghi 3. Bấm vào thì mở danh sách hồ sơ có **đúng 3** hồ sơ, đều quá hạn. Điều này đúng với mọi ô và mọi thanh: số trên tổng quan bằng số dòng của danh sách nó mở ra.
- **AC-2** Tòa có 1 việc quá hạn thì ô tòa hiện chấm đỏ kèm chữ "Cần can thiệp". Hết việc quá hạn, còn việc đến hạn trong 24 giờ, thì là "Cần theo dõi". Không còn cả hai thì là "Ổn định".
- **AC-3** Thẻ "Ưu tiên xử lý" của BQT là việc quá hạn lâu nhất mà BQT đang giữ. Nếu BQT không giữ việc nào, thẻ là việc quá hạn lâu nhất trong phạm vi, kèm tên người đang giữ việc.
- **AC-4** Đổi kỳ sang "Tháng 10" thì ô "Hoàn tất trong kỳ" và các số tiền đổi theo, và mức thay đổi so sánh với tháng 9. Bộ lọc nằm trên đường dẫn; mở link ở tab mới vẫn đúng kỳ đó.
- **AC-5** Bấm ô "Aqua 3" thì mọi khối chỉ còn số liệu của Aqua 3; "Bỏ lọc tòa" đưa về tất cả.
- **AC-6** `bql-b` chỉ thấy ô và số liệu của tòa B.
- **AC-7** Mỗi biểu đồ có "Xem dạng bảng" với đúng số liệu đang vẽ. Màu biểu đồ dùng `--series-1`, `--series-2` của §5.3. Dải màu của ⑥ đạt `validate_palette.js --ordinal` ở chế độ sáng và tối (lưu kết quả vào bằng chứng).
- **AC-8** Ở 375px, thứ tự khối đúng như §5.1, và trang không cuộn ngang.
- **AC-9** Ở chế độ `api`, không có chữ "AI" hay "An Nhi" trên dòng tóm tắt; dòng tóm tắt khớp với các ô số.
