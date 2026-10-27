# Module B06: Xử lý khẩn cấp

**Chủ sở hữu:** PM/BA · **Cập nhật:** 27/10/2026 · **Trạng thái:** Phân tích lần 1, **chủ dự án duyệt 27/10/2026 (PD-18)**  
**Code đã đọc** (commit `fb4fd7a`):
- API: `api-qltn/src/modules/records/record-actions.ts`, `record-status-groups.ts`, `entities/repair-record.entity.ts`, `src/domain/permissions.ts`, `src/domain/building-config.ts`, `src/modules/buildings/*` (config), migration `2026-10-21b-catalog-admin.sql`, `2026-10-23a-repair-records.sql`.
- Web: `web/src/features/records/components/emergency/*`, `shared/RecordAlerts.tsx`, `list/RecordFlags.tsx`, `detail/RecordDetailHeader.tsx`, `web/src/domain/actions.ts`, `task-rules.ts`, `repair-alerts.ts`, `services/handlers/emergency-handlers.ts`, `repair-proposal-handlers.ts`, `services/http/command-adapter.ts`, `mock/seed-repairs.ts`, `features/assistant/rules.ts`.
- Test: web `services/config-and-emergency.test.ts` (1 ca khẩn cấp); API `catalog-admin.e2e-spec.ts` (chỉ phần cấu hình và quyền).

**Liên quan nghiệp vụ:**
- D2 nhóm 06: "Ghi nhận lý do, nhà thầu và giá dự kiến; áp dụng hạn mức theo tòa; theo dõi hạn bổ sung hồ sơ và thực hiện quy trình phê duyệt sau."
- D1 tr. 20 "Xử lý nhanh và truy đủ hồ sơ sau sự cố" (KC-001, Aqua 2). Các trang khác của D1 không có nội dung khẩn cấp (đã dò toàn bộ chữ của D1).
- D5 "Thông tin quy trình hồ sơ KT" (10 bước): **không có nhánh khẩn cấp**. Chỉ có bước 1 "NVKT ghi nhận hư hỏng… gửi thông tin đến BQT và TVKT".
- DF-09 (TT05 Điều 32.5, 37.5; D2 nhóm 06). Phiếu L0 câu C6. SPEC B03–B09 v2 §2 để B06 sang SPEC riêng (PD-04).

## 1. D1 tr. 20 vẽ gì

- Tiêu đề hồ sơ: "Aqua 2 · Sự cố KC-001 · 23/11/2026", vị trí "Tầng hầm". Người dùng là BQL.
- 4 ô đếm: Sự cố 1 · Đã kiểm soát 1 · Ảnh hiện trường 2 · Hồ sơ cần đủ 1.
- **Nhật ký sự cố** (mobile gọi "Diễn biến xử lý"): mỗi dòng có giờ, việc, người xử lý.
  - 09:10 Ghi nhận rò nước, QL01.
  - 09:15 Cô lập khu vực, KT02.
  - 09:30 Kiểm soát rò nước, KT02.
- **Tình trạng hiện tại:** "Đã kiểm soát".
- **Hồ sơ sau xử lý:** "Đang hoàn thiện", gồm 2 ảnh hiện trường và `Nhật ký.pdf`.
- Nút chính **"Bổ sung hồ sơ"**; "3 tài liệu liên kết"; An Nhi gợi ý "Lưu diễn biến và chứng từ xử lý".
- D1 **không** vẽ: hạn mức, hạn bổ sung, BQT duyệt hậu kiểm, kết quả từ chối, cờ hội nghị.

## 2. Luồng đề xuất từ đầu đến cuối

