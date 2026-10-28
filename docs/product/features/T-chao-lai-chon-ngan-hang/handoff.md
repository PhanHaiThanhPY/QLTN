# Handoff: T-S1 Thư mời chào lãi suất và chọn ngân hàng gửi tiền quỹ bảo trì

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-37) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-T1.18).

**Cách làm:**
- Tạo nhánh và worktree riêng, tách từ `main` mới nhất (đã có đủ nhóm F). Gợi ý: `feature/t-s1-rate-invitations`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Slice đầu của nhóm T** (tiền gửi quỹ bảo trì). Không có demo; hình D1 tr. 33–34 là mẫu giao diện. Bản mô tả đọc từ hình nằm ở `docs/product/modules/T-tien-gui-quy-bao-tri.md` §2.

**Dùng lại, không làm thứ hai:**
- **Mô hình quỹ của F-S3:** thêm loại quỹ `BAO_TRI` vào cùng bảng quỹ, và tạo sẵn cho mọi tòa. Không làm bảng quỹ riêng.
- **Bộ lịch chạy dùng chung**, cho việc tự hết hạn nhận bản chào.
- **Cách dựng của nhóm F:**
  - F-S1: gói, hạn nhận, trễ hạn theo thời điểm nhận, danh sách kiểm khi gửi;
  - F-S2: đề xuất kết quả, BQT duyệt, yêu cầu sửa, từ chối, đổi kết quả, bản chụp bảng so sánh.

  Tách phần dùng chung nếu thấy hợp lý; không chép một bản thứ hai.

**Những gì phải tạo mới:**
- Danh mục ngân hàng; thư mời (`MC-`), ngân hàng được mời, bản chào; kết quả chọn (`KQ-TG`), biên bản (`BB-TG`), quyết định. Gộp vào **một** migration mới.
- Quyền mới cho tiền gửi (BR-T1-12). Bạn đặt tên; cập nhật ma trận quyền và lịch sử RM.
- Nhóm menu "Tiền gửi quỹ bảo trì": "Thư mời chào lãi", "Ngân hàng".

**Cần lưu ý:**
- **Lãi suất** lưu dạng **số nguyên** theo phần nghìn của phần trăm (5,875% → 5875). Nhập quá 3 chữ số thập phân thì từ chối.
- **Lãi cả kỳ** = số tiền × lãi suất × số ngày ÷ cơ sở. Tính hoàn toàn bằng số nguyên (BigInt hoặc bigint ở DB), làm tròn đến đồng, nửa lên. Ví dụ D1: 1.000.000.000 × 6,0% × 90 ÷ 360 = 15.000.000. Không có phép tính số thực.
- **Cơ sở tính ngày** là trường bắt buộc của bản chào, **không có mặc định** (DF-22).
- **Chặn đổi kết quả khi đã có hợp đồng** (AC-T1.14) chỉ test đầy đủ được khi có T-S2. Ghi rõ trong bằng chứng.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

**Nhánh:** `feature/t-s1-rate-invitations` (worktree `../QLTN-t-s1`), tách từ `main` @`c928998`. Chưa push.

**Commit:** `f5c2c70` (API), `860fe8d` (test API), `64d77c3`, `42ff857`, `6239719` (web), cùng commit bằng chứng này.

**Migration:** `api-qltn/src/database/migrations/2026-10-28c-deposit-rate-invitations.sql`.
- Chạy thử trên `qltn_dev` trong `BEGIN … ROLLBACK`, chạy hai lần liền nhau: mỗi tòa có đúng một quỹ `BAO_TRI`.
- Áp thật trên các DB e2e và trên DB riêng `qltn_build_t1_evidence`. **Chưa áp vào `qltn_dev`.**
- Nội dung:
  - quỹ `BAO_TRI` cho mọi tòa;
  - trigger tạo quỹ cho tòa mới nay tạo cả hai loại quỹ;
  - 4 bảng mới: `deposit_banks`, `deposit_invitations`, `deposit_offers`, `deposit_selections`.

### Quyết định (SPEC chưa nói rõ)

