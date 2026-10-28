import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { DepositSelection, InvitationDetail } from '@/services/deposit-api';
import { formatVndText } from '@/utils/money';
import { ComparisonCards } from './ComparisonCards';
import { DepositFileField } from './DepositFileField';

const BASIS_MIN = 20;
const REASON_MIN = 10;

interface ProposeSelectionDialogProps {
  detail: InvitationDetail;
  /** "Gửi lại" a result sent back, or "Đổi kết quả" of an approved one; none for a first proposal. */
  selection?: DepositSelection;
  mode: 'propose' | 'resubmit' | 'change';
  onClose: () => void;
}

const TITLE = { propose: 'Lập đề xuất kết quả', resubmit: 'Gửi lại kết quả', change: 'Đề xuất đổi kết quả' } as const;
const ACTION = { propose: 'proposeDepositSelection', resubmit: 'resubmitDepositSelection', change: 'proposeDepositSelectionChange' } as const;

/**
 * "Lập đề xuất kết quả" (SPEC T-S1 BR-T1-09, D-T1-2, ui-brief §2.3): pick a complete offer (or "Không chọn được ngân
 * hàng"), with minutes and basis; not the highest, or late, each asks for its own reason before it can be sent.
 */
export const ProposeSelectionDialog = ({ detail, selection, mode, onClose }: ProposeSelectionDialogProps) => {
  const command = useCommand({ successMessage: 'Đã gửi kết quả chờ BQT duyệt.' });
  const { comparison, invitation } = detail;
  const keep = mode === 'resubmit' ? selection : undefined;
  const [kind, setKind] = useState<'BANK' | 'NONE'>(keep?.kind ?? 'BANK');
  const [offerId, setOfferId] = useState<string | null>(keep?.offerId ?? null);
  const [minutes, setMinutes] = useState<Attachment | null>(keep ? (detail.files[keep.minutesAttachmentId] ?? null) : null);
  const [basis, setBasis] = useState(keep?.basis ?? '');
  const [notHighest, setNotHighest] = useState(keep?.notHighestReason ?? '');
  const [late, setLate] = useState(keep?.lateReason ?? '');
  const [changeReason, setChangeReason] = useState('');
  const errors = command.fieldErrors;
  const picked = comparison.rows.find((row) => row.offerId === offerId);
  const highest = comparison.rows.find((row) => row.offerId === comparison.highestOfferId);
  const needsNotHighest = kind === 'BANK' && Boolean(picked) && picked?.offerId !== comparison.highestOfferId;
  const needsLate = kind === 'BANK' && Boolean(picked?.isLate);
  const ready =
    Boolean(minutes) &&
    basis.trim().length >= BASIS_MIN &&
    (kind === 'NONE' || Boolean(picked)) &&
    (!needsNotHighest || notHighest.trim().length >= BASIS_MIN) &&
    (!needsLate || late.trim().length >= REASON_MIN) &&
    (mode !== 'change' || changeReason.trim().length >= BASIS_MIN);
  const submit = async () => {
    const payload = {
      kind,
      offerId: kind === 'BANK' ? offerId : null,
      minutesAttachmentId: minutes?.id,
      basis: basis.trim(),
      notHighestReason: needsNotHighest ? notHighest.trim() : null,
      lateReason: needsLate ? late.trim() : null,
      ...(mode === 'change' ? { changeReason: changeReason.trim() } : {}),
    };
    const result = await command.execute(
      selection
        ? { subjectType: 'DEPOSIT_SELECTION', subjectId: selection.id, expectedVersion: selection.version, action: ACTION[mode], payload }
        : { subjectType: 'DEPOSIT_INVITATION', subjectId: invitation.id, action: ACTION.propose, payload },
    );
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`${TITLE[mode]} · ${invitation.code}`}
      description="Bảng so sánh được lưu lại lúc gửi duyệt."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!ready} onClick={() => void submit()}>
            Gửi duyệt
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">Loại kết quả</legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="sel-kind" className="accent-accent" checked={kind === 'BANK'} onChange={() => setKind('BANK')} />
            Chọn một ngân hàng
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="sel-kind" className="accent-accent" checked={kind === 'NONE'} onChange={() => setKind('NONE')} />
            Không chọn được ngân hàng
          </label>
        </fieldset>
        {kind === 'BANK' ? (
          <>
            <ComparisonCards
              rows={comparison.rows}
              amountVnd={comparison.amountVnd}
              termDays={comparison.termDays}
              mixedBasis={comparison.mixedBasis}
              pick={{ value: offerId, onChange: setOfferId }}
              compact
            />
            {errors.offerId ? <p className="text-sm text-crit" role="alert">{errors.offerId}</p> : null}
          </>
        ) : null}
        {needsNotHighest && highest ? (
          <>
            <Notice tone="warning">
              Không phải bản chào có lãi cả kỳ cao nhất (cao nhất: {highest.bankName} · {formatVndText(highest.interestVnd)}).
            </Notice>
            <Field label="Lý do không chọn bản có lãi cao nhất" htmlFor="sel-not-highest" required error={errors.notHighestReason} hint={`Tối thiểu ${BASIS_MIN} ký tự.`}>
              <Textarea id="sel-not-highest" rows={2} value={notHighest} onChange={(event) => setNotHighest(event.target.value)} />
            </Field>
          </>
        ) : null}
        {needsLate ? (
          <Field label="Lý do xét bản chào trễ hạn" htmlFor="sel-late" required error={errors.lateReason} hint={`Tối thiểu ${REASON_MIN} ký tự.`}>
            <Textarea id="sel-late" rows={2} value={late} onChange={(event) => setLate(event.target.value)} />
          </Field>
        ) : null}
        <DepositFileField invitationId={invitation.id} purpose="DEPOSIT_SELECTION_MINUTES" label="Biên bản" required file={minutes} onChange={setMinutes} error={errors.minutesAttachmentId} />
        <Field label="Căn cứ" htmlFor="sel-basis" required error={errors.basis} hint={`Tối thiểu ${BASIS_MIN} ký tự.`}>
          <Textarea id="sel-basis" rows={3} value={basis} onChange={(event) => setBasis(event.target.value)} />
        </Field>
        {mode === 'change' ? (
          <Field label="Lý do đổi kết quả đã duyệt" htmlFor="sel-change" required error={errors.changeReason} hint={`Tối thiểu ${BASIS_MIN} ký tự.`}>
            <Textarea id="sel-change" rows={2} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
};