| # | Bước | Ai làm | Nội dung | Căn cứ |
|---|---|---|---|---|
| E1 | Bắt đầu xử lý khẩn cấp | BQL quản lý hồ sơ, có `EMERGENCY_START` | Từ hồ sơ `DRAFT`, `PENDING_CONFIRMATION` hoặc `PENDING_PROPOSAL`. Nhập lý do, nhà thầu, chi phí dự kiến, ngày dự kiến xong. Hồ sơ sang `EMERGENCY_IN_PROGRESS` | Demo; DF-09 |
| E2 | Kiểm hạn mức | Hệ thống | Chi phí dự kiến ≤ `emergencyLimitVnd` của tòa **lúc bắt đầu**. Vượt thì từ chối, đi luồng thường. Lưu hạn mức đã áp vào hồ sơ | Demo; DF-09 |
| E3 | Báo người duyệt | Hệ thống | Thông báo ngay cho người xác nhận và mọi người giữ bước duyệt (TVKT, BQT) | Demo; DF-09; D5 bước 1 |
| E4 | Ghi nhật ký sự cố | BQL và người được giao | Thêm dòng diễn biến (giờ, việc, người, ảnh); đặt tình trạng "Đang xử lý" / "Đã kiểm soát" | D1 tr. 20 |
| E5 | Nộp tờ trình bổ sung | BQL | Hạn = lúc bắt đầu + `emergencyDocHours` (4–72 giờ). Trễ hạn thì bắt buộc ghi lý do | Demo; DF-09 |
| E6 | Duyệt hậu kiểm | Chuỗi duyệt PROPOSAL của snapshot (mẫu AQUA: TVKT → BQT) | Như T07–T09 của SPEC v2, có biên bản họp BQT (PD-07 Q8). Duyệt xong: về `IN_CONSTRUCTION` (đã có thi công), không qua "Chờ thi công" | Demo; DF-02, DF-09 |
| E7 | Không được duyệt hậu kiểm | BQT | Hồ sơ ghi "Không được duyệt hậu kiểm", chặn mọi thanh toán, chuyển BQT xử lý | DF-09 |
| E8 | Nghiệm thu, thanh toán | Như S3, S4 | Chỉ sau E6. Tạm ứng và quyết toán ≤ số được duyệt | SPEC v2 BR-S4-01, 04 |
| E9 | Cờ báo cáo hội nghị | Hệ thống | Mọi hồ sơ khẩn cấp có cờ "báo cáo hội nghị gần nhất" đến khi được đánh dấu đã báo cáo | DF-09 |

## 3. Gắn vào máy trạng thái B03–B09 v2

- `EMERGENCY_IN_PROGRESS` **đã có** trong tập trạng thái (nhãn "Đang xử lý khẩn cấp", nhóm lọc `CONSTRUCTION`). SPEC v2 §5 "không thêm trạng thái mới" vẫn giữ được cho E1–E6.
- Các chuyển cần thêm hoặc mở rộng:

| # | Hành động | Từ | Sang | Ghi chú |
|---|---|---|---|---|
| E-T1 | `startEmergencyRepair` (mới) | `DRAFT`, `PENDING_CONFIRMATION`, `PENDING_PROPOSAL` | `EMERGENCY_IN_PROGRESS` | `EMERGENCY_START` · manager. Tạo bản thi công (ngày bắt đầu = hôm nay) |
| T04 | `saveProposalDraft` | **cộng** `EMERGENCY_IN_PROGRESS` | giữ nguyên | demo đã có |
| T05 | `submitProposal` | **cộng** `EMERGENCY_IN_PROGRESS` | bước đầu của chuỗi | thêm `lateReason` khi trễ hạn |
| T07 | `approveProposal` bước cuối | như cũ | `IN_CONSTRUCTION` nếu hồ sơ khẩn cấp đã có thi công; nếu không, `READY_FOR_CONSTRUCTION` | demo đã có |
| T11 | `updateConstruction` | **cộng** `EMERGENCY_IN_PROGRESS` | giữ nguyên | demo đã có |
| T09 | `rejectProposal` trên hồ sơ khẩn cấp | như cũ | xem B6G-04 | **chưa có quyết định** |

- **Thanh toán (S4):** A1 (tạm ứng) chỉ mở từ `READY_FOR_CONSTRUCTION` trở đi, và cần số được duyệt. Vì vậy hồ sơ ở `EMERGENCY_IN_PROGRESS` hoặc đang chờ hậu kiểm **tự nhiên bị chặn** thanh toán. Cần giữ điều này bằng test, không phải bằng quy tắc mới.
- **Nghiệm thu:** `submitAcceptance` chỉ từ `IN_CONSTRUCTION`. Việc khẩn cấp làm xong trước khi duyệt phải chờ hậu kiểm mới nghiệm thu (giả định, xem câu hỏi Q6).
- **Bỏ qua bước xác nhận:** bắt đầu từ `DRAFT` hoặc `PENDING_CONFIRMATION` nghĩa là bỏ bước TVKT/BQT xác nhận hư hỏng. Giả định: chấp nhận, vì duyệt hậu kiểm bao luôn phần xác nhận; người xác nhận vẫn được báo ở E3.