1. **Quyền:**
   - `DEPOSIT_VIEW`: BQL, BQT, kế toán. **ADMIN** cũng có, chỉ xem, theo yêu cầu của PM/BA (BR-RM2-02).
   - `DEPOSIT_MANAGE`: BQL.
   - `DEPOSIT_APPROVE`: BQT.
   - Đã cập nhật ADR-0001 §3, lịch sử SPEC RM, ma trận quyền trên web và nhãn nhật ký ở cả hai bản.
2. **Không tách bộ duyệt chung từ F-S2.**
   - Kết quả chọn ngân hàng dùng lại các phần nhỏ dùng chung: `validateReason`, bộ đếm mã, nhật ký, khóa phiên bản. Luồng duyệt viết theo đúng mẫu của F-S2.
   - Lý do: luồng của F-S2 gắn chặt với gói và hồ sơ dự thầu. Tách ra phải sửa code F-S2 đã merge, rủi ro cao hơn lợi ích.
   - Trên web, hộp thoại "Gia hạn" của F-S1 được tổng quát hóa và dùng chung.
3. **Nhiều nhất một bản chào cho mỗi ngân hàng.** Ghi lần hai thì báo 409, kèm lời nhắn "sửa bản đó". "Nộp lại" là sửa bản chào đã có (`PUT /deposits/offers/:id`, có khóa phiên bản).
4. **Bản có lãi cao nhất** là bản cao nhất trong số các bản đủ hồ sơ và đúng hạn. Nếu không có bản nào đúng hạn, lấy bản cao nhất trong các bản đủ hồ sơ. Web đọc lại cùng quy tắc từ bản chụp bảng so sánh để hiện cảnh báo cho BQT.
5. **Xếp hạng:** theo lãi cả kỳ; bằng nhau thì xét lãi suất; vẫn bằng thì bản nhận sớm hơn đứng trước.
6. **Thư đã gửi:**
   - Không đổi được số tiền và kỳ hạn (409).
   - Hạn phản hồi chỉ đổi qua "Gia hạn".
   - Chỉ thêm được ngân hàng, không bớt.
   - Bản chào ghi được khi thư "Đang nhận bản chào", và sau khi "Đã hết hạn nhận" (bản trễ hạn).
7. **Hủy thư** bị chặn khi có kết quả đang chờ duyệt hoặc đang "Cần sửa". Hủy được khi thư ở Nháp, Đang nhận bản chào, hoặc Đã hết hạn nhận.
8. **Người đề xuất không tự duyệt.** BQL không có `DEPOSIT_APPROVE` nên bị 403. Ngoài ra API còn chặn trường hợp người duyệt cũng là người đề xuất.
9. **Mã:**
   - `KQ-TG01` và `BB-TG01` không có gạch sau tiền tố. `CodeCounterService.next` có thêm tham số ký tự nối, mặc định vẫn là `-`.
   - Biên bản nhận mã `BB-TG` lúc đề xuất. Mã giữ nguyên khi gửi lại.
10. **Seed** chạy qua các service, nên ngày tháng là của hôm nay:
    - MC-001 nhận bản chào, đóng sớm, chọn B, BQT duyệt.
    - MC-002 có hạn phản hồi là hôm nay + 3 ngày, lúc 17:00. Hai ngân hàng A và B đã phản hồi.
    - B trả lãi định kỳ mỗi 30 ngày, như ui-brief.
11. **AC-T1.14:** việc chặn đổi kết quả khi đã có hợp đồng tiền gửi **để dành cho T-S2**. `proposeChange` có ghi chú ở chỗ cần thêm kiểm tra.
12. **Quỹ `BAO_TRI` qua API của nhóm F:** `GET /funds` vẫn chỉ trả quỹ khai thác (e2e AC-T1.16). Các route của F-S3 theo id quỹ (thiết lập, sổ) chưa chặn id của quỹ bảo trì; T-S2 sẽ dùng chính các route này cho quỹ bảo trì.

### AC → bằng chứng

