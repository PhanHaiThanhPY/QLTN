import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { Voucher, VoucherCategory } from '@/services/fund-api';
import { digitsOf, groupDigits } from '../fund-input';
import { TARGET_FUND_TEXT, VOUCHER_CATEGORY_TEXT } from '../fund-ui';
import { FundFileField } from './FundFileField';

/** A deposit refund is drafted from the contract's "Thanh lý" tab only (BR-F5-11). */
const CATEGORIES = (Object.entries(VOUCHER_CATEGORY_TEXT) as Array<[VoucherCategory, string]>).filter(([key]) => key !== 'DEPOSIT_REFUND');
const isCategory = (value: string): value is VoucherCategory => CATEGORIES.some(([key]) => key === value);
const CONTENT_MIN = 10;

interface VoucherFormDialogProps {
  fundId: string;
  /** Editing a draft or a voucher sent back. */
  voucher?: Voucher;
  /** The request file already on the voucher being edited. */
  requestFile?: Attachment | null;
  /** F-S5 BR-F5-11: a "Hoàn cọc" voucher for this contract, within the deposit still held. */
  refund?: { contractId: string; contractCode: string; payeeName: string; maxVnd: string };
  onClose: () => void;
}

/** BR-F3-12: Kế toán drafts a voucher; a transfer names the receiving fund (D-F3-4). */
export const VoucherFormDialog = ({ fundId, voucher, requestFile = null, refund, onClose }: VoucherFormDialogProps) => {
  const navigate = useNavigate();
  const command = useCommand({ successMessage: voucher ? 'Đã lưu phiếu chi.' : 'Đã lập phiếu chi nháp.' });
  const [category, setCategory] = useState<VoucherCategory>(voucher?.category ?? (refund ? 'DEPOSIT_REFUND' : 'SERVICE'));
  const contractId = refund?.contractId ?? voucher?.contractId ?? null;
  const [target, setTarget] = useState(voucher?.targetFundKind ?? '');
  const [content, setContent] = useState(voucher?.content ?? (refund ? `Hoàn cọc còn lại ${refund.contractCode}` : ''));
  const [payeeName, setPayeeName] = useState(voucher?.payeeName ?? refund?.payeeName ?? '');
  const [payeeAccount, setPayeeAccount] = useState(voucher?.payeeAccount ?? '');
  const [amount, setAmount] = useState(groupDigits(voucher?.amountVnd ?? refund?.maxVnd));
  const [file, setFile] = useState<Attachment | null>(requestFile);
  const errors = command.fieldErrors;
  const ready =
    content.trim().length >= CONTENT_MIN && Boolean(payeeName.trim()) && Boolean(digitsOf(amount)) && Boolean(file) && (category !== 'TRANSFER' || Boolean(target));
  const newTitle = refund ? `Lập phiếu hoàn cọc · ${refund.contractCode}` : 'Lập phiếu chi';
  const title = voucher ? `Sửa ${voucher.code}` : newTitle;
  const submit = async () => {
    const payload = {
      category,
      targetFundKind: category === 'TRANSFER' ? target : null,
      contractId: category === 'DEPOSIT_REFUND' ? contractId : null,
      content: content.trim(),
      payeeName: payeeName.trim(),
      payeeAccount: payeeAccount.trim() || null,
      amountVnd: digitsOf(amount),
      requestAttachmentId: file?.id,
    };
    const result = await command.execute(
      voucher
        ? { subjectType: 'FUND_VOUCHER', subjectId: voucher.id, expectedVersion: voucher.version, action: 'updateFundVoucher', payload }
        : { subjectType: 'FUND_VOUCHER', subjectId: fundId, action: 'createFundVoucher', payload },
    );
    if (!result) return;
    onClose();
    if (!voucher && result.subjectId) navigate(`/exploitation/vouchers/${result.subjectId}`);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!ready} onClick={() => void submit()}>
            {voucher ? 'Lưu' : 'Lập phiếu chi'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {category === 'DEPOSIT_REFUND' ? (
          <p className="text-sm text-ink-2 sm:col-span-2">
            Nhóm chi: {VOUCHER_CATEGORY_TEXT.DEPOSIT_REFUND}
            {refund ? ` · tối đa ${groupDigits(refund.maxVnd)} đ (cọc đang giữ)` : ''}
          </p>
        ) : (
          <Field label="Nhóm chi" htmlFor="pc-category" required error={errors.category}>
            <NativeSelect id="pc-category" value={category} onChange={(event) => (isCategory(event.target.value) ? setCategory(event.target.value) : undefined)}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {category === 'TRANSFER' ? (
          <Field label="Quỹ nhận" htmlFor="pc-target" required error={errors.targetFundKind} hint="Phía nhận ghi khi có quỹ bảo trì trên hệ thống.">
            <NativeSelect id="pc-target" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Chọn quỹ nhận</option>
              <option value="BAO_TRI">{TARGET_FUND_TEXT.BAO_TRI}</option>
            </NativeSelect>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Nội dung" htmlFor="pc-content" required error={errors.content} hint={`Tối thiểu ${CONTENT_MIN} ký tự.`}>
            <Textarea id="pc-content" rows={2} value={content} onChange={(event) => setContent(event.target.value)} />
          </Field>
        </div>
        <Field label="Người nhận tiền" htmlFor="pc-payee" required error={errors.payeeName}>
          <Input id="pc-payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
        </Field>
        <Field label="Số tài khoản người nhận" htmlFor="pc-account" error={errors.payeeAccount}>
          <Input id="pc-account" value={payeeAccount} onChange={(event) => setPayeeAccount(event.target.value)} />
        </Field>
        <Field label="Số tiền (VND)" htmlFor="pc-amount" required error={errors.amountVnd}>
          <MoneyInput id="pc-amount" value={amount} onChange={setAmount} invalid={Boolean(errors.amountVnd)} />
        </Field>
        <div className="sm:col-span-2">
          <FundFileField fundId={fundId} purpose="VOUCHER_REQUEST" label="Đề nghị chi" required file={file} onChange={setFile} error={errors.requestAttachmentId} />
        </div>
      </div>
    </Dialog>
  );
};