## 4. Tính năng và trạng thái hiện nay

| # | Tính năng | API | Web `api` | Test | Trạng thái |
|---|---|---|---|---|---|
| B6-01 | Cấu hình hạn mức và giờ bổ sung theo tòa (mẫu STANDARD 20 tr/24 h, RESIDENTIAL 15/24, OFFICE 50/48, AQUA 15/24); chỉ ADMIN sửa (DF-11) | `GET/PUT …/config` | `ConfigCard` | e2e `catalog-admin` | **Có** |
| B6-02 | Quyền `EMERGENCY_START` (BQL; vai trò tùy chỉnh VT-01 không có) | có trong ma trận | có | e2e `catalog-admin` | **Có** |
| B6-03 | Trạng thái `EMERGENCY_IN_PROGRESS`: nhãn và nhóm lọc | có | có | — | Có (chỉ nhãn; không chuyển nào dẫn tới) |
| B6-04 | Bắt đầu xử lý khẩn cấp, kiểm hạn mức, tạo thi công | **không có** (không có hành động, endpoint, cột dữ liệu) | adapter không có lệnh → báo "Thao tác này chưa nối API." | web 1 ca | **Chỉ demo** |
| B6-05 | Báo người xác nhận và người duyệt khi bắt đầu | không có (module `notifications` đã có, chưa dùng cho B06) | — | web 1 ca | Chỉ demo |
| B6-06 | Hạn bổ sung hồ sơ; việc "SUBMIT_EMERGENCY_DOCS" cho BQL; huy hiệu còn/quá giờ | không có | — | web 1 ca | Chỉ demo |
| B6-07 | Nộp tờ trình từ `EMERGENCY_IN_PROGRESS`, bắt lý do trễ hạn | không có (T05 chỉ từ `PENDING_PROPOSAL`) | — | web 1 ca | Chỉ demo |
| B6-08 | Duyệt xong về thẳng `IN_CONSTRUCTION` | không có (luôn `READY_FOR_CONSTRUCTION`) | — | chưa có test | Chỉ demo |
| B6-09 | Cảnh báo giá trình vượt hạn mức khẩn cấp (`EMERGENCY_OVER_LIMIT`) | không có | — | — | Chỉ demo, chỉ cảnh báo |
| B6-10 | Thẻ "Sửa chữa khẩn cấp" và cờ khẩn cấp ở danh sách, chi tiết | không có (view không có `emergency`) | — | — | Chỉ demo |
| B6-11 | Nhật ký sự cố, tình trạng "Đã kiểm soát" (D1 tr. 20) | không có | — | — | **Chưa có** (demo chỉ có nhật ký thi công) |
| B6-12 | "Không được duyệt hậu kiểm", chặn thanh toán, chuyển BQT | không có | — | — | **Chưa có** |
| B6-13 | Cờ "báo cáo hội nghị gần nhất" | không có | — | — | **Chưa có** |
| B6-14 | Trợ lý An Nhi gợi ý cho hồ sơ khẩn cấp | — | `assistant/rules.ts` không có luật khẩn cấp | — | Chưa có |

Dữ liệu demo: SC-020 "Vỡ ống cấp nước chính hầm B1" (12,5 tr, nhà thầu Bình An) đang khẩn cấp, dùng để thử trễ hạn.

## 5. Quy tắc đang chạy (demo)