| AC | Bằng chứng |
|---|---|
| T1.1 | e2e: trùng tên và chi nhánh (không phân biệt hoa thường) bị từ chối ở trường `branch`; khác chi nhánh thì được |
| T1.2 | e2e: gửi khi thiếu tệp thư và ngân hàng bị từ chối, báo đúng hai trường; đủ thì "Đang nhận bản chào", có nhật ký |
| T1.3 | e2e: đổi số tiền sau khi gửi → 409; rút ngắn hạn → 400 `deadlineAt`; gia hạn có lý do → 200 |
| T1.4 | e2e: `DepositDeadlinesService.run` (bộ lịch chạy dùng chung, mỗi phút) chuyển thư sang "Đã hết hạn nhận" |
| T1.5, T1.6 | e2e: 2/3, ngân hàng thứ ba "Còn chờ"; "5,8755" → 400; "5,875" lưu là 5875; ngân hàng ngoài danh sách cần lý do. Ảnh T1-2. Test component: thanh tiến độ có nhãn |
| T1.7, T1.8 | Unit test: ví dụ D1, cơ sở 365 ra 14.794.521, làm tròn nửa lên, số lớn. e2e: 14.500.000 / 15.000.000 / 14.750.000, B đứng đầu; cơ sở 365 có cảnh báo. Ảnh T1-3, T1-6 |
| T1.9 | e2e: nhận 16:00 dù nhập ngày 28/08 thì không trễ; nhận 18:00 thì trễ |
| T1.10 | e2e: chọn bản "Thiếu" → 400; chọn B → chờ duyệt, có bản chụp bảng so sánh; BQL duyệt → 403; BQT duyệt → "Đã chọn ngân hàng" |
| T1.11, T1.12 | e2e: thiếu lý do không cao nhất hoặc lý do trễ thì báo cả hai trường; đủ thì được. Ảnh T1-5: BQT thấy cảnh báo "Không phải bản chào có lãi cả kỳ cao nhất (cao nhất: Ngân hàng B · …)" |
| T1.13 | e2e: "Không chọn được ngân hàng", yêu cầu sửa, gửi lại, duyệt → "Không có kết quả"; một ca từ chối riêng |
| T1.14 | e2e: đổi kết quả có lý do, BQT duyệt, kết quả cũ "Đã thay thế". Chặn khi đã có hợp đồng: để dành cho T-S2 |
| T1.15 | e2e: kế toán đọc MC-001 và KQ-TG01, ghi → 403; ADMIN đọc được, ghi → 403; KT → 403; `bql-b` → 404. Ảnh T1-7: kế toán không có nút ghi |
| T1.16 | e2e: mỗi tòa đúng một quỹ `BAO_TRI`; `/funds` chỉ trả quỹ khai thác |
| T1.17 | e2e: seed ra MC-001 (B, KQ-TG01, BB-TG01, 3/3) và MC-002 (2/3); chạy lại không tạo trùng |
| T1.18 | Ảnh T1-4 và T1-4b ở 375px, không cuộn ngang. Test component. Các suite nhóm F vẫn đạt (bên dưới) |

**Chạy lại bằng chứng** (cần DB mới, vì script thay đổi MC-002): [supporting/t-s1-invitations-check.mjs](supporting/t-s1-invitations-check.mjs). Lần chạy cuối: `PASS`.

### Test đã chạy

- **API:**
  - `format:check` OK; `tsc` OK; `eslint` OK.
  - `jest`: 169/169, gồm 6 test của `domain/deposit`.
  - e2e trên `qltn_build_e2e`:
    - `deposit-invitations`: 13/13.
    - `exploitation-fund` 13/13, `exploitation-contracts` 10/10, `fund-statements` 11/11. Ba suite này chạy riêng từng suite; lần chạy gộp trước đó hết thời gian ở `beforeAll` vì máy đang tải cao (load ~10), không có lỗi kiểm tra nào.
    - `role-matrix`, `attachments`, `fund-termination`, `exploitation` cũng đạt trong lần chạy gộp.
- **Web:**
  - `tsc -b` OK.
  - `vitest`: 620/620 (105 tệp), gồm test parity giữa web và API cho lãi suất và lãi cả kỳ, cùng test nhãn nhật ký.

### Còn lại / lưu ý cho review

- `beforeAll` của e2e T-S1 có thời hạn 120 giây. Lý do: khởi động (migration và seed) cộng 5 lần đăng nhập vượt 30 giây khi máy tải cao.
- Ở dưới 768px, nút chính chưa dính đáy màn hình như ui-brief §3; các nút nằm trong đầu trang và tự xuống dòng. Không cuộn ngang.
- Chưa có test component cho các hộp thoại soạn và gửi thư, bản chào, đề xuất. Luồng của chúng được e2e API và script trình duyệt phủ.
