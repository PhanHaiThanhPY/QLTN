import { useState } from 'react';
import { AttachmentList } from '@/components/common/AttachmentList';
import { InfoGrid } from '@/components/common/InfoGrid';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { formatRate, parseRate, termInterest, type DayBasis } from '@/domain/deposit';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listBanks, type InvitationDetail, type Offer, type PaymentUnit } from '@/services/deposit-api';
import { formatVndText } from '@/utils/money';
import { formatVnDateTime, fromVnLocalInput, toVnLocalInput } from '@/features/exploitation/exploitation-ui';
import { paymentText, rateText } from '../deposit-ui';
import { DepositFileField } from './DepositFileField';

interface OfferDialogProps {
  detail: InvitationDetail;
  /** An offer to read (and edit with "Sửa" when `canEdit`); none to record a new one. */
  offer?: Offer;
  canEdit: boolean;
  onClose: () => void;
}

const nowLocal = (): string => toVnLocalInput(new Date().toISOString());

/** "Ghi nhận bản chào" (SPEC T-S1 BR-T1-06, BR-T1-07, ui-brief §2.2): the rate is checked as typed and previewed. */
export const OfferDialog = ({ detail, offer, canEdit, onClose }: OfferDialogProps) => {
  const [editing, setEditing] = useState(!offer);
  const command = useCommand({ successMessage: offer ? 'Đã lưu bản chào.' : 'Đã ghi nhận bản chào.' });
  const banks = useServiceQuery(['deposit', 'banks', 'active'], () => listBanks());
  const { invitation } = detail;
  const [bankId, setBankId] = useState(offer?.bankId ?? detail.invitees.find((bank) => !bank.offerId)?.id ?? '');
  const [receivedAt, setReceivedAt] = useState(offer ? toVnLocalInput(offer.receivedAt) : nowLocal());
  const [rate, setRate] = useState(offer ? formatRate(offer.rateMilli) : '');
  const [basis, setBasis] = useState(offer ? String(offer.dayBasis) : '');
  const [kind, setKind] = useState(offer?.paymentKind ?? 'END');
  const [every, setEvery] = useState(String(offer?.paymentEvery ?? ''));
  const [unit, setUnit] = useState<PaymentUnit>(offer?.paymentUnit ?? 'MONTH');
  const [conditions, setConditions] = useState(offer?.conditions ?? '');
  const [complete, setComplete] = useState(offer?.completeness ?? 'COMPLETE');
  const [missing, setMissing] = useState(offer?.missingNote ?? '');
  const [outsideReason, setOutsideReason] = useState(offer?.outsideReason ?? '');
  const [file, setFile] = useState<Attachment | null>(offer ? (detail.files[offer.attachmentId] ?? null) : null);
  const errors = command.fieldErrors;
  const rateMilli = parseRate(rate);
  const rateError = rate && rateMilli === null ? 'Lãi suất lớn hơn 0 và không quá 30 %/năm, tối đa 3 chữ số thập phân.' : undefined;
  const dayBasis: DayBasis | null = basis === '360' || basis === '365' ? Number(basis) as DayBasis : null;
  const outside = Boolean(bankId) && !invitation.inviteeIds.includes(bankId);
  const preview =
    rateMilli !== null && dayBasis
      ? `Lãi cả kỳ để so sánh: ${formatVndText(termInterest(BigInt(invitation.amountVnd), rateMilli, invitation.termDays, dayBasis).toString())} (${formatVndText(invitation.amountVnd)} × ${formatRate(rateMilli)}% × ${invitation.termDays} ÷ ${dayBasis})`
      : null;
  const late = Boolean(invitation.deadlineAt && receivedAt && fromVnLocalInput(receivedAt) && new Date(fromVnLocalInput(receivedAt) ?? '').getTime() > new Date(invitation.deadlineAt).getTime());
  const bankChoices = (banks.data ?? []).filter((bank) => !detail.offers.some((row) => row.bankId === bank.id) || bank.id === offer?.bankId);
  const ready =
    Boolean(bankId) &&
    Boolean(receivedAt) &&
    rateMilli !== null &&
    dayBasis !== null &&
    Boolean(file) &&
    (kind === 'END' || Number(every) > 0) &&
    (complete === 'COMPLETE' || missing.trim().length > 0) &&
    (!outside || outsideReason.trim().length >= 10);
  const submit = async () => {
    const payload = {
      receivedAt: fromVnLocalInput(receivedAt),
      rate,
      dayBasis,
      paymentKind: kind,
      paymentEvery: kind === 'PERIODIC' ? Number(every) : null,
      paymentUnit: kind === 'PERIODIC' ? unit : null,
      conditions: conditions.trim() || null,
      attachmentId: file?.id,
      completeness: complete,
      missingNote: complete === 'INCOMPLETE' ? missing.trim() : null,
      outsideReason: outside ? outsideReason.trim() : null,
    };
    const result = await command.execute(
      offer
        ? { subjectType: 'DEPOSIT_INVITATION', subjectId: offer.id, expectedVersion: offer.version, action: 'updateDepositOffer', payload }
        : { subjectType: 'DEPOSIT_INVITATION', subjectId: invitation.id, action: 'recordDepositOffer', payload: { ...payload, bankId } },
    );
    if (result) onClose();
  };
  const bankName = detail.banks[bankId]?.name ?? '';
  if (offer && !editing) {
    const view = detail.comparison.rows.find((row) => row.offerId === offer.id);
    return (
      <Dialog
        open
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={`Bản chào · ${bankName}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            {canEdit ? <Button onClick={() => setEditing(true)}>Sửa</Button> : null}
          </>
        }
      >
        <div className="space-y-3">
          <p className="flex flex-wrap gap-1.5">
            <StatusPill tone={offer.completeness === 'COMPLETE' ? 'good' : 'warn'}>{offer.completeness === 'COMPLETE' ? 'Đủ hồ sơ' : 'Thiếu'}</StatusPill>
            {offer.isLate ? <StatusPill tone="crit">Trễ hạn</StatusPill> : null}
            {offer.outside ? <StatusPill tone="info">Ngoài danh sách mời</StatusPill> : null}
          </p>
          <InfoGrid
            items={[
              { label: 'Thời điểm nhận', value: formatVnDateTime(offer.receivedAt) },
              { label: 'Lãi suất', value: rateText(offer.rateMilli) },
              { label: 'Cơ sở tính ngày', value: `${offer.dayBasis} ngày/năm` },
              { label: 'Cách trả lãi', value: paymentText(offer) },
              { label: 'Lãi cả kỳ', value: formatVndText(view?.interestVnd ?? offer.interestVnd) },
              { label: 'Hồ sơ', value: offer.missingNote ? `Thiếu: ${offer.missingNote}` : 'Đủ hồ sơ' },
            ]}
          />
          {offer.conditions ? <p className="text-sm text-ink-2">Điều kiện kèm theo: {offer.conditions}</p> : null}
          {offer.outsideReason ? <p className="text-sm text-ink-2">Lý do ngoài danh sách: {offer.outsideReason}</p> : null}
          <AttachmentList attachments={file ? [file] : []} emptyText="Không có tệp." />
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={offer ? `Sửa bản chào · ${bankName}` : `Ghi nhận bản chào · ${invitation.code}`}
      description={`Cùng điều kiện: ${formatVndText(invitation.amountVnd)} · ${invitation.termDays} ngày.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!ready} onClick={() => void submit()}>
            {offer ? 'Lưu' : 'Ghi nhận bản chào'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ngân hàng" htmlFor="of-bank" required error={errors.bankId}>
          <NativeSelect id="of-bank" value={bankId} disabled={Boolean(offer)} onChange={(event) => setBankId(event.target.value)}>
            <option value="">Chọn ngân hàng</option>
            {bankChoices.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
                {invitation.inviteeIds.includes(bank.id) ? '' : ' (ngoài danh sách mời)'}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Thời điểm nhận (giờ Việt Nam)" htmlFor="of-received" required error={errors.receivedAt} hint={late ? 'Sau hạn phản hồi: bản chào sẽ có cờ "Trễ hạn".' : undefined}>
          <Input id="of-received" type="datetime-local" max={nowLocal()} value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
        </Field>
        {outside ? (
          <div className="sm:col-span-2">
            <Field label="Lý do nhận bản chào ngoài danh sách mời" htmlFor="of-outside" required error={errors.outsideReason} hint="Tối thiểu 10 ký tự.">
              <Textarea id="of-outside" rows={2} value={outsideReason} onChange={(event) => setOutsideReason(event.target.value)} />
            </Field>
          </div>
        ) : null}
        <Field label="Lãi suất (%/năm)" htmlFor="of-rate" required error={errors.rate ?? rateError} hint="Tối đa 3 chữ số thập phân, ví dụ 5,875.">
          <Input id="of-rate" inputMode="decimal" value={rate} aria-invalid={Boolean(errors.rate ?? rateError)} onChange={(event) => setRate(event.target.value)} />
        </Field>
        <Field label="Cơ sở tính ngày" htmlFor="of-basis" required error={errors.dayBasis} hint="Theo đúng bản chào; không có mặc định.">
          <NativeSelect id="of-basis" value={basis} onChange={(event) => setBasis(event.target.value)}>
            <option value="">Chọn 360 hoặc 365</option>
            <option value="360">360 ngày/năm</option>
            <option value="365">365 ngày/năm</option>
          </NativeSelect>
        </Field>
        {preview ? (
          <p className="text-sm text-ink-2 sm:col-span-2" role="status">
            {preview}
          </p>
        ) : null}
        <Field label="Cách trả lãi" htmlFor="of-kind" required>
          <NativeSelect id="of-kind" value={kind} onChange={(event) => setKind(event.target.value === 'PERIODIC' ? 'PERIODIC' : 'END')}>
            <option value="END">Cuối kỳ</option>
            <option value="PERIODIC">Định kỳ</option>
          </NativeSelect>
        </Field>
        {kind === 'PERIODIC' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mỗi" htmlFor="of-every" required error={errors.paymentEvery}>
              <Input id="of-every" inputMode="numeric" value={every} onChange={(event) => setEvery(event.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Đơn vị" htmlFor="of-unit">
              <NativeSelect id="of-unit" value={unit} onChange={(event) => setUnit(event.target.value === 'DAY' ? 'DAY' : 'MONTH')}>
                <option value="MONTH">tháng</option>
                <option value="DAY">ngày</option>
              </NativeSelect>
            </Field>
          </div>
        ) : (
          <div />
        )}
        <Field label="Tình trạng hồ sơ" htmlFor="of-complete" required>
          <NativeSelect id="of-complete" value={complete} onChange={(event) => setComplete(event.target.value === 'INCOMPLETE' ? 'INCOMPLETE' : 'COMPLETE')}>
            <option value="COMPLETE">Đủ hồ sơ</option>
            <option value="INCOMPLETE">Thiếu</option>
          </NativeSelect>
        </Field>
        {complete === 'INCOMPLETE' ? (
          <Field label="Còn thiếu" htmlFor="of-missing" required error={errors.missingNote}>
            <Input id="of-missing" value={missing} onChange={(event) => setMissing(event.target.value)} />
          </Field>
        ) : (
          <div />
        )}
        <div className="sm:col-span-2">
          <Field label="Điều kiện kèm theo" htmlFor="of-conditions" error={errors.conditions}>
            <Textarea id="of-conditions" rows={2} maxLength={2000} value={conditions} onChange={(event) => setConditions(event.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <DepositFileField invitationId={invitation.id} purpose="DEPOSIT_OFFER" label="Tệp bản chào" required file={file} onChange={setFile} error={errors.attachmentId} />
        </div>
      </div>
    </Dialog>
  );
};