- Chỉ manager của hồ sơ có `EMERGENCY_START`. Hồ sơ phải đủ điều kiện gửi (tên, mô tả, vị trí, BQL còn hoạt động).
- Lý do theo độ dài lý do chung; tên nhà thầu bắt buộc, có giới hạn độ dài; chi phí là số VND hợp lệ; ngày dự kiến xong ≥ hôm nay.
- Chi phí > hạn mức: lỗi trường `estimatedAmountVnd` "Vượt hạn mức khẩn cấp của tòa… Hãy đi quy trình duyệt thông thường."
- `docsDueAt` = lúc bắt đầu + `emergencyDocHours`. Hạn mức lúc bắt đầu được lưu vào `emergency.limitVnd`.
- Tờ trình nháp được tạo sẵn với nhà thầu và chi phí dự kiến.
- Nộp tờ trình sau hạn: bắt buộc `lateReason`. Ghi `docsSubmittedAt`.
- Từ chối hồ sơ khẩn cấp: **xử lý như hồ sơ thường** (trình lại, lần 3 thành `UNRESOLVED`). Không có kết quả hậu kiểm riêng.
- Không có nhắc khi quá hạn ngoài huy hiệu "Quá hạn bổ sung N giờ" và việc quá hạn trong danh sách công việc.

## 6. Khoảng trống và rủi ro

| ID | Nội dung | Căn cứ | Mức | Hướng xử lý |
|---|---|---|---|---|
| **B6G-01** | API không có gì của luồng khẩn cấp ngoài cấu hình, quyền và nhãn trạng thái. Web chế độ `api`: nút "Xử lý khẩn cấp" vẫn có thể hiện với BQL nhưng bấm thì lỗi "chưa nối API" (đọc code, chưa chạy thử) | `record-actions.ts`, `command-adapter.ts` | **Cao** | B06-S1 |
| **B6G-02** | `repair_records` không có trường khẩn cấp (lý do, nhà thầu, chi phí dự kiến, hạn mức đã áp, hạn bổ sung, lúc nộp, lý do trễ, người và lúc bắt đầu) | entity, migration | Cao | B06-S1, migration mới. Tiền dạng `bigint`, gửi chuỗi |
| **B6G-03** | Chưa có tình trạng "chờ duyệt hậu kiểm" nhìn thấy được: khi đã nộp, hồ sơ thành `PENDING_TECH_REVIEW` như hồ sơ thường, chỉ còn thẻ khẩn cấp | `repair-proposal-handlers.ts` | Trung bình | Giữ trạng thái chung; nhãn bước hiện "Duyệt hậu kiểm" khi hồ sơ có `emergency` |
| **B6G-04** | **Từ chối hậu kiểm chưa định nghĩa.** Demo cho trình lại tối đa 3 lần rồi `UNRESOLVED`; mà `UNRESOLVED` sinh thông báo "chưa xử lý" cho cư dân (DF-04), sai với việc đã làm xong. DF-09 cần "Không được duyệt hậu kiểm", chặn thanh toán, chuyển BQT | DF-04, DF-09 | **Cao** | Giả định: từ chối có trình lại vẫn theo 3 lần. Lần từ chối cuối, hoặc BQT chọn "Không duyệt hậu kiểm", đưa hồ sơ về trạng thái mới `POST_REVIEW_REJECTED` (nhóm `NEEDS_ACTION`, người giữ BQT). BQT đóng bằng quyết định xử lý (ghi chú + tệp). Không phát thông báo cư dân. Cần sửa SPEC v2 §5 "không thêm trạng thái" |
| **B6G-05** | Đang chờ hậu kiểm hoặc cần bổ sung tờ trình thì không ghi được tiến độ (`updateConstruction` chỉ từ `IN_CONSTRUCTION`, `EMERGENCY_IN_PROGRESS`), trong khi việc thật vẫn chạy | `actions.ts` | Trung bình | Nhật ký sự cố (B6G-06) mở cho mọi trạng thái mở của hồ sơ khẩn cấp |
| **B6G-06** | Chưa có nhật ký sự cố theo D1: dòng giờ/việc/người, tình trạng "Đã kiểm soát", ảnh hiện trường, `Nhật ký.pdf` | D1 tr. 20 | Trung bình | B06-S2. Xuất PDF để sau (DF-18) |
| **B6G-07** | Chưa có cờ báo cáo hội nghị | DF-09 | Trung bình | B06-S2: cờ suy ra từ `emergency`; BQL đánh dấu "đã báo cáo" kèm ngày hội nghị; báo cáo lọc theo cờ |
| **B6G-08** | Quá hạn bổ sung không báo ai | DF-09 | Trung bình | Giả định: quá hạn thì hiện trong danh sách quá hạn của BQL và BQT; thông báo BQT một lần khi phát hiện quá hạn (tính lúc đọc, không cần lịch chạy) |
| **B6G-09** | Giá trình cuối vượt hạn mức chỉ là cảnh báo | `repair-alerts.ts` | Trung bình | Giả định: vẫn cho trình, cảnh báo bắt buộc hiện cho BQT; số chi tối đa là số được duyệt (BR-S4-04) |
| B6G-10 | Lạm dụng: chia nhỏ một việc thành nhiều hồ sơ dưới hạn mức để né duyệt trước | rủi ro | Trung bình | Báo cáo số hồ sơ khẩn cấp theo tòa/tháng; cảnh báo hỏng lặp (B11) đã có ở web |
| B6G-11 | Bỏ bước xác nhận khi bắt đầu từ `DRAFT` | `actions.ts` | Thấp | Giả định: chấp nhận (mục 3), ghi audit rõ |
| B6G-12 | D1 dùng mã "KC-001", hệ thống dùng mã `SC-` | D1 tr. 20 | Thấp | Giả định: giữ mã `SC-`, thêm nhãn "Khẩn cấp" |
| B6G-13 | Căn cứ TT05 Điều 32.5, 37.5 lấy từ DF-09; PM/BA chưa đối chiếu lại nguyên văn | PRODUCT-DEFAULTS lưu ý pháp lý | Thấp | Đơn vị vận hành/luật sư xác nhận trước khi chạy thật |

