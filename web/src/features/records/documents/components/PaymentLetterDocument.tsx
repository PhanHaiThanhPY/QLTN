import { DOTS } from '../print-format';
import { LETTER_OPENING, type PaymentLetterModel } from '../payment-letter-model';
import { CheckLine } from './CheckLine';
import { SignatureBox } from './SignatureBox';

/** The payment letter (`BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`) for one instalment (SPEC B7-S1 §3.3, ui-brief §2.5). */
export const PaymentLetterDocument = ({ model }: { model: PaymentLetterModel }) => (
  <>
    <p className="d5-heading">Ban quản lý {DOTS}</p>
    <h1 id="d5-title">Thư đề nghị</h1>
    <p style={{ textAlign: 'center' }}>V/v: Chuyển khoản thanh toán cho Nhà thầu bảo trì/sửa chữa</p>
    <p>Kính gửi: {model.recipient}</p>
    <p>{LETTER_OPENING}</p>
    <p>1. Người hưởng:</p>
    <p>Tên tài khoản: {model.payeeName}</p>
    <p>
      Số tài khoản: {model.accountNo} · Ngân hàng: {model.bankName}
    </p>
    <p>
      Số tiền: {model.amount} VNĐ (Bằng chữ: {model.amountInWords})
    </p>
    {model.computation ? <p className="d5-small">{model.computation}</p> : null}
    <p>2. Nội dung: {model.transferContent}</p>
    <p>3. Bộ hồ sơ đính kèm:</p>
    {model.attachments.map((row) => (
      <CheckLine key={row.label} label={row.label} isChecked={row.isPresent} />
    ))}
    <p>4. Ghi chú (nếu có): {DOTS}</p>
    <p>Trân trọng,</p>
    <div className="d5-sign-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div />
      <SignatureBox heading={['Đại diện Ban quản lý']} signature={model.managerSignature} />
    </div>
  </>
);
