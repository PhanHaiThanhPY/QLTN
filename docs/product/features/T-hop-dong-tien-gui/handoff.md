# Handoff: T-S2 Quỹ bảo trì, quy chế và hợp đồng tiền gửi có lịch lãi

**Gói việc:** [SPEC.md](SPEC.md) (`Đã duyệt`, PD-39) và [supporting/ui-brief.md](supporting/ui-brief.md). Brief là một phần của AC (AC-T2.17).

**Cách làm:**
- **Chỉ bắt đầu sau khi T-S1 đạt review.** Thứ tự trong hàng của bạn: T-S1 → RM-S2 → T-S2.
- Tách nhánh từ nhánh T-S1 đã review, hoặc từ `main` nếu T-S1 đã merge. Gợi ý: `feature/t-s2-deposit-contracts`.
- Dùng worktree riêng, không đụng vào cây thư mục chung.
- Không push và không merge khi chủ dự án chưa yêu cầu.
- Chỉ chạy test liên quan, theo SPEC §5. e2e chạy trên DB riêng.
- Khi chụp ảnh: chạy dev server **một lần**, chụp xong thì tắt, vì RAM có hạn.

## Ghi chú cho dev-build (PM/BA)

**Dùng lại, không làm thứ hai:**
- **Quỹ:** quỹ, tài khoản, số dư đầu, sổ, dòng đảo, luật không âm (khóa quỹ `FOR UPDATE`) của F-S3. Thêm nhóm dòng mới; màn "Sổ quỹ" thêm ô chọn loại quỹ.
- **Sao kê và đối soát** của F-S4: phải chạy được cho tài khoản quỹ bảo trì mà không phải đổi gì.
- **Bộ lịch chạy dùng chung**, cho trạng thái kỳ lãi.
- **Cách dựng trang hợp đồng** (mốc liên kết, bảng lịch, phụ lục có xem trước) của F-S2; khung duyệt của F-S2 và T-S1.

**Những gì phải tạo mới:**
- Quy chế quỹ và phiên bản; hợp đồng tiền gửi và phiên bản; kỳ lãi; phụ lục; liên kết tiền chuyển đến với phiếu chi. Gộp vào **một** migration mới.
- Nhóm dòng sổ "Gửi tiền có kỳ hạn", "Nhận chuyển từ quỹ khác". Chừa sẵn "Thu hồi gốc" và "Lãi tiền gửi" cho T-S3 và T-S4.
- Chặn đổi KQ-TG khi đã có hợp đồng (AC-T2.14; bổ sung cho AC-T1.14).
- **Quyền xem của T-S2 cấp cho ADMIN** (BR-RM2-02, PD-38).

**Cần lưu ý:**
- **Tiền và lãi suất là số nguyên** trên mọi đường. Lãi từng kỳ, lãi hai đoạn của phụ lục, kỳ cuối nhận phần còn lại đều tính bằng số nguyên. Các số kiểm sẵn: AC-T2.9 (4.931.506 / 4.931.508), AC-T2.10 (4 kỳ, cắt cuối tháng), AC-T2.12 (4.555.555).
- **Cách làm tròn không có mặc định:** ô để trống, bắt buộc chọn (DF-22).
- **Tài sản quỹ** = số dư tài khoản theo sổ + gốc đang gửi. Không có chỗ nào cộng gốc vào "số dư tài khoản".
- **Ghi nhận gửi tiền** dùng chung luật không âm, chạy trong cùng giao dịch, có khóa.
- Ghi tên tệp migration vào bằng chứng.

**Khi SPEC chưa rõ:** chỉ hỏi PM/BA nếu câu trả lời có thể đổi ý định nghiệp vụ. Còn lại cứ tự quyết và ghi vào phần bằng chứng.

## Bằng chứng triển khai (dev-build)

_(dev-build điền: commit, migration, quyết định, bảng AC → bằng chứng, test đã chạy.)_