## 7. Mặc định đề xuất (giả định, theo PD-06)

- **D-B6-1:** Chỉ BQL quản lý hồ sơ được bắt đầu (`EMERGENCY_START`). KT trực đêm ghi nhật ký, không bắt đầu.
- **D-B6-2:** Hạn mức so với chi phí dự kiến **mỗi hồ sơ**, không cộng dồn theo tháng.
- **D-B6-3:** Hạn mức và số giờ lấy theo cấu hình tòa lúc bắt đầu và lưu vào hồ sơ; đổi cấu hình sau đó không ảnh hưởng.
- **D-B6-4:** Duyệt hậu kiểm dùng đúng chuỗi PROPOSAL của snapshot, kể cả biên bản họp BQT.
- **D-B6-5:** Không tạm ứng, không nghiệm thu trước khi duyệt hậu kiểm xong.
- **D-B6-6:** Không duyệt hậu kiểm thì hồ sơ dừng ở "Không được duyệt hậu kiểm" (B6G-04); BQT ghi quyết định xử lý chi phí ngoài hệ thống; không có thanh toán nào trong hệ thống.
- **D-B6-7:** Cờ hội nghị bật cho mọi hồ sơ khẩn cấp, kể cả bị từ chối.

## 8. Câu hỏi cho khách (ứng viên OD, mặc định dùng trong lúc chờ)

| ID | Câu hỏi | Mặc định đang dùng |
|---|---|---|
| B6Q-01 | Hạn mức tiền thực tế cho từng tòa Aqua 1–4? (L0 C6) | Mẫu AQUA 15 triệu |
| B6Q-02 | Ai được cho làm trước: BQL, trưởng BQL, hay cần BQT đồng ý miệng/qua điện thoại? (L0 C6) | D-B6-1 |
| B6Q-03 | Thời hạn bổ sung hồ sơ? (L0 C6) | 24 giờ |
| B6Q-04 | Không được duyệt hậu kiểm thì ai chịu chi phí, xử lý thế nào? (L0 C6) | D-B6-6 |
| B6Q-05 | Có cần mã riêng "KC-" và màn danh sách sự cố riêng như D1 không? | B6G-12 |
| B6Q-06 | Việc đã xong trước khi duyệt có được nghiệm thu ngay không? | D-B6-5 |
| B6Q-07 | Báo cáo hội nghị cần nội dung gì (danh sách, tổng tiền, lý do)? Hội nghị nào: thường niên hay bất thường? | Danh sách hồ sơ + số tiền + lý do |
| B6Q-08 | Hạn mức tính theo hồ sơ hay cộng dồn theo kỳ? | D-B6-2 |

Đề xuất gom thành **OD-19** trong DECISIONS khi chủ dự án duyệt bản này.

## 9. Slice đề xuất

| Slice | Nội dung | Sẵn sàng? |
|---|---|---|
| **B06-S1** ([SPEC](../features/B06-xu-ly-khan-cap/SPEC.md), đã triển khai 27/10; gồm cả B6G-04) | Đưa luồng demo lên API và web chế độ `api`: E1–E3, E5, E6, chặn thanh toán bằng trạng thái, thẻ và cờ khẩn cấp | Sau khi chủ dự án duyệt phân tích này (PD-08). Không phụ thuộc slice khác đang mở |
| **B06-S2** | Từ chối hậu kiểm (B6G-04, có trạng thái mới), nhật ký sự cố D1 (B6G-05, 06), quá hạn báo BQT (B6G-08), cờ và danh sách báo cáo hội nghị (B6G-07) | Sau S1. Cần chủ dự án chốt B6G-04 (thêm trạng thái) |

**AC nháp B06-S1**
1. BQL quản lý hồ sơ có `EMERGENCY_START` bắt đầu được từ `DRAFT`, `PENDING_CONFIRMATION`, `PENDING_PROPOSAL`; hồ sơ sang `EMERGENCY_IN_PROGRESS`, có bản thi công ngày bắt đầu hôm nay.
2. Thiếu quyền hoặc không phải manager: 403. Sai trạng thái: 409. Thứ tự kiểm như SPEC v2 §3.
3. Chi phí dự kiến > hạn mức của tòa: 400 lỗi trường `estimatedAmountVnd`. Bằng hạn mức: cho phép.
4. Hồ sơ lưu lý do, nhà thầu, chi phí, hạn mức đã áp, `docsDueAt` = bắt đầu + `emergencyDocHours`; đổi cấu hình sau đó không đổi các giá trị này.
5. Người xác nhận và mọi người giữ bước duyệt nhận đúng một thông báo.
6. BQL lưu nháp và nộp tờ trình từ `EMERGENCY_IN_PROGRESS`; nộp sau hạn mà thiếu `lateReason`: 400; có thì lưu cùng `docsSubmittedAt`.
7. Duyệt bước cuối đưa hồ sơ về `IN_CONSTRUCTION`, không qua `READY_FOR_CONSTRUCTION`.
8. Trước khi duyệt xong: tạm ứng, nghiệm thu, quyết toán đều bị từ chối (409).
9. `updateConstruction` chạy được ở `EMERGENCY_IN_PROGRESS`.
10. Chi tiết và danh sách hồ sơ (API view) trả thông tin khẩn cấp; web chế độ `api` hiện thẻ, huy hiệu hạn và cờ như demo.
11. Mọi hành động có khóa phiên bản và audit trong cùng transaction (BR-C-01).
12. Có e2e cho: trong/đúng/vượt hạn mức, đúng hạn/trễ hạn, sai quyền, duyệt xong về thi công, chặn thanh toán.

**AC nháp B06-S2**
1. Lần từ chối cuối (hoặc BQT chọn "Không duyệt hậu kiểm") trên hồ sơ khẩn cấp đưa hồ sơ sang "Không được duyệt hậu kiểm"; không sinh thông báo cư dân; mọi đợt thanh toán bị chặn.
2. BQT đóng hồ sơ này bằng quyết định xử lý (lý do 5–1000 ký tự, tệp tùy chọn), có audit.
3. Nhật ký sự cố: thêm dòng (giờ, việc, người, ảnh) ở mọi trạng thái mở của hồ sơ khẩn cấp; đặt tình trạng "Đang xử lý"/"Đã kiểm soát"; không sửa, không xóa dòng đã ghi.
4. Quá `docsDueAt` chưa nộp: hồ sơ vào danh sách quá hạn của BQL và BQT; BQT nhận một thông báo.
5. Mọi hồ sơ khẩn cấp có cờ hội nghị; BQL đánh dấu "đã báo cáo" kèm ngày hội nghị; báo cáo lọc được hồ sơ chưa báo cáo theo tòa và kỳ.
